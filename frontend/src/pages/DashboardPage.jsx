import { useState, useEffect } from 'react';
import StatsCards from '../components/Dashboard/StatsCards';
import RecentDetections from '../components/Dashboard/RecentDetections';
import RoadHealthIndex from '../components/Dashboard/RoadHealthIndex';
import MapView from '../components/Map/MapView';
import { analyticsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function DashboardPage({ potholes }) {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      const response = await analyticsAPI.getStats({ state: user?.state, district: user?.district });
      setStats(response.data.data);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 10000); // Auto-refresh every 10s
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page title */}
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Real-time overview of road conditions</p>
      </div>

      {/* Stats */}
      <StatsCards stats={stats} />

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map preview */}
        <div className="lg:col-span-2 glass-card overflow-hidden" style={{ minHeight: '400px' }}>
          <div className="p-4 border-b border-white/5">
            <h3 className="text-sm font-semibold text-white">Pothole Map Overview</h3>
          </div>
          <div style={{ height: '350px' }}>
            <MapView potholes={potholes} showHeatmap={true} />
          </div>
        </div>

        {/* Road Health */}
        <RoadHealthIndex value={stats?.potholes?.roadHealthIndex || 0} />
      </div>

      {/* Recent detections */}
      <RecentDetections detections={stats?.potholes?.recentDetections || []} />
    </div>
  );
}
