const express = require('express');
const router = express.Router();
const supabase = require('../config/db');

// DELETE /api/settings/clear-database - Clear all data from the database
router.delete('/clear-database', async (req, res) => {
  try {
    // Delete in order: alerts → sensor_data → potholes (respects FK constraints)
    const [alertsRes, sensorRes, potholesRes] = await Promise.all([
      supabase.from('alerts').delete().neq('id', 0),       // delete all rows
      supabase.from('sensor_data').delete().neq('id', 0),
      supabase.from('potholes').delete().neq('id', 0),
    ]);

    // Check for errors
    if (alertsRes.error) throw alertsRes.error;
    if (sensorRes.error) throw sensorRes.error;
    if (potholesRes.error) throw potholesRes.error;

    console.log('🗑️ Database cleared successfully');

    res.json({
      success: true,
      message: 'Database cleared successfully',
      deleted: {
        potholes: 'all',
        sensorData: 'all',
        alerts: 'all',
      },
    });
  } catch (error) {
    console.error('Error clearing database:', error);
    res.status(500).json({ error: 'Failed to clear database', message: error.message });
  }
});

// GET /api/settings/db-stats - Get database statistics
router.get('/db-stats', async (req, res) => {
  try {
    const [potholesRes, sensorDataRes, alertsRes] = await Promise.all([
      supabase.from('potholes').select('*', { count: 'exact', head: true }),
      supabase.from('sensor_data').select('*', { count: 'exact', head: true }),
      supabase.from('alerts').select('*', { count: 'exact', head: true }),
    ]);

    const potholes = potholesRes.count || 0;
    const sensorData = sensorDataRes.count || 0;
    const alerts = alertsRes.count || 0;

    res.json({
      success: true,
      data: {
        potholes,
        sensorData,
        alerts,
        total: potholes + sensorData + alerts,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get database stats' });
  }
});

module.exports = router;
