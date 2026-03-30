const express = require('express');
const router = express.Router();
const supabase = require('../config/db');

// GET /api/reports?period=daily|monthly|yearly
router.get('/', async (req, res) => {
  try {
    const period = req.query.period || 'daily';
    const state = req.query.state || null;
    const district = req.query.district || null;

    const rpcParams = { p_period: period, p_state: state, p_district: district };

    // Fetch summary, grouped data, and top roads in parallel
    const [summaryRes, groupedRes, topRoadsRes] = await Promise.all([
      supabase.rpc('get_report_summary', rpcParams),
      supabase.rpc('get_report_data', rpcParams),
      supabase.rpc('get_top_roads', rpcParams),
    ]);

    if (summaryRes.error) throw summaryRes.error;
    if (groupedRes.error) throw groupedRes.error;
    if (topRoadsRes.error) throw topRoadsRes.error;

    // Parse the summary row
    const rawSummary = summaryRes.data && summaryRes.data.length > 0 ? summaryRes.data[0] : {};
    const summary = {};
    for (const [k, v] of Object.entries(rawSummary)) {
      summary[k] = parseFloat(v || 0);
    }

    // Parse grouped rows
    const grouped = (groupedRes.data || []).map(row => {
      const parsed = { label: row.label };
      for (const [k, v] of Object.entries(row)) {
        if (k !== 'label') parsed[k] = parseFloat(v || 0);
      }
      return parsed;
    });

    // Parse top roads
    const topRoads = (topRoadsRes.data || []).map(row => ({
      road_name: row.road_name,
      count: parseInt(row.count),
      totalCost: parseFloat(row.total_cost || 0),
    }));

    res.json({
      success: true,
      data: { period, summary, grouped, topRoads },
    });
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
