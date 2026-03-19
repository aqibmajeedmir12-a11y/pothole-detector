const Alert = require('../models/Alert');

class NotificationService {
  constructor() {
    this.io = null;
  }

  setSocketIO(io) {
    this.io = io;
  }

  // Send real-time notification via WebSocket
  sendRealTimeAlert(data) {
    if (this.io) {
      this.io.emit('notification', {
        type: data.type || 'info',
        title: data.title || 'Notification',
        message: data.message,
        timestamp: new Date().toISOString(),
        data: data.payload
      });
    }
  }

  // Create alert + send real-time notification
  async notifyPotholeDetected(pothole) {
    const alert = Alert.create({
      potholeId: pothole.id,
      message: `New ${pothole.severity} severity pothole detected at ${pothole.roadName || `${pothole.lat}, ${pothole.lng}`}`,
      type: 'detection'
    });

    this.sendRealTimeAlert({
      type: 'warning',
      title: 'Pothole Detected',
      message: alert.message,
      payload: pothole
    });

    return alert;
  }

  async notifyPotholeRepaired(pothole) {
    const alert = Alert.create({
      potholeId: pothole.id,
      message: `Pothole #${pothole.id} has been marked as repaired`,
      type: 'repair'
    });

    this.sendRealTimeAlert({
      type: 'success',
      title: 'Pothole Repaired',
      message: alert.message,
      payload: pothole
    });

    return alert;
  }
}

module.exports = new NotificationService();
