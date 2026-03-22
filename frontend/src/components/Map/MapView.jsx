import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const severityIcons = {
  low: '#22c55e',
  medium: '#f59e0b',
  high: '#f97316',
  critical: '#ef4444',
};

function createCustomIcon(severity) {
  const color = severityIcons[severity] || '#6b7280';
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      width: 24px; height: 24px; border-radius: 50%; 
      background: ${color}; border: 3px solid white;
      box-shadow: 0 2px 8px ${color}80, 0 0 20px ${color}40;
      display: flex; align-items: center; justify-content: center;
    "><div style="width: 6px; height: 6px; background: white; border-radius: 50%;"></div></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -16],
  });
}

// Heatmap component using simple circles
function HeatmapOverlay({ potholes, show }) {
  const map = useMap();

  useEffect(() => {
    if (!show || !potholes.length) return;

    const circles = potholes
      .filter(p => p.status !== 'repaired')
      .map(p => {
        const color = severityIcons[p.severity] || '#6b7280';
        return L.circle([p.lat, p.lng], {
          radius: p.severity === 'critical' ? 200 : p.severity === 'high' ? 150 : 100,
          color: 'transparent',
          fillColor: color,
          fillOpacity: 0.25,
        }).addTo(map);
      });

    return () => circles.forEach(c => map.removeLayer(c));
  }, [potholes, show, map]);

  return null;
}

// Auto-fit bounds
function FitBounds({ potholes }) {
  const map = useMap();
  useEffect(() => {
    if (potholes.length > 0) {
      const bounds = L.latLngBounds(potholes.map(p => [p.lat, p.lng]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
  }, [potholes, map]);
  return null;
}

export default function MapView({ potholes = [], showHeatmap = false, onSelectPothole }) {
  // Filter out repaired potholes so their dots don't appear on the map
  const activePotholes = potholes.filter(p => p.status !== 'repaired');

  const center = activePotholes.length > 0 
    ? [activePotholes[0].lat, activePotholes[0].lng] 
    : [8.7271, 77.7329]; // Default: GCE Tirunelveli, Tamil Nadu

  return (
    <MapContainer
      center={center}
      zoom={12}
      className="w-full h-full rounded-2xl"
      style={{ minHeight: '400px' }}
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />
      
      {activePotholes.length > 0 && <FitBounds potholes={activePotholes} />}
      <HeatmapOverlay potholes={activePotholes} show={showHeatmap} />

      {activePotholes.map((pothole) => (
        <Marker
          key={pothole.id}
          position={[pothole.lat, pothole.lng]}
          icon={createCustomIcon(pothole.severity)}
          eventHandlers={{
            click: () => onSelectPothole?.(pothole),
          }}
        >
          <Popup>
            <div className="min-w-[200px]">
              <div className="flex items-center gap-2 mb-2">
                <span className={`inline-block w-3 h-3 rounded-full`} 
                  style={{ background: severityIcons[pothole.severity] }} />
                <span className="font-bold text-sm capitalize">{pothole.severity} Severity</span>
              </div>
              {pothole.road_name && (
                <p className="text-sm mb-1">📍 {pothole.road_name}</p>
              )}
              <p className="text-xs text-gray-400 mb-1">
                {pothole.description || 'Pothole detected'}
              </p>
              <div className="flex justify-between text-xs text-gray-500 mt-2 pt-2 border-t border-white/10">
                <span>Status: {pothole.status?.replace('_', ' ')}</span>
                <span>{new Date(pothole.detected_at).toLocaleDateString()}</span>
              </div>
              {pothole.confidence > 0 && (
                <div className="mt-1 text-xs text-gray-500">
                  Confidence: {Math.round(pothole.confidence * 100)}%
                </div>
              )}
              {pothole.cost > 0 && (
                <div className="mt-2 pt-2 border-t border-white/10">
                  <p className="text-xs font-bold" style={{ color: '#f59e0b' }}>🔧 Repair Estimation</p>
                  <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                    <p>Area: <strong>{pothole.area?.toFixed(4)} m²</strong></p>
                    <p>Volume: <strong>{pothole.volume?.toFixed(6)} m³</strong></p>
                    <p>Cost: <strong style={{ color: '#f59e0b' }}>₹{pothole.cost.toLocaleString('en-IN')}</strong></p>
                    <p style={{ color: '#9ca3af', fontSize: '10px' }}>Material: Cold-mix asphalt</p>
                  </div>
                </div>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
