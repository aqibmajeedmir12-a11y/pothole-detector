const supabase = require('../config/db');

const Alert = {
  async create(data) {
    const record = {
      pothole_id: data.potholeId || null,
      message: data.message,
      type: data.type || 'detection',
    };

    const { data: row, error } = await supabase
      .from('alerts')
      .insert(record)
      .select()
      .single();

    if (error) throw new Error(`Alert.create failed: ${error.message}`);
    return row;
  },

  async findAll(limit = 50) {
    const { data: rows, error } = await supabase
      .from('alerts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(`Alert.findAll failed: ${error.message}`);
    return rows || [];
  },

  async findUnread() {
    const { data: rows, error } = await supabase
      .from('alerts')
      .select('*')
      .eq('read', 0)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Alert.findUnread failed: ${error.message}`);
    return rows || [];
  },

  async markRead(id) {
    const parsedId = parseInt(id, 10);
    if (isNaN(parsedId)) throw new Error('Invalid alert ID');

    const { error } = await supabase
      .from('alerts')
      .update({ read: 1 })
      .eq('id', parsedId);

    if (error) throw new Error(`Alert.markRead failed: ${error.message}`);
  },

  async markAllRead() {
    const { error } = await supabase
      .from('alerts')
      .update({ read: 1 })
      .eq('read', 0);

    if (error) throw new Error(`Alert.markAllRead failed: ${error.message}`);
  },

  async getUnreadCount() {
    const { count, error } = await supabase
      .from('alerts')
      .select('*', { count: 'exact', head: true })
      .eq('read', 0);

    if (error) throw new Error(`Alert.getUnreadCount failed: ${error.message}`);
    return count || 0;
  },
};

module.exports = Alert;
