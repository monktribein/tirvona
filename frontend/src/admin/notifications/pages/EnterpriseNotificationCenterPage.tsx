import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { getFormattingLocale } from "../../../utils/format";
import {
  Clock,
  Search,
  Download,
  Trash2,
  Sparkles,
  Radio,
  RefreshCw,
  Printer,
  CheckCheck,
} from "lucide-react";
import { enterpriseNotificationService } from "../../../services";
import { useNotifications } from "../../../contexts/NotificationContext";
import { getErrorMessage } from "../../../lib/api";
import { humanizeLabel } from "../../../utils/labels";
import { EnterprisePageHeader } from "../../shared";
import { NotificationSoundSettings } from "../components/NotificationSoundSettings";

const REFRESH_INTERVAL_MS = 15_000;

interface FeedRow {
  id: string;
  source: "notification" | "activity";
  time: number;
  title: string;
  detail: string;
  module: string;
  severity: string;
  actor: string;
  actorMeta: string;
  isRead: boolean;
}

export const EnterpriseNotificationCenterPage: React.FC = () => {
  const { addNotification } = useNotifications();

  const [stats, setStats] = useState<any>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [notificationsList, setNotificationsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"table" | "timeline">("table");

  useEffect(() => {
    const timer = window.setTimeout(() => setAppliedSearch(searchTerm), 400);
    return () => window.clearTimeout(timer);
  }, [searchTerm]);

  const fetchCenterData = useCallback(
    async (background = false) => {
      if (!background) setLoading(true);
      try {
        const [statsRes, actRes, notifRes] = await Promise.all([
          enterpriseNotificationService.getStats(),
          enterpriseNotificationService.getActivities({
            severity: severityFilter,
            search: appliedSearch,
          }),
          enterpriseNotificationService.getNotifications({
            severity: severityFilter,
            search: appliedSearch,
          }),
        ]);

        if (statsRes.data?.success) setStats(statsRes.data.data);
        if (actRes.data?.success) setActivities(actRes.data.data || []);
        if (notifRes.data?.success)
          setNotificationsList(notifRes.data.data || []);
        setLastSyncedAt(new Date());
      } catch (err) {
        console.warn("Fetch Enterprise Notifications Error:", err);
      } finally {
        if (!background) setLoading(false);
      }
    },
    [appliedSearch, severityFilter],
  );

  useEffect(() => {
    fetchCenterData();
  }, [fetchCenterData]);

  const refreshRef = useRef(fetchCenterData);
  refreshRef.current = fetchCenterData;
  useEffect(() => {
    const tick = () => {
      if (!document.hidden) void refreshRef.current(true);
    };
    const timer = window.setInterval(tick, REFRESH_INTERVAL_MS);
    const onVisible = () => {
      if (!document.hidden) void refreshRef.current(true);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const feed: FeedRow[] = useMemo(() => {
    const rows: FeedRow[] = [
      ...notificationsList.map((item: any) => ({
        id: String(item._id),
        source: "notification" as const,
        time: new Date(item.createdAt || item.updatedAt || 0).getTime(),
        title: item.title || humanizeLabel(item.type) || "Notification",
        detail: item.message || "",
        module: item.module || "notification",
        severity: item.severity || "info",
        actor: item.recipientName || humanizeLabel(item.recipientRole) || "All admins",
        actorMeta: humanizeLabel(item.type) || "In-app",
        isRead: Boolean(item.isRead),
      })),
      ...activities.map((item: any) => ({
        id: String(item._id || item.activityId),
        source: "activity" as const,
        time: new Date(item.timestamp || item.createdAt || 0).getTime(),
        title: humanizeLabel(item.action) || "System activity",
        detail: item.description || "",
        module: item.module || "SYSTEM",
        severity: item.severity || "info",
        actor: item.userName || item.userEmail || "System",
        actorMeta: [humanizeLabel(item.role), item.ipAddress, item.apiEndpoint]
          .filter(Boolean)
          .join(" • "),
        isRead: true,
      })),
    ];
    return rows.sort((a, b) => b.time - a.time);
  }, [notificationsList, activities]);

  const actionableIds = useMemo(
    () => feed.filter((r) => r.source === "notification").map((r) => r.id),
    [feed],
  );
  const allSelected =
    actionableIds.length > 0 && selectedIds.length === actionableIds.length;

  const toggleSelected = (id: string) =>
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

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

  const handleDeleteNotif = async (id: string) => {
    try {
      await enterpriseNotificationService.deleteNotification(id);
      addNotification("Deleted", "Notification removed.", "info");
      setNotificationsList((prev) => prev.filter((x) => String(x._id) !== id));
      setSelectedIds((prev) => prev.filter((x) => x !== id));
    } catch (err) {
      addNotification(
        "Delete Error",
        getErrorMessage(err, "Could not delete."),
        "error",
      );
    }
  };

  const handleMarkRead = async (id: string) => {
    try {
      await enterpriseNotificationService.markRead(id);
      setNotificationsList((prev) =>
        prev.map((x) => (String(x._id) === id ? { ...x, isRead: true } : x)),
      );
      fetchCenterData(true);
    } catch (err) {
      addNotification(
        "Update Error",
        getErrorMessage(err, "Could not mark as read."),
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
    if (feed.length === 0) return;
    const headers = "Timestamp,Source,Module,Title,Details,Actor,Severity\n";
    const cell = (value: unknown) =>
      `"${String(value ?? "").replace(/"/g, '""')}"`;
    const rows = feed
      .map((row) =>
        [
          new Date(row.time).toISOString(),
          row.source,
          row.module,
          row.title,
          row.detail,
          row.actor,
          row.severity,
        ]
          .map(cell)
          .join(","),
      )
      .join("\n");

    const blob = new Blob([headers + rows], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `tirvona_notifications_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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

  const sourceBadge = (source: FeedRow["source"]) => (
    <span
      className={`px-2 py-0.5 rounded-full text-[9px] font-black tracking-wider ${
        source === "notification"
          ? "bg-[#EBF2FA] text-[#0A4DA6] dark:bg-[#0A4DA6]/20 dark:text-blue-300"
          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
      }`}
    >
      {source === "notification" ? "Notification" : "Activity"}
    </span>
  );

  const emptyMessage = loading
    ? "Loading the live feed…"
    : appliedSearch || severityFilter !== "all"
      ? "No notifications match this filter."
      : "No notifications or system activity recorded yet.";

  return (
    <div className="space-y-6 text-left w-full">
      <EnterprisePageHeader
        title="Notification Center"
        subtitle="Every platform notification, authentication log, payment audit and system event in one live feed."
        icon={<Radio size={22} className="animate-pulse" />}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <NotificationSoundSettings />
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
              onClick={() => fetchCenterData()}
              className="p-2.5 bg-gray-50 dark:bg-slate-900 hover:bg-gray-100 dark:hover:bg-slate-800 border border-gray-100 dark:border-slate-800 rounded-full text-gray-500 cursor-pointer transition-colors"
              title="Refresh"
            >
              <RefreshCw
                size={16}
                className={loading ? "animate-spin text-[#0A4DA6]" : ""}
              />
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
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
            Failed Payments
          </span>
          <span className="text-2xl font-black text-gray-800 dark:text-gray-200 mt-1 block">
            {stats?.failedPayments ?? 0}
          </span>
        </div>
      </div>

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

          <span className="hidden sm:block text-[10px] font-bold text-gray-400 mr-1">
            {lastSyncedAt
              ? `Updated ${lastSyncedAt.toLocaleTimeString(getFormattingLocale())}`
              : "Connecting…"}
          </span>

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

      {viewMode === "timeline" ? (
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-6 shadow-sm space-y-6">
          <h3 className="font-extrabold text-base text-[#0B192C] dark:text-white flex items-center gap-2">
            <Clock size={18} className="text-[#0A4DA6]" /> Live Chronological
            System Timeline
          </h3>

          {feed.length === 0 ? (
            <p className="text-xs font-semibold text-gray-400 py-6">
              {emptyMessage}
            </p>
          ) : (
            <div className="relative pl-6 border-l-2 border-gray-100 dark:border-slate-800 space-y-6">
              {feed.map((item) => (
                <div key={`${item.source}-${item.id}`} className="relative group">
                  <div
                    className={`absolute -left-[31px] top-1.5 w-4 h-4 rounded-full border-4 border-white dark:border-[#0B192C] ${
                      item.source === "notification" && !item.isRead
                        ? "bg-amber-500"
                        : "bg-[#0A4DA6]"
                    }`}
                  />

                  <div className="bg-gray-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-gray-100 dark:border-slate-800 space-y-2">
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-xs text-[#0B192C] dark:text-white">
                          {item.title}
                        </span>
                        {sourceBadge(item.source)}
                        {getSeverityBadge(item.severity)}
                      </div>
                      <span className="text-[10px] text-gray-400 font-semibold whitespace-nowrap">
                        {new Date(item.time).toLocaleString(
                          getFormattingLocale(),
                        )}
                      </span>
                    </div>

                    <p className="text-xs text-gray-600 dark:text-gray-300 font-medium">
                      {item.detail}
                    </p>

                    <div className="flex items-center gap-4 text-[10px] text-gray-400 pt-1 font-mono">
                      <span>{item.actor}</span>
                      {item.actorMeta && <span>{item.actorMeta}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-900 text-gray-400 font-extrabold text-[10px] tracking-wider">
                  <th className="py-4 px-4 w-10">
                    <input
                      type="checkbox"
                      aria-label="Select all notifications"
                      checked={allSelected}
                      disabled={actionableIds.length === 0}
                      onChange={(e) =>
                        setSelectedIds(e.target.checked ? actionableIds : [])
                      }
                      className="accent-[#0A4DA6] cursor-pointer"
                    />
                  </th>
                  <th className="py-4 px-6">Timestamp</th>
                  <th className="py-4 px-6">Module / Action</th>
                  <th className="py-4 px-6">User / Actor</th>
                  <th className="py-4 px-6">Event Details</th>
                  <th className="py-4 px-6">Severity</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {feed.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="py-10 px-6 text-center text-gray-400 font-semibold"
                    >
                      {emptyMessage}
                    </td>
                  </tr>
                ) : (
                  feed.map((item) => (
                    <tr
                      key={`${item.source}-${item.id}`}
                      className={`hover:bg-gray-50/50 dark:hover:bg-slate-900/40 ${
                        item.source === "notification" && !item.isRead
                          ? "bg-amber-50/40 dark:bg-amber-950/10"
                          : ""
                      }`}
                    >
                      <td className="py-4 px-4">
                        {item.source === "notification" && (
                          <input
                            type="checkbox"
                            aria-label={`Select ${item.title}`}
                            checked={selectedIds.includes(item.id)}
                            onChange={() => toggleSelected(item.id)}
                            className="accent-[#0A4DA6] cursor-pointer"
                          />
                        )}
                      </td>
                      <td className="py-4 px-6 font-mono text-gray-400 whitespace-nowrap">
                        {new Date(item.time).toLocaleString(
                          getFormattingLocale(),
                        )}
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex flex-col gap-1">
                          <span className="font-extrabold text-[#0B192C] dark:text-white">
                            {item.title}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <span className="text-[10px] text-[#0A4DA6] font-bold">
                              {humanizeLabel(item.module)}
                            </span>
                            {sourceBadge(item.source)}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex flex-col">
                          <span className="font-semibold text-gray-800 dark:text-gray-200">
                            {item.actor}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            {item.actorMeta}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-6 font-medium text-gray-600 dark:text-gray-300 max-w-xs truncate">
                        {item.detail}
                      </td>
                      <td className="py-4 px-6">
                        {getSeverityBadge(item.severity)}
                      </td>
                      <td className="py-4 px-6 text-right whitespace-nowrap">
                        {item.source === "notification" ? (
                          <>
                            {!item.isRead && (
                              <button
                                onClick={() => handleMarkRead(item.id)}
                                title="Mark as read"
                                className="p-1.5 text-gray-400 hover:text-emerald-600 rounded-lg transition-colors"
                              >
                                <CheckCheck size={14} />
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteNotif(item.id)}
                              title="Delete notification"
                              className="p-1.5 text-gray-400 hover:text-rose-600 rounded-lg transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        ) : (
                          <span className="text-[10px] text-gray-300 dark:text-slate-700 font-bold">
                            Audit log
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
