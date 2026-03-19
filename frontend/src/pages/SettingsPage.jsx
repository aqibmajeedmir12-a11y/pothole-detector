import { useState, useEffect } from 'react';
import { Trash2, Database, RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react';

export default function SettingsPage() {
  const [dbStats, setDbStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [message, setMessage] = useState(null);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  const API_KEY = import.meta.env.VITE_API_KEY || 'dev-api-key-2024';

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/settings/db-stats`, {
        headers: { 'x-api-key': API_KEY }
      });
      const data = await res.json();
      if (data.success) setDbStats(data.data);
    } catch (err) {
      console.error('Failed to fetch DB stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const clearDatabase = async () => {
    try {
      setClearing(true);
      const res = await fetch(`${API_URL}/api/settings/clear-database`, {
        method: 'DELETE',
        headers: { 'x-api-key': API_KEY }
      });
      const data = await res.json();
      if (data.success) {
        setMessage({
          type: 'success',
          text: `Database cleared! Deleted ${data.deleted.potholes} potholes, ${data.deleted.sensorData} sensor records, ${data.deleted.alerts} alerts.`
        });
        // Also clear road_monitor localStorage
        try { localStorage.removeItem('sm_potholes_v2'); } catch(_) {}
        fetchStats();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to clear database' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to connect to server' });
    } finally {
      setClearing(false);
      setShowConfirm(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Manage application data and configuration</p>
      </div>

      {/* Status message */}
      {message && (
        <div className={`flex items-center gap-3 p-4 rounded-xl border ${
          message.type === 'success' 
            ? 'bg-green-500/10 border-green-500/30 text-green-400' 
            : 'bg-red-500/10 border-red-500/30 text-red-400'
        } animate-fade-in`}>
          {message.type === 'success' 
            ? <CheckCircle className="w-5 h-5 flex-shrink-0" /> 
            : <AlertTriangle className="w-5 h-5 flex-shrink-0" />}
          <p className="text-sm">{message.text}</p>
        </div>
      )}

      {/* Database Statistics */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Database className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Database Overview</h3>
              <p className="text-xs text-gray-500">Current data stored in SQLite</p>
            </div>
          </div>
          <button
            onClick={fetchStats}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium
              bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {dbStats ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white/5 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-white">{dbStats.potholes}</p>
              <p className="text-xs text-gray-500 mt-1">Potholes</p>
            </div>
            <div className="bg-white/5 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-white">{dbStats.sensorData}</p>
              <p className="text-xs text-gray-500 mt-1">Sensor Records</p>
            </div>
            <div className="bg-white/5 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-white">{dbStats.alerts}</p>
              <p className="text-xs text-gray-500 mt-1">Alerts</p>
            </div>
            <div className="bg-white/5 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-primary-400">{dbStats.total}</p>
              <p className="text-xs text-gray-500 mt-1">Total Records</p>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500 text-sm">Loading statistics...</div>
        )}
      </div>

      {/* Danger Zone */}
      <div className="glass-card p-6 border border-red-500/20">
        <h3 className="text-sm font-semibold text-red-400 mb-1">Danger Zone</h3>
        <p className="text-xs text-gray-500 mb-5">
          These actions are destructive and cannot be undone.
        </p>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-red-500/5 border border-red-500/15">
          <div>
            <p className="text-sm font-medium text-white">Clear All Data</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Remove all potholes, sensor data, and alerts from the database.
            </p>
          </div>
          <button
            onClick={() => setShowConfirm(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium
              bg-red-500/15 text-red-400 border border-red-500/30 
              hover:bg-red-500/25 hover:border-red-500/50 transition-all flex-shrink-0"
          >
            <Trash2 className="w-4 h-4" />
            Clear Database
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
             onClick={() => setShowConfirm(false)}>
          <div className="glass-card p-6 max-w-md w-full animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/15 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white">Confirm Clear Database</h4>
                <p className="text-xs text-gray-500">This action cannot be undone</p>
              </div>
            </div>

            <p className="text-sm text-gray-400 mb-6">
              This will permanently delete <strong className="text-white">{dbStats?.potholes || 0} potholes</strong>,{' '}
              <strong className="text-white">{dbStats?.sensorData || 0} sensor records</strong>, and{' '}
              <strong className="text-white">{dbStats?.alerts || 0} alerts</strong>.
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-white/5 text-gray-400 
                  border border-white/10 hover:bg-white/10 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={clearDatabase}
                disabled={clearing}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium
                  bg-red-500/20 text-red-400 border border-red-500/30 
                  hover:bg-red-500/30 transition-all disabled:opacity-50"
              >
                {clearing ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                {clearing ? 'Clearing...' : 'Yes, Clear Everything'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
