const db = require('../config/db');

const Pothole = {
  create(data) {
    const stmt = db.prepare(`
      INSERT INTO potholes (lat, lng, severity, source, image_url, description, status, detected_at, road_name, confidence, area, volume, cost)
      VALUES (@lat, @lng, @severity, @source, @imageUrl, @description, @status, @detectedAt, @roadName, @confidence, @area, @volume, @cost)
    `);
    const result = stmt.run({
      lat: data.lat,
      lng: data.lng,
      severity: data.severity || 'medium',
      source: data.source || 'manual',
      imageUrl: data.imageUrl || null,
      description: data.description || null,
      status: data.status || 'detected',
      detectedAt: data.detectedAt || new Date().toISOString(),
      roadName: data.roadName || null,
      confidence: data.confidence || 0,
      area: data.area || 0,
      volume: data.volume || 0,
      cost: data.cost || 0
    });
    return { id: result.lastInsertRowid, ...data };
  },

  findAll(filters = {}) {
    let query = 'SELECT * FROM potholes WHERE 1=1';
    const params = {};

    if (filters.status) {
      query += ' AND status = @status';
      params.status = filters.status;
    }
    if (filters.severity) {
      query += ' AND severity = @severity';
      params.severity = filters.severity;
    }
    if (filters.source) {
      query += ' AND source = @source';
      params.source = filters.source;
    }

    query += ' ORDER BY detected_at DESC';

    if (filters.limit) {
      query += ' LIMIT @limit';
      params.limit = parseInt(filters.limit);
    }

    return db.prepare(query).all(params);
  },

  findById(id) {
    return db.prepare('SELECT * FROM potholes WHERE id = ?').get(id);
  },

  update(id, data) {
    const fields = [];
    const params = { id };

    if (data.status !== undefined) { fields.push('status = @status'); params.status = data.status; }
    if (data.severity !== undefined) { fields.push('severity = @severity'); params.severity = data.severity; }
    if (data.maintenanceNotes !== undefined) { fields.push('maintenance_notes = @maintenanceNotes'); params.maintenanceNotes = data.maintenanceNotes; }
    if (data.repairedAt !== undefined) { fields.push('repaired_at = @repairedAt'); params.repairedAt = data.repairedAt; }
    if (data.description !== undefined) { fields.push('description = @description'); params.description = data.description; }

    fields.push("updated_at = datetime('now')");

    if (fields.length === 1) return this.findById(id); // only updated_at, nothing to change

    const stmt = db.prepare(`UPDATE potholes SET ${fields.join(', ')} WHERE id = @id`);
    stmt.run(params);
    return this.findById(id);
  },

  delete(id) {
    return db.prepare('DELETE FROM potholes WHERE id = ?').run(id);
  },

  getStats() {
    const total = db.prepare('SELECT COUNT(*) as count FROM potholes').get().count;
    const detected = db.prepare("SELECT COUNT(*) as count FROM potholes WHERE status = 'detected'").get().count;
    const confirmed = db.prepare("SELECT COUNT(*) as count FROM potholes WHERE status = 'confirmed'").get().count;
    const inRepair = db.prepare("SELECT COUNT(*) as count FROM potholes WHERE status = 'in_repair'").get().count;
    const repaired = db.prepare("SELECT COUNT(*) as count FROM potholes WHERE status = 'repaired'").get().count;
    
    const severityCounts = db.prepare(`
      SELECT severity, COUNT(*) as count FROM potholes WHERE status != 'repaired' GROUP BY severity
    `).all();

    const todayDetections = db.prepare(`
      SELECT COUNT(*) as count FROM potholes WHERE date(detected_at) = date('now')
    `).get().count;

    const recentDetections = db.prepare(`
      SELECT * FROM potholes ORDER BY detected_at DESC LIMIT 10
    `).all();

    // Road health index: based on ratio of repaired vs total, weighted by severity
    const activeIssues = db.prepare(`
      SELECT 
        SUM(CASE WHEN severity = 'critical' THEN 25 WHEN severity = 'high' THEN 15 WHEN severity = 'medium' THEN 8 ELSE 3 END) as weighted_score
      FROM potholes WHERE status != 'repaired'
    `).get();
    const activeWeighted = activeIssues.weighted_score || 0;
    const totalPotholes = total || 1;
    const repairedRatio = total > 0 ? repaired / total : 1;
    // Blend: 60% based on repair ratio, 40% based on severity density
    const severityFactor = Math.max(0, 100 - Math.min(100, activeWeighted / Math.max(totalPotholes, 1) * 10));
    const roadHealth = Math.max(0, Math.min(100, repairedRatio * 60 + severityFactor * 0.4));

    return {
      total,
      detected,
      confirmed,
      inRepair,
      repaired,
      severityCounts,
      todayDetections,
      recentDetections,
      roadHealthIndex: Math.round(roadHealth)
    };
  }
};

module.exports = Pothole;
