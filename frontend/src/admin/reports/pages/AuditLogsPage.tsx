import React, { useState, useEffect } from "react";
import { RefreshCw, Clock, History } from "lucide-react";
import { analyticsService } from "../../../services";
import { EnterprisePageHeader } from "../../shared";
import { humanizeLabel } from "../../../utils/labels";

export const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await analyticsService.auditLogs();
      if (res.data.success) {
        setLogs(res.data.data);
      }
    } catch (err) {
      console.error("Audit logs error:", err);
      setError("Unable to load audit logs. Please try again.");
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 text-left">
      <EnterprisePageHeader
        title="Security & System Audit Logs"
        subtitle="Track real-time logins, RBAC transitions, system overrides, and counter check-in events."
        icon={<History size={22} />}
        badgeText="Telemetry active"
        actions={
          <button
            onClick={fetchLogs}
            className="px-4 py-2 bg-[#0A4DA6] text-white hover:bg-[#083b80] rounded-full text-xs font-bold flex items-center gap-2 shadow-md cursor-pointer transition-all"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />{" "}
            Refresh Logs
          </button>
        }
      />

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
                <tr className="border-b border-gray-50 dark:border-slate-855 bg-gray-50 dark:bg-slate-900 text-gray-450 font-bold text-[10px] tracking-wider">
                  <th className="py-4 px-6">Timestamp</th>
                  <th className="py-4 px-6">Module</th>
                  <th className="py-4 px-6">Action Event</th>
                  <th className="py-4 px-6">Actor User</th>
                  <th className="py-4 px-6">IP Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr
                    key={log._id}
                    className="border-b border-gray-50 dark:border-slate-850 hover:bg-gray-50/20"
                  >
                    <td className="py-4 px-6 text-gray-500 font-semibold flex items-center gap-1.5 whitespace-nowrap">
                      <Clock size={12} className="text-[#0A4DA6]" />{" "}
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="py-4 px-6">
                      <span className="px-2.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-[#0B192C] dark:text-accent rounded-full text-[9px] font-bold">
                        {humanizeLabel(log.module)}
                      </span>
                    </td>
                    <td className="py-4 px-6 font-bold text-[#0B192C] dark:text-white">
                      {humanizeLabel(log.action)}
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex flex-col">
                        <span className="font-semibold text-secondary dark:text-white">
                          {log.userId?.name || "Guest / System"}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {log.userId?.email}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-gray-400 font-mono">
                      {log.ipAddress}
                    </td>
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
                  <span className="text-gray-400 flex items-center gap-1">
                    <Clock size={10} className="text-[#0A4DA6]" />{" "}
                    {new Date(log.timestamp).toLocaleString()}
                  </span>
                  <span className="px-2.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-[#0B192C] dark:text-accent rounded-full text-[8.5px] font-bold">
                    {humanizeLabel(log.module)}
                  </span>
                </div>
                <div className="font-extrabold text-xs text-[#0B192C] dark:text-white">
                  {humanizeLabel(log.action)}
                </div>
                <div className="flex justify-between items-end pt-1">
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-secondary dark:text-white">
                      {log.userId?.name || "Guest / System"}
                    </span>
                    <span className="text-[9px] text-gray-400">
                      {log.userId?.email}
                    </span>
                  </div>
                  <span className="text-[10px] text-gray-400 font-mono">
                    {log.ipAddress}
                  </span>
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
