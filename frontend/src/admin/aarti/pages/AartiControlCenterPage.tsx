import React, { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  Ban,
  CheckCircle2,
  Flame,
  IndianRupee,
  Loader2,
  Radio,
  Star,
  Ticket,
  TrendingUp,
  Users,
} from "lucide-react";
import { getErrorMessage } from "../../../lib/api";
import { EnterprisePageHeader } from "../../shared/components/EnterprisePageHeader";
import { aartiAdminService } from "../../../modules/aarti/services/aarti.service";
import type {
  AartiDashboard,
  AartiSession,
  AartiStream,
} from "../../../modules/aarti/types/aarti.types";
import {
  sessionStatusLabel,
  sessionStatusStyle,
  formatClock,
  formatCurrency,
  formatSchedule,
} from "../../../modules/aarti/utils/aartiFormat";

const StatCard: React.FC<{
  label: string;
  value: string | number;
  hint?: string;
  icon: React.ReactNode;
}> = ({ label, value, hint, icon }) => (
  <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] shadow-sm p-4">
    <div className="flex items-center justify-between">
      <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
        {label}
      </span>
      <span className="text-gray-300 dark:text-slate-700">{icon}</span>
    </div>
    <p className="mt-2 text-2xl font-bold text-[#0B192C] dark:text-white">{value}</p>
    {hint ? <p className="mt-0.5 text-xs text-gray-400">{hint}</p> : null}
  </div>
);

export const AartiControlCenterPage: React.FC = () => {
  const [dashboard, setDashboard] = useState<AartiDashboard | null>(null);
  const [sessions, setSessions] = useState<AartiSession[]>([]);
  const [streams, setStreams] = useState<AartiStream[]>([]);
  const [tab, setTab] = useState<"sessions" | "streams">("sessions");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [dashboardRes, sessionRes, streamRes] = await Promise.all([
        aartiAdminService.dashboard(30),
        aartiAdminService.listSessions({
          status: statusFilter || undefined,
          limit: 100,
        }),
        aartiAdminService.listStreams({
          status: statusFilter || undefined,
          limit: 100,
        }),
      ]);
      setDashboard(dashboardRes.data?.data ?? null);
      setSessions(sessionRes.data?.data ?? []);
      setStreams(streamRes.data?.data ?? []);
    } catch (err) {
      setError(getErrorMessage(err, "We could not load the aarti console."));
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const setSessionStatus = async (session: AartiSession, status: string) => {
    await aartiAdminService
      .setSessionStatus(session._id, status)
      .catch(() => undefined);
    await load();
  };

  const toggleFeatured = async (session: AartiSession) => {
    await aartiAdminService
      .setSessionFeatured(session._id, !session.isFeatured)
      .catch(() => undefined);
    await load();
  };

  const toggleStreamFeatured = async (stream: AartiStream) => {
    await aartiAdminService
      .setStreamFeatured(stream._id, !stream.isFeatured)
      .catch(() => undefined);
    await load();
  };

  return (
    <div className="space-y-6">
      <EnterprisePageHeader
        title="Aarti Control Center"
        subtitle="Every aarti and live pooja on the platform, across all ashrams. Approvals live under Aarti Approvals."
        icon={<Flame size={22} />}
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
            label="Live aartis"
            value={dashboard.sessions.approved}
            hint={`${dashboard.sessions.pendingReview} awaiting review`}
            icon={<Flame size={16} />}
          />
          <StatCard
            label="Live poojas"
            value={dashboard.streams.approved}
            hint={`${dashboard.streams.liveNow} streaming now`}
            icon={<Radio size={16} />}
          />
          <StatCard
            label="Passes sold (30d)"
            value={dashboard.totals.passes ?? 0}
            hint={`${dashboard.totals.bookings ?? 0} bookings`}
            icon={<Ticket size={16} />}
          />
          <StatCard
            label="Gross (30d)"
            value={formatCurrency(dashboard.totals.gross ?? 0)}
            hint={`${formatCurrency(dashboard.totals.donations ?? 0)} in donations`}
            icon={<IndianRupee size={16} />}
          />
        </div>
      ) : null}

      {dashboard?.topSessions?.length ? (
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] shadow-sm p-5">
          <h2 className="flex items-center gap-2 text-base font-bold text-[#0B192C] dark:text-white">
            <TrendingUp size={17} className="text-[#D4AF37]" /> Top aartis by revenue
          </h2>
          <div className="mt-3 space-y-2">
            {dashboard.topSessions.map((row, index) => (
              <div
                key={row._id}
                className="flex items-center justify-between gap-3 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl px-3 py-2.5"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="w-5 shrink-0 text-sm font-bold text-gray-400">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[#0B192C] dark:text-white">
                      {row.name ?? "—"}
                    </p>
                    <p className="text-[10px] font-bold text-gray-400">
                      {row.city ?? "—"} · {row.passes} passes
                    </p>
                  </div>
                </div>
                <span className="shrink-0 text-sm font-bold text-[#0B192C] dark:text-white">
                  {formatCurrency(row.revenue)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {(["sessions", "streams"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors cursor-pointer ${
                tab === value
                  ? "bg-[#0A4DA6] text-white"
                  : "text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-900"
              }`}
            >
              {value === "sessions" ? "Aartis" : "Live poojas"}
            </button>
          ))}
        </div>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-[#0B192C] dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/30 transition-all"
        >
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="pending">In review</option>
          <option value="approved">Live</option>
          <option value="rejected">Rejected</option>
          <option value="suspended">Suspended</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {loading ? (
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] shadow-sm p-12 flex items-center justify-center gap-3">
          <Loader2 size={20} className="animate-spin text-[#0A4DA6]" />
          <span className="text-sm font-bold text-gray-400">Loading…</span>
        </div>
      ) : tab === "sessions" ? (
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] shadow-sm overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="border-b border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-900 text-left text-[10px] tracking-wider font-bold text-gray-400 uppercase">
              <tr>
                <th className="px-4 py-3">Aarti</th>
                <th className="px-4 py-3">Ashram</th>
                <th className="px-4 py-3">Schedule</th>
                <th className="px-4 py-3">Bookings</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
              {sessions.map((session) => {
                const tone = sessionStatusStyle(session.status);
                const ashram =
                  typeof session.ashramId === "object" ? session.ashramId : null;
                return (
                  <tr key={session._id}>
                    <td className="px-4 py-3">
                      <p className="font-bold text-[#0B192C] dark:text-white">
                        {session.name}
                        {session.isFeatured ? (
                          <Star
                            size={12}
                            className="ml-1.5 inline fill-[#D4AF37] text-[#D4AF37]"
                          />
                        ) : null}
                      </p>
                      <p className="text-[10px] font-bold text-gray-400">
                        {session.venue?.city ?? "—"}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">
                      {ashram?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">
                      {formatClock(session.startTime)}
                      <span className="block text-xs text-gray-400">
                        {formatSchedule(session.daysOfWeek)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">
                      {session.bookingCount ?? 0}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-black tracking-wider ${tone}`}
                      >
                        {sessionStatusLabel(session.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          title={session.isFeatured ? "Unfeature" : "Feature"}
                          onClick={() => toggleFeatured(session)}
                          className="p-2 rounded-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 text-gray-500 hover:text-[#0A4DA6] hover:border-[#0A4DA6] transition-all active:scale-90 cursor-pointer"
                        >
                          <Star
                            size={13}
                            className={
                              session.isFeatured
                                ? "fill-[#D4AF37] text-[#D4AF37]"
                                : ""
                            }
                          />
                        </button>
                        {session.status === "approved" ? (
                          <button
                            type="button"
                            title="Suspend"
                            onClick={() => setSessionStatus(session, "suspended")}
                            className="p-2 rounded-full bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-400 transition-all active:scale-90 cursor-pointer"
                          >
                            <Ban size={13} />
                          </button>
                        ) : session.status === "suspended" ? (
                          <button
                            type="button"
                            title="Restore"
                            onClick={() => setSessionStatus(session, "approved")}
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
      ) : (
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] shadow-sm overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="border-b border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-900 text-left text-[10px] tracking-wider font-bold text-gray-400 uppercase">
              <tr>
                <th className="px-4 py-3">Stream</th>
                <th className="px-4 py-3">Ashram</th>
                <th className="px-4 py-3">Platform</th>
                <th className="px-4 py-3">Views</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
              {streams.map((stream) => {
                const tone = sessionStatusStyle(stream.status);
                const ashram =
                  typeof stream.ashramId === "object" ? stream.ashramId : null;
                return (
                  <tr key={stream._id}>
                    <td className="px-4 py-3">
                      <p className="font-bold text-[#0B192C] dark:text-white">
                        {stream.title}
                        {stream.isLiveNow ? (
                          <span className="ml-2 rounded-full bg-rose-600 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
                            Live
                          </span>
                        ) : null}
                      </p>
                      <a
                        href={stream.streamUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="line-clamp-1 text-[10px] font-semibold text-[#0A4DA6] dark:text-blue-400 hover:underline"
                      >
                        {stream.streamUrl}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">
                      {ashram?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 capitalize text-xs font-semibold text-gray-500 dark:text-gray-400">
                      {stream.provider}
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        <Users size={12} /> {stream.viewCount ?? 0}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-black tracking-wider ${tone}`}
                      >
                        {sessionStatusLabel(stream.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        title={stream.isFeatured ? "Unfeature" : "Feature"}
                        onClick={() => toggleStreamFeatured(stream)}
                        className="p-2 rounded-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 text-gray-500 hover:text-[#0A4DA6] hover:border-[#0A4DA6] transition-all active:scale-90 cursor-pointer"
                      >
                        <Star
                          size={13}
                          className={
                            stream.isFeatured ? "fill-[#D4AF37] text-[#D4AF37]" : ""
                          }
                        />
                      </button>
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

export default AartiControlCenterPage;
