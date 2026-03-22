import React, { useState, useEffect } from 'react';
import { ShieldAlert, MapPin, Activity } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function UserDashboard({ potholes }) {
  const { user } = useAuth();
  
  // Use dynamic stats broadcasted from the map iframe's GPS proximity radar
  const [nearbyStats, setNearbyStats] = useState({ total: 0, critical: 0 });

  useEffect(() => {
    const handleStats = (e) => {
      if (e.data && e.data.type === 'POTHOLE_STATS') {
        setNearbyStats({
          total: e.data.nearbyCount,
          critical: e.data.criticalCount
        });
      }
    };
    window.addEventListener('message', handleStats);
    return () => window.removeEventListener('message', handleStats);
  }, []);

  return (
    <div className="space-y-6 animate-fade-in flex flex-col h-[calc(100vh-6rem)]">
      
      {/* Top Banner Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 shrink-0">
        <div className="glass-card p-6 rounded-2xl border-l-4 border-l-primary-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-400 text-sm font-medium mb-1 tracking-wide">NEARBY HAZARDS</p>
              <h3 className="text-3xl font-bold text-white font-mono">{nearbyStats.total}</h3>
            </div>
            <div className="p-3 rounded-full bg-primary-500/20 text-primary-400">
              <MapPin className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className="glass-card p-6 rounded-2xl border-l-4 border-l-red-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-400 text-sm font-medium mb-1 tracking-wide">CRITICAL / HIGH</p>
              <h3 className="text-3xl font-bold text-white font-mono">{nearbyStats.critical}</h3>
            </div>
            <div className="p-3 rounded-full bg-red-500/20 text-red-400">
              <ShieldAlert className="w-6 h-6" />
            </div>
          </div>
        </div>
        
        <div className="glass-card p-6 rounded-2xl border-l-4 border-l-blue-500 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Activity className="w-8 h-8 text-blue-400 animate-pulse-soft" />
              <div>
                <p className="text-white font-bold">Drive Safely</p>
                <p className="text-xs text-gray-400 mt-1">Background alerts active</p>
              </div>
            </div>
        </div>
      </div>

      {/* Map View taking up the rest of the height */}
      <div className="glass-card rounded-2xl overflow-hidden flex-1 relative border border-white/5 shadow-2xl">
        <iframe 
          src={`/road_monitor.html?state=${encodeURIComponent(user?.state || '')}&district=${encodeURIComponent(user?.district || '')}&view=citizen`} 
          className="w-full h-full border-0 absolute inset-0" 
          title="Live Road Monitor GPS"
          allow="geolocation"
        />
      </div>

    </div>
  );
}
