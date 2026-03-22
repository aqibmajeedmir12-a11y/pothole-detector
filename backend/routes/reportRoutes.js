const express = require('express');
const router = express.Router();
const db = require('../config/db');

// GET /api/reports?period=daily|monthly|yearly
router.get('/', (req, res) => {
  try {
    const period = req.query.period || 'daily';

    let groupExpr, labelExpr, dateFilter;

    switch (period) {
      case 'yearly':
        groupExpr = "strftime('%Y', detected_at)";
        labelExpr = "strftime('%Y', detected_at) as label";
        dateFilter = "detected_at >= datetime('now', '-5 years')";
        break;
      case 'monthly':
        groupExpr = "strftime('%Y-%m', detected_at)";
        labelExpr = "strftime('%Y-%m', detected_at) as label";
        dateFilter = "detected_at >= datetime('now', '-12 months')";
        break;
      case 'daily':
      default:
        groupExpr = "date(detected_at)";
        labelExpr = "date(detected_at) as label";
        dateFilter = "detected_at >= datetime('now', '-30 days')";
        break;
    }

    let p = {};
    let accessFilter = "";
    if (req.query.state) { accessFilter += " AND state = @state"; p.state = req.query.state; }
    if (req.query.district) { accessFilter += " AND district = @district"; p.district = req.query.district; }

    const combinedFilter = `${dateFilter} ${accessFilter}`;

    // Summary stats for the period
    const summary = db.prepare(`
      SELECT 
        COUNT(*) as totalDetections,
        SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) as criticalCount,
        SUM(CASE WHEN severity = 'high' THEN 1 ELSE 0 END) as highCount,
        SUM(CASE WHEN severity = 'medium' THEN 1 ELSE 0 END) as mediumCount,
        SUM(CASE WHEN severity = 'low' THEN 1 ELSE 0 END) as lowCount,
        SUM(CASE WHEN status = 'repaired' THEN 1 ELSE 0 END) as repairedCount,
        ROUND(COALESCE(SUM(cost), 0), 2) as totalCost,
        ROUND(COALESCE(AVG(confidence), 0), 3) as avgConfidence
      FROM potholes
      WHERE ${combinedFilter}
    `).get(p);

    // Grouped data for chart + table
    const grouped = db.prepare(`
      SELECT 
        ${labelExpr},
        COUNT(*) as count,
        SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) as critical,
        SUM(CASE WHEN severity = 'high' THEN 1 ELSE 0 END) as high,
        SUM(CASE WHEN severity = 'medium' THEN 1 ELSE 0 END) as medium,
        SUM(CASE WHEN severity = 'low' THEN 1 ELSE 0 END) as low,
        SUM(CASE WHEN status = 'repaired' THEN 1 ELSE 0 END) as repaired,
        ROUND(COALESCE(SUM(cost), 0), 2) as totalCost,
        ROUND(COALESCE(AVG(confidence), 0), 3) as avgConfidence
      FROM potholes
      WHERE ${combinedFilter}
      GROUP BY ${groupExpr}
      ORDER BY label ASC
    `).all(p);

    // Top road names in the period
    const topRoads = db.prepare(`
      SELECT 
        road_name, 
        COUNT(*) as count,
        ROUND(COALESCE(SUM(cost), 0), 2) as totalCost
      FROM potholes
      WHERE ${combinedFilter} AND road_name IS NOT NULL AND road_name != ''
      GROUP BY road_name
      ORDER BY count DESC
      LIMIT 10
    `).all(p);

    res.json({
      success: true,
      data: {
        period,
        summary,
        grouped,
        topRoads
      }
    });
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
