import React, { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  Ban,
  CalendarDays,
  CheckCircle2,
  Loader2,
  Sparkles,
  Star,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react";
import { getErrorMessage } from "../../../lib/api";
import { EnterprisePageHeader } from "../../shared/components/EnterprisePageHeader";
import { eventAdminService } from "../../../modules/events/services/event.service";
import type {
  EventDashboard,
  EventFestival,
} from "../../../modules/events/types/event.types";
import {
  formatDateRange,
  listingStatusLabel,
  listingStatusStyle,
} from "../../../modules/events/utils/eventFormat";

const CARD =
  "bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] shadow-sm";

const StatCard: React.FC<{
  label: string;
  value: string | number;
  hint?: string;
  icon: React.ReactNode;
}> = ({ label, value, hint, icon }) => (
  <div className={`${CARD} p-4`}>
    <div className="flex items-center justify-between">
      <span className="text-[10px] tracking-wider font-bold text-gray-400 uppercase">
        {label}
      </span>
      <span className="text-gray-300 dark:text-slate-700">{icon}</span>
    </div>
    <p className="mt-2 text-2xl font-black text-[#0B192C] dark:text-white">
      {value}
    </p>
    {hint ? (
      <p className="mt-0.5 text-[10px] font-bold text-gray-400">{hint}</p>
    ) : null}
  </div>
);

export const EventControlCenterPage: React.FC = () => {
  const [dashboard, setDashboard] = useState<EventDashboard | null>(null);
  const [events, setEvents] = useState<EventFestival[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [dashboardRes, eventRes] = await Promise.all([
        eventAdminService.dashboard(30),
        eventAdminService.listEvents({
          status: statusFilter || undefined,
          limit: 100,
        }),
      ]);
      setDashboard(dashboardRes.data?.data ?? null);
      setEvents(eventRes.data?.data ?? []);
    } catch (err) {
      setError(getErrorMessage(err, "We could not load the events console."));
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const setStatus = async (item: EventFestival, status: string) => {
    await eventAdminService.setStatus(item._id, status).catch(() => undefined);
    await load();
  };

  const toggleFeatured = async (item: EventFestival) => {
    await eventAdminService
      .setFeatured(item._id, !item.isFeatured)
      .catch(() => undefined);
    await load();
  };

  return (
    <div className="space-y-6">
      <EnterprisePageHeader
        title="Events Control Center"
        subtitle="Every festival on the platform, across all ashrams. Approvals live under Event Approvals."
        icon={<CalendarDays size={22} />}
        badgeText="Super Admin"
      />

      {error ? (
        <div className="flex items-start gap-2.5 p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-sm font-semibold">
          <AlertCircle size={16} /> {error}
        </div>
      ) : null}

      {dashboard ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Live events"
            value={dashboard.events.approved}
            hint={`${dashboard.events.pendingReview} awaiting review`}
            icon={<CalendarDays size={16} />}
          />
          <StatCard
            label="Running now"
            value={dashboard.events.runningNow}
            hint="Happening today"
            icon={<Sparkles size={16} />}
          />
          <StatCard
            label="Registrations (30d)"
            value={dashboard.totals.registrations ?? 0}
            hint={`${dashboard.totals.seats ?? 0} places reserved`}
            icon={<Users size={16} />}
          />
          <StatCard
            label="Admitted (30d)"
            value={dashboard.totals.admitted ?? 0}
            hint="Scanned at the gate"
            icon={<UserCheck size={16} />}
          />
        </div>
      ) : null}

      {dashboard?.topEvents?.length ? (
        <div className={`${CARD} p-5`}>
          <h2 className="flex items-center gap-2 text-base font-black text-[#0B192C] dark:text-white">
            <TrendingUp size={17} className="text-[#0A4DA6] stroke-[2.5]" />
            Most registered events
          </h2>
          <div className="mt-3 space-y-2">
            {dashboard.topEvents.map((row, index) => (
              <div
                key={row._id}
                className="flex items-center justify-between gap-3 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl px-3 py-2.5"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="w-5 shrink-0 text-sm font-bold text-gray-400">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-[#0B192C] dark:text-white">
                      {row.name ?? "—"}
                    </p>
                    <p className="text-[10px] font-bold text-gray-400">
                      {row.city ?? "—"} · {row.registrations} registrations
                    </p>
                  </div>
                </div>
                <span className="shrink-0 text-sm font-black text-[#0B192C] dark:text-white">
                  {row.seats} places
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-3">
        <select
          value={statusFilter}
          onChange={(changeEvent) => setStatusFilter(changeEvent.target.value)}
          className="bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-[#0B192C] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/30"
        >
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="pending">In review</option>
          <option value="approved">Live</option>
          <option value="rejected">Rejected</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      {loading ? (
        <div className={`${CARD} p-12 flex items-center justify-center gap-3`}>
          <Loader2 size={20} className="animate-spin text-[#0A4DA6]" />
          <span className="text-sm font-bold text-gray-400">Loading…</span>
        </div>
      ) : (
        <div className={`${CARD} overflow-x-auto`}>
          <table className="w-full min-w-[900px] text-sm">
            <thead className="border-b border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-900 text-left text-[10px] tracking-wider font-bold text-gray-400 uppercase">
              <tr>
                <th className="px-4 py-3">Event</th>
                <th className="px-4 py-3">Ashram</th>
                <th className="px-4 py-3">Dates</th>
                <th className="px-4 py-3">Registrations</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
              {events.map((item) => {
                const ashram =
                  typeof item.ashramId === "object" ? item.ashramId : null;
                return (
                  <tr key={item._id}>
                    <td className="px-4 py-3">
                      <p className="font-bold text-[#0B192C] dark:text-white">
                        {item.name}
                        {item.isFeatured ? (
                          <Star
                            size={12}
                            className="ml-1.5 inline fill-[#D4AF37] text-[#D4AF37]"
                          />
                        ) : null}
                      </p>
                      <p className="text-[10px] font-bold text-gray-400">
                        {item.venue?.city ?? "—"}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">
                      {ashram?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">
                      {formatDateRange(item.startDate, item.endDate)}
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">
                      {item.registrationCount ?? 0}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-black tracking-wider ${listingStatusStyle(item.status)}`}
                      >
                        {listingStatusLabel(item.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          title={item.isFeatured ? "Unfeature" : "Feature"}
                          onClick={() => toggleFeatured(item)}
                          className="p-2 rounded-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 text-gray-500 hover:text-[#0A4DA6] hover:border-[#0A4DA6] transition-all active:scale-90 cursor-pointer"
                        >
                          <Star
                            size={13}
                            className={
                              item.isFeatured
                                ? "fill-[#D4AF37] text-[#D4AF37]"
                                : ""
                            }
                          />
                        </button>
                        {item.status === "approved" ? (
                          <button
                            type="button"
                            title="Suspend"
                            onClick={() => setStatus(item, "suspended")}
                            className="p-2 rounded-full bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-400 transition-all active:scale-90 cursor-pointer"
                          >
                            <Ban size={13} />
                          </button>
                        ) : item.status === "suspended" ? (
                          <button
                            type="button"
                            title="Restore"
                            onClick={() => setStatus(item, "approved")}
                            className="p-2 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-400 transition-all active:scale-90 cursor-pointer"
                          >
                            <CheckCircle2 size={13} />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default EventControlCenterPage;
