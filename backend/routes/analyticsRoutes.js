const express = require('express');
const router = express.Router();
const Pothole = require('../models/Pothole');
const SensorData = require('../models/SensorData');
const db = require('../config/db');

// GET /api/analytics - Return comprehensive statistics
router.get('/', (req, res) => {
  try {
    const potholeStats = Pothole.getStats();
    const sensorStats = SensorData.getStats();

    // Detection frequency by day (last 30 days)
    const dailyFrequency = db.prepare(`
      SELECT date(detected_at) as day, COUNT(*) as count
      FROM potholes 
      WHERE detected_at >= datetime('now', '-30 days')
      GROUP BY day ORDER BY day ASC
    `).all();

    // High-risk areas (top locations with most potholes)
    const riskAreas = db.prepare(`
      SELECT 
        road_name,
        ROUND(lat, 3) as area_lat,
        ROUND(lng, 3) as area_lng,
        COUNT(*) as pothole_count,
        SUM(CASE WHEN severity = 'critical' THEN 4 WHEN severity = 'high' THEN 3 WHEN severity = 'medium' THEN 2 ELSE 1 END) as risk_score
      FROM potholes 
      WHERE status != 'repaired'
      GROUP BY ROUND(lat, 3), ROUND(lng, 3)
      ORDER BY risk_score DESC
      LIMIT 10
    `).all();

    // Source distribution
    const sourceDistribution = db.prepare(`
      SELECT source, COUNT(*) as count FROM potholes GROUP BY source
    `).all();

    // Monthly trend
    const monthlyTrend = db.prepare(`
      SELECT 
        strftime('%Y-%m', detected_at) as month,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'repaired' THEN 1 ELSE 0 END) as repaired
      FROM potholes
      WHERE detected_at >= datetime('now', '-12 months')
      GROUP BY month ORDER BY month ASC
    `).all();

    // Confidence trends (hourly avg from AI camera detections)
    const confidenceTrends = db.prepare(`
      SELECT 
        strftime('%Y-%m-%d %H:00:00', detected_at) as hour,
        ROUND(AVG(confidence), 3) as avg_confidence,
        ROUND(MAX(confidence), 3) as max_confidence,
        ROUND(MIN(confidence), 3) as min_confidence,
        COUNT(*) as detections
      FROM potholes 
      WHERE detected_at >= datetime('now', '-24 hours')
        AND confidence > 0
      GROUP BY hour
      ORDER BY hour ASC
    `).all();

    res.json({
      success: true,
      data: {
        potholes: potholeStats,
        sensors: sensorStats,
        dailyFrequency,
        riskAreas,
        sourceDistribution,
        monthlyTrend,
        confidenceTrends
      }
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
