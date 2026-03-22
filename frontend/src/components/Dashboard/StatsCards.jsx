import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

const iconMap = {
  up: TrendingUp,
  down: TrendingDown,
  neutral: Minus,
};

export default function StatsCards({ stats }) {
  if (!stats) return null;

  const cards = [
    {
      title: 'Active Potholes',
      value: stats.potholes?.active ?? stats.potholes?.total ?? 0,
      subtitle: `${stats.potholes?.todayDetections || 0} today`,
      icon: '🕳️',
      trend: stats.potholes?.todayDetections > 5 ? 'up' : 'neutral',
      color: 'from-red-500/20 to-red-600/10',
      borderColor: 'border-red-500/20',
    },
    {
      title: 'Road Health Index',
      value: `${stats.potholes?.roadHealthIndex || 0}%`,
      subtitle: stats.potholes?.roadHealthIndex > 70 ? 'Good condition' : 'Needs attention',
      icon: '🛣️',
      trend: stats.potholes?.roadHealthIndex > 70 ? 'up' : 'down',
      color: stats.potholes?.roadHealthIndex > 70 ? 'from-green-500/20 to-green-600/10' : 'from-amber-500/20 to-amber-600/10',
      borderColor: stats.potholes?.roadHealthIndex > 70 ? 'border-green-500/20' : 'border-amber-500/20',
    },
    {
      title: 'Active Sensors',
      value: stats.sensors?.activeDeviceCount || 0,
      subtitle: `${stats.sensors?.totalReadings || 0} total readings`,
      icon: '📡',
      trend: 'neutral',
      color: 'from-blue-500/20 to-blue-600/10',
      borderColor: 'border-blue-500/20',
    },
    {
      title: 'Under Repair',
      value: stats.potholes?.inRepair || 0,
      subtitle: `${stats.potholes?.repaired || 0} repaired`,
      icon: '🔧',
      trend: stats.potholes?.repaired > 0 ? 'up' : 'neutral',
      color: 'from-purple-500/20 to-purple-600/10',
      borderColor: 'border-purple-500/20',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, idx) => {
        const TrendIcon = iconMap[card.trend];
        return (
          <div key={idx}
            className={`stat-card bg-gradient-to-br ${card.color} ${card.borderColor} animate-slide-up`}
            style={{ animationDelay: `${idx * 100}ms` }}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">{card.title}</p>
                <p className="text-3xl font-bold text-white mt-2">{card.value}</p>
                <div className="flex items-center gap-1.5 mt-2">
                  <TrendIcon className={`w-3.5 h-3.5 ${
                    card.trend === 'up' ? 'text-green-400' : 
                    card.trend === 'down' ? 'text-red-400' : 'text-gray-400'
                  }`} />
                  <span className="text-xs text-gray-400">{card.subtitle}</span>
                </div>
              </div>
              <span className="text-3xl">{card.icon}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
