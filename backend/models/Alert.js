const db = require('../config/db');

const Alert = {
  create(data) {
    const stmt = db.prepare(`
      INSERT INTO alerts (pothole_id, message, type)
      VALUES (@potholeId, @message, @type)
    `);
    const result = stmt.run({
      potholeId: data.potholeId || null,
      message: data.message,
      type: data.type || 'detection'
    });
    return { id: result.lastInsertRowid, ...data };
  },

  findAll(limit = 50) {
    return db.prepare('SELECT * FROM alerts ORDER BY created_at DESC LIMIT ?').all(limit);
  },

  findUnread() {
    return db.prepare("SELECT * FROM alerts WHERE read = 0 ORDER BY created_at DESC").all();
  },

  markRead(id) {
    db.prepare('UPDATE alerts SET read = 1 WHERE id = ?').run(id);
  },

  markAllRead() {
    db.prepare('UPDATE alerts SET read = 1 WHERE read = 0').run();
  },

  getUnreadCount() {
    return db.prepare('SELECT COUNT(*) as count FROM alerts WHERE read = 0').get().count;
  }
};

module.exports = Alert;
