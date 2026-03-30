import { useState } from 'react';
import { adminAPI } from '../../services/api';
import { CheckCircle, Wrench, AlertTriangle, FileText, Search, Filter } from 'lucide-react';

const severityColors = {
  low: 'badge-low',
  medium: 'badge-medium',
  high: 'badge-high',
  critical: 'badge-critical',
};

const statusColors = {
  detected: 'badge-detected',
  confirmed: 'badge-confirmed',
  in_repair: 'badge-in_repair',
  repaired: 'badge-repaired',
};

export default function AdminPanel({ potholes = [], onUpdate }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [notes, setNotes] = useState('');
  const [updating, setUpdating] = useState(false);

  const filtered = potholes.filter(p => {
    const matchSearch = !search || 
      p.road_name?.toLowerCase().includes(search.toLowerCase()) ||
      p.description?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleStatusUpdate = async (id, newStatus) => {
    try {
      setUpdating(true);
      await adminAPI.updatePothole(id, { status: newStatus });
      onUpdate?.();
    } catch (err) {
      console.error('Failed to update:', err);
    } finally {
      setUpdating(false);
    }
  };

  const handleNotesUpdate = async (id) => {
    try {
      setUpdating(true);
      await adminAPI.updatePothole(id, { maintenanceNotes: notes });
      setEditingId(null);
      setNotes('');
      onUpdate?.();
    } catch (err) {
      console.error('Failed to update notes:', err);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="glass-card p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search by road name or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field pl-10"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input-field pl-10 pr-8 appearance-none cursor-pointer min-w-[160px]"
            >
              <option value="">All Status</option>
              <option value="detected">Detected</option>
              <option value="confirmed">Confirmed</option>
              <option value="in_repair">In Repair</option>
              <option value="repaired">Repaired</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 uppercase border-b border-white/5 bg-white/[0.02]">
                <th className="text-left py-3 px-4">ID</th>
                <th className="text-left py-3 px-4">Location</th>
                <th className="text-center py-3 px-4">Severity</th>
                <th className="text-center py-3 px-4">Status</th>
                <th className="text-center py-3 px-4">Source</th>
                <th className="text-left py-3 px-4">Date</th>
                <th className="text-center py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-500">No potholes found</td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <>
                    <tr key={p.id} className="table-row">
                      <td className="py-3 px-4 text-gray-400 font-mono">#{p.id}</td>
                      <td className="py-3 px-4">
                        <p className="text-gray-300 font-medium">
                          {(p.district || p.state) ? [p.district, p.state].filter(Boolean).join(', ') : (p.road_name || 'Unknown')}
                        </p>
                        <p className="text-xs text-gray-500">{p.lat?.toFixed(4)}, {p.lng?.toFixed(4)}</p>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`badge ${severityColors[p.severity]}`}>{p.severity}</span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`badge ${statusColors[p.status]}`}>{p.status?.replace('_', ' ')}</span>
                      </td>
                      <td className="py-3 px-4 text-center text-xs text-gray-400">{p.source?.replace('_', ' ')}</td>
                      <td className="py-3 px-4 text-xs text-gray-400">
                        {new Date(p.detected_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1">
                          {p.status !== 'repaired' && (
                            <>
                              {p.status !== 'confirmed' && p.status !== 'in_repair' && (
                                <button
                                  onClick={() => handleStatusUpdate(p.id, 'confirmed')}
                                  disabled={updating}
                                  className="p-1.5 rounded-lg hover:bg-purple-500/20 text-purple-400 transition-colors"
                                  title="Confirm"
                                >
                                  <AlertTriangle className="w-4 h-4" />
                                </button>
                              )}
                              {p.status !== 'in_repair' && (
                                <button
                                  onClick={() => handleStatusUpdate(p.id, 'in_repair')}
                                  disabled={updating}
                                  className="p-1.5 rounded-lg hover:bg-amber-500/20 text-amber-400 transition-colors"
                                  title="Start Repair"
                                >
                                  <Wrench className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={() => handleStatusUpdate(p.id, 'repaired')}
                                disabled={updating}
                                className="p-1.5 rounded-lg hover:bg-green-500/20 text-green-400 transition-colors"
                                title="Mark Repaired"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => { setEditingId(editingId === p.id ? null : p.id); setNotes(p.maintenance_notes || ''); }}
                            className="p-1.5 rounded-lg hover:bg-blue-500/20 text-blue-400 transition-colors"
                            title="Add Notes"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {editingId === p.id && (
                      <tr key={`notes-${p.id}`} className="bg-white/[0.02]">
                        <td colSpan={7} className="p-4">
                          <div className="flex gap-3">
                            <textarea
                              value={notes}
                              onChange={(e) => setNotes(e.target.value)}
                              placeholder="Add maintenance notes..."
                              className="input-field flex-1 min-h-[60px] resize-none"
                            />
                            <div className="flex flex-col gap-2">
                              <button onClick={() => handleNotesUpdate(p.id)} disabled={updating} className="btn-primary text-xs">
                                Save
                              </button>
                              <button onClick={() => setEditingId(null)} className="btn-secondary text-xs">
                                Cancel
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
