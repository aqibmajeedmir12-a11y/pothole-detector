import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, BarChart3, PieChart as PieChartIcon, AlertTriangle, Target } from 'lucide-react';

const COLORS = ['#2d7fff', '#22c55e', '#f59e0b', '#f97316', '#ef4444', '#8b5cf6'];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload) return null;
  return (
    <div className="bg-dark-900 border border-white/10 rounded-lg p-3 shadow-xl">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-sm font-semibold" style={{ color: p.color }}>
          {p.name}: {typeof p.value === 'number' && p.value < 1 ? (p.value * 100).toFixed(1) + '%' : p.value}
        </p>
      ))}
    </div>
  );
};

function EmptyChart({ icon: Icon, title, subtitle }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-3">
        <Icon className="w-6 h-6 text-gray-600" />
      </div>
      <p className="text-sm text-gray-500 font-medium">{title}</p>
      <p className="text-xs text-gray-600 mt-1">{subtitle}</p>
    </div>
  );
}

export function VibrationChart({ data = [] }) {
  const hasData = data.length > 0;
  return (
    <div className="glass-card p-6">
      <h3 className="text-sm font-semibold text-white mb-4">Vibration Trends (24h)</h3>
      {!hasData ? (
        <EmptyChart icon={TrendingUp} title="No vibration data yet" subtitle="Data will appear once ESP32 sensors send readings" />
      ) : (
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="vibGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2d7fff" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#2d7fff" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#6b7280' }} tickFormatter={(v) => v?.split(' ')[1] || v} />
            <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="avg_vibration" name="Avg Vibration" stroke="#2d7fff" fill="url(#vibGrad)" strokeWidth={2} />
            <Line type="monotone" dataKey="max_vibration" name="Max" stroke="#ef4444" strokeWidth={1} dot={false} strokeDasharray="4 4" />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export function ConfidenceChart({ data = [] }) {
  const hasData = data.length > 0;
  return (
    <div className="glass-card p-6">
      <h3 className="text-sm font-semibold text-white mb-4">AI Detection Confidence (24h)</h3>
      {!hasData ? (
        <EmptyChart icon={Target} title="No AI detection data yet" subtitle="Confidence trends will appear once AI camera detects potholes" />
      ) : (
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="confGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#6b7280' }} tickFormatter={(v) => v?.split(' ')[1] || v} />
            <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} domain={[0, 1]} tickFormatter={(v) => (v * 100) + '%'} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="avg_confidence" name="Avg Confidence" stroke="#22c55e" fill="url(#confGrad)" strokeWidth={2} />
            <Line type="monotone" dataKey="max_confidence" name="Max" stroke="#f59e0b" strokeWidth={1} dot={false} strokeDasharray="4 4" />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export function FrequencyChart({ data = [] }) {
  const hasData = data.length > 0;
  return (
    <div className="glass-card p-6">
      <h3 className="text-sm font-semibold text-white mb-4">Daily Detection Frequency</h3>
      {!hasData ? (
        <EmptyChart icon={BarChart3} title="No detection data yet" subtitle="Charts will populate as potholes are detected" />
      ) : (
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#6b7280' }} tickFormatter={(v) => v?.split('-').slice(1).join('/')} />
            <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="count" name="Detections" fill="#2d7fff" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export function SourceDistributionChart({ data = [] }) {
  const chartData = data.map(d => ({ name: d.source?.replace('_', ' '), value: d.count }));
  const hasData = chartData.length > 0;

  return (
    <div className="glass-card p-6">
      <h3 className="text-sm font-semibold text-white mb-4">Detection Sources</h3>
      {!hasData ? (
        <EmptyChart icon={PieChartIcon} title="No source data yet" subtitle="Source breakdown will appear with detections" />
      ) : (
        <>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={chartData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={5} dataKey="value">
                {chartData.map((_, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-3 justify-center mt-2">
            {chartData.map((d, i) => (
              <div key={i} className="flex items-center gap-1.5 text-xs text-gray-400">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                {d.name} ({d.value})
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function RiskAreasTable({ areas = [] }) {
  return (
    <div className="glass-card p-6">
      <h3 className="text-sm font-semibold text-white mb-4">🔥 High-Risk Areas</h3>
      {areas.length === 0 ? (
        <EmptyChart icon={AlertTriangle} title="No risk areas identified" subtitle="High-risk zones will appear as data accumulates" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 uppercase border-b border-white/5">
                <th className="text-left py-2 px-2">Location</th>
                <th className="text-center py-2 px-2">Potholes</th>
                <th className="text-center py-2 px-2">Risk Score</th>
              </tr>
            </thead>
            <tbody>
              {areas.map((area, i) => (
                <tr key={i} className="table-row">
                  <td className="py-3 px-2 text-gray-300">{area.road_name || `Area ${area.area_lat}, ${area.area_lng}`}</td>
                  <td className="py-3 px-2 text-center text-white font-semibold">{area.pothole_count}</td>
                  <td className="py-3 px-2 text-center">
                    <span className={`badge ${
                      area.risk_score > 10 ? 'badge-critical' : 
                      area.risk_score > 6 ? 'badge-high' : 
                      area.risk_score > 3 ? 'badge-medium' : 'badge-low'
                    }`}>
                      {area.risk_score}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
