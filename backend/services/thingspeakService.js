const axios = require('axios');
const SensorData = require('../models/SensorData');
const Pothole = require('../models/Pothole');
const Alert = require('../models/Alert');
const { getGeocodeData } = require('../utils/geocode');
const notificationService = require('./notificationService');

class ThingSpeakService {
  constructor() {
    this.baseUrl = 'https://api.thingspeak.com';
    this.writeKey = process.env.THINGSPEAK_WRITE_KEY;
    this.readKey = process.env.THINGSPEAK_READ_KEY;
    this.channelId = process.env.THINGSPEAK_CHANNEL_ID;
    this.lastEntryId = 0;
    this.pollingInterval = null;
    this.io = null;

    /*
     * ThingSpeak Field Mapping (Channel 3299005):
     *   field1 = Confidence / Vibration Value (numeric)
     *            - From AI camera: 0.0–1.0 (confidence score)
     *            - From ESP32: 0–100+ (vibration level)
     *   field2 = Pothole Status  (0 = no, 1 = yes)
     *   field3 = Box Count (from AI camera, number of detected boxes)
     *
     * NOTE: The AI camera (pothole_detector.py) sends detections
     * DIRECTLY to the backend API via POST /api/pothole.
     * ThingSpeak entries from the AI camera should NOT create
     * duplicate pothole records here. Only ESP32 vibration sensor
     * data (field1 > 1.0) should create pothole records.
     */
  }

  setSocketIO(io) {
    this.io = io;
  }

  // Write sensor data TO ThingSpeak
  async writeData(fields) {
    if (!this.writeKey) {
      console.log('⚠️ ThingSpeak write key not configured');
      return null;
    }
    try {
      const response = await axios.get(`${this.baseUrl}/update`, {
        params: { api_key: this.writeKey, ...fields }
      });
      return response.data;
    } catch (error) {
      console.error('ThingSpeak write error:', error.message);
      return null;
    }
  }

  // Write vibration data to ThingSpeak
  async writeSensorData(vibrationLevel, potholeDetected, aiDetection) {
    return this.writeData({
      field1: vibrationLevel,
      field2: potholeDetected ? 1 : 0,
      field3: aiDetection ? 1 : 0
    });
  }

  // Read latest feeds FROM ThingSpeak channel
  async readChannel(results = 10) {
    if (!this.channelId || !this.readKey) {
      console.log('⚠️ ThingSpeak read config not set');
      return null;
    }
    try {
      const response = await axios.get(
        `${this.baseUrl}/channels/${this.channelId}/feeds.json`,
        { params: { api_key: this.readKey, results } }
      );
      return response.data;
    } catch (error) {
      console.error('ThingSpeak read error:', error.message);
      return null;
    }
  }

  // Read last single entry from ThingSpeak
  async readLastEntry() {
    if (!this.channelId || !this.readKey) return null;
    try {
      const response = await axios.get(
        `${this.baseUrl}/channels/${this.channelId}/feeds/last.json`,
        { params: { api_key: this.readKey } }
      );
      return response.data;
    } catch (error) {
      console.error('ThingSpeak last entry error:', error.message);
      return null;
    }
  }

  // Determine if a field1 value is ESP32 vibration (>1.0) vs AI confidence (0-1.0)
  isVibrationData(field1Value) {
    return field1Value > 1.0;
  }

  // Process a ThingSpeak feed entry and store in our database
  async processFeedEntry(entry) {
    if (!entry || !entry.entry_id) return null;

    const field1Value = parseFloat(entry.field1) || 0;
    const potholeDetected = parseInt(entry.field2) === 1;
    const field3Value = parseInt(entry.field3) || 0;
    const lat = parseFloat(entry.field5) || 0;
    const lng = parseFloat(entry.field6) || 0;
    const timestamp = entry.created_at;

    // Determine source: ESP32 entries have field3 = null (no AI camera data)
    // AI camera entries have field3 set (box count). This is more reliable than
    // checking field1 > 1.0, since ESP32 sends 0 when there's no vibration.
    const isESP32 = entry.field3 === null || entry.field3 === undefined;

    if (isESP32) {
      // Store ESP32 vibration sensor data
      const sensorData = await SensorData.create({
        deviceId: 'ESP32-VIB-01',
        vibrationLevel: field1Value,
        lat: lat !== 0 ? lat : null,
        lng: lng !== 0 ? lng : null,
        timestamp,
        potholeDetected
      });

      // Broadcast real-time sensor data via WebSocket (admins only)
      notificationService.emitSensorData({
        ...sensorData,
        source: 'esp32',
        vibrationLevel: field1Value,
        potholeDetected,
        timestamp
      });

      // If ESP32 detected a pothole via vibration, create a pothole record
      if (potholeDetected) {
        const severity = field1Value > 80 ? 'critical'
          : field1Value > 60 ? 'high'
          : field1Value > 40 ? 'medium' : 'low';

        let finalLat = lat !== 0 ? lat : 8.6824;
        let finalLng = lng !== 0 ? lng : 77.7271;

        const geo = await getGeocodeData(finalLat, finalLng);
        let roadName = geo.roadName || 'Unknown Location';
        let state = geo.state;
        let district = geo.district;

        // ── Check for existing nearby pothole (Clustering) ──
        const existingPothole = await Pothole.findNearbyActive(finalLat, finalLng, 20); // 20 meters
        let pothole;

        if (existingPothole) {
          // Update existing pothole — refresh timestamp + severity + geocoding
          const updates = {};
          const severityLevels = { low: 1, medium: 2, high: 3, critical: 4 };
          if (severityLevels[severity] > severityLevels[existingPothole.severity]) {
            updates.severity = severity;
          }
          const newConf = Math.min(field1Value / 100, 1);
          if (newConf > existingPothole.confidence) {
            updates.confidence = newConf;
          }

          // Fix missing geocoding data on old record
          if (!existingPothole.state && state) {
            updates.state = state;
            updates.district = district;
            updates.roadName = roadName;
          }

          // Always update the timestamp so it shows as a recent detection
          updates.detectedAt = new Date().toISOString();
          updates.description = `Vibration sensor re-detected pothole (level: ${field1Value.toFixed(1)})`;
          
          pothole = await Pothole.update(existingPothole.id, updates);

          const reAlertMsg = `ESP32 sensor re-detected ${pothole.severity || severity} pothole at ${roadName} (vibration: ${field1Value.toFixed(1)})`;
          await Alert.create({
            potholeId: pothole.id,
            message: reAlertMsg,
            type: 'detection'
          });
          
          notificationService.emitPotholeUpdate(pothole, reAlertMsg);
          console.log(`🕳️ ESP32 pothole re-detected & updated! ID: ${existingPothole.id}, Vibration: ${field1Value}`);
        } else {
          // Create new pothole record
          pothole = await Pothole.create({
            lat: finalLat,
            lng: finalLng,
            severity,
            source: 'esp32_sensor',
            roadName: roadName,
            state: state,
            district: district,
            description: `Vibration sensor detected pothole (level: ${field1Value.toFixed(1)})`,
            confidence: Math.min(field1Value / 100, 1)
          });

          const newAlertMsg = `ESP32 vibration sensor detected ${severity} pothole at ${roadName} (vibration: ${field1Value.toFixed(1)})`;
          await Alert.create({
            potholeId: pothole.id,
            message: newAlertMsg,
            type: 'detection'
          });

          notificationService.emitPotholeDetection(pothole, newAlertMsg);
          console.log(`🕳️ New ESP32 pothole created! Severity: ${severity}, Vibration: ${field1Value}`);
        }
      }

      return sensorData;
    } else {
      // AI camera data (field1 = confidence 0-1.0)
      // DO NOT create pothole records here — the Python script already
      // sends detections directly to POST /api/pothole
      // Just broadcast telemetry for real-time dashboard updates (admins only)
      notificationService.emitSensorData({
        source: 'ai_camera',
        confidence: field1Value,
        potholeDetected,
        boxes: field3Value,
        timestamp
      });

      console.log(`📷 AI camera telemetry from ThingSpeak (conf: ${field1Value}, boxes: ${field3Value}) — skipping pothole creation (handled by direct API)`);
      return null;
    }
  }

  // Start polling ThingSpeak for new data every 15 seconds
  startPolling(intervalMs = 15000) {
    if (!this.channelId || !this.readKey) {
      console.log('⚠️ ThingSpeak not configured, skipping polling');
      return;
    }

    console.log(`📡 ThingSpeak polling started (every ${intervalMs / 1000}s) - Channel: ${this.channelId}`);

    // Initial fetch - get last 5 entries to populate dashboard
    this.fetchNewEntries(5);

    // Poll for new entries
    this.pollingInterval = setInterval(() => {
      this.fetchNewEntries(3);
    }, intervalMs);
  }

  async fetchNewEntries(count = 3) {
    try {
      const data = await this.readChannel(count);
      if (!data || !data.feeds || data.feeds.length === 0) return;

      let newEntries = 0;
      for (const entry of data.feeds) {
        // Skip already processed entries
        if (entry.entry_id <= this.lastEntryId) continue;

        await this.processFeedEntry(entry);
        this.lastEntryId = entry.entry_id;
        newEntries++;
      }

      if (newEntries > 0) {
        console.log(`📊 Processed ${newEntries} new ThingSpeak entries (last ID: ${this.lastEntryId})`);
      }
    } catch (error) {
      console.error('ThingSpeak polling error:', error.message);
    }
  }

  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      console.log('📡 ThingSpeak polling stopped');
    }
  }
}

module.exports = new ThingSpeakService();
