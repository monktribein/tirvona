import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlarmClock, CheckCircle2, Flame, Hourglass, Inbox, LifeBuoy, Plus, RefreshCw, Timer, UserX, Users } from "lucide-react";
import { EnterprisePageHeader } from "../../shared/components/EnterprisePageHeader";
import { EnterpriseButton } from "../../shared/components/EnterpriseButton";
import { Empty, Panel, PanelState, Stat, useRemote } from "../../../modules/marketplace/ui";
import { PRIORITY_META, STATUS_META, formatMinutes } from "../../../modules/support/supportUi";
import { supportAdminApi, type SupportDashboard } from "../../../services/support.service";
import { humanizeLabel } from "../../../utils/labels";
import { useSupportRole } from "../supportAccess";

const BAR_TONE: Record<string, string> = {
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  saffron: "bg-[#F28C28]",
  red: "bg-rose-500",
  blue: "bg-indigo-500",
  gray: "bg-gray-400",
};

/** Horizontal bars: each row links to the matching filtered ticket list. */
const Bars: React.FC<{ rows: Array<{ key: string; label: string; count: number; tone?: string; to: string }> }> = ({ rows }) => {
  const max = Math.max(1, ...rows.map((r) => r.count));
  if (!rows.some((r) => r.count)) return <p className="text-xs text-gray-400 py-4 text-center">No tickets yet.</p>;
  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row.key}>
          <Link to={row.to} className="block group">
            <div className="flex justify-between text-[11px] font-bold mb-1">
              <span className="text-gray-600 dark:text-gray-300 group-hover:text-[#F28C28]">{row.label}</span>
              <span className="tabular-nums text-[#0B192C] dark:text-white">{row.count}</span>
            </div>
            <div className="h-2 rounded-full bg-gray-100 dark:bg-slate-800 overflow-hidden">
              <div className={`h-full rounded-full ${BAR_TONE[row.tone ?? "saffron"]}`} style={{ width: `${(row.count / max) * 100}%` }} />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
};

export const SupportDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { canCreateTickets } = useSupportRole();
  const { data: d, state, error, reload } = useRemote<SupportDashboard>(() => supportAdminApi.dashboard(), []);
  const list = (params: string) => `/admin/support/tickets?${params}`;

  return (
    <div className="space-y-5">
      <EnterprisePageHeader
        title="Support Dashboard"
        subtitle={d?.scope === "own_queue" ? "Your tickets and the unassigned queue." : "Every support ticket across Tirvona."}
        icon={<LifeBuoy size={20} />}
        actions={
          <>
            <EnterpriseButton variant="outline" size="sm" icon={<RefreshCw size={13} />} onClick={reload}>
              Refresh
            </EnterpriseButton>
            {canCreateTickets && (
              <EnterpriseButton size="sm" icon={<Plus size={13} />} onClick={() => navigate("/admin/support/tickets/new")}>
                New ticket
              </EnterpriseButton>
            )}
          </>
        }
      />
      {state !== "ready" || !d ? (
        <Panel>
          <PanelState state={state} error={error} onRetry={reload} />
        </Panel>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
            <Stat label="Total tickets" value={d.totals.total} icon={<Inbox size={15} />} to={list("view=all")} hint={`${d.totals.createdToday} new today`} />
            <Stat label="Open" value={d.totals.open + d.totals.reopened} icon={<Inbox size={15} />} to={list("status=OPEN,REOPENED")} hint={d.totals.reopened ? `${d.totals.reopened} reopened` : undefined} />
            <Stat label="In progress" value={d.totals.inProgress} icon={<Timer size={15} />} to={list("status=IN_PROGRESS")} />
            <Stat label="Waiting for customer" value={d.totals.waitingForUser} icon={<Hourglass size={15} />} to={list("status=WAITING_FOR_USER")} />
            <Stat label="Urgent (active)" value={d.totals.urgentOpen} icon={<Flame size={15} />} tone={d.totals.urgentOpen ? "warn" : undefined} to={list("view=urgent")} />
            <Stat label="Resolved today" value={d.totals.resolvedToday} icon={<CheckCircle2 size={15} />} tone="ok" to={list("status=RESOLVED&sort=activity")} />
            <Stat label="Unassigned" value={d.totals.unassignedOpen} icon={<UserX size={15} />} tone={d.totals.unassignedOpen ? "warn" : undefined} to={list("view=unassigned")} />
            <Stat label="SLA overdue" value={d.totals.overdueOpen} icon={<AlarmClock size={15} />} tone={d.totals.overdueOpen ? "warn" : undefined} to={list("view=overdue")} />
            <Stat label="Escalated" value={d.totals.escalatedOpen} icon={<Flame size={15} />} to={list("view=escalated")} />
            <Stat
              label="Avg. first response"
              value={formatMinutes(d.averages.firstResponse.minutes)}
              icon={<Timer size={15} />}
              hint={d.averages.firstResponse.sample ? `${d.averages.firstResponse.sample} tickets, last 30 days` : "No replies in the last 30 days"}
            />
            <Stat
              label="Avg. resolution time"
              value={formatMinutes(d.averages.resolution.minutes)}
              icon={<CheckCircle2 size={15} />}
              hint={d.averages.resolution.sample ? `${d.averages.resolution.sample} resolved, last 30 days` : "Nothing resolved in the last 30 days"}
            />
            <Stat label="Closed" value={d.totals.closed} icon={<CheckCircle2 size={15} />} to={list("status=CLOSED")} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Panel title="Tickets by status">
              <Bars rows={d.byStatus.map((s) => ({ key: s.key, label: STATUS_META[s.key]?.label ?? s.key, count: s.count, tone: STATUS_META[s.key]?.tone, to: list(`status=${s.key}`) }))} />
            </Panel>
            <Panel title="Active tickets by priority">
              <Bars rows={d.byPriority.map((p) => ({ key: p.key, label: PRIORITY_META[p.key]?.label ?? p.key, count: p.count, tone: PRIORITY_META[p.key]?.tone, to: list(`priority=${p.key}&status=OPEN,IN_PROGRESS,WAITING_FOR_USER,REOPENED`) }))} />
            </Panel>
            <Panel title="Tickets by category">
              <Bars rows={d.byCategory.map((c) => ({ key: c.key, label: c.label, count: c.count, to: list(`category=${encodeURIComponent(c.key)}`) }))} />
            </Panel>
          </div>

          <Panel title={<span className="flex items-center gap-2"><Users size={15} className="text-[#F28C28]" /> Staff workload (active tickets)</span>}>
            {!d.workload.length ? (
              <Empty title="No assigned active tickets" text="Assigned tickets that are still open show up here per agent." />
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-slate-800">
                {d.workload.map((w) => (
                  <li key={w.userId}>
                    <Link to={list(`assignedTo=${w.userId}&status=OPEN,IN_PROGRESS,WAITING_FOR_USER,REOPENED`)} className="flex items-center justify-between gap-3 py-2.5 hover:bg-orange-50/40 dark:hover:bg-slate-900/60 rounded-lg px-1">
                      <span className="min-w-0">
                        <span className="block text-xs font-black text-[#0B192C] dark:text-white truncate">{w.name}</span>
                        <span className="block text-[10px] text-gray-400">{humanizeLabel(w.role)}</span>
                      </span>
                      <span className="text-sm font-black tabular-nums">{w.open}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </>
      )}
    </div>
  );
};

export default SupportDashboardPage;
