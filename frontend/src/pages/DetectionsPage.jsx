import { useState, useEffect } from 'react';
import { MapPin, Clock, Camera, AlertTriangle, ExternalLink, Trash2, RefreshCw, ImageOff, Wrench, IndianRupee } from 'lucide-react';
import { potholeAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

const severityColors = {
  critical: 'border-red-500/40 bg-red-500/10',
  high: 'border-orange-500/40 bg-orange-500/10',
  medium: 'border-amber-500/40 bg-amber-500/10',
  low: 'border-green-500/40 bg-green-500/10',
};

const severityBadge = {
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
  high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  low: 'bg-green-500/20 text-green-400 border-green-500/30',
};

export default function DetectionsPage() {
  const { user } = useAuth();
  const [detections, setDetections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(null);

  const fetchDetections = async () => {
    try {
      setLoading(true);
      const limitParam = 50;
      const res = await potholeAPI.getAll({ 
        limit: limitParam, 
        state: user?.state, 
        district: user?.district 
      });
      const data = res.data?.data || res.data || [];
      setDetections(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch detections:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetections();
  }, [user?.state, user?.district]);

  const formatDate = (ts) => {
    if (!ts) return '—';
    const d = new Date(ts);
    return d.toLocaleString('en-IN', { 
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true 
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Detection Gallery</h1>
          <p className="text-sm text-gray-500 mt-1">
            {detections.length} pothole detection{detections.length !== 1 ? 's' : ''} recorded
          </p>
        </div>
        <button
          onClick={fetchDetections}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium
            bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10 
            hover:text-primary-400 transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {['critical', 'high', 'medium', 'low'].map(sev => {
          const count = detections.filter(d => d.severity === sev && d.status !== 'repaired').length;
          return (
            <div key={sev} className={`glass-card p-4 text-center border ${severityColors[sev]}`}>
              <p className="text-2xl font-bold text-white">{count}</p>
              <p className="text-xs text-gray-500 capitalize mt-1">{sev}</p>
            </div>
          );
        })}
        <div className="glass-card p-4 text-center border border-emerald-500/40 bg-emerald-500/10">
          <p className="text-2xl font-bold text-white">{detections.filter(d => d.status === 'repaired').length}</p>
          <p className="text-xs text-gray-500 capitalize mt-1">Repaired</p>
        </div>
      </div>

      {/* Detection cards grid */}
      {detections.length === 0 && !loading ? (
        <div className="glass-card p-12 text-center">
          <Camera className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">No detections yet</p>
          <p className="text-sm text-gray-600 mt-1">
            Detection images will appear here when potholes are identified by the AI camera or sensors
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {detections.map((det) => (
            <div
              key={det.id}
              className={`glass-card overflow-hidden group hover:ring-1 hover:ring-primary-500/30 transition-all cursor-pointer ${det.status === 'repaired' ? 'opacity-75' : ''}`}
              onClick={() => setSelectedImage(det)}
            >
              {/* Image area */}
              <div className="relative h-44 bg-dark-900 flex items-center justify-center overflow-hidden">
                {det.image_url ? (
                  <img
                    src={det.image_url.startsWith('http') ? det.image_url : `/detections-images/${det.image_url}`}
                    alt={`Pothole #${det.id}`}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                  />
                ) : null}
                <div className={`flex-col items-center justify-center gap-2 ${det.image_url ? 'hidden' : 'flex'}`}>
                  <ImageOff className="w-8 h-8 text-gray-700" />
                  <span className="text-xs text-gray-600">No image captured</span>
                </div>

                {/* Repaired overlay */}
                {det.status === 'repaired' && (
                  <div className="absolute inset-0 bg-emerald-900/50 flex items-center justify-center">
                    <span className="text-emerald-300 font-bold text-lg uppercase tracking-wider bg-emerald-900/80 px-4 py-2 rounded-xl border border-emerald-400/30">
                      ✅ Repaired
                    </span>
                  </div>
                )}

                {/* Severity badge overlay */}
                <div className="absolute top-2 right-2">
                  <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-lg border ${det.status === 'repaired' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : (severityBadge[det.severity] || severityBadge.medium)}`}>
                    {det.status === 'repaired' ? 'repaired' : det.severity}
                  </span>
                </div>

                {/* ID badge */}
                <div className="absolute top-2 left-2">
                  <span className="text-[10px] font-medium px-2 py-1 rounded-lg bg-black/60 text-gray-300 backdrop-blur-sm">
                    #{det.id}
                  </span>
                </div>
              </div>

              {/* Info */}
              <div className="p-3 space-y-2">
                <p className="text-sm text-gray-300 font-medium truncate">
                  {det.road_name || det.description || 'Pothole Detection'}
                </p>

                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <MapPin className="w-3 h-3 flex-shrink-0" />
                  <span>{det.lat?.toFixed(5)}, {det.lng?.toFixed(5)}</span>
                </div>

                <div className="flex items-center justify-between text-xs text-gray-500">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{formatDate(det.detected_at)}</span>
                  </div>
                  {det.status === 'repaired' ? (
                    <span className="text-emerald-400 font-medium">Repaired</span>
                  ) : det.confidence > 0 ? (
                    <span className="text-primary-400 font-medium">
                      {Math.round(det.confidence * 100)}%
                    </span>
                  ) : null}
                </div>

                {/* Repair Estimation */}
                {det.cost > 0 && (
                  <div className="flex items-center gap-2 pt-1.5 border-t border-white/5 text-xs">
                    <Wrench className="w-3 h-3 text-amber-400 flex-shrink-0" />
                    <span className="text-amber-400 font-semibold">₹{det.cost.toLocaleString('en-IN')}</span>
                    <span className="text-gray-600">|</span>
                    <span className="text-gray-500">{det.area?.toFixed(4)} m²</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox modal */}
      {selectedImage && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div 
            className="glass-card max-w-2xl w-full max-h-[90vh] overflow-auto animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Image */}
            <div className="relative bg-dark-900 min-h-[200px] flex items-center justify-center">
              {selectedImage.image_url ? (
                <img
                  src={selectedImage.image_url.startsWith('http') ? selectedImage.image_url : `/detections-images/${selectedImage.image_url}`}
                  alt={`Pothole #${selectedImage.id}`}
                  className="w-full max-h-[50vh] object-contain"
                />
              ) : (
                <div className="flex flex-col items-center gap-2 py-12">
                  <ImageOff className="w-12 h-12 text-gray-700" />
                  <span className="text-gray-600">No image available</span>
                </div>
              )}
            </div>

            {/* Details */}
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">Pothole #{selectedImage.id}</h3>
                <div className="flex items-center gap-2">
                  {selectedImage.status === 'repaired' && (
                    <span className="text-xs font-bold uppercase px-2.5 py-1 rounded-lg border bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                      ✅ Repaired
                    </span>
                  )}
                  <span className={`text-xs font-bold uppercase px-2.5 py-1 rounded-lg border ${severityBadge[selectedImage.severity] || severityBadge.medium}`}>
                    {selectedImage.severity}
                  </span>
                </div>
              </div>

              <p className="text-sm text-gray-400">{selectedImage.description || 'Pothole detected by AI system'}</p>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/5 rounded-xl p-3">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">Coordinates</p>
                  <p className="text-sm font-mono text-primary-400 mt-1">
                    {selectedImage.lat?.toFixed(6)}, {selectedImage.lng?.toFixed(6)}
                  </p>
                </div>
                <div className="bg-white/5 rounded-xl p-3">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">Confidence</p>
                  <p className="text-sm font-mono text-green-400 mt-1">
                    {selectedImage.confidence ? `${Math.round(selectedImage.confidence * 100)}%` : '—'}
                  </p>
                </div>
                <div className="bg-white/5 rounded-xl p-3">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">Source</p>
                  <p className="text-sm text-gray-300 mt-1 capitalize">
                    {selectedImage.source?.replace('_', ' ') || '—'}
                  </p>
                </div>
                <div className="bg-white/5 rounded-xl p-3">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">Detected At</p>
                  <p className="text-sm text-gray-300 mt-1">{formatDate(selectedImage.detected_at)}</p>
                </div>
              </div>

              {selectedImage.road_name && (
                <div className="bg-white/5 rounded-xl p-3">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">Road Name</p>
                  <p className="text-sm text-gray-300 mt-1">{selectedImage.road_name}</p>
                </div>
              )}

              {/* Repair Estimation Section */}
              {selectedImage.cost > 0 && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-amber-400" />
                    <h4 className="text-sm font-bold text-amber-400 uppercase tracking-wider">Repair Estimation</h4>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-white/5 rounded-lg p-2.5 text-center">
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider">Area</p>
                      <p className="text-sm font-mono text-white mt-1">{selectedImage.area?.toFixed(4)} m²</p>
                    </div>
                    <div className="bg-white/5 rounded-lg p-2.5 text-center">
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider">Volume</p>
                      <p className="text-sm font-mono text-white mt-1">{selectedImage.volume?.toFixed(6)} m³</p>
                    </div>
                    <div className="bg-white/5 rounded-lg p-2.5 text-center">
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider">Est. Cost</p>
                      <p className="text-sm font-mono text-amber-400 mt-1">₹{selectedImage.cost.toLocaleString('en-IN')}</p>
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-500 flex items-center gap-1.5">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500/60"></span>
                    Material Required: Cold-mix asphalt / Bitumen patch
                  </p>
                </div>
              )}

              <div className="flex justify-between pt-2">
                <a
                  href={`https://www.google.com/maps?q=${selectedImage.lat},${selectedImage.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-primary-400 hover:text-primary-300"
                >
                  <ExternalLink className="w-4 h-4" />
                  View on Google Maps
                </a>
                <button 
                  onClick={() => setSelectedImage(null)}
                  className="text-sm text-gray-500 hover:text-white"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
