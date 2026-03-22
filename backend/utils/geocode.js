const axios = require('axios');

async function getGeocodeData(lat, lng) {
  const result = { roadName: 'Unknown Location', state: null, district: null };
  if (!lat || !lng) return result;

  try {
    const response = await axios.get('https://nominatim.openstreetmap.org/reverse', {
      params: { lat, lon: lng, format: 'json', zoom: 16 },
      headers: { 'User-Agent': 'AIoT-Road-Monitor-Backend/1.0' },
      timeout: 5000
    });
    const data = response.data;
    
    if (data && data.address) {
      const addr = data.address;
      
      // Determine road name
      let name = addr.road || addr.suburb || addr.town || addr.city || (data.display_name ? data.display_name.split(',')[0] : '');
      const area = addr.suburb || addr.town || addr.city || addr.state_district || '';
      if (area && area !== name) name = `${name}, ${area}`;
      if (name) result.roadName = name;

      // Extract state and district
      result.state = addr.state || null;
      // In India, district is often mapped to state_district or county in Nominatim
      result.district = addr.state_district || addr.county || addr.city || null;
    }
  } catch (error) {
    console.error('Reverse geocoding error:', error.message);
    result.roadName = `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
  }
  
  return result;
}

module.exports = { getGeocodeData };
