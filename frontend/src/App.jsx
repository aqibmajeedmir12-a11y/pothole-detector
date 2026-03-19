import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { useWebSocket } from './hooks/useWebSocket';
import { usePotholes } from './hooks/usePotholes';
import { useState } from 'react';

import Sidebar from './components/Layout/Sidebar';
import Header from './components/Layout/Header';
import AlertBanner from './components/Alerts/AlertBanner';

import DashboardPage from './pages/DashboardPage';
import MapPage from './pages/MapPage';
import AnalyticsPage from './pages/AnalyticsPage';
import AdminPage from './pages/AdminPage';
import LiveFeedPage from './pages/LiveFeedPage';
import DetectionsPage from './pages/DetectionsPage';
import SettingsPage from './pages/SettingsPage';
import ReportsPage from './pages/ReportsPage';

function AppContent() {
  const { isConnected, lastSensorData, lastAlert, notifications, clearNotifications, on } = useWebSocket();
  const { potholes, refetch, addPothole, updatePothole } = usePotholes();
  const [currentAlert, setCurrentAlert] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Listen for WebSocket events
  on('onNewPothole', (data) => {
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
        />

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Routes>
            <Route path="/" element={<DashboardPage potholes={potholes} />} />
            <Route path="/map" element={<MapPage />} />
            <Route path="/detections" element={<DetectionsPage />} />
            <Route path="/live" element={<LiveFeedPage potholes={potholes} lastSensorData={lastSensorData} isConnected={isConnected} />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/admin" element={<AdminPage potholes={potholes} onRefresh={refetch} />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/reports" element={<ReportsPage />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <Router>
        <AppContent />
      </Router>
    </ThemeProvider>
  );
}
