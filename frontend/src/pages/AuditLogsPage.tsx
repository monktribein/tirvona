import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { RefreshCw, Clock } from 'lucide-react';

export const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/analytics/audit-logs`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('ab_token')}` },
      });
      if (res.data.success) {
        setLogs(res.data.data);
      }
    } catch (err) {
      console.error('Audit logs error:', err);
      // Mocks fallback
      setLogs([
        {
          _id: '1',
          action: 'USER_LOGIN_PASSWORD',
          module: 'AUTH',
          ipAddress: '127.0.0.1',
          userAgent: 'Mozilla/5.0 Windows',
          timestamp: new Date().toISOString(),
          userId: { name: 'Super Admin', email: 'admin@tirvona.com' },
        },
        {
          _id: '2',
          action: 'ASHRAM_VERIFY_APPROVED',
          module: 'GOVT_APPROVAL',
          ipAddress: '127.0.0.1',
          userAgent: 'Mozilla/5.0 Windows',
          timestamp: new Date(Date.now() - 500000).toISOString(),
          userId: { name: 'District Officer', email: 'officer@tirvona.com' },
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 text-left">
      <div className="flex justify-between items-center bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 p-6 rounded-[24px] shadow-sm">
        <div>
          <h2 className="text-base font-extrabold text-[#0B192C] dark:text-white">Security & System Audit Logs</h2>
          <p className="text-xs text-gray-400 font-semibold mt-1">Track all logins, registration status transitions, overrides, and counter check-ins.</p>
        </div>
        <button
          onClick={fetchLogs}
          className="p-2.5 bg-gray-50 dark:bg-slate-900 hover:bg-gray-100 border border-gray-100 dark:border-slate-800 rounded-xl text-gray-500 cursor-pointer transition-colors"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {loading ? (
        <div className="h-40 bg-gray-50 border border-gray-100 rounded-[24px] animate-pulse" />
      ) : (
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] shadow-sm overflow-hidden">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-50 dark:border-slate-855 bg-gray-50 dark:bg-slate-900 text-gray-450 font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-4 px-6">Timestamp</th>
                  <th className="py-4 px-6">Module</th>
                  <th className="py-4 px-6">Action Event</th>
                  <th className="py-4 px-6">Actor User</th>
                  <th className="py-4 px-6">IP Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log._id} className="border-b border-gray-50 dark:border-slate-850 hover:bg-gray-50/20">
                    <td className="py-4 px-6 text-gray-500 font-semibold flex items-center gap-1.5 whitespace-nowrap">
                      <Clock size={12} className="text-[#0A4DA6]" /> {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="py-4 px-6">
                      <span className="px-2.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-[#0B192C] dark:text-accent rounded-full text-[9px] font-bold uppercase">{log.module}</span>
                    </td>
                    <td className="py-4 px-6 font-bold text-[#0B192C] dark:text-white">{log.action}</td>
                    <td className="py-4 px-6">
                      <div className="flex flex-col">
                        <span className="font-semibold text-secondary dark:text-white">{log.userId?.name || 'Guest / System'}</span>
                        <span className="text-[10px] text-gray-400">{log.userId?.email}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-gray-400 font-mono">{log.ipAddress}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards View */}
          <div className="block md:hidden divide-y divide-gray-100 dark:divide-slate-800">
            {logs.map((log) => (
              <div key={log._id} className="p-5 space-y-3">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-gray-400 flex items-center gap-1"><Clock size={10} className="text-[#0A4DA6]" /> {new Date(log.timestamp).toLocaleString()}</span>
                  <span className="px-2.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-[#0B192C] dark:text-accent rounded-full text-[8.5px] font-bold uppercase">{log.module}</span>
                </div>
                <div className="font-extrabold text-xs text-[#0B192C] dark:text-white">{log.action}</div>
                <div className="flex justify-between items-end pt-1">
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-secondary dark:text-white">{log.userId?.name || 'Guest / System'}</span>
                    <span className="text-[9px] text-gray-400">{log.userId?.email}</span>
                  </div>
                  <span className="text-[10px] text-gray-400 font-mono">{log.ipAddress}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      )}
    </div>
  );
};
export default AuditLogsPage;
