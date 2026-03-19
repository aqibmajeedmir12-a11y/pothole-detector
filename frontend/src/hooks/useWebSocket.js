import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:5000';

export function useWebSocket() {
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
      setLastPothole(data);
      if (listenersRef.current.onNewPothole) {
        listenersRef.current.onNewPothole(data);
      }
    });

    socket.on('potholeUpdated', (data) => {
      if (listenersRef.current.onPotholeUpdated) {
        listenersRef.current.onPotholeUpdated(data);
      }
    });

    socket.on('sensorData', (data) => {
      setLastSensorData(data);
      if (listenersRef.current.onSensorData) {
        listenersRef.current.onSensorData(data);
      }
    });

    socket.on('newAlert', (data) => {
      setLastAlert(data);
      setNotifications(prev => [data, ...prev].slice(0, 20));
      if (listenersRef.current.onNewAlert) {
        listenersRef.current.onNewAlert(data);
      }
    });

    socket.on('notification', (data) => {
      setNotifications(prev => [data, ...prev].slice(0, 20));
    });

    return () => {
      socket.disconnect();
    };
  }, []);

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
