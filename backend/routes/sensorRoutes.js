const express = require('express');
const router = express.Router();
const SensorData = require('../models/SensorData');
const Pothole = require('../models/Pothole');
const Alert = require('../models/Alert');

// POST /api/sensor - Receive vibration data from ESP32
router.post('/', (req, res) => {
  try {
    const { deviceId, vibrationLevel, lat, lng, potholeDetected } = req.body;

    if (!deviceId || vibrationLevel === undefined) {
      return res.status(400).json({ error: 'deviceId and vibrationLevel are required' });
    }

    const sensorData = SensorData.create({
      deviceId,
      vibrationLevel: parseFloat(vibrationLevel),
      lat: lat ? parseFloat(lat) : null,
      lng: lng ? parseFloat(lng) : null,
      potholeDetected: !!potholeDetected
    });

    // If pothole detected by sensor, auto-create pothole entry
    if (potholeDetected && lat && lng) {
      const severity = vibrationLevel > 80 ? 'critical' : vibrationLevel > 60 ? 'high' : vibrationLevel > 40 ? 'medium' : 'low';
      
      const pothole = Pothole.create({
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        severity,
        source: 'esp32_sensor',
        description: `Auto-detected by sensor ${deviceId} with vibration level ${vibrationLevel}`,
        confidence: Math.min(vibrationLevel / 100, 1)
      });

      Alert.create({
        potholeId: pothole.id,
        message: `ESP32 sensor ${deviceId} detected pothole (vibration: ${vibrationLevel})`,
        type: 'detection'
      });

      // Broadcast via WebSocket
      const io = req.app.get('io');
      if (io) {
        io.emit('newPothole', pothole);
        io.emit('sensorData', sensorData);
      }
    } else {
      const io = req.app.get('io');
      if (io) {
        io.emit('sensorData', sensorData);
      }
    }

    res.status(201).json({ success: true, data: sensorData });
  } catch (error) {
    console.error('Error recording sensor data:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// GET /api/sensors - Get recent sensor readings
router.get('/', (req, res) => {
  try {
    const { limit, deviceId } = req.query;
    let data;
    if (deviceId) {
      data = SensorData.findByDevice(deviceId, parseInt(limit) || 100);
    } else {
      data = SensorData.findRecent(parseInt(limit) || 50);
    }
    res.json({ success: true, count: data.length, data });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/sensors/trends - Get vibration trends
router.get('/trends', (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    const trends = SensorData.getVibrationTrends(hours);
    res.json({ success: true, data: trends });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/sensors/devices - Get active devices
router.get('/devices', (req, res) => {
  try {
    const devices = SensorData.getActiveDevices();
    res.json({ success: true, data: devices });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
