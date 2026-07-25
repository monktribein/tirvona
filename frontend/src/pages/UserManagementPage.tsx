import React, { useState, useEffect } from 'react';
import { ToggleLeft, ToggleRight, RefreshCw } from 'lucide-react';
import { userService } from '../services';
import { getErrorMessage } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';

interface ManagedUser {
  _id: string;
  name: string;
  email: string;
  role: string;
  status: string;
}

export const UserManagementPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const { addNotification } = useNotifications();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await userService.list();
      if (res.data.success) {
        setUsers(res.data.data);
      }
    } catch (err) {
      console.error('Fetch users error:', err);
      setError(getErrorMessage(err, 'Unable to load users.'));
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  // Only super_admin can actually change status server-side.
  const canModerate = currentUser?.role === 'super_admin';

  const toggleStatus = async (u: ManagedUser) => {
    if (!canModerate) return;
    const nextStatus = u.status === 'active' ? 'suspended' : 'active';
    try {
      const res = await userService.updateStatus(u._id, nextStatus);
      if (res.data.success) {
        setUsers((prev) => prev.map((x) => (x._id === u._id ? { ...x, status: nextStatus } : x)));
        addNotification('User Updated', `${u.name} is now ${nextStatus}.`, 'success');
      }
    } catch (err) {
      addNotification('Update Failed', getErrorMessage(err, 'Could not update user status.'), 'error');
    }
  };

  return (
    <div className="space-y-6 text-left">
      <div className="flex justify-between items-center bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 p-6 rounded-[24px] shadow-sm">
        <div>
          <h2 className="text-base font-extrabold text-[#0B192C] dark:text-white">User Accounts Control Center</h2>
          <p className="text-xs text-gray-400 font-semibold mt-1">Monitor active user sessions, audit roles, and toggle safety suspension blocks.</p>
        </div>
        <button
          onClick={fetchUsers}
          className="p-2.5 bg-gray-50 dark:bg-slate-900 hover:bg-gray-100 border border-gray-100 dark:border-slate-800 rounded-xl text-gray-500 cursor-pointer transition-colors"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {error && (
        <div className="p-4 bg-danger/10 text-danger border border-danger/20 text-xs font-bold rounded-2xl">
          {error}
        </div>
      )}

      {loading ? (
        <div className="h-40 bg-gray-50 border border-gray-100 rounded-[24px] animate-pulse" />
      ) : (
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] shadow-sm overflow-hidden">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
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
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-gray-400 font-semibold">No users found.</td>
                  </tr>
                ) : users.map((u) => (
                  <tr key={u._id} className="border-b border-gray-50 dark:border-slate-850 hover:bg-gray-50/20">
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
                        onClick={() => toggleStatus(u)}
                        disabled={!canModerate}
                        className="p-1 rounded hover:bg-gray-50 dark:hover:bg-slate-805 transition-colors inline-flex cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        title={canModerate ? 'Toggle account status' : 'Only Super Admin can moderate'}
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

          {/* Mobile Cards View */}
          <div className="block md:hidden divide-y divide-gray-100 dark:divide-slate-800">
            {users.length === 0 ? (
              <div className="p-8 text-center text-gray-400 font-semibold text-xs">No users found.</div>
            ) : users.map((u) => (
              <div key={u._id} className="p-5 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="font-extrabold text-sm text-[#0B192C] dark:text-white">{u.name}</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold ${
                    u.status === 'active' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
                  }`}>
                    {u.status}
                  </span>
                </div>
                <div className="text-xs text-gray-500">{u.email}</div>
                <div className="flex justify-between items-center pt-2">
                  <span className="px-2.5 py-0.5 bg-[#0A4DA6]/10 text-[#0A4DA6] rounded-full text-[9px] font-bold uppercase">{u.role.replace('_', ' ')}</span>
                  <button
                    onClick={() => toggleStatus(u)}
                    disabled={!canModerate}
                    className="p-1 rounded hover:bg-gray-50 dark:hover:bg-slate-805 transition-colors inline-flex cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {u.status === 'active' ? (
                      <ToggleRight className="text-success" size={24} />
                    ) : (
                      <ToggleLeft className="text-danger" size={24} />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
export default UserManagementPage;
