export default function RoadHealthIndex({ value = 0 }) {
  const percentage = Math.min(100, Math.max(0, value));
  const color = percentage > 75 ? '#22c55e' : percentage > 50 ? '#f59e0b' : percentage > 25 ? '#f97316' : '#ef4444';
  const label = percentage > 75 ? 'Good' : percentage > 50 ? 'Fair' : percentage > 25 ? 'Poor' : 'Critical';
  
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="glass-card p-6">
      <h3 className="text-sm font-semibold text-white mb-4">Road Health Index</h3>
      
      <div className="flex flex-col items-center">
        <div className="relative w-40 h-40">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 140 140">
            {/* Background circle */}
            <circle
              cx="70" cy="70" r={radius}
              fill="none" stroke="rgba(255,255,255,0.05)"
              strokeWidth="12" strokeLinecap="round"
            />
            {/* Progress circle */}
            <circle
              cx="70" cy="70" r={radius}
              fill="none" stroke={color}
              strokeWidth="12" strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              style={{ transition: 'stroke-dashoffset 1s ease-out, stroke 0.3s' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold text-white">{percentage}%</span>
            <span className="text-xs font-medium" style={{ color }}>{label}</span>
          </div>
        </div>

        <div className="mt-4 w-full space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">Critical</span>
            <span className="text-gray-400">Good</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
            <div className="h-full rounded-full transition-all duration-1000"
              style={{ 
                width: `${percentage}%`, 
                background: `linear-gradient(90deg, #ef4444, #f97316, #f59e0b, #22c55e)` 
              }} 
            />
          </div>
        </div>
      </div>
    </div>
  );
}
