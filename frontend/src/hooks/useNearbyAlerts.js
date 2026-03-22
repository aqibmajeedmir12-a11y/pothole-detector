import { useEffect, useRef } from 'react';

// Distance calculation using Haversine formula
function getDistanceInMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in meters
  const p1 = lat1 * Math.PI/180;
  const p2 = lat2 * Math.PI/180;
  const dp = (lat2-lat1) * Math.PI/180;
  const dl = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(dp/2) * Math.sin(dp/2) +
            Math.cos(p1) * Math.cos(p2) *
            Math.sin(dl/2) * Math.sin(dl/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export function useNearbyAlerts(potholes, role, onAlert) {
  const lastAlertTime = useRef(0);

  useEffect(() => {
    if (role !== 'user') return; // Only Citizens get background drive notifications

    // Request notification permission if not yet granted
    if (("Notification" in window) && Notification.permission === "default") {
      Notification.requestPermission();
    }

    if (!navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const now = Date.now();

        // Prevent overwhelming: only check every 2 seconds roughly, unless a critical event forces it.
        // Actually, watchPosition is naturally paced, but we enforce a 3s absolute cooldown between ANY notifications.
        
        for (const pothole of potholes) {
          // If already repaired, skip.
          if (pothole.status === 'repaired') continue;
          
          const dist = getDistanceInMeters(latitude, longitude, pothole.lat, pothole.lng);
          
          // Alert if less than 100 meters away, every 3+ seconds
          if (dist < 100 && (now - lastAlertTime.current > 3000)) {
            const msg = `Sir here is pothole... ${pothole.severity} severity. Please drive slowly! (${Math.round(dist)}m away on ${pothole.roadName || 'this road'})`;
            
            if (("Notification" in window) && Notification.permission === "granted") {
              new Notification("⚠️ POTHOLE NEARBY ZONE ⚠️", {
                body: msg,
                icon: "/vite.svg"
              });
            }
            if (onAlert) onAlert(msg);
            
            lastAlertTime.current = Date.now();
            break; // only one alert per tick
          }
        }
      },
      (err) => console.error("GPS Watch error:", err),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [potholes, role]);
}
