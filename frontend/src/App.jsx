import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { useWebSocket } from './hooks/useWebSocket';
import { usePotholes } from './hooks/usePotholes';
import { useState, useEffect } from 'react';

import Sidebar from './components/Layout/Sidebar';
import Header from './components/Layout/Header';
import AlertBanner from './components/Alerts/AlertBanner';

import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';

import DashboardPage from './pages/DashboardPage';
import UserDashboard from './pages/UserDashboard';
import MapPage from './pages/MapPage';
import AnalyticsPage from './pages/AnalyticsPage';
import AdminPage from './pages/AdminPage';
import LiveFeedPage from './pages/LiveFeedPage';
import DetectionsPage from './pages/DetectionsPage';
import SettingsPage from './pages/SettingsPage';
import ReportsPage from './pages/ReportsPage';
import AccessPage from './pages/AccessPage';
import { useNearbyAlerts } from './hooks/useNearbyAlerts';

function AppContent() {
  const { user, loading } = useAuth();
  const { isConnected, lastSensorData, lastAlert, notifications, clearNotifications, on } = useWebSocket(user);
  
  // Pass user's state and district to the potholes hook so it can filter
  const { potholes, refetch, addPothole, updatePothole } = usePotholes({ state: user?.state, district: user?.district });
  
  const [currentAlert, setCurrentAlert] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Initialize background push notifications for citizens
  useNearbyAlerts(potholes, user?.role, (msg) => {
    setCurrentAlert({ message: msg });
  });

  // Bridge iframe proximity alerts into React Bell Icon and ServiceWorker Notifications
  useEffect(() => {
    const handleMessage = (e) => {
      if (e.data && e.data.type === 'POTHOLE_PROXIMITY') {
        const msg = e.data.msg;
        const severity = e.data.severity || 'high';
        
        // 1. Native React Alert Banner
        setCurrentAlert({ message: msg });

        // 2. Dispatch to Bell Icon Notification Dropdown
        const notif = {
          message: msg,
          severity: severity,
          source: 'esp32_sensor',
          timestamp: new Date().toISOString()
        };
        window.dispatchEvent(new CustomEvent('localNotification', { detail: notif }));

        // 3. Dispatch Hardware Notification via ServiceWorker (mobile/minimized compatible)
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.ready.then(reg => {
            reg.showNotification("⚠️ POTHOLE NEARBY ZONE ⚠️", {
              body: msg,
              icon: "/vite.svg",
              vibrate: [200, 100, 200, 100, 200, 100, 200],
              tag: "proximity-alert",
              renotify: true
            });
          });
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // If auth is still initializing, don't flash login
  if (loading) return <div className="h-screen flex items-center justify-center bg-dark-950 text-white">Loading...</div>;

  // If no user session, render the Login Page
  if (!user) return <LoginPage />;


  // Listen for WebSocket events
  on('onNewPothole', (data) => {
    // Filter out data outside user's jurisdiction
    if (user?.state && data.state && user.state !== data.state) return;
    if (user?.district && data.district && user.district !== data.district) return;

    addPothole(data);
    setCurrentAlert({ message: `New ${data.severity} pothole detected at ${data.roadName || 'unknown location'}` });
  });

  on('onPotholeUpdated', (data) => {
    updatePothole(data);
  });

  return (
    <div className="flex h-screen bg-dark-950 dark:bg-dark-950 text-white overflow-hidden">
      {/* Alert Banner */}
      <AlertBanner alert={currentAlert} onDismiss={() => setCurrentAlert(null)} />

      {/* Sidebar */}
      <Sidebar 
        unreadAlerts={notifications.length} 
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header 
          isConnected={isConnected}
          notifications={notifications}
          onClearNotifications={clearNotifications}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          userSession={user}
        />

        <main className="flex-1 overflow-y-auto p-4 md:p-6 relative">
          <Routes>
            {user.role === 'user' ? (
              <>
                <Route path="/" element={<UserDashboard potholes={potholes} />} />
                <Route path="/settings" element={<SettingsPage />} />
                {/* Fallback to dashboard if navigating anywhere else */}
                <Route path="*" element={<UserDashboard potholes={potholes} />} />
              </>
            ) : (
              <>
                <Route path="/" element={<DashboardPage potholes={potholes} />} />
                <Route path="/map" element={<MapPage />} />
                <Route path="/detections" element={<DetectionsPage />} />
                <Route path="/live" element={<LiveFeedPage potholes={potholes} lastSensorData={lastSensorData} isConnected={isConnected} />} />
                <Route path="/analytics" element={<AnalyticsPage />} />
                <Route path="/admin" element={<AdminPage potholes={potholes} onRefresh={refetch} />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/reports" element={<ReportsPage />} />
                {user.superadmin && <Route path="/access" element={<AccessPage />} />}
              </>
            )}
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <AppContent />
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}
