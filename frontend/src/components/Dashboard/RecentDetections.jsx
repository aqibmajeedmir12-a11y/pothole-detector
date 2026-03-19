import { Clock, MapPin, AlertTriangle } from 'lucide-react';

const severityColors = {
  low: 'badge-low',
  medium: 'badge-medium',
  high: 'badge-high',
  critical: 'badge-critical',
};

const statusColors = {
  detected: 'badge-detected',
  confirmed: 'badge-confirmed',
  in_repair: 'badge-in_repair',
  repaired: 'badge-repaired',
};

export default function RecentDetections({ detections = [] }) {
  if (detections.length === 0) {
    return (
      <div className="glass-card p-6">
        <h3 className="text-sm font-semibold text-white mb-4">Recent Detections</h3>
        <p className="text-gray-500 text-sm text-center py-8">No detections yet</p>
      </div>
    );
  }

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          Recent Detections
        </h3>
        <span className="text-xs text-gray-500">{detections.length} results</span>
      </div>

      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
        {detections.map((d, i) => (
          <div key={d.id || i} className="flex items-start gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors group animate-slide-up"
               style={{ animationDelay: `${i * 50}ms` }}>
            {/* Severity dot */}
            <div className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${
              d.severity === 'critical' ? 'bg-red-500' :
              d.severity === 'high' ? 'bg-orange-500' :
              d.severity === 'medium' ? 'bg-amber-500' : 'bg-green-500'
            }`} />

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`badge ${severityColors[d.severity]}`}>{d.severity}</span>
                <span className={`badge ${statusColors[d.status]}`}>{d.status?.replace('_', ' ')}</span>
              </div>
              
              <p className="text-sm text-gray-300 mt-1.5 truncate">
                {d.description || d.road_name || `Pothole at ${d.lat?.toFixed(4)}, ${d.lng?.toFixed(4)}`}
              </p>

              <div className="flex items-center gap-3 mt-1.5">
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {d.road_name || `${d.lat?.toFixed(3)}, ${d.lng?.toFixed(3)}`}
                </span>
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(d.detected_at).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Confidence */}
            {d.confidence > 0 && (
              <div className="text-right flex-shrink-0">
                <span className="text-xs text-gray-500">Confidence</span>
                <p className="text-sm font-semibold text-white">{Math.round(d.confidence * 100)}%</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
