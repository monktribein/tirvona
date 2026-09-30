import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AlarmClock, ArrowLeft, Flame, Link2, Lock, MessageSquare, Send, UserCheck, UserMinus } from "lucide-react";
import { EnterpriseButton } from "../../shared/components/EnterpriseButton";
import { EnterpriseModal } from "../../shared/components/EnterpriseModal";
import { Field, Panel, PanelState, inputClass, useAction, useRemote } from "../../../modules/marketplace/ui";
import {
  AttachmentPicker,
  EntityCard,
  PRIORITY_META,
  PriorityPill,
  STATUS_META,
  StatusPill,
  Thread,
  formatMinutes,
  fullTime,
  timeAgo,
  type ThreadItem,
} from "../../../modules/support/supportUi";
import {
  ENTITY_TYPE_LABELS,
  TICKET_PRIORITIES,
  supportAdminApi,
  type PersonRef,
  type StaffTicketDetail,
  type SupportAttachment,
  type SupportCategory,
  type SupportStaffMember,
  type TicketStatus,
} from "../../../services/support.service";
import { humanizeLabel } from "../../../utils/labels";
import { useSupportRole } from "../supportAccess";

const person = (value: PersonRef | string | null | undefined) => (value && typeof value === "object" ? value : null);
const statusLabel = (s: TicketStatus) => (s === "WAITING_FOR_USER" ? "Waiting for customer" : STATUS_META[s]?.label ?? s);

const ACTIVITY: Record<string, (a: { from: string; to: string }) => string> = {
  created: () => "created the ticket",
  status_changed: (a) => `changed status ${a.from ? `from ${humanizeLabel(a.from.toLowerCase())} ` : ""}to ${humanizeLabel(a.to.toLowerCase())}`,
  priority_changed: (a) => `changed priority from ${a.from} to ${a.to}`,
  category_changed: (a) => `moved it from ${a.from} to ${a.to}`,
  assigned: (a) => `assigned it${a.to ? ` to ${a.to}` : ""}`,
  unassigned: () => "unassigned it",
  escalated: (a) => `escalated it (priority ${a.to})`,
  entity_linked: (a) => `linked ${a.to}`,
  entity_unlinked: (a) => `removed the link to ${a.from}`,
};

export const SupportTicketWorkspacePage: React.FC = () => {
  const { id = "" } = useParams();
  const { userId } = useSupportRole();
  const { data, state, error, reload } = useRemote<StaffTicketDetail>(() => supportAdminApi.ticket(id), [id]);
  const { busy, run } = useAction();
  const [staff, setStaff] = useState<SupportStaffMember[]>([]);
  const [categories, setCategories] = useState<SupportCategory[]>([]);
  const [mode, setMode] = useState<"reply" | "note">("reply");
  const [body, setBody] = useState("");
  const [after, setAfter] = useState("");
  const [files, setFiles] = useState<SupportAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);

  useEffect(() => {
    supportAdminApi.categories().then((r) => setCategories((r.data.data ?? []).filter((c: SupportCategory) => c.isActive !== false))).catch(() => undefined);
    supportAdminApi.staff().then((r) => setStaff(r.data.data ?? [])).catch(() => undefined);
  }, []);

  // Pick up customer replies while the ticket is open.
  useEffect(() => {
    const timer = window.setInterval(() => !document.hidden && !body && reload(), 30_000);
    return () => window.clearInterval(timer);
  }, [reload, body]);

  const items: ThreadItem[] = useMemo(() => {
    if (!data) return [];
    const t = data.ticket;
    const customerName = person(t.userId)?.name ?? "Customer";
    const opening: ThreadItem = { id: "opening", side: "them", name: `${customerName} (opened ticket)`, body: t.description, attachments: t.attachments, createdAt: t.createdAt };
    return [
      opening,
      ...data.messages.map((m): ThreadItem => ({
        id: m._id,
        side: m.internal ? "note" : m.senderType === "staff" ? "me" : m.senderType === "system" ? "system" : "them",
        name: m.senderType === "staff" ? `${m.senderName || "Staff"}${String(m.senderId) === userId ? " (you)" : ""}` : m.senderName || customerName,
        body: m.body,
        attachments: m.attachments,
        createdAt: m.createdAt,
        readAt: m.senderType === "staff" && !m.internal ? m.readAt : undefined,
      })),
    ];
  }, [data, userId]);

  if (state !== "ready" || !data)
    return (
      <Panel>
        <PanelState state={state} error={error} onRetry={reload} missingText="This ticket does not exist or is outside your queue." />
      </Panel>
    );

  const { ticket: t, customer, relatedEntity, permissions, activity } = data;
  const assignee = person(t.assignedTo);
  const assigneeId = assignee?._id ?? (typeof t.assignedTo === "string" ? t.assignedTo : "");
  const finished = t.status === "RESOLVED" || t.status === "CLOSED";

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    const ok = await run(
      "send",
      () =>
        supportAdminApi.reply(t._id, {
          body: body.trim(),
          internal: mode === "note",
          status: after || undefined,
          attachmentIds: files.map((f) => f._id!).filter(Boolean),
        }),
      reload,
    );
    if (ok) {
      setBody("");
      setFiles([]);
      setAfter("");
    }
  };

  const change = (key: string, payload: { status?: string; priority?: string; category?: string; note?: string }) =>
    run(key, () => supportAdminApi.update(t._id, payload), reload);

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <Link to="/admin/support/tickets" className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 mt-0.5" aria-label="Back to tickets">
          <ArrowLeft size={18} />
        </Link>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-black text-gray-500">{t.ticketNumber}</span>
            <StatusPill status={t.status} staff />
            <PriorityPill priority={t.priority} />
            {t.isEscalated && (
              <span className="inline-flex items-center gap-1 text-[10px] font-black text-rose-600">
                <Flame size={12} /> Escalated
              </span>
            )}
            {t.sla.breached && (
              <span className="inline-flex items-center gap-1 text-[10px] font-black text-rose-600">
                <AlarmClock size={12} /> SLA overdue
              </span>
            )}
          </div>
          <h1 className="text-lg font-black text-[#0B192C] dark:text-white break-words">{t.subject}</h1>
          <p className="text-[11px] text-gray-500">
            {t.categoryLabel || t.category} · opened {fullTime(t.createdAt)}
            {t.source === "admin" ? ` by ${person(t.createdBy)?.name ?? "staff"}` : ""} · last activity {timeAgo(t.lastActivityAt)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">
        {/* ------------------------------------------------ conversation */}
        <Panel className="xl:col-span-2" padded={false}>
          <div className="p-4 sm:p-5 max-h-[65vh] overflow-y-auto">
            <Thread items={items} />
          </div>
          <form onSubmit={send} className="border-t border-gray-100 dark:border-slate-800 p-4 sm:p-5 space-y-2.5">
            <div className="flex gap-1.5" role="tablist">
              {([
                ["reply", "Reply to customer", <MessageSquare key="r" size={13} />],
                ["note", "Internal note", <Lock key="n" size={13} />],
              ] as const).map(([key, label, icon]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={mode === key}
                  onClick={() => setMode(key)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-extrabold border cursor-pointer ${
                    mode === key
                      ? key === "note"
                        ? "bg-amber-100 border-amber-300 text-amber-800 dark:bg-amber-950/50 dark:border-amber-800 dark:text-amber-300"
                        : "bg-[#F28C28] border-[#F28C28] text-white"
                      : "bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-300"
                  }`}
                >
                  {icon}
                  {label}
                </button>
              ))}
            </div>
            {mode === "reply" && t.status === "CLOSED" ? (
              <p className="text-xs text-gray-500 py-2">This ticket is closed. Reopen it (status → Reopened) to reply to the customer; internal notes still work.</p>
            ) : (
              <>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={4}
                  maxLength={5000}
                  placeholder={mode === "note" ? "Only staff can see this note…" : "Write your reply to the customer…"}
                  className={`${inputClass} ${mode === "note" ? "!bg-amber-50/60 dark:!bg-amber-950/20 !border-amber-200 dark:!border-amber-900" : ""}`}
                  aria-label={mode === "note" ? "Internal note" : "Reply"}
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <AttachmentPicker value={files} onChange={setFiles} onBusy={setUploading} compact />
                  <div className="flex flex-wrap items-center gap-2">
                    {permissions.transitions.length > 0 && (
                      <select value={after} onChange={(e) => setAfter(e.target.value)} className={`${inputClass} !w-auto !py-2`} aria-label="Status after sending">
                        <option value="">Keep status</option>
                        {permissions.transitions.map((s) => (
                          <option key={s} value={s}>
                            Then: {statusLabel(s)}
                          </option>
                        ))}
                      </select>
                    )}
                    <EnterpriseButton
                      type="submit"
                      size="sm"
                      variant={mode === "note" ? "warning" : "primary"}
                      icon={mode === "note" ? <Lock size={13} /> : <Send size={13} />}
                      loading={busy === "send"}
                      disabled={!body.trim() || uploading || busy === "send"}
                    >
                      {mode === "note" ? "Add note" : "Send reply"}
                    </EnterpriseButton>
                  </div>
                </div>
              </>
            )}
          </form>
        </Panel>

        {/* ------------------------------------------------ side panel */}
        <div className="space-y-4">
          <Panel title="Ticket">
            <div className="space-y-3">
              <Field label="Status">
                <select
                  value=""
                  onChange={(e) => e.target.value && change("status", { status: e.target.value })}
                  className={inputClass}
                  disabled={busy === "status" || !permissions.transitions.length}
                >
                  <option value="">{statusLabel(t.status)} — change to…</option>
                  {permissions.transitions.map((s) => (
                    <option key={s} value={s}>
                      {statusLabel(s)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Priority">
                <select value={t.priority} onChange={(e) => change("priority", { priority: e.target.value })} className={inputClass} disabled={busy === "priority"}>
                  {TICKET_PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {PRIORITY_META[p].label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Category">
                <select value={t.category} onChange={(e) => change("category", { category: e.target.value })} className={inputClass} disabled={busy === "category"}>
                  {!categories.some((c) => c.key === t.category) && <option value={t.category}>{t.categoryLabel || t.category}</option>}
                  {categories.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Assigned to">
                {permissions.canAssignOthers ? (
                  <select
                    value={assigneeId}
                    onChange={(e) => run("assign", () => supportAdminApi.assign(t._id, e.target.value || null), reload)}
                    className={inputClass}
                    disabled={busy === "assign"}
                  >
                    <option value="">Unassigned</option>
                    {staff.map((s) => (
                      <option key={s._id} value={s._id}>
                        {s.name} · {humanizeLabel(s.role)} ({s.openTickets} active)
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="flex items-center justify-between gap-2 text-xs font-bold">
                    <span>{assignee?.name ?? "Unassigned"}</span>
                    {!assigneeId && (
                      <EnterpriseButton size="sm" variant="outline" icon={<UserCheck size={13} />} loading={busy === "assign"} onClick={() => run("assign", () => supportAdminApi.assign(t._id, userId), reload, "Ticket assigned to you")}>
                        Assign to me
                      </EnterpriseButton>
                    )}
                    {assigneeId === userId && (
                      <EnterpriseButton size="sm" variant="ghost" icon={<UserMinus size={13} />} loading={busy === "assign"} onClick={() => run("assign", () => supportAdminApi.assign(t._id, null), reload)}>
                        Release
                      </EnterpriseButton>
                    )}
                  </div>
                )}
              </Field>
              {!finished && !t.isEscalated && (
                <EnterpriseButton
                  variant="danger"
                  size="sm"
                  icon={<Flame size={13} />}
                  loading={busy === "escalate"}
                  onClick={() => {
                    const reason = window.prompt("Why does this need escalation?")?.trim();
                    if (reason && reason.length >= 3) run("escalate", () => supportAdminApi.escalate(t._id, reason), reload);
                  }}
                >
                  Escalate
                </EnterpriseButton>
              )}
              {t.isEscalated && t.escalation?.reason && (
                <p className="rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 p-2.5 text-[11px] text-rose-800 dark:text-rose-300">
                  <b>Escalated</b> {fullTime(t.escalation.at)}: {t.escalation.reason}
                </p>
              )}
            </div>
          </Panel>

          <Panel title="Customer">
            <div className="space-y-1 text-xs">
              <p className="font-black text-sm text-[#0B192C] dark:text-white">{customer.name ?? "—"}</p>
              {customer.email && <p className="text-gray-500 break-all">{customer.email}</p>}
              {customer.phone && <p className="text-gray-500">{customer.phone}</p>}
              <p className="text-[11px] text-gray-400 pt-1">
                {customer.totalTickets} ticket{customer.totalTickets === 1 ? "" : "s"} · {customer.openTickets} active
                {customer.createdAt ? ` · member since ${new Date(customer.createdAt).getFullYear()}` : ""}
              </p>
              {customer.totalTickets > 1 && (
                <Link to={`/admin/support/tickets?view=all&search=${encodeURIComponent(customer.email ?? customer.phone ?? "")}`} className="text-[11px] font-black text-[#F28C28] hover:underline">
                  View their other tickets
                </Link>
              )}
            </div>
          </Panel>

          <Panel
            title="Related record"
            actions={
              <EnterpriseButton size="sm" variant="ghost" icon={<Link2 size={13} />} onClick={() => setLinkOpen(true)}>
                {relatedEntity ? "Change" : "Link"}
              </EnterpriseButton>
            }
          >
            {relatedEntity ? <EntityCard entity={relatedEntity} /> : <p className="text-xs text-gray-400">No booking, order or payment linked.</p>}
          </Panel>

          <Panel title="SLA">
            <dl className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <dt className="text-[10px] font-bold text-gray-400">First response due</dt>
                <dd className={`font-bold ${t.sla.firstResponseOverdue ? "text-rose-600" : ""}`}>{t.firstResponseAt ? "—" : fullTime(t.firstResponseDueAt)}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold text-gray-400">First response</dt>
                <dd className="font-bold">{t.firstResponseAt ? `${formatMinutes(t.firstResponseMinutes)}` : "Not yet"}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold text-gray-400">Resolution due</dt>
                <dd className={`font-bold ${t.sla.resolutionOverdue ? "text-rose-600" : ""}`}>{t.resolvedAt ? "—" : fullTime(t.resolutionDueAt)}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold text-gray-400">Resolved in</dt>
                <dd className="font-bold">{t.resolvedAt ? formatMinutes(t.resolutionMinutes) : "—"}</dd>
              </div>
              {t.reopenedCount > 0 && (
                <div className="col-span-2 text-[11px] text-amber-700">Reopened {t.reopenedCount}×</div>
              )}
            </dl>
          </Panel>

          <Panel title="History">
            <ol className="space-y-2">
              {activity.map((a) => (
                <li key={a._id} className="text-[11px] leading-snug">
                  <span className="font-black text-[#0B192C] dark:text-gray-100">{a.actorName || "System"}</span>{" "}
                  <span className="text-gray-600 dark:text-gray-300">{(ACTIVITY[a.action] ?? (() => a.action.replace(/_/g, " ")))(a)}</span>
                  {a.note && <span className="block text-gray-500 italic">“{a.note}”</span>}
                  <span className="block text-[10px] text-gray-400">{fullTime(a.createdAt)}</span>
                </li>
              ))}
            </ol>
          </Panel>
        </div>
      </div>

      <LinkRecordModal
        open={linkOpen}
        onClose={() => setLinkOpen(false)}
        ticketId={t._id}
        customerId={person(t.userId)?._id ?? String(t.userId)}
        hasLink={Boolean(relatedEntity)}
        onDone={() => {
          setLinkOpen(false);
          reload();
        }}
      />
    </div>
  );
};

const LinkRecordModal: React.FC<{ open: boolean; onClose: () => void; ticketId: string; customerId: string; hasLink: boolean; onDone: () => void }> = ({
  open,
  onClose,
  ticketId,
  customerId,
  hasLink,
  onDone,
}) => {
  const [type, setType] = useState("booking");
  const [records, setRecords] = useState<Array<{ entityId: string; reference: string; title: string; status: string }>>([]);
  const [entityId, setEntityId] = useState("");
  const [reference, setReference] = useState("");
  const { busy, run } = useAction();

  useEffect(() => {
    if (!open) return;
    setEntityId("");
    setRecords([]);
    if (["other", "ashram", "temple"].includes(type)) return;
    supportAdminApi.customerLinkable(customerId, type).then((r) => setRecords(r.data.data ?? [])).catch(() => setRecords([]));
  }, [open, type, customerId]);

  return (
    <EnterpriseModal isOpen={open} onClose={onClose} title="Link a related record" maxWidth="lg">
      <div className="space-y-3">
        <Field label="Record type">
          <select value={type} onChange={(e) => setType(e.target.value)} className={inputClass}>
            {Object.entries(ENTITY_TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        {records.length > 0 && (
          <Field label="This customer's records">
            <select value={entityId} onChange={(e) => setEntityId(e.target.value)} className={inputClass}>
              <option value="">Choose one</option>
              {records.map((r) => (
                <option key={r.entityId} value={r.entityId}>
                  {r.reference}
                  {r.title && r.title !== r.reference ? ` — ${r.title}` : ""}
                  {r.status ? ` (${r.status})` : ""}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="…or reference / ID" hint="Booking ID, order no., refund no., payment/transaction ID, or a name for a property/temple.">
          <input value={reference} onChange={(e) => setReference(e.target.value)} maxLength={120} className={inputClass} />
        </Field>
        <div className="flex flex-wrap justify-between gap-2 pt-2">
          {hasLink ? (
            <EnterpriseButton variant="ghost" size="sm" loading={busy === "unlink"} onClick={() => run("unlink", () => supportAdminApi.link(ticketId), onDone)}>
              Remove link
            </EnterpriseButton>
          ) : (
            <span />
          )}
          <EnterpriseButton
            size="sm"
            disabled={!entityId && !reference.trim()}
            loading={busy === "link"}
            onClick={() => run("link", () => supportAdminApi.link(ticketId, { type, entityId: entityId || undefined, reference: reference.trim() || undefined }), onDone)}
          >
            Link record
          </EnterpriseButton>
        </div>
      </div>
    </EnterpriseModal>
  );
};

export default SupportTicketWorkspacePage;
