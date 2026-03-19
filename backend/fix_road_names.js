/**
 * Fix existing "Detection Feed" road names using reverse geocoding
 * Run: node fix_road_names.js
 */
require('dotenv').config();
const Database = require('better-sqlite3');
const https = require('https');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'roadmonitor.db');
const db = new Database(dbPath);

function reverseGeocode(lat, lng) {
  return new Promise((resolve, reject) => {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=16`;
    https.get(url, { headers: { 'User-Agent': 'AIoT-Road-Monitor/1.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const addr = json.address || {};
          let name = addr.road || addr.suburb || addr.town || addr.city || (json.display_name || '').split(',')[0];
          const area = addr.suburb || addr.town || addr.city || addr.state_district || '';
          if (area && area !== name) name = `${name}, ${area}`;
          resolve(name || `Location (${lat}, ${lng})`);
        } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

async function main() {
  // Get all potholes with "Detection Feed" road name
  const rows = db.prepare("SELECT id, lat, lng, road_name FROM potholes WHERE road_name = 'Detection Feed' OR road_name IS NULL").all();
  console.log(`Found ${rows.length} records to update`);

  // Group by unique coordinates
  const coordMap = {};
  for (const row of rows) {
    const key = `${parseFloat(row.lat).toFixed(4)},${parseFloat(row.lng).toFixed(4)}`;
    if (!coordMap[key]) coordMap[key] = { lat: row.lat, lng: row.lng, ids: [] };
    coordMap[key].ids.push(row.id);
  }

  const updateStmt = db.prepare("UPDATE potholes SET road_name = ? WHERE id = ?");

  for (const [key, group] of Object.entries(coordMap)) {
    try {
      const name = await reverseGeocode(group.lat, group.lng);
      console.log(`  📍 ${key} → ${name} (${group.ids.length} records)`);
      for (const id of group.ids) {
        updateStmt.run(name, id);
      }
      // Rate limit: Nominatim requires 1 request per second
      await new Promise(r => setTimeout(r, 1100));
    } catch (e) {
      console.error(`  ❌ Failed for ${key}:`, e.message);
    }
  }

  console.log('\n✅ Done updating road names!');
  
  // Show results
  const updated = db.prepare("SELECT id, road_name, image_url FROM potholes ORDER BY id").all();
  console.log('\nUpdated records:');
  updated.forEach(r => console.log(`  #${r.id}: road=${r.road_name} | image=${r.image_url || 'none'}`));
  
  db.close();
}

main().catch(console.error);
