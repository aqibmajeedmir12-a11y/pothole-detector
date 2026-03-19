const express = require('express');
const router = express.Router();
const Pothole = require('../models/Pothole');
const Alert = require('../models/Alert');

// POST /api/pothole - Receive pothole detection from AI or sensor
router.post('/', (req, res) => {
  try {
    const { lat, lng, severity, source, imageUrl, description, roadName, confidence, bboxWidth, bboxHeight } = req.body;

    if (lat === undefined || lat === null || lng === undefined || lng === null) {
      return res.status(400).json({ error: 'lat and lng are required' });
    }

    // ── Repair Estimation ───────────────────────
    const SCALE_FACTOR = 0.002;  // meters per pixel
    const DEPTH = 0.05;          // assumed depth in meters
    const COST_PER_M3 = 4000;    // ₹ per cubic meter

    let area = 0, volume = 0, cost = 0;
    if (bboxWidth && bboxHeight) {
      area = (bboxWidth * SCALE_FACTOR) * (bboxHeight * SCALE_FACTOR);
      volume = area * DEPTH;
      cost = Math.round(volume * COST_PER_M3);
    }

    const pothole = Pothole.create({
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      severity: severity || 'medium',
      source: source || 'manual',
      imageUrl,
      description,
      roadName,
      confidence: confidence ? parseFloat(confidence) : 0,
      area: parseFloat(area.toFixed(6)),
      volume: parseFloat(volume.toFixed(8)),
      cost
    });

    // Create alert
    Alert.create({
      potholeId: pothole.id,
      message: `New ${severity || 'medium'} severity pothole detected at ${roadName || `${lat}, ${lng}`}`,
      type: 'detection'
    });

    // Broadcast via WebSocket
    const io = req.app.get('io');
    if (io) {
      io.emit('newPothole', pothole);
      io.emit('newAlert', {
        message: `New ${severity || 'medium'} severity pothole detected`,
        pothole
      });
    }

    res.status(201).json({ success: true, data: pothole });
  } catch (error) {
    console.error('Error creating pothole:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// GET /api/potholes - Get all potholes with optional filters
router.get('/', (req, res) => {
  try {
    const { status, severity, source, limit } = req.query;
    const potholes = Pothole.findAll({ status, severity, source, limit });
    res.json({ success: true, count: potholes.length, data: potholes });
  } catch (error) {
    console.error('Error fetching potholes:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/pothole/:id - Get a single pothole
router.get('/:id', (req, res) => {
  try {
    const pothole = Pothole.findById(req.params.id);
    if (!pothole) {
      return res.status(404).json({ error: 'Pothole not found' });
    }
    res.json({ success: true, data: pothole });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/pothole/:id - Update pothole status/details
router.patch('/:id', (req, res) => {
  try {
    const existing = Pothole.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Pothole not found' });
    }

    const updates = {};
    if (req.body.status) updates.status = req.body.status;
    if (req.body.severity) updates.severity = req.body.severity;
    if (req.body.maintenanceNotes !== undefined) updates.maintenanceNotes = req.body.maintenanceNotes;
    if (req.body.description !== undefined) updates.description = req.body.description;
    
    if (req.body.status === 'repaired') {
      updates.repairedAt = new Date().toISOString();
    }

    const updated = Pothole.update(req.params.id, updates);

    // Broadcast update via WebSocket
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

// DELETE /api/pothole/:id - Delete a pothole
router.delete('/:id', (req, res) => {
  try {
    const existing = Pothole.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Pothole not found' });
    }
    Pothole.delete(req.params.id);
    res.json({ success: true, message: 'Pothole deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
