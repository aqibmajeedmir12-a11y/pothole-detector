const Pothole = require('../models/Pothole');
const Alert = require('../models/Alert');
const { getGeocodeData } = require('../utils/geocode');
const notificationService = require('../services/notificationService');

exports.createPothole = async (req, res) => {
  try {
    const { lat, lng, severity, source, imageUrl, description, roadName, confidence, bboxWidth, bboxHeight } = req.body;

    if (lat === undefined || lat === null || lng === undefined || lng === null) {
      return res.status(400).json({ error: 'lat and lng are required' });
    }

    // Repair Estimation
    const SCALE_FACTOR = 0.002;
    const DEPTH = 0.05;
    const COST_PER_M3 = 4000;

    let area = 0, volume = 0, cost = 0;
    if (bboxWidth && bboxHeight) {
      area = (bboxWidth * SCALE_FACTOR) * (bboxHeight * SCALE_FACTOR);
      volume = area * DEPTH;
      cost = Math.round(volume * COST_PER_M3);
    }

    const existingPothole = await Pothole.findNearbyActive(parseFloat(lat), parseFloat(lng), 20);

    if (existingPothole) {
      const updates = {};
      const newConf = confidence ? parseFloat(confidence) : 0;
      
      if (newConf > existingPothole.confidence) {
        updates.confidence = newConf;
      }
      
      const severityLevels = { low: 1, medium: 2, high: 3, critical: 4 };
      if (severity && severityLevels[severity] > severityLevels[existingPothole.severity]) {
        updates.severity = severity;
      }

      if (!existingPothole.image_url && imageUrl) {
        updates.imageUrl = imageUrl;
      }
      
      if (!existingPothole.state && lat && lng) {
        const geo = await getGeocodeData(parseFloat(lat), parseFloat(lng));
        if (geo.state) {
          updates.state = geo.state;
          updates.district = geo.district;
          if (geo.roadName) updates.roadName = geo.roadName;
        }
      }
      
      updates.detectedAt = new Date().toISOString();
      const newSeverity = updates.severity || existingPothole.severity;
      updates.description = `AI re-detected ${newSeverity} pothole (${(newConf * 100).toFixed(1)}% conf)`;
      
      const updatedPothole = await Pothole.update(existingPothole.id, updates);

      const reAlertMsg = `AI Camera re-detected ${newSeverity} pothole at ${existingPothole.road_name || 'Location'} (Conf: ${(newConf * 100).toFixed(1)}%)`;
      await Alert.create({
        potholeId: updatedPothole.id,
        message: reAlertMsg,
        type: 'detection'
      });

      notificationService.emitPotholeUpdate(updatedPothole, reAlertMsg);

      return res.status(200).json({ success: true, message: 'Updated existing nearby pothole', data: updatedPothole });
    }

    let finalRoadName = roadName;
    let state = null;
    let district = null;
    
    if (lat && lng) {
        const geo = await getGeocodeData(parseFloat(lat), parseFloat(lng));
        finalRoadName = geo.roadName || finalRoadName;
        state = geo.state;
        district = geo.district;
    }

    const pothole = await Pothole.create({
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      severity: severity || 'medium',
      source: source || 'manual',
      imageUrl,
      description,
      roadName: finalRoadName,
      state,
      district,
      confidence: confidence ? parseFloat(confidence) : 0,
      area: parseFloat(area.toFixed(6)),
      volume: parseFloat(volume.toFixed(8)),
      cost
    });

    const alertMsg = `New ${severity || 'medium'} severity pothole detected at ${finalRoadName || `${parseFloat(lat).toFixed(4)}, ${parseFloat(lng).toFixed(4)}`}`;
    await Alert.create({
      potholeId: pothole.id,
      message: alertMsg,
      type: 'detection'
    });

    notificationService.emitPotholeDetection(pothole, alertMsg);

    res.status(201).json({ success: true, data: pothole });
  } catch (error) {
    console.error('Error creating pothole:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};

exports.getAllPotholes = async (req, res) => {
  try {
    const { status, severity, source, limit, state, district } = req.query;
    const safeLimit = limit ? parseInt(limit) : 500;
    const potholes = await Pothole.findAll({ status, severity, source, limit: safeLimit, state, district });
    res.json({ success: true, count: potholes.length, data: potholes });
  } catch (error) {
    console.error('Error fetching potholes:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getPotholeById = async (req, res) => {
  try {
    const pothole = await Pothole.findById(req.params.id);
    if (!pothole) {
      return res.status(404).json({ error: 'Pothole not found' });
    }
    res.json({ success: true, data: pothole });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.updatePothole = async (req, res) => {
  try {
    const existing = await Pothole.findById(req.params.id);
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

    const updated = await Pothole.update(req.params.id, updates);

    const alertMsg2 = req.body.status === 'repaired' 
      ? `Pothole #${req.params.id} has been marked as repaired`
      : null;
    notificationService.emitPotholeUpdate(updated, alertMsg2);

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error updating pothole:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.deletePothole = async (req, res) => {
  try {
    const existing = await Pothole.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Pothole not found' });
    }
    await Pothole.delete(req.params.id);
    res.json({ success: true, message: 'Pothole deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};
