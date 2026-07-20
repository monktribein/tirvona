import React, { useState } from 'react';
import { ToggleLeft, ToggleRight } from 'lucide-react';

export const UserManagementPage: React.FC = () => {
  const [users, setUsers] = useState([
    { id: '1', name: 'Rajesh Kumar', email: 'pilgrim@tirvona.com', role: 'customer', status: 'active' },
    { id: '2', name: 'Swami Chidanand', email: 'owner@tirvona.com', role: 'owner', status: 'active' },
    { id: '3', name: 'Devendra Pandey', email: 'officer@tirvona.com', role: 'district_officer', status: 'active' },
  ]);

  const toggleStatus = (id: string) => {
    setUsers((prev) =>
      prev.map((u) =>
        u.id === id ? { ...u, status: u.status === 'active' ? 'suspended' : 'active' } : u
      )
    );
  };

  return (
    <div className="space-y-6 text-left">
      <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 p-6 rounded-[24px] shadow-sm">
        <h2 className="text-base font-extrabold text-[#0B192C] dark:text-white">User Accounts Control Center</h2>
        <p className="text-xs text-gray-400 font-semibold mt-1">Monitor active user sessions, audit roles, and toggle safety suspension blocks.</p>
      </div>

      <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-gray-50 dark:border-slate-850 bg-gray-50 dark:bg-slate-900 text-gray-450 font-bold uppercase text-[10px] tracking-wider">
                <th className="py-4 px-6">Name</th>
                <th className="py-4 px-6">Email Address</th>
                <th className="py-4 px-6">System Role</th>
                <th className="py-4 px-6">Account Status</th>
                <th className="py-4 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-gray-50 dark:border-slate-850 hover:bg-gray-50/20">
                  <td className="py-4.5 px-6 font-bold text-[#0B192C] dark:text-white">{u.name}</td>
                  <td className="py-4.5 px-6 text-gray-500">{u.email}</td>
                  <td className="py-4.5 px-6">
                    <span className="px-2.5 py-0.5 bg-[#0A4DA6]/10 text-[#0A4DA6] rounded-full text-[9px] font-bold uppercase">{u.role.replace('_', ' ')}</span>
                  </td>
                  <td className="py-4.5 px-6">
                    <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold ${
                      u.status === 'active' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
                    }`}>
                      {u.status}
                    </span>
                  </td>
                  <td className="py-4.5 px-6 text-right">
                    <button
                      onClick={() => toggleStatus(u.id)}
                      className="p-1 rounded hover:bg-gray-50 dark:hover:bg-slate-805 transition-colors inline-flex cursor-pointer"
                    >
                      {u.status === 'active' ? (
                        <ToggleRight className="text-success" size={24} />
                      ) : (
                        <ToggleLeft className="text-danger" size={24} />
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
export default UserManagementPage;
