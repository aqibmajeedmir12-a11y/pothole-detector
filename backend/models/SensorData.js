const db = require('../config/db');

const SensorData = {
  create(data) {
    const stmt = db.prepare(`
      INSERT INTO sensor_data (device_id, vibration_level, lat, lng, timestamp, pothole_detected)
      VALUES (@deviceId, @vibrationLevel, @lat, @lng, @timestamp, @potholeDetected)
    `);
    const result = stmt.run({
      deviceId: data.deviceId,
      vibrationLevel: data.vibrationLevel,
      lat: data.lat || null,
      lng: data.lng || null,
      timestamp: data.timestamp || new Date().toISOString(),
      potholeDetected: data.potholeDetected ? 1 : 0
    });
    return { id: result.lastInsertRowid, ...data };
  },

  findRecent(limit = 50) {
    return db.prepare('SELECT * FROM sensor_data ORDER BY timestamp DESC LIMIT ?').all(limit);
  },

  findByDevice(deviceId, limit = 100) {
    return db.prepare('SELECT * FROM sensor_data WHERE device_id = ? ORDER BY timestamp DESC LIMIT ?').all(deviceId, limit);
  },

  getVibrationTrends(hours = 24) {
    return db.prepare(`
      SELECT 
        strftime('%Y-%m-%d %H:00:00', timestamp) as hour,
        AVG(vibration_level) as avg_vibration,
        MAX(vibration_level) as max_vibration,
        MIN(vibration_level) as min_vibration,
        COUNT(*) as readings
      FROM sensor_data 
      WHERE timestamp >= datetime('now', '-' || ? || ' hours')
      GROUP BY hour
      ORDER BY hour ASC
    `).all(hours);
  },

  getActiveDevices() {
    return db.prepare(`
      SELECT 
        device_id,
        COUNT(*) as total_readings,
        MAX(timestamp) as last_seen,
        AVG(vibration_level) as avg_vibration
      FROM sensor_data
      WHERE timestamp >= datetime('now', '-1 hour')
      GROUP BY device_id
    `).all();
  },

  getStats() {
    const totalReadings = db.prepare('SELECT COUNT(*) as count FROM sensor_data').get().count;
    const activeDevices = this.getActiveDevices();
    const potholeDetections = db.prepare('SELECT COUNT(*) as count FROM sensor_data WHERE pothole_detected = 1').get().count;
    
    return {
      totalReadings,
      activeDeviceCount: activeDevices.length,
      activeDevices,
      potholeDetections
    };
  }
};

module.exports = SensorData;
