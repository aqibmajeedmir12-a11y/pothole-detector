import { ExternalLink } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function MapPage() {
  const { user } = useAuth();
  const stateQuery = encodeURIComponent(user?.state || '');
  const districtQuery = encodeURIComponent(user?.district || '');
  const iframeSrc = `/road_monitor.html?state=${stateQuery}&district=${districtQuery}`;

  return (
    <div className="space-y-4 animate-fade-in h-full">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Live Map View</h1>
          <p className="text-sm text-gray-500 mt-1">
            Real-time Google Maps with ThingSpeak data &amp; GPS tracking
          </p>
        </div>

        <a
          href={iframeSrc}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium 
            bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10 
            hover:text-primary-400 transition-all"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Open Full Screen
        </a>
      </div>

      {/* Embedded Google Maps Monitor */}
      <div
        className="glass-card overflow-hidden rounded-2xl"
        style={{ height: 'calc(100vh - 180px)', minHeight: '500px' }}
      >
        <iframe
          src={iframeSrc}
          title="AIoT Road Monitor - Live Map"
          className="w-full h-full border-0 rounded-2xl"
          allow="geolocation"
          style={{ border: 'none' }}
        />
      </div>
    </div>
  );
}
