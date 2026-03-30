const supabase = require('../config/db');

const SensorData = {
  async create(data) {
    const record = {
      device_id: data.deviceId,
      vibration_level: data.vibrationLevel,
      lat: data.lat || null,
      lng: data.lng || null,
      timestamp: data.timestamp || new Date().toISOString(),
      pothole_detected: data.potholeDetected ? 1 : 0,
    };

    const { data: row, error } = await supabase
      .from('sensor_data')
      .insert(record)
      .select()
      .single();

    if (error) throw new Error(`SensorData.create failed: ${error.message}`);
    return row;
  },

  async findRecent(limit = 50) {
    const { data: rows, error } = await supabase
      .from('sensor_data')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (error) throw new Error(`SensorData.findRecent failed: ${error.message}`);
    return rows || [];
  },

  async findByDevice(deviceId, limit = 100) {
    const { data: rows, error } = await supabase
      .from('sensor_data')
      .select('*')
      .eq('device_id', deviceId)
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (error) throw new Error(`SensorData.findByDevice failed: ${error.message}`);
    return rows || [];
  },

  async getVibrationTrends(hours = 24) {
    const { data: rows, error } = await supabase.rpc('get_vibration_trends', {
      p_hours: hours,
    });

    if (error) throw new Error(`SensorData.getVibrationTrends failed: ${error.message}`);
    return rows || [];
  },

  async getActiveDevices() {
    // Get devices active in the last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { data: rows, error } = await supabase
      .from('sensor_data')
      .select('device_id, vibration_level, timestamp')
      .gte('timestamp', oneHourAgo);

    if (error) throw new Error(`SensorData.getActiveDevices failed: ${error.message}`);

    // Group by device_id in JavaScript (Supabase query builder doesn't support GROUP BY directly)
    const deviceMap = {};
    for (const row of (rows || [])) {
      if (!deviceMap[row.device_id]) {
        deviceMap[row.device_id] = {
          device_id: row.device_id,
          total_readings: 0,
          last_seen: row.timestamp,
          vibration_sum: 0,
        };
      }
      const d = deviceMap[row.device_id];
      d.total_readings++;
      d.vibration_sum += row.vibration_level;
      if (new Date(row.timestamp) > new Date(d.last_seen)) {
        d.last_seen = row.timestamp;
      }
    }

    return Object.values(deviceMap).map(d => ({
      device_id: d.device_id,
      total_readings: d.total_readings,
      last_seen: d.last_seen,
      avg_vibration: parseFloat((d.vibration_sum / d.total_readings).toFixed(2)),
    }));
  },

  async getStats() {
    const [totalRes, activeDevices, potholeRes] = await Promise.all([
      supabase.from('sensor_data').select('*', { count: 'exact', head: true }),
      this.getActiveDevices(),
      supabase.from('sensor_data').select('*', { count: 'exact', head: true }).eq('pothole_detected', 1),
    ]);

    return {
      totalReadings: totalRes.count || 0,
      activeDeviceCount: activeDevices.length,
      activeDevices,
      potholeDetections: potholeRes.count || 0,
    };
  },
};

module.exports = SensorData;
