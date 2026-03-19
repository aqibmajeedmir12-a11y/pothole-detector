import AdminPanel from '../components/Admin/AdminPanel';
import { Shield } from 'lucide-react';

export default function AdminPage({ potholes, onRefresh }) {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/20 flex items-center justify-center">
          <Shield className="w-5 h-5 text-purple-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
          <p className="text-sm text-gray-500 mt-1">Manage pothole reports and road maintenance</p>
        </div>
      </div>

      <AdminPanel potholes={potholes} onUpdate={onRefresh} />
    </div>
  );
}
