import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:5000';

export function useWebSocket(user) {
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastPothole, setLastPothole] = useState(null);
  const [lastSensorData, setLastSensorData] = useState(null);
  const [lastAlert, setLastAlert] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const listenersRef = useRef({});

  useEffect(() => {
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
         if (user.district && p.district && user.district !== p.district) return;
      }
      setLastAlert(data);
      setNotifications(prev => [data, ...prev].slice(0, 20));
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
