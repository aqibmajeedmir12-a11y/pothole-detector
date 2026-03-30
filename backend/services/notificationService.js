const Alert = require('../models/Alert');

class NotificationService {
  constructor() {
    this.io = null;
  }

  setSocketIO(io) {
    this.io = io;
  }

  // ── Targeted notification helpers ──────────────────────────

  /**
   * Emit a pothole detection event to the correct dashboards:
   * - District admin room (if state/district known)
   * - Super admin (always)
   * - Citizens get a separate safety-focused alert (citizenAlert)
   */
  emitPotholeDetection(pothole, alertMessage) {
    if (!this.io) return;

    const state = (pothole.state || '').toLowerCase().trim();
    const district = (pothole.district || '').toLowerCase().trim();
    const severity = pothole.severity || 'medium';

    const adminRooms = ['role:superadmin'];
    if (state) adminRooms.push(`state:${state}`);
    if (state && district) adminRooms.push(`district:${state}:${district}`);

    this.io.to(adminRooms).emit('newPothole', pothole);
    this.io.to(adminRooms).emit('newAlert', {
      message: alertMessage,
      pothole,
      targetRole: 'admin',
    });

    // 3. Citizens get a SAFETY-focused alert (not the raw detection)
    const citizenRooms = [];
    if (state) citizenRooms.push(`citizen_state:${state}`);
    if (state && district) citizenRooms.push(`citizen_district:${state}:${district}`);
    if (citizenRooms.length === 0) citizenRooms.push('role:citizen');

    this.io.to(citizenRooms).emit('citizenAlert', {
      type: 'warning',
      title: '⚠️ Pothole Warning',
      message: `Caution! A ${severity} severity pothole has been reported at ${pothole.road_name || pothole.roadName || 'nearby road'}. Please drive carefully!`,
      severity,
      pothole: {
        id: pothole.id,
        lat: pothole.lat,
        lng: pothole.lng,
        severity: pothole.severity,
        road_name: pothole.road_name || pothole.roadName,
        status: pothole.status,
      },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Emit a pothole update event to the correct dashboards
   */
  emitPotholeUpdate(pothole, alertMessage) {
    if (!this.io) return;

    const state = (pothole.state || '').toLowerCase().trim();
    const district = (pothole.district || '').toLowerCase().trim();

    const adminRooms = ['role:superadmin'];
    if (state) adminRooms.push(`state:${state}`);
    if (state && district) adminRooms.push(`district:${state}:${district}`);

    this.io.to(adminRooms).emit('potholeUpdated', pothole);
    if (alertMessage) {
      this.io.to(adminRooms).emit('newAlert', {
        message: alertMessage,
        pothole,
        targetRole: 'admin',
      });
    }

    // 3. If repaired, let citizens know it's fixed (positive notification)
    if (pothole.status === 'repaired') {
      const citizenRooms = [];
      if (state) citizenRooms.push(`citizen_state:${state}`);
      if (state && district) citizenRooms.push(`citizen_district:${state}:${district}`);
      if (citizenRooms.length === 0) citizenRooms.push('role:citizen');

      this.io.to(citizenRooms).emit('citizenAlert', {
        type: 'success',
        title: '✅ Road Repaired',
        message: `Good news! A pothole at ${pothole.road_name || pothole.roadName || 'nearby road'} has been repaired.`,
        severity: 'low',
        pothole: {
          id: pothole.id,
          lat: pothole.lat,
          lng: pothole.lng,
          severity: pothole.severity,
          road_name: pothole.road_name || pothole.roadName,
          status: pothole.status,
        },
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Emit sensor data to admin dashboards only (not citizens)
   */
  emitSensorData(data) {
    if (!this.io) return;
    // Sensor telemetry goes to admins + superadmins only
    this.io.to('role:superadmin').emit('sensorData', data);
    this.io.to('role:admin').emit('sensorData', data);
  }

  // ── Legacy methods (kept for backward compatibility) ──────

  // Send real-time notification via WebSocket
  sendRealTimeAlert(data) {
    if (this.io) {
      // Only send to admin rooms, not globally
      this.io.to('role:superadmin').to('role:admin').emit('notification', {
        type: data.type || 'info',
        title: data.title || 'Notification',
        message: data.message,
        timestamp: new Date().toISOString(),
        data: data.payload,
      });
    }
  }

  // Create alert + send real-time notification
  async notifyPotholeDetected(pothole) {
    const alertMessage = `New ${pothole.severity} severity pothole detected at ${pothole.road_name || pothole.roadName || `${pothole.lat}, ${pothole.lng}`}`;
    
    const alert = await Alert.create({
      potholeId: pothole.id,
      message: alertMessage,
      type: 'detection',
    });

    this.emitPotholeDetection(pothole, alertMessage);

    return alert;
  }

  async notifyPotholeRepaired(pothole) {
    const alertMessage = `Pothole #${pothole.id} has been marked as repaired`;

    const alert = await Alert.create({
      potholeId: pothole.id,
      message: alertMessage,
      type: 'repair',
    });

    this.emitPotholeUpdate(pothole, alertMessage);

    return alert;
  }
}

module.exports = new NotificationService();
