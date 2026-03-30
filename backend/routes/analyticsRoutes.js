const express = require('express');
const router = express.Router();
const Pothole = require('../models/Pothole');
const SensorData = require('../models/SensorData');
const supabase = require('../config/db');

// GET /api/analytics - Return comprehensive statistics
router.get('/', async (req, res) => {
  try {
    const { state, district } = req.query;
    const rpcParams = {
      p_state: state || null,
      p_district: district || null,
    };

    const [potholeStats, sensorStats] = await Promise.all([
      Pothole.getStats(req.query),
      SensorData.getStats(),
    ]);

    // Run all RPC functions in parallel
    const [
      dailyFrequencyRes,
      riskAreasRes,
      sourceDistributionRes,
      monthlyTrendRes,
      confidenceTrendsRes,
    ] = await Promise.all([
      supabase.rpc('get_daily_frequency', rpcParams),
      supabase.rpc('get_risk_areas', rpcParams),
      supabase.rpc('get_source_distribution', rpcParams),
      supabase.rpc('get_monthly_trend', rpcParams),
      supabase.rpc('get_confidence_trends', rpcParams),
    ]);

    res.json({
      success: true,
      data: {
        potholes: potholeStats,
        sensors: sensorStats,
        dailyFrequency: (dailyFrequencyRes.data || []).map(r => ({
          day: r.day,
          count: parseInt(r.count),
        })),
        riskAreas: (riskAreasRes.data || []).map(r => ({
          ...r,
          pothole_count: parseInt(r.pothole_count),
          risk_score: parseInt(r.risk_score),
        })),
        sourceDistribution: (sourceDistributionRes.data || []).map(r => ({
          source: r.source,
          count: parseInt(r.count),
        })),
        monthlyTrend: (monthlyTrendRes.data || []).map(r => ({
          ...r,
          total: parseInt(r.total),
          repaired: parseInt(r.repaired),
        })),
        confidenceTrends: (confidenceTrendsRes.data || []).map(r => ({
          ...r,
          detections: parseInt(r.detections),
        })),
      },
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
