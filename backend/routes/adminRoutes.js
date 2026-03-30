const express = require('express');
const router = express.Router();
const Pothole = require('../models/Pothole');
const Alert = require('../models/Alert');

// PATCH /api/admin/pothole/:id - Manage pothole (mark repaired, add notes)
router.patch('/pothole/:id', async (req, res) => {
  try {
    const existing = await Pothole.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Pothole not found' });
    }

    const updates = {};
    if (req.body.status) updates.status = req.body.status;
    if (req.body.maintenanceNotes !== undefined) updates.maintenanceNotes = req.body.maintenanceNotes;
    if (req.body.severity) updates.severity = req.body.severity;
    
    if (req.body.status === 'repaired') {
      updates.repairedAt = new Date().toISOString();
      await Alert.create({
        potholeId: parseInt(req.params.id),
        message: `Pothole #${req.params.id} at ${existing.road_name || `${existing.lat}, ${existing.lng}`} has been repaired`,
        type: 'repair'
      });
    }

    if (req.body.status === 'in_repair') {
      await Alert.create({
        potholeId: parseInt(req.params.id),
        message: `Repair started for pothole #${req.params.id} at ${existing.road_name || `${existing.lat}, ${existing.lng}`}`,
        type: 'severity_change'
      });
    }

    const updated = await Pothole.update(req.params.id, updates);

    // Broadcast update
    const io = req.app.get('io');
    if (io) {
      io.emit('potholeUpdated', updated);
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error updating pothole:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/potholes - Get all potholes with full details for admin
router.get('/potholes', async (req, res) => {
  try {
    const { status, severity, limit } = req.query;
    const safeLimit = limit ? parseInt(limit) : 500;
    const potholes = await Pothole.findAll({ status, severity, limit: safeLimit });
    res.json({ success: true, count: potholes.length, data: potholes });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/alerts - Get alerts
router.get('/alerts', async (req, res) => {
  try {
    const alerts = await Alert.findAll(parseInt(req.query.limit) || 50);
    const unreadCount = await Alert.getUnreadCount();
    res.json({ success: true, unreadCount, data: alerts });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/alerts/read - Mark all alerts as read
router.post('/alerts/read', async (req, res) => {
  try {
    await Alert.markAllRead();
    res.json({ success: true, message: 'All alerts marked as read' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/alerts/:id/read - Mark single alert as read
router.post('/alerts/:id/read', async (req, res) => {
  try {
    await Alert.markRead(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
