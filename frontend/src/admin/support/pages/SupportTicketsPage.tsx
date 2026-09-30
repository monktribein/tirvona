import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AlarmClock, Flame, LifeBuoy, Plus, Search, X } from "lucide-react";
import { EnterprisePageHeader } from "../../shared/components/EnterprisePageHeader";
import { EnterpriseButton } from "../../shared/components/EnterpriseButton";
import { Chips, Empty, Pager, Panel, PanelState, ResponsiveTable, inputClass, useRemote } from "../../../modules/marketplace/ui";
import { PRIORITY_META, PriorityPill, STATUS_META, StatusPill, timeAgo } from "../../../modules/support/supportUi";
import {
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  supportAdminApi,
  type PersonRef,
  type StaffTicket,
  type SupportCategory,
  type SupportStaffMember,
} from "../../../services/support.service";
import { useSupportRole } from "../supportAccess";

const VIEWS = [
  { value: "all", label: "All tickets" },
  { value: "mine", label: "My assigned" },
  { value: "unassigned", label: "Unassigned" },
  { value: "urgent", label: "Urgent" },
  { value: "escalated", label: "Escalated" },
  { value: "overdue", label: "SLA overdue" },
];

const TITLES: Record<string, string> = {
  all: "All Tickets",
  mine: "My Assigned Tickets",
  unassigned: "Unassigned Tickets",
  urgent: "Urgent Tickets",
  escalated: "Escalated Tickets",
  overdue: "SLA Overdue Tickets",
};

const SORTS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "priority", label: "Highest priority" },
  { value: "activity", label: "Recent activity" },
  { value: "due", label: "Resolution due soonest" },
];

const person = (value: PersonRef | string | null | undefined) =>
  value && typeof value === "object" ? value : null;

export const SupportTicketsPage: React.FC = () => {
  const navigate = useNavigate();
  const { canCreateTickets } = useSupportRole();
  const [params, setParams] = useSearchParams();
  const view = params.get("view") ?? "all";
  const status = params.get("status") ?? "";
  const priority = params.get("priority") ?? "";
  const category = params.get("category") ?? "";
  const assignedTo = params.get("assignedTo") ?? "";
  const search = params.get("search") ?? "";
  const sort = params.get("sort") ?? (view === "urgent" || view === "overdue" ? "priority" : "newest");
  const page = Number(params.get("page") ?? 1) || 1;
  const [draft, setDraft] = useState(search);
  const [categories, setCategories] = useState<SupportCategory[]>([]);
  const [staff, setStaff] = useState<SupportStaffMember[]>([]);

  useEffect(() => setDraft(search), [search]);
  useEffect(() => {
    supportAdminApi.categories().then((r) => setCategories(r.data.data ?? [])).catch(() => undefined);
    supportAdminApi.staff().then((r) => setStaff(r.data.data ?? [])).catch(() => undefined);
  }, []);

  const { data, meta, state, error, reload } = useRemote<StaffTicket[]>(
    () =>
      supportAdminApi.tickets({
        view,
        status: status || undefined,
        priority: priority || undefined,
        category: category || undefined,
        assignedTo: assignedTo || undefined,
        search: search || undefined,
        sort,
        page,
        limit: 20,
      }),
    [view, status, priority, category, assignedTo, search, sort, page],
  );

  const set = (changes: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (!("page" in changes)) next.delete("page");
    setParams(next);
  };
  const filtered = Boolean(status || priority || category || assignedTo || search);

  return (
    <div className="space-y-5">
      <EnterprisePageHeader
        title={TITLES[view] ?? "Tickets"}
        subtitle="Search, filter and open any ticket to work it."
        icon={<LifeBuoy size={20} />}
        actions={
          canCreateTickets && (
            <EnterpriseButton size="sm" icon={<Plus size={13} />} onClick={() => navigate("/admin/support/tickets/new")}>
              New ticket
            </EnterpriseButton>
          )
        }
      />
      <Panel>
        <div className="space-y-3">
          <Chips value={view} options={VIEWS} onChange={(v) => set({ view: v === "all" ? "" : v })} />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2">
            <form
              className="relative sm:col-span-2"
              onSubmit={(e) => {
                e.preventDefault();
                set({ search: draft.trim() });
              }}
            >
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Ticket no., subject, customer, booking ref."
                className={`${inputClass} pl-9`}
                aria-label="Search tickets"
              />
            </form>
            <select value={status} onChange={(e) => set({ status: e.target.value })} className={inputClass} aria-label="Status">
              <option value="">Any status</option>
              <option value="OPEN,IN_PROGRESS,WAITING_FOR_USER,REOPENED">Active (not finished)</option>
              {TICKET_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s === "WAITING_FOR_USER" ? "Waiting for customer" : STATUS_META[s].label}
                </option>
              ))}
            </select>
            <select value={priority} onChange={(e) => set({ priority: e.target.value })} className={inputClass} aria-label="Priority">
              <option value="">Any priority</option>
              {TICKET_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_META[p].label}
                </option>
              ))}
            </select>
            <select value={category} onChange={(e) => set({ category: e.target.value })} className={inputClass} aria-label="Category">
              <option value="">Any category</option>
              {categories.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
            <select value={sort} onChange={(e) => set({ sort: e.target.value })} className={inputClass} aria-label="Sort">
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          {(filtered || staff.length > 0) && (
            <div className="flex flex-wrap items-center gap-2">
              {staff.length > 0 && (
                <select value={assignedTo} onChange={(e) => set({ assignedTo: e.target.value })} className={`${inputClass} sm:w-60`} aria-label="Assignee">
                  <option value="">Any assignee</option>
                  {staff.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name} ({s.openTickets} active)
                    </option>
                  ))}
                </select>
              )}
              {filtered && (
                <EnterpriseButton
                  variant="ghost"
                  size="sm"
                  icon={<X size={13} />}
                  onClick={() => set({ status: "", priority: "", category: "", assignedTo: "", search: "" })}
                >
                  Clear filters
                </EnterpriseButton>
              )}
            </div>
          )}

          {state !== "ready" ? (
            <PanelState state={state} error={error} onRetry={reload} />
          ) : !data?.length ? (
            <Empty icon={<LifeBuoy size={28} className="text-gray-300" />} title="No tickets found" text={filtered ? "Try different filters." : "Nothing in this view right now."} />
          ) : (
            <>
              <ResponsiveTable
                rows={data}
                rowKey={(t) => t._id}
                onRowClick={(t) => navigate(`/admin/support/tickets/${t._id}`)}
                columns={[
                  {
                    header: "Ticket",
                    cell: (t) => (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="font-mono font-black">{t.ticketNumber}</span>
                        {t.unreadForStaff > 0 && <span className="w-2 h-2 rounded-full bg-[#F28C28]" title="New customer message" />}
                      </span>
                    ),
                  },
                  {
                    header: "Subject",
                    cell: (t) => (
                      <span className="block min-w-0 max-w-[280px]">
                        <span className="block font-bold truncate">{t.subject}</span>
                        <span className="block text-[10px] text-gray-400 truncate">
                          {person(t.userId)?.name ?? "Customer"}
                          {t.relatedEntity?.reference ? ` · ${t.relatedEntity.reference}` : ""}
                        </span>
                      </span>
                    ),
                  },
                  { header: "Category", cell: (t) => t.categoryLabel || t.category, hideOnMobile: true },
                  {
                    header: "Priority",
                    cell: (t) => (
                      <span className="inline-flex items-center gap-1">
                        <PriorityPill priority={t.priority} />
                        {t.isEscalated && <Flame size={12} className="text-rose-500" aria-label="Escalated" />}
                      </span>
                    ),
                  },
                  { header: "Status", cell: (t) => <StatusPill status={t.status} staff /> },
                  { header: "Assignee", cell: (t) => person(t.assignedTo)?.name ?? <span className="text-gray-400">Unassigned</span>, hideOnMobile: true },
                  {
                    header: "SLA",
                    cell: (t) =>
                      t.sla.breached ? (
                        <span className="inline-flex items-center gap-1 text-rose-600 font-black text-[10px]">
                          <AlarmClock size={12} /> Overdue
                        </span>
                      ) : (
                        <span className="text-[10px] text-gray-400">On track</span>
                      ),
                    hideOnMobile: true,
                  },
                  { header: "Activity", cell: (t) => <span className="text-[11px] text-gray-500 whitespace-nowrap">{timeAgo(t.lastActivityAt)}</span>, hideOnMobile: true },
                ]}
              />
              <Pager page={meta.page} limit={meta.limit} total={meta.total} onPage={(p) => set({ page: String(p) })} />
            </>
          )}
        </div>
      </Panel>
    </div>
  );
};

export default SupportTicketsPage;
