/**
 * Fix all potholes with null state/district by reverse geocoding their coordinates.
 * Run: node fix_locations.js
 */
const db = require('./config/db');
const axios = require('axios');

const DELAY_MS = 1100; // Nominatim rate limit: 1 req/sec

async function getGeocodeData(lat, lng) {
  try {
    const response = await axios.get('https://nominatim.openstreetmap.org/reverse', {
      params: { lat, lon: lng, format: 'json', zoom: 16 },
      headers: { 'User-Agent': 'AIoT-Road-Monitor-Backend/1.0' },
      timeout: 5000
    });
    const data = response.data;
    if (data && data.address) {
      const addr = data.address;
      let name = addr.road || addr.suburb || addr.town || addr.city || (data.display_name ? data.display_name.split(',')[0] : '');
      const area = addr.suburb || addr.town || addr.city || addr.state_district || '';
      if (area && area !== name) name = `${name}, ${area}`;
      return {
        roadName: name || `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
        state: addr.state || null,
        district: addr.state_district || addr.county || addr.city || null
      };
    }
  } catch (error) {
    console.error(`  ❌ Geocoding failed for ${lat}, ${lng}: ${error.message}`);
  }
  return { roadName: `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`, state: null, district: null };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  // Find all potholes with null state or district
  const broken = db.prepare(`
    SELECT id, lat, lng, road_name, state, district 
    FROM potholes 
    WHERE state IS NULL OR district IS NULL
    ORDER BY id
  `).all();

  console.log(`\n🔍 Found ${broken.length} potholes with missing state/district\n`);

  if (broken.length === 0) {
    console.log('✅ All potholes already have location data!');
    return;
  }

  const updateStmt = db.prepare(`
    UPDATE potholes SET road_name = @roadName, state = @state, district = @district, updated_at = datetime('now')
    WHERE id = @id
  `);

  let fixed = 0;
  let failed = 0;

  for (const p of broken) {
    console.log(`  [${p.id}] Geocoding ${p.lat}, ${p.lng}...`);
    const geo = await getGeocodeData(p.lat, p.lng);
    
    if (geo.state) {
      updateStmt.run({
        id: p.id,
        roadName: geo.roadName,
        state: geo.state,
        district: geo.district
      });
      console.log(`  ✅ [${p.id}] → ${geo.roadName} | ${geo.district}, ${geo.state}`);
      fixed++;
    } else {
      console.log(`  ⚠️  [${p.id}] Geocoding returned no state — skipped`);
      failed++;
    }

    // Respect Nominatim rate limit
    await sleep(DELAY_MS);
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`✅ Fixed: ${fixed}  |  ⚠️  Failed: ${failed}  |  Total: ${broken.length}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
}

main().catch(console.error);
