import { NavLink, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, Map, BarChart3, Shield, Radio, 
  Bell, ChevronLeft, ChevronRight, Activity, Camera, Settings, FileText
} from 'lucide-react';
import { useState } from 'react';

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/map', icon: Map, label: 'Map View' },
  { path: '/detections', icon: Camera, label: 'Detections' },
  { path: '/live', icon: Radio, label: 'Live Feed' },
  { path: '/analytics', icon: BarChart3, label: 'Analytics' },
  { path: '/reports', icon: FileText, label: 'Reports' },
  { path: '/admin', icon: Shield, label: 'Admin Panel' },
  { path: '/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar({ unreadAlerts = 0 }) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  return (
    <>
      {/* Mobile overlay */}
      <div className={`fixed inset-0 bg-black/50 z-40 lg:hidden ${collapsed ? 'hidden' : ''}`} 
           onClick={() => setCollapsed(true)} />

      <aside className={`fixed left-0 top-0 h-full z-50 flex flex-col transition-all duration-300
        ${collapsed ? 'w-20' : 'w-64'} 
        bg-dark-950/95 dark:bg-dark-950/95 backdrop-blur-xl border-r border-white/5
        lg:relative lg:z-auto`}>
        
        {/* Logo */}
        <div className="flex items-center gap-3 p-5 border-b border-white/5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center flex-shrink-0">
            <Activity className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <div className="animate-fade-in">
              <h1 className="text-sm font-bold text-white tracking-tight">Road Monitor</h1>
              <p className="text-[10px] text-gray-500 font-medium">AIoT Smart System</p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map(({ path, icon: Icon, label }) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) =>
                `nav-link ${isActive ? 'nav-link-active' : 'nav-link-inactive'} ${collapsed ? 'justify-center px-3' : ''}`
              }
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Alerts indicator */}
        {unreadAlerts > 0 && (
          <div className={`mx-3 mb-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 ${collapsed ? 'text-center' : ''}`}>
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-red-400 flex-shrink-0" />
              {!collapsed && (
                <span className="text-xs text-red-400 font-medium">{unreadAlerts} unread alerts</span>
              )}
            </div>
          </div>
        )}

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex items-center justify-center p-3 border-t border-white/5 text-gray-500 hover:text-gray-300 transition-colors"
        >
          {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>
      </aside>
    </>
  );
}
