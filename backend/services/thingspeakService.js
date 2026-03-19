const axios = require('axios');
const SensorData = require('../models/SensorData');
const Pothole = require('../models/Pothole');
const Alert = require('../models/Alert');

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
  processFeedEntry(entry) {
    if (!entry || !entry.entry_id) return null;

    const field1Value = parseFloat(entry.field1) || 0;
    const potholeDetected = parseInt(entry.field2) === 1;
    const field3Value = parseInt(entry.field3) || 0;
    const timestamp = entry.created_at;

    // Determine source: if field1 > 1.0, it's ESP32 vibration data
    // If field1 is 0-1.0, it's AI camera confidence data
    const isESP32 = this.isVibrationData(field1Value);

    if (isESP32) {
      // Store ESP32 vibration sensor data
      const sensorData = SensorData.create({
        deviceId: 'ESP32-VIB-01',
        vibrationLevel: field1Value,
        lat: null,
        lng: null,
        timestamp,
        potholeDetected
      });

      // Broadcast real-time sensor data via WebSocket
      if (this.io) {
        this.io.emit('sensorData', {
          ...sensorData,
          source: 'esp32',
          vibrationLevel: field1Value,
          potholeDetected,
          timestamp
        });
      }

      // If ESP32 detected a pothole via vibration, create a pothole record
      if (potholeDetected) {
        const severity = field1Value > 80 ? 'critical'
          : field1Value > 60 ? 'high'
          : field1Value > 40 ? 'medium' : 'low';

        const pothole = Pothole.create({
          lat: 8.7271,
          lng: 77.7329,
          severity,
          source: 'esp32_sensor',
          roadName: 'GCE Tirunelveli, Tamil Nadu',
          description: `Vibration sensor detected pothole (level: ${field1Value.toFixed(1)})`,
          confidence: Math.min(field1Value / 100, 1)
        });

        Alert.create({
          potholeId: pothole.id,
          message: `ESP32 vibration sensor detected ${severity} pothole (vibration: ${field1Value.toFixed(1)})`,
          type: 'detection'
        });

        if (this.io) {
          this.io.emit('newPothole', pothole);
          this.io.emit('newAlert', {
            message: `Vibration sensor detected ${severity} pothole`,
            pothole
          });
        }

        console.log(`🕳️ ESP32 pothole detected! Severity: ${severity}, Vibration: ${field1Value}`);
      }

      return sensorData;
    } else {
      // AI camera data (field1 = confidence 0-1.0)
      // DO NOT create pothole records here — the Python script already
      // sends detections directly to POST /api/pothole
      // Just broadcast telemetry for real-time dashboard updates
      if (this.io) {
        this.io.emit('sensorData', {
          source: 'ai_camera',
          confidence: field1Value,
          potholeDetected,
          boxes: field3Value,
          timestamp
        });
      }

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

        this.processFeedEntry(entry);
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
