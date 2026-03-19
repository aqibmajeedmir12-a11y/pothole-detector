const express = require('express');
const router = express.Router();
const db = require('../config/db');

// DELETE /api/settings/clear-database - Clear all data from the database
router.delete('/clear-database', (req, res) => {
  try {
    const alertsDeleted = db.prepare('DELETE FROM alerts').run().changes;
    const sensorDeleted = db.prepare('DELETE FROM sensor_data').run().changes;
    const potholesDeleted = db.prepare('DELETE FROM potholes').run().changes;

    // Reset auto-increment counters
    db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('alerts', 'sensor_data', 'potholes')").run();

    console.log(`🗑️ Database cleared: ${potholesDeleted} potholes, ${sensorDeleted} sensor records, ${alertsDeleted} alerts`);

    res.json({
      success: true,
      message: 'Database cleared successfully',
      deleted: {
        potholes: potholesDeleted,
        sensorData: sensorDeleted,
        alerts: alertsDeleted
      }
    });
  } catch (error) {
    console.error('Error clearing database:', error);
    res.status(500).json({ error: 'Failed to clear database', message: error.message });
  }
});

// GET /api/settings/db-stats - Get database statistics
router.get('/db-stats', (req, res) => {
  try {
    const potholes = db.prepare('SELECT COUNT(*) as count FROM potholes').get().count;
    const sensorData = db.prepare('SELECT COUNT(*) as count FROM sensor_data').get().count;
    const alerts = db.prepare('SELECT COUNT(*) as count FROM alerts').get().count;

    res.json({
      success: true,
      data: {
        potholes,
        sensorData,
        alerts,
        total: potholes + sensorData + alerts
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get database stats' });
  }
});

module.exports = router;
