import React from 'react';
import { ShieldCheck, UserCheck, UserX, Clock, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function AccessPage() {
  const { getAllAdmins, approveAdmin, rejectAdmin } = useAuth();
  const admins = getAllAdmins();

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <ShieldCheck className="w-8 h-8 text-blue-400" />
          Access Control
        </h1>
        <p className="text-sm text-gray-500 mt-1">Manage Official Admin registrations and approvals.</p>
      </div>

      <div className="glass-card rounded-xl overflow-hidden shadow-2xl border border-white/5">
        <div className="p-5 border-b border-white/5 bg-white/5">
          <h2 className="text-lg font-bold text-white">Registered Administrators</h2>
        </div>
        
        {admins.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No administrators have registered yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-dark-900/50 text-gray-400 text-xs font-semibold uppercase tracking-wider">
                  <th className="p-4 border-b border-white/5">Email</th>
                  <th className="p-4 border-b border-white/5">Username</th>
                  <th className="p-4 border-b border-white/5">Jurisdiction</th>
                  <th className="p-4 border-b border-white/5">Status</th>
                  <th className="p-4 border-b border-white/5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {admins.map((admin) => (
                  <tr key={admin.email} className="hover:bg-white/[0.02] transition-colors">
                    <td className="p-4 text-sm text-white font-medium">{admin.email}</td>
                    <td className="p-4 text-sm text-gray-400">{admin.username}</td>
                    <td className="p-4 text-sm text-gray-400">
                      {admin.district}, {admin.state}
                    </td>
                    <td className="p-4">
                      {admin.status === 'pending' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
                          <Clock className="w-3.5 h-3.5" /> Pending
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-500/10 text-green-500 border border-green-500/20">
                          <CheckCircle className="w-3.5 h-3.5" /> Approved
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {admin.status === 'pending' && (
                          <button
                            onClick={() => approveAdmin(admin.email)}
                            className="p-2 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors"
                            title="Approve Admin"
                          >
                            <UserCheck className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => rejectAdmin(admin.email)}
                          className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                          title="Reject/Delete Admin"
                        >
                          <UserX className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
