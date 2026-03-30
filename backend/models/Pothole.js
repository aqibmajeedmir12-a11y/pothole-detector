const supabase = require('../config/db');

const Pothole = {
  async create(data) {
    const record = {
      lat: data.lat,
      lng: data.lng,
      severity: data.severity || 'medium',
      source: data.source || 'manual',
      image_url: data.imageUrl || null,
      description: data.description || null,
      status: data.status || 'detected',
      detected_at: data.detectedAt || new Date().toISOString(),
      road_name: data.roadName || null,
      confidence: data.confidence || 0,
      area: data.area || 0,
      volume: data.volume || 0,
      cost: data.cost || 0,
      state: data.state || null,
      district: data.district || null,
    };

    const { data: rows, error } = await supabase
      .from('potholes')
      .insert(record)
      .select()
      .single();

    if (error) throw new Error(`Pothole.create failed: ${error.message}`);
    return rows;
  },

  async findAll(filters = {}) {
    let query = supabase.from('potholes').select('*');

    if (filters.status)   query = query.eq('status', filters.status);
    if (filters.severity)  query = query.eq('severity', filters.severity);
    if (filters.source)    query = query.eq('source', filters.source);
    if (filters.state)     query = query.ilike('state', `%${filters.state}%`);
    if (filters.district)  query = query.ilike('district', `%${filters.district}%`);

    query = query.order('detected_at', { ascending: false });

    if (filters.limit) {
      query = query.limit(parseInt(filters.limit, 10));
    }

    const { data: rows, error } = await query;
    if (error) throw new Error(`Pothole.findAll failed: ${error.message}`);
    return rows || [];
  },

  async findNearbyActive(lat, lng, maxDistanceMeters = 20) {
    const latDiff = maxDistanceMeters / 111139;
    const lngDiff = maxDistanceMeters / (111139 * Math.cos(lat * Math.PI / 180));

    const { data: candidates, error } = await supabase
      .from('potholes')
      .select('*')
      .neq('status', 'repaired')
      .gte('lat', lat - latDiff)
      .lte('lat', lat + latDiff)
      .gte('lng', lng - lngDiff)
      .lte('lng', lng + lngDiff);

    if (error) throw new Error(`Pothole.findNearbyActive failed: ${error.message}`);
    if (!candidates || candidates.length === 0) return null;

    const R = 6371e3;
    let closest = null;
    let minD = maxDistanceMeters;

    for (const p of candidates) {
      const pLat = parseFloat(p.lat);
      const pLng = parseFloat(p.lng);
      const dLat = (pLat - lat) * Math.PI / 180;
      const dLng = (pLng - lng) * Math.PI / 180;
      const a = Math.sin(dLat / 2) ** 2 +
                Math.cos(lat * Math.PI / 180) * Math.cos(pLat * Math.PI / 180) *
                Math.sin(dLng / 2) ** 2;
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const d = R * c;

      if (d <= minD) {
        minD = d;
        closest = p;
      }
    }

    return closest;
  },

  async findById(id) {
    const parsedId = parseInt(id, 10);
    if (isNaN(parsedId)) return null;

    const { data, error } = await supabase
      .from('potholes')
      .select('*')
      .eq('id', parsedId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // not found
      throw new Error(`Pothole.findById failed: ${error.message}`);
    }
    return data;
  },

  async update(id, data) {
    const parsedId = parseInt(id, 10);
    if (isNaN(parsedId)) throw new Error('Invalid pothole ID');

    const fields = {};
    if (data.status !== undefined)          fields.status = data.status;
    if (data.severity !== undefined)        fields.severity = data.severity;
    if (data.maintenanceNotes !== undefined) fields.maintenance_notes = data.maintenanceNotes;
    if (data.repairedAt !== undefined)       fields.repaired_at = data.repairedAt;
    if (data.description !== undefined)     fields.description = data.description;
    if (data.confidence !== undefined)      fields.confidence = data.confidence;
    if (data.imageUrl !== undefined)        fields.image_url = data.imageUrl;
    if (data.state !== undefined)           fields.state = data.state;
    if (data.district !== undefined)        fields.district = data.district;
    if (data.roadName !== undefined)        fields.road_name = data.roadName;
    if (data.detectedAt !== undefined)      fields.detected_at = data.detectedAt;

    if (Object.keys(fields).length === 0) return this.findById(parsedId);

    // updated_at is set automatically by the database trigger
    const { data: updated, error } = await supabase
      .from('potholes')
      .update(fields)
      .eq('id', parsedId)
      .select()
      .single();

    if (error) throw new Error(`Pothole.update failed: ${error.message}`);
    return updated;
  },

  async delete(id) {
    const parsedId = parseInt(id, 10);
    if (isNaN(parsedId)) throw new Error('Invalid pothole ID');

    const { error } = await supabase
      .from('potholes')
      .delete()
      .eq('id', parsedId);

    if (error) throw new Error(`Pothole.delete failed: ${error.message}`);
  },

  async getStats(filters = {}) {
    // Use the RPC function for efficient aggregation
    const { data: statsRow, error } = await supabase.rpc('get_pothole_stats', {
      p_state: filters.state || null,
      p_district: filters.district || null,
    });

    if (error) throw new Error(`Pothole.getStats failed: ${error.message}`);

    const s = statsRow && statsRow.length > 0 ? statsRow[0] : {
      total: 0, active: 0, detected: 0, confirmed: 0,
      in_repair: 0, repaired: 0, today_detections: 0, weighted_score: 0,
    };

    // Severity counts (separate query — lightweight)
    let sevQuery = supabase
      .from('potholes')
      .select('severity')
      .neq('status', 'repaired');

    if (filters.state) sevQuery = sevQuery.ilike('state', `%${filters.state}%`);
    if (filters.district) sevQuery = sevQuery.ilike('district', `%${filters.district}%`);

    const { data: sevRows } = await sevQuery;
    const sevMap = {};
    (sevRows || []).forEach(r => {
      sevMap[r.severity] = (sevMap[r.severity] || 0) + 1;
    });
    const severityCounts = Object.entries(sevMap).map(([severity, count]) => ({ severity, count }));

    // Recent detections
    let recentQuery = supabase
      .from('potholes')
      .select('*')
      .order('detected_at', { ascending: false })
      .limit(10);

    if (filters.state) recentQuery = recentQuery.ilike('state', `%${filters.state}%`);
    if (filters.district) recentQuery = recentQuery.ilike('district', `%${filters.district}%`);

    const { data: recentDetections } = await recentQuery;

    const total = parseInt(s.total) || 0;
    const active = parseInt(s.active) || 0;
    const repaired = parseInt(s.repaired) || 0;
    const activeWeighted = parseInt(s.weighted_score) || 0;
    const totalPotholes = total || 1;
    const repairedRatio = total > 0 ? repaired / total : 1;
    const severityFactor = Math.max(0, 100 - Math.min(100, (activeWeighted / Math.max(totalPotholes, 1)) * 10));
    const roadHealth = Math.max(0, Math.min(100, repairedRatio * 60 + severityFactor * 0.4));

    return {
      total,
      active,
      detected: parseInt(s.detected) || 0,
      confirmed: parseInt(s.confirmed) || 0,
      inRepair: parseInt(s.in_repair) || 0,
      repaired,
      severityCounts,
      todayDetections: parseInt(s.today_detections) || 0,
      recentDetections: recentDetections || [],
      roadHealthIndex: Math.round(roadHealth),
    };
  },
};

module.exports = Pothole;
