import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

// If VITE_WS_URL isn't set, default to the API URL (helpful for Render/Vercel deployments)
const WS_URL = import.meta.env.VITE_WS_URL || import.meta.env.VITE_API_URL || 'http://localhost:5000';

// ── Helper: fire desktop notification + Service Worker push for Admin/Super Admin ──
function fireAdminDesktopNotification(title, body, severity) {
  // 1. Play alert sound
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = severity === 'critical' ? 1000 : 880;
    osc.type = 'sine';
    gain.gain.value = 0.18;
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.stop(ctx.currentTime + 0.5);
  } catch (_) { /* audio not supported */ }

  // 2. Browser Notification API (works even when tab is not focused)
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body,
        icon: '/vite.svg',
        tag: 'admin-pothole-alert',
        renotify: true,
      });
    } catch (_) { /* fallback below */ }
  }

  // 3. Service Worker push notification (works even when browser is minimized)
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.ready.then(reg => {
      reg.showNotification(title, {
        body,
        icon: '/vite.svg',
        vibrate: [200, 100, 200, 100, 200],
        tag: 'admin-pothole-alert',
        renotify: true,
      });
    }).catch(() => {});
  }
}

// ── Helper: fire citizen safety notification ──
function fireCitizenSafetyNotification(title, body) {
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body,
        icon: '/vite.svg',
        tag: 'citizen-safety-alert',
        renotify: true,
      });
    } catch (_) { /* ignore */ }
  }

  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.ready.then(reg => {
      reg.showNotification(title, {
        body,
        icon: '/vite.svg',
        vibrate: [200, 100, 200],
        tag: 'citizen-safety-alert',
        renotify: true,
      });
    }).catch(() => {});
  }
}

export function useWebSocket(user) {
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastPothole, setLastPothole] = useState(null);
  const [lastSensorData, setLastSensorData] = useState(null);
  const [lastAlert, setLastAlert] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const listenersRef = useRef({});

  useEffect(() => {
    // Request notification permission
    if (user && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    const socket = io(WS_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('🔌 WebSocket connected');
      setIsConnected(true);

      // Register user with server so it assigns us to the right rooms
      if (user) {
        socket.emit('registerUser', {
          role: user.role,
          state: user.state || '',
          district: user.district || '',
          superadmin: !!user.superadmin,
        });
        console.log(`📡 Registered as ${user.superadmin ? 'superadmin' : user.role} (${user.state || 'all'} / ${user.district || 'all'})`);
      }
    });

    socket.on('disconnect', () => {
      console.log('❌ WebSocket disconnected');
      setIsConnected(false);
    });

    // ── Admin/SuperAdmin: New pothole detected (server already filtered by room) ──
    socket.on('newPothole', (data) => {
      setLastPothole(data);

      if (listenersRef.current.onNewPothole) {
        listenersRef.current.onNewPothole(data);
      }
    });

    // ── Admin/SuperAdmin: Pothole updated (server already filtered by room) ──
    socket.on('potholeUpdated', (data) => {
      if (listenersRef.current.onPotholeUpdated) {
        listenersRef.current.onPotholeUpdated(data);
      }
    });

    // ── Admin/SuperAdmin: Sensor telemetry (server already filtered) ──
    socket.on('sensorData', (data) => {
      console.log('📡 sensorData received:', data);
      setLastSensorData(data);
      if (listenersRef.current.onSensorData) {
        listenersRef.current.onSensorData(data);
      }
    });

    // ── Admin/SuperAdmin: Bell icon alerts (server already filtered by room) ──
    socket.on('newAlert', (data) => {
      setLastAlert(data);
      setNotifications(prev => [data, ...prev].slice(0, 20));

      // Desktop notification
      const pothole = data.pothole || {};
      const severity = pothole.severity || 'medium';
      const msg = data.message || `New ${severity} pothole detected`;
      fireAdminDesktopNotification('🔔 Road Monitor Alert', msg, severity);

      if (listenersRef.current.onNewAlert) {
        listenersRef.current.onNewAlert(data);
      }
    });

    // ── Admin/SuperAdmin: Server-side notifications ──
    socket.on('notification', (data) => {
      setNotifications(prev => [data, ...prev].slice(0, 20));
    });

    // ── Citizen: Safety-focused alerts (only warnings, not raw detections) ──
    socket.on('citizenAlert', (data) => {
      console.log('🛡️ Citizen safety alert received:', data);

      // Add to bell icon notifications with citizen-friendly formatting
      const citizenNotif = {
        message: data.message,
        severity: data.severity || 'medium',
        source: 'safety_alert',
        timestamp: data.timestamp || new Date().toISOString(),
        type: data.type || 'warning',
      };

      setNotifications(prev => [citizenNotif, ...prev].slice(0, 20));
      setLastAlert(citizenNotif);

      // Fire citizen desktop notification
      fireCitizenSafetyNotification(
        data.title || '⚠️ Road Safety Alert',
        data.message
      );

      // Trigger banner alert in App.jsx
      if (listenersRef.current.onCitizenAlert) {
        listenersRef.current.onCitizenAlert(data);
      }
    });

    // ── Local notifications from iframe proximity (citizen only) ──
    const handleLocal = (e) => {
      setNotifications(prev => [e.detail, ...prev].slice(0, 20));
      setLastAlert(e.detail);
    };
    window.addEventListener('localNotification', handleLocal);

    return () => {
      socket.disconnect();
      window.removeEventListener('localNotification', handleLocal);
    };
  }, [user]);

  // When superadmin changes their filter, tell the server to update rooms
  useEffect(() => {
    if (socketRef.current && user?.superadmin) {
      socketRef.current.emit('updateFilter', {
        state: user.state || '',
        district: user.district || '',
      });
    }
  }, [user?.state, user?.district]);

  const on = useCallback((event, callback) => {
    listenersRef.current[event] = callback;
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  return {
    isConnected,
    lastPothole,
    lastSensorData,
    lastAlert,
    notifications,
    clearNotifications,
    on,
    socket: socketRef.current,
  };
}
