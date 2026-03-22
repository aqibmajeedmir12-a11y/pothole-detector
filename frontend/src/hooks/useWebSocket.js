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

export function useWebSocket(user) {
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastPothole, setLastPothole] = useState(null);
  const [lastSensorData, setLastSensorData] = useState(null);
  const [lastAlert, setLastAlert] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const listenersRef = useRef({});

  useEffect(() => {
    // Request notification permission for admin/super admin users
    if (user && user.role !== 'user' && 'Notification' in window && Notification.permission === 'default') {
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
    });

    socket.on('disconnect', () => {
      console.log('❌ WebSocket disconnected');
      setIsConnected(false);
    });

    socket.on('newPothole', (data) => {
      // Citizens should not receive detection events
      if (user?.role === 'user') return;

      if (user && !user.superadmin) {
        if (user.state && data.state && user.state !== data.state) return;
        if (user.district && data.district && user.district !== data.district) return;
      }
      setLastPothole(data);

      // ── Desktop notification for Admin / Super Admin ──
      const severity = data.severity || 'medium';
      const location = data.roadName || `${data.lat?.toFixed(5)}, ${data.lng?.toFixed(5)}`;
      const title = severity === 'critical'
        ? '🚨 CRITICAL POTHOLE DETECTED!'
        : '⚠️ New Pothole Detected';
      const body = `${severity.toUpperCase()} severity pothole at ${location}`;
      fireAdminDesktopNotification(title, body, severity);

      if (listenersRef.current.onNewPothole) {
        listenersRef.current.onNewPothole(data);
      }
    });

    socket.on('potholeUpdated', (data) => {
      if (user && !user.superadmin) {
        if (user.state && data.state && user.state !== data.state) return;
        if (user.district && data.district && user.district !== data.district) return;
      }
      if (listenersRef.current.onPotholeUpdated) {
        listenersRef.current.onPotholeUpdated(data);
      }
    });

    socket.on('sensorData', (data) => {
      // Sensor raw telemetry may not have explicit state/district attached yet on fast bursts
      // We will allow sensorData to flow, or if it has them, strict filter it:
      if (user && !user.superadmin && data.state && data.district) {
        if (user.state !== data.state) return;
        if (user.district !== data.district) return;
      }
      setLastSensorData(data);
      if (listenersRef.current.onSensorData) {
        listenersRef.current.onSensorData(data);
      }
    });

    socket.on('newAlert', (data) => {
      // Citizens should not receive detection alerts in the bell icon
      if (user?.role === 'user') return;

      // Filter jurisdictional boundary on global alerts (admin sees only their district)
      if (user && !user.superadmin) {
         const p = data.pothole || data;
         if (user.state && p.state && user.state !== p.state) return;
         if (user.district && p.district && p.district !== user.district) return;
      }
      setLastAlert(data);
      setNotifications(prev => [data, ...prev].slice(0, 20));

      // ── Desktop notification for Admin / Super Admin ──
      const pothole = data.pothole || {};
      const severity = pothole.severity || 'medium';
      const msg = data.message || `New ${severity} pothole detected`;
      fireAdminDesktopNotification('🔔 Road Monitor Alert', msg, severity);

      if (listenersRef.current.onNewAlert) {
        listenersRef.current.onNewAlert(data);
      }
    });

    socket.on('notification', (data) => {
      // Citizens should not receive server-side notifications in bell icon
      if (user?.role === 'user') return;
      setNotifications(prev => [data, ...prev].slice(0, 20));
    });

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
