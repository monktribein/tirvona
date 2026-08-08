import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  Clock,
  Search,
  Download,
  Trash2,
  RotateCcw,
  Sparkles,
  Radio,
  Key,
  Building,
  FileCheck,
  RefreshCw,
  Calendar,
  Printer,
} from "lucide-react";
import { enterpriseNotificationService } from "../../../services";
import { useNotifications } from "../../../contexts/NotificationContext";
import { getErrorMessage } from "../../../lib/api";
import { humanizeLabel } from "../../../utils/labels";
import { EnterprisePageHeader } from "../../shared";

export const EnterpriseNotificationCenterPage: React.FC = () => {
  const { subSection } = useParams<{ subSection?: string }>();
  const navigate = useNavigate();
  const { addNotification } = useNotifications();

  // Active View Tab: 'dashboard' | 'all' | 'activities' | 'auth-logs' | 'bookings' | 'payments' | 'tickets' | 'cms' | 'timeline' | 'security'
  const activeSection = subSection || "dashboard";

  const [stats, setStats] = useState<any>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [notificationsList, setNotificationsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [searchTerm, setSearchTerm] = useState("");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"table" | "timeline">("table");

  useEffect(() => {
    fetchCenterData();
  }, [activeSection, moduleFilter, severityFilter]);

  const fetchCenterData = async () => {
    setLoading(true);
    try {
      const [statsRes, actRes, notifRes] = await Promise.all([
        enterpriseNotificationService.getStats(),
        enterpriseNotificationService.getActivities({
          module:
            activeSection === "auth-logs"
              ? "AUTH"
              : activeSection === "bookings"
                ? "BOOKING"
                : activeSection === "payments"
                  ? "PAYMENT"
                  : activeSection === "cms"
                    ? "BANNER"
                    : moduleFilter,
          severity: severityFilter,
          search: searchTerm,
        }),
        enterpriseNotificationService.getNotifications({
          severity: severityFilter,
          search: searchTerm,
        }),
      ]);

      if (statsRes.data?.success) setStats(statsRes.data.data);
      if (actRes.data?.success) setActivities(actRes.data.data || []);
      if (notifRes.data?.success)
        setNotificationsList(notifRes.data.data || []);
    } catch (err) {
      console.warn("Fetch Enterprise Notifications Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSeed = async () => {
    try {
      await enterpriseNotificationService.seedTelemetry();
      addNotification(
        "Telemetry Initialized",
        "Real-time telemetry and sample events seeded.",
        "success",
      );
      fetchCenterData();
    } catch (err) {
      addNotification(
        "Seed Error",
        getErrorMessage(err, "Unable to seed telemetry."),
        "error",
      );
    }
  };

  const handleMarkRead = async (id: string) => {
    try {
      await enterpriseNotificationService.markRead(id);
      addNotification("Marked Read", "Notification updated.", "info");
      fetchCenterData();
    } catch (err) {
      addNotification(
        "Action Error",
        getErrorMessage(err, "Could not mark read."),
        "error",
      );
    }
  };

  const handleDeleteNotif = async (id: string) => {
    try {
      await enterpriseNotificationService.deleteNotification(id);
      addNotification("Deleted", "Notification removed.", "info");
      setNotificationsList((prev) => prev.filter((x) => x._id !== id));
    } catch (err) {
      addNotification(
        "Delete Error",
        getErrorMessage(err, "Could not delete."),
        "error",
      );
    }
  };

  const handleBulkAction = async (action: "delete" | "mark_read") => {
    if (selectedIds.length === 0) return;
    try {
      await enterpriseNotificationService.bulkAction(selectedIds, action);
      addNotification(
        "Bulk Action Complete",
        `${selectedIds.length} items updated.`,
        "success",
      );
      setSelectedIds([]);
      fetchCenterData();
    } catch (err) {
      addNotification(
        "Bulk Error",
        getErrorMessage(err, "Bulk operation failed."),
        "error",
      );
    }
  };

  const handleExportCSV = () => {
    const exportData =
      activeSection === "activities" || activeSection === "timeline"
        ? activities
        : notificationsList;
    if (exportData.length === 0) return;

    const headers = "ID,Module,Action,Description,Severity,Timestamp\n";
    const rows = exportData
      .map(
        (x) =>
          `"${x._id || x.activityId}","${x.module || ""}","${x.action || ""}","${(x.description || x.message || "").replace(/"/g, '""')}","${x.severity || "info"}","${x.createdAt || x.timestamp || ""}"`,
      )
      .join("\n");

    const blob = new Blob([headers + rows], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      `tirvona_telemetry_${activeSection}_${Date.now()}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case "critical":
      case "emergency":
      case "security":
        return (
          <span className="px-2.5 py-0.5 bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 rounded-full text-[9px] font-black tracking-wider">
            🚨 {severity}
          </span>
        );
      case "warning":
        return (
          <span className="px-2.5 py-0.5 bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 rounded-full text-[9px] font-black tracking-wider">
            ⚠️ Warning
          </span>
        );
      case "success":
        return (
          <span className="px-2.5 py-0.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 rounded-full text-[9px] font-black tracking-wider">
            ✅ Success
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-full text-[9px] font-bold tracking-wider">
            ℹ️ Info
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 text-left w-full">
      {/* Header Banner */}
      <EnterprisePageHeader
        title="Enterprise Telemetry & Activity Center"
        subtitle="Real-time platform telemetry, authentication logs, security events, and live Socket.IO feeds."
        icon={<Radio size={22} className="animate-pulse" />}
        badgeText="Telemetry Live"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="px-3.5 py-2 rounded-full border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 text-gray-700 dark:text-gray-200 text-xs font-bold flex items-center gap-1.5 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <Download size={14} /> Export CSV
            </button>
            <button
              onClick={() => window.print()}
              className="px-3.5 py-2 rounded-full border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 text-gray-700 dark:text-gray-200 text-xs font-bold flex items-center gap-1.5 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <Printer size={14} /> Print
            </button>
            <button
              onClick={handleSeed}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-full text-xs font-extrabold flex items-center gap-1.5 shadow-md cursor-pointer transition-all"
            >
              <Sparkles size={14} /> Seed Telemetry
            </button>
            <button
              onClick={fetchCenterData}
              className="p-2.5 bg-gray-50 dark:bg-slate-900 hover:bg-gray-100 dark:hover:bg-slate-800 border border-gray-100 dark:border-slate-800 rounded-full text-gray-500 cursor-pointer transition-colors"
              title="Refresh"
            >
              <RefreshCw size={16} className={loading ? "animate-spin text-[#0A4DA6]" : ""} />
            </button>
          </div>
        }
      />

      {/* Real-time Dashboard Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 p-4 rounded-2xl shadow-sm">
          <span className="text-[10px] text-gray-400 font-bold block">
            Today's Notifications
          </span>
          <span className="text-2xl font-black text-[#0B192C] dark:text-white mt-1 block">
            {stats?.todaysNotifications ?? 0}
          </span>
        </div>
        <div className="bg-white dark:bg-[#0B192C] border border-rose-200 dark:border-rose-950/60 p-4 rounded-2xl shadow-sm">
          <span className="text-[10px] text-rose-500 font-bold block">
            Critical Alerts
          </span>
          <span className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1 block">
            {stats?.criticalAlerts ?? 0}
          </span>
        </div>
        <div className="bg-white dark:bg-[#0B192C] border border-amber-200 dark:border-amber-950/60 p-4 rounded-2xl shadow-sm">
          <span className="text-[10px] text-amber-500 font-bold block">
            Unread Notifications
          </span>
          <span className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1 block">
            {stats?.unreadNotifications ?? 0}
          </span>
        </div>
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 p-4 rounded-2xl shadow-sm">
          <span className="text-[10px] text-gray-400 font-bold block">
            Failed Logins
          </span>
          <span className="text-2xl font-black text-gray-800 dark:text-gray-200 mt-1 block">
            {stats?.failedLogins ?? 0}
          </span>
        </div>
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 p-4 rounded-2xl shadow-sm">
          <span className="text-[10px] text-gray-400 font-bold block">
            Failed Payments
          </span>
          <span className="text-2xl font-black text-gray-800 dark:text-gray-200 mt-1 block">
            {stats?.failedPayments ?? 0}
          </span>
        </div>
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 p-4 rounded-2xl shadow-sm">
          <span className="text-[10px] text-gray-400 font-bold block">
            Server / API Errors
          </span>
          <span className="text-2xl font-black text-gray-800 dark:text-gray-200 mt-1 block">
            {stats?.apiErrors ?? 0}
          </span>
        </div>
      </div>

      {/* Sub-Section Navigation Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none border-b border-gray-200 dark:border-slate-800">
        {[
          { key: "dashboard", label: "Overview Dashboard" },
          { key: "all", label: "All Notifications" },
          { key: "activities", label: "System Activities" },
          { key: "auth-logs", label: "Authentication Logs" },
          { key: "bookings", label: "Bookings Telemetry" },
          { key: "payments", label: "Payment Audit" },
          { key: "cms", label: "Banner CMS Queue" },
          { key: "timeline", label: "Chronological Timeline" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() =>
              navigate(`/admin/enterprise-notifications/${tab.key}`)
            }
            className={`px-4 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all cursor-pointer ${
              activeSection === tab.key
                ? "bg-[#0A4DA6] text-white shadow-md shadow-[#0A4DA6]/20"
                : "bg-white dark:bg-[#0B192C] text-gray-500 hover:text-gray-900 dark:hover:text-white border border-gray-100 dark:border-slate-800"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filter Bar & Controls */}
      <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 p-4 rounded-2xl shadow-sm flex flex-col sm:flex-row justify-between items-center gap-3">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search
              className="absolute left-3 top-2.5 text-gray-400"
              size={14}
            />
            <input
              type="text"
              placeholder="Search activity, IP, email, action..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:border-[#0A4DA6]"
            />
          </div>

          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="px-3 py-2 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs font-semibold"
          >
            <option value="all">All Severities</option>
            <option value="info">Info</option>
            <option value="success">Success</option>
            <option value="warning">Warning</option>
            <option value="critical">Critical</option>
            <option value="security">Security</option>
            <option value="emergency">Emergency</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          {selectedIds.length > 0 && (
            <>
              <button
                onClick={() => handleBulkAction("mark_read")}
                className="px-3 py-1.5 bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold cursor-pointer"
              >
                Mark Read ({selectedIds.length})
              </button>
              <button
                onClick={() => handleBulkAction("delete")}
                className="px-3 py-1.5 bg-rose-100 text-rose-800 rounded-lg text-xs font-bold cursor-pointer"
              >
                Delete ({selectedIds.length})
              </button>
            </>
          )}

          <div className="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setViewMode("table")}
              className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${viewMode === "table" ? "bg-white dark:bg-[#0B192C] text-[#0A4DA6] shadow-xs" : "text-gray-400"}`}
            >
              Table View
            </button>
            <button
              onClick={() => setViewMode("timeline")}
              className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${viewMode === "timeline" ? "bg-white dark:bg-[#0B192C] text-[#0A4DA6] shadow-xs" : "text-gray-400"}`}
            >
              Timeline View
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {viewMode === "timeline" || activeSection === "timeline" ? (
        /* Chronological Timeline View */
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-6 shadow-sm space-y-6">
          <h3 className="font-extrabold text-base text-[#0B192C] dark:text-white flex items-center gap-2">
            <Clock size={18} className="text-[#0A4DA6]" /> Live Chronological
            System Timeline
          </h3>

          <div className="relative pl-6 border-l-2 border-gray-100 dark:border-slate-800 space-y-6">
            {activities.map((item, idx) => (
              <div key={item._id || idx} className="relative group">
                <div className="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full bg-[#0A4DA6] border-4 border-white dark:border-[#0B192C]" />

                <div className="bg-gray-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-gray-100 dark:border-slate-800 space-y-2">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-[#0B192C] dark:text-white">
                        {humanizeLabel(item.action)}
                      </span>
                      {getSeverityBadge(item.severity)}
                    </div>
                    <span className="text-[10px] text-gray-400 font-semibold">
                      {new Date(
                        item.timestamp || item.createdAt,
                      ).toLocaleString()}
                    </span>
                  </div>

                  <p className="text-xs text-gray-600 dark:text-gray-300 font-medium">
                    {item.description}
                  </p>

                  <div className="flex items-center gap-4 text-[10px] text-gray-400 pt-1 font-mono">
                    <span>
                      User: {item.userName} ({humanizeLabel(item.role)})
                    </span>
                    <span>IP: {item.ipAddress}</span>
                    <span>Endpoint: {item.apiEndpoint}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Standard Data Table View */
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-900 text-gray-400 font-extrabold text-[10px] tracking-wider">
                  <th className="py-4 px-6">Timestamp</th>
                  <th className="py-4 px-6">Module / Action</th>
                  <th className="py-4 px-6">User / Actor</th>
                  <th className="py-4 px-6">Event Details</th>
                  <th className="py-4 px-6">Severity</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {activities.map((item, idx) => (
                  <tr
                    key={item._id || idx}
                    className="hover:bg-gray-50/50 dark:hover:bg-slate-900/40"
                  >
                    <td className="py-4 px-6 font-mono text-gray-400 whitespace-nowrap">
                      {new Date(
                        item.timestamp || item.createdAt,
                      ).toLocaleString()}
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex flex-col">
                        <span className="font-extrabold text-[#0B192C] dark:text-white">
                          {humanizeLabel(item.action)}
                        </span>
                        <span className="text-[10px] text-[#0A4DA6] font-bold">
                          {humanizeLabel(item.module)}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex flex-col">
                        <span className="font-semibold text-gray-800 dark:text-gray-200">
                          {item.userName}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {humanizeLabel(item.role)} • {item.ipAddress}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-6 font-medium text-gray-600 dark:text-gray-300 max-w-xs truncate">
                      {item.description}
                    </td>
                    <td className="py-4 px-6">
                      {getSeverityBadge(item.severity)}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button
                        onClick={() => handleDeleteNotif(item._id)}
                        className="p-1.5 text-gray-400 hover:text-rose-600 rounded-lg transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
