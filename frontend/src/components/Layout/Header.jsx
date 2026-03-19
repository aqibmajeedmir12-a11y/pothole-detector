import { Sun, Moon, Bell, Wifi, WifiOff, Menu, AlertTriangle, Camera, Zap, Clock } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useState } from 'react';

function timeAgo(ts) {
  if (!ts) return '';
  const diff = Date.now() - new Date(ts).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const severityDot = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-amber-500',
  low: 'bg-green-500',
};

const sourceIcon = {
  ai_camera: Camera,
  esp32_sensor: Zap,
};

export default function Header({ isConnected, notifications = [], onClearNotifications, onToggleSidebar }) {
  const { darkMode, toggleDarkMode } = useTheme();
  const [showNotifs, setShowNotifs] = useState(false);

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-6 py-4 
      bg-dark-950/80 dark:bg-dark-950/80 backdrop-blur-xl border-b border-white/5
      light:bg-white/80 light:border-gray-200/50">
      
      <div className="flex items-center gap-4">
        <button className="lg:hidden text-gray-400 hover:text-white" onClick={onToggleSidebar}>
          <Menu className="w-6 h-6" />
        </button>
        <div>
          <h2 className="text-lg font-bold text-white dark:text-white">Smart Road Monitoring</h2>
          <p className="text-xs text-gray-500">AI-Powered Pothole Detection Dashboard</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Connection status */}
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium
          ${isConnected 
            ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
            : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
          {isConnected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
          <span className="hidden sm:inline">{isConnected ? 'Live' : 'Offline'}</span>
        </div>

        {/* Notifications */}
        <div className="relative">
          <button 
            onClick={() => setShowNotifs(!showNotifs)}
            className="relative p-2 rounded-xl hover:bg-white/5 transition-colors text-gray-400 hover:text-white"
          >
            <Bell className="w-5 h-5" />
            {notifications.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center animate-pulse-soft">
                {notifications.length}
              </span>
            )}
          </button>

          {/* Notification dropdown */}
          {showNotifs && (
            <div className="absolute right-0 top-12 w-96 glass-card animate-fade-in max-h-[480px] overflow-hidden flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-primary-400" />
                  <span className="text-sm font-bold text-white">Notifications</span>
                  {notifications.length > 0 && (
                    <span className="text-[10px] bg-primary-500/20 text-primary-400 px-1.5 py-0.5 rounded-full font-medium">
                      {notifications.length}
                    </span>
                  )}
                </div>
                {notifications.length > 0 && (
                  <button 
                    onClick={() => { onClearNotifications?.(); setShowNotifs(false); }}
                    className="text-xs text-primary-400 hover:text-primary-300 font-medium"
                  >
                    Clear all
                  </button>
                )}
              </div>
              <div className="overflow-y-auto flex-1">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center">
                    <Bell className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No notifications yet</p>
                    <p className="text-xs text-gray-600 mt-1">Alerts will appear here when potholes are detected</p>
                  </div>
                ) : (
                  notifications.map((notif, i) => {
                    const severity = notif.severity || 'medium';
                    const dotColor = severityDot[severity] || severityDot.medium;
                    const SourceIcon = sourceIcon[notif.source] || AlertTriangle;
                    return (
                      <div key={i} className="p-3 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0 flex items-start gap-3">
                        <div className="relative flex-shrink-0 mt-0.5">
                          <SourceIcon className="w-4 h-4 text-gray-400" />
                          <div className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ${dotColor}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-300 leading-snug">{notif.message}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-[10px] font-bold uppercase px-1 py-0.5 rounded ${dotColor}/20 ${
                              severity === 'critical' ? 'text-red-400' :
                              severity === 'high' ? 'text-orange-400' :
                              severity === 'medium' ? 'text-amber-400' : 'text-green-400'
                            }`}>
                              {severity}
                            </span>
                            <span className="flex items-center gap-1 text-[10px] text-gray-500">
                              <Clock className="w-2.5 h-2.5" />
                              {timeAgo(notif.timestamp)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Dark mode toggle */}
        <button
          onClick={toggleDarkMode}
          className="p-2 rounded-xl hover:bg-white/5 transition-all duration-200 text-gray-400 hover:text-white"
        >
          {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
      </div>
    </header>
  );
}
