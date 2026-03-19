import { AlertTriangle, MapPin, Zap, Camera, X } from 'lucide-react';
import { useState, useEffect } from 'react';

const severityColors = {
  critical: { bg: 'bg-red-500/15', border: 'border-red-500', text: 'text-red-400', icon: 'text-red-400' },
  high:     { bg: 'bg-orange-500/15', border: 'border-orange-500', text: 'text-orange-400', icon: 'text-orange-400' },
  medium:   { bg: 'bg-amber-500/15', border: 'border-amber-500', text: 'text-amber-400', icon: 'text-amber-400' },
  low:      { bg: 'bg-green-500/15', border: 'border-green-500', text: 'text-green-400', icon: 'text-green-400' },
};

const sourceIcons = {
  ai_camera: Camera,
  esp32_sensor: Zap,
};

export default function AlertBanner({ alert, onDismiss }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (alert) {
      setVisible(true);
      // Play alert sound
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        osc.type = 'sine';
        gain.gain.value = 0.15;
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc.stop(ctx.currentTime + 0.4);
      } catch (_) { /* audio not supported */ }

      const timer = setTimeout(() => {
        setVisible(false);
        setTimeout(() => onDismiss?.(), 300);
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [alert]);

  if (!alert) return null;

  const severity = alert.severity || 'medium';
  const colors = severityColors[severity] || severityColors.medium;
  const SourceIcon = sourceIcons[alert.source] || AlertTriangle;

  return (
    <div className={`fixed top-4 right-4 z-50 max-w-sm transition-all duration-300 
      ${visible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}`}>
      <div className={`glass-card p-4 border-l-4 ${colors.border} ${colors.bg} flex items-start gap-3 shadow-2xl`}>
        <div className={`p-2 rounded-lg ${colors.bg} flex-shrink-0`}>
          <SourceIcon className={`w-5 h-5 ${colors.icon}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-sm font-bold text-white">Pothole Detected!</p>
            <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${colors.bg} ${colors.text} border ${colors.border}/30`}>
              {severity}
            </span>
          </div>
          <p className="text-xs text-gray-400 truncate">{alert.message}</p>
          {alert.confidence && (
            <p className="text-[11px] text-gray-500 mt-1">
              Confidence: {Math.round(alert.confidence * 100)}%
            </p>
          )}
          {alert.lat && alert.lng && (
            <div className="flex items-center gap-1 mt-1">
              <MapPin className="w-3 h-3 text-gray-500" />
              <span className="text-[11px] text-gray-500">{alert.lat?.toFixed(5)}, {alert.lng?.toFixed(5)}</span>
            </div>
          )}
        </div>
        <button 
          onClick={() => { setVisible(false); setTimeout(() => onDismiss?.(), 300); }}
          className="text-gray-500 hover:text-white transition-colors flex-shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
