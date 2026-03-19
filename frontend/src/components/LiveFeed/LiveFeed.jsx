import { Radio, MapPin, Clock, Zap } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

const severityColors = {
  low: 'border-green-500/30 bg-green-500/5',
  medium: 'border-amber-500/30 bg-amber-500/5',
  high: 'border-orange-500/30 bg-orange-500/5',
  critical: 'border-red-500/30 bg-red-500/5',
};

const severityDots = {
  low: 'bg-green-500',
  medium: 'bg-amber-500',
  high: 'bg-orange-500',
  critical: 'bg-red-500',
};

export default function LiveFeed({ potholes = [], sensorData = null, isConnected }) {
  const [feed, setFeed] = useState(potholes.slice(0, 20));
  const feedRef = useRef(null);

  useEffect(() => {
    setFeed(potholes.slice(0, 20));
  }, [potholes]);

  return (
    <div className="space-y-4">
      {/* Status bar */}
      <div className="glass-card p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`relative w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}>
            {isConnected && <div className="absolute inset-0 rounded-full bg-green-500 animate-ping" />}
          </div>
          <span className="text-sm font-medium text-white">
            {isConnected ? 'Live Monitoring Active' : 'Connection Lost'}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Radio className="w-3.5 h-3.5" />
          <span>{feed.length} detections</span>
        </div>
      </div>

      {/* Latest sensor reading */}
      {sensorData && (
        <div className="glass-card p-4 animate-slide-up border-primary-500/20">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-primary-400" />
            <span className="text-xs font-semibold text-primary-400 uppercase tracking-wider">Latest Sensor Reading</span>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-gray-500">Device</p>
              <p className="text-sm font-semibold text-white">{sensorData.deviceId}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Vibration</p>
              <p className="text-sm font-semibold text-white">{sensorData.vibrationLevel?.toFixed(1)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Pothole</p>
              <p className={`text-sm font-semibold ${sensorData.potholeDetected ? 'text-red-400' : 'text-green-400'}`}>
                {sensorData.potholeDetected ? 'Yes ⚠️' : 'No ✅'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Feed items */}
      <div ref={feedRef} className="space-y-3 max-h-[calc(100vh-300px)] overflow-y-auto pr-1">
        {feed.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <Radio className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500">Waiting for detections...</p>
            <p className="text-xs text-gray-600 mt-1">Send data via POST /api/pothole to see live updates</p>
          </div>
        ) : (
          feed.map((item, i) => (
            <div key={item.id || i} 
              className={`glass-card p-4 border ${severityColors[item.severity]} animate-slide-up transition-all hover:scale-[1.01]`}
              style={{ animationDelay: `${i * 30}ms` }}
            >
              <div className="flex items-start gap-3">
                <div className={`w-3 h-3 rounded-full mt-1 ${severityDots[item.severity]}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-white capitalize">{item.severity} Severity</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-gray-400">
                      {item.source?.replace('_', ' ')}
                    </span>
                  </div>
                  
                  <p className="text-sm text-gray-400 mt-1">
                    {item.description || 'Pothole detected'}
                  </p>

                  <div className="flex items-center gap-4 mt-2">
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {item.road_name || `${item.lat?.toFixed(4)}, ${item.lng?.toFixed(4)}`}
                    </span>
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(item.detected_at).toLocaleString()}
                    </span>
                  </div>

                  {item.confidence > 0 && (
                    <div className="mt-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1 rounded-full bg-white/5">
                          <div className="h-full rounded-full bg-primary-500 transition-all"
                            style={{ width: `${item.confidence * 100}%` }} />
                        </div>
                        <span className="text-xs text-gray-500">{Math.round(item.confidence * 100)}%</span>
                      </div>
                    </div>
                  )}
                </div>

                {item.image_url && (
                  <img src={item.image_url} alt="Detection" 
                    className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
