import { useState, useEffect } from 'react';
import { VibrationChart, ConfidenceChart, FrequencyChart, SourceDistributionChart, RiskAreasTable } from '../components/Analytics/Charts';
import { analyticsAPI, sensorAPI } from '../services/api';
import { RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function AnalyticsPage() {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState(null);
  const [vibrationTrends, setVibrationTrends] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [analyticsRes, trendsRes] = await Promise.all([
        analyticsAPI.getStats({ state: user?.state, district: user?.district }),
        sensorAPI.getTrends(24),
      ]);
      setAnalytics(analyticsRes.data.data);
      setVibrationTrends(trendsRes.data.data || []);
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Analytics</h1>
          <p className="text-sm text-gray-500 mt-1">Data insights and trend analysis</p>
        </div>
        <button onClick={fetchData} disabled={loading} className="btn-secondary flex items-center gap-2 text-sm">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Summary cards */}
      {analytics && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="glass-card p-4 text-center">
            <p className="text-3xl font-bold text-white">{analytics.potholes?.total || 0}</p>
            <p className="text-xs text-gray-500 mt-1">Total Detections</p>
          </div>
          <div className="glass-card p-4 text-center">
            <p className="text-3xl font-bold text-green-400">{analytics.potholes?.repaired || 0}</p>
            <p className="text-xs text-gray-500 mt-1">Repaired</p>
          </div>
          <div className="glass-card p-4 text-center">
            <p className="text-3xl font-bold text-primary-400">{analytics.potholes?.todayDetections || 0}</p>
            <p className="text-xs text-gray-500 mt-1">Today's Detections</p>
          </div>
          <div className="glass-card p-4 text-center">
            <p className="text-3xl font-bold text-amber-400">{analytics.sensors?.activeDeviceCount || 0}</p>
            <p className="text-xs text-gray-500 mt-1">Active Sensors</p>
          </div>
        </div>
      )}

      {/* Charts - Row 1: AI Confidence + Detection Frequency */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ConfidenceChart data={analytics?.confidenceTrends || []} />
        <FrequencyChart data={analytics?.dailyFrequency || []} />
      </div>

      {/* Charts - Row 2: Vibration + Sources */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <VibrationChart data={vibrationTrends} />
        <SourceDistributionChart data={analytics?.sourceDistribution || []} />
      </div>

      {/* Risk Areas */}
      <RiskAreasTable areas={analytics?.riskAreas || []} />
    </div>
  );
}
