import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, LifeBuoy, Plus, RotateCcw, Search, Send } from "lucide-react";
import { getErrorMessage } from "../../lib/api";
import { toast } from "../../lib/toast";
import { EnterpriseButton } from "../../admin/shared/components/EnterpriseButton";
import { Chips, Empty, Field, Pager, Panel, PanelState, inputClass, useAction, useRemote } from "../../modules/marketplace/ui";
import {
  AttachmentPicker,
  StatusPill,
  Thread,
  fullTime,
  timeAgo,
  type ThreadItem,
} from "../../modules/support/supportUi";
import {
  ENTITY_TYPE_LABELS,
  supportApi,
  type CustomerTicket,
  type CustomerTicketDetail,
  type LinkableRecord,
  type SupportAttachment,
  type SupportCategory,
} from "../../services/support.service";
import { SUPPORT_CONFIG } from "../../constants/support";

/**
 * Help & Support inside the profile: /profile/support (my tickets),
 * /profile/support/new and /profile/support/:ticketId (conversation).
 */
export const ProfileSupportTab: React.FC = () => {
  const { pathname } = useLocation();
  const rest = pathname.replace(/^\/profile\/support\/?/, "");
  if (rest === "new") return <CreateTicket />;
  if (rest) return <TicketDetail id={rest.split("/")[0]} />;
  return <MyTickets />;
};

const FILTERS = [
  { value: "", label: "All" },
  { value: "active", label: "Active" },
  { value: "WAITING_FOR_USER", label: "Needs my reply" },
  { value: "finished", label: "Resolved & closed" },
];

const MyTickets: React.FC = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const { data, meta, state, error, reload } = useRemote<CustomerTicket[]>(
    () => supportApi.myTickets({ status: status || undefined, search: query || undefined, page, limit: 10 }),
    [status, query, page],
  );

  return (
    <div className="space-y-4">
      <Panel
        title={
          <span className="flex items-center gap-2">
            <LifeBuoy size={16} className="text-[#F28C28]" /> Help &amp; Support
          </span>
        }
        actions={
          <EnterpriseButton size="sm" icon={<Plus size={14} />} onClick={() => navigate("/profile/support/new")}>
            New ticket
          </EnterpriseButton>
        }
      >
        <div className="space-y-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Raise a ticket for any booking, order, payment or account problem. Our team replies here and you get a notification.
            Urgent? Call {SUPPORT_CONFIG.helpline}.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <Chips value={status} options={FILTERS} onChange={(v) => { setPage(1); setStatus(v); }} />
            <form
              className="relative sm:ml-auto sm:w-64"
              onSubmit={(e) => { e.preventDefault(); setPage(1); setQuery(search.trim()); }}
            >
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search ticket no. or subject"
                className={`${inputClass} pl-9`}
                aria-label="Search tickets"
              />
            </form>
          </div>
          {state !== "ready" ? (
            <PanelState state={state} error={error} onRetry={reload} />
          ) : !data?.length ? (
            <Empty
              icon={<LifeBuoy size={28} className="text-gray-300" />}
              title={query || status ? "No tickets match" : "No support tickets yet"}
              text={query || status ? "Try another filter." : "When you need help, create a ticket and track it here."}
              action={!query && !status && (
                <EnterpriseButton size="sm" icon={<Plus size={14} />} onClick={() => navigate("/profile/support/new")}>
                  Create a ticket
                </EnterpriseButton>
              )}
            />
          ) : (
            <>
              <ul className="divide-y divide-gray-100 dark:divide-slate-800">
                {data.map((t) => (
                  <li key={t._id}>
                    <Link
                      to={`/profile/support/${t._id}`}
                      className="flex items-start justify-between gap-3 py-3 px-1 hover:bg-orange-50/40 dark:hover:bg-slate-900/60 rounded-xl transition-colors"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-[11px] font-black text-gray-500">{t.ticketNumber}</span>
                          <StatusPill status={t.status} />
                          {t.unread > 0 && (
                            <span className="px-1.5 py-0.5 rounded-full bg-[#F28C28] text-white text-[9px] font-black">
                              {t.unread} new
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-black text-[#0B192C] dark:text-white truncate">{t.subject}</p>
                        <p className="text-[11px] text-gray-500 truncate">
                          {t.categoryLabel}
                          {t.relatedEntity ? ` · ${t.relatedEntity.label}` : ""}
                        </p>
                      </div>
                      <span className="text-[10px] font-bold text-gray-400 whitespace-nowrap pt-0.5">{timeAgo(t.lastActivityAt)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              <Pager page={meta.page} limit={meta.limit} total={meta.total} onPage={setPage} />
            </>
          )}
        </div>
      </Panel>
    </div>
  );
};

const CreateTicket: React.FC = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<SupportCategory[]>([]);
  const [category, setCategory] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [entityType, setEntityType] = useState("");
  const [records, setRecords] = useState<LinkableRecord[] | null>(null);
  const [entityId, setEntityId] = useState("");
  const [reference, setReference] = useState("");
  const [files, setFiles] = useState<SupportAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supportApi
      .categories()
      .then((res) => setCategories(res.data.data ?? []))
      .catch((err) => toast.error(getErrorMessage(err, "Could not load categories.")));
  }, []);

  const selected = categories.find((c) => c.key === category);
  const entityTypes = useMemo(() => (selected?.entityTypes ?? []).filter((t) => ENTITY_TYPE_LABELS[t]), [selected]);

  useEffect(() => {
    setEntityId("");
    setReference("");
    setRecords(null);
    if (!entityType || entityType === "other" || entityType === "ashram" || entityType === "temple") return;
    let cancelled = false;
    supportApi
      .linkable(entityType)
      .then((res) => !cancelled && setRecords(res.data.data ?? []))
      .catch(() => !cancelled && setRecords([]));
    return () => {
      cancelled = true;
    };
  }, [entityType]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category) return toast.error("Please choose a category.");
    if (description.trim().length < 10) return toast.error("Please describe the problem in at least 10 characters.");
    const relatedEntity = entityType && (entityId || reference.trim())
      ? { type: entityType, entityId: entityId || undefined, reference: reference.trim() || undefined }
      : undefined;
    setSaving(true);
    try {
      const res = await supportApi.create({
        subject: subject.trim(),
        description: description.trim(),
        category,
        relatedEntity,
        attachmentIds: files.map((f) => f._id!).filter(Boolean),
      });
      navigate(`/profile/support/${res.data.data._id}`, { replace: true });
    } catch {
      // The API client already shows the reason.
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel
      title={
        <span className="flex items-center gap-2">
          <Link to="/profile/support" className="p-1 -ml-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800" aria-label="Back to my tickets">
            <ArrowLeft size={16} />
          </Link>
          New support ticket
        </span>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="What is this about?" required>
          <select value={category} onChange={(e) => { setCategory(e.target.value); setEntityType(""); }} className={inputClass} required>
            <option value="">Choose a category</option>
            {categories.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
          {selected?.description && <span className="block text-[10px] text-gray-400">{selected.description}</span>}
        </Field>

        {entityTypes.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Related to (optional)" hint="Linking the booking or order helps us solve it faster.">
              <select value={entityType} onChange={(e) => setEntityType(e.target.value)} className={inputClass}>
                <option value="">Nothing specific</option>
                {entityTypes.map((t) => (
                  <option key={t} value={t}>
                    {ENTITY_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </Field>
            {entityType && records && records.length > 0 && (
              <Field label={`Which ${ENTITY_TYPE_LABELS[entityType]?.toLowerCase()}?`}>
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
            {entityType && (records?.length === 0 || ["other", "ashram", "temple"].includes(entityType)) && (
              <Field
                label={entityType === "ashram" || entityType === "temple" ? "Name" : "Reference number"}
                hint={records?.length === 0 ? "We found none on your account — enter the reference if you have it." : undefined}
              >
                <input value={reference} onChange={(e) => setReference(e.target.value)} maxLength={120} className={inputClass} placeholder="e.g. BK-12345" />
              </Field>
            )}
          </div>
        )}

        <Field label="Subject" required>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} required minLength={3} maxLength={200} className={inputClass} placeholder="e.g. Room not allocated at check-in" />
        </Field>

        <Field label="Describe the problem" required hint="Include dates, amounts and what you expected to happen.">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            minLength={10}
            maxLength={5000}
            rows={6}
            className={inputClass}
            placeholder="Tell us what happened…"
          />
          <span className="block text-right text-[10px] text-gray-400">{description.length}/5000</span>
        </Field>

        <AttachmentPicker value={files} onChange={setFiles} onBusy={setUploading} />

        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-2">
          <EnterpriseButton type="button" variant="outline" onClick={() => navigate("/profile/support")}>
            Cancel
          </EnterpriseButton>
          <EnterpriseButton type="submit" loading={saving} disabled={saving || uploading} icon={<Send size={14} />}>
            Submit ticket
          </EnterpriseButton>
        </div>
      </form>
    </Panel>
  );
};

const ACTIVITY_TEXT: Record<string, (a: { from: string; to: string }) => string> = {
  created: () => "Ticket created",
  status_changed: (a) => `Status: ${a.to.replace(/_/g, " ").toLowerCase()}`,
  category_changed: (a) => `Category changed to ${a.to}`,
};

const TicketDetail: React.FC<{ id: string }> = ({ id }) => {
  const { data: t, state, error, reload } = useRemote<CustomerTicketDetail>(() => supportApi.ticket(id), [id]);
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<SupportAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const { busy, run } = useAction();

  // Refresh quietly while the page is open so staff replies appear.
  useEffect(() => {
    const timer = window.setInterval(() => !document.hidden && reload(), 30_000);
    return () => window.clearInterval(timer);
  }, [reload]);

  const items: ThreadItem[] = useMemo(() => {
    if (!t) return [];
    const opening: ThreadItem = {
      id: "opening",
      side: "me",
      name: "You",
      body: t.description,
      attachments: t.attachments,
      createdAt: t.createdAt,
    };
    const messages: ThreadItem[] = t.messages.map((m) => ({
      id: m._id,
      side: m.mine ? "me" : m.senderType === "system" ? "system" : "them",
      name: m.mine ? "You" : m.senderName,
      body: m.body,
      attachments: m.attachments,
      createdAt: m.createdAt,
      readAt: m.mine ? m.readAt : undefined,
    }));
    const events: ThreadItem[] = t.activity
      .filter((a) => a.action !== "created")
      .map((a) => ({
        id: a._id,
        side: "system",
        name: "",
        body: (ACTIVITY_TEXT[a.action] ?? (() => a.action.replace(/_/g, " ")))(a),
        createdAt: a.createdAt,
      }));
    return [opening, ...messages, ...events].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [t]);

  if (state !== "ready" || !t)
    return (
      <Panel>
        <PanelState state={state} error={error} onRetry={reload} missingText="This ticket does not exist or is not yours." />
      </Panel>
    );

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    try {
      await supportApi.reply(t._id, body.trim(), files.map((f) => f._id!).filter(Boolean));
      setBody("");
      setFiles([]);
      await reload();
    } catch (err) {
      toast.error(getErrorMessage(err, "Your message could not be sent."));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <Panel padded={false}>
        <div className="p-4 sm:p-5 space-y-3 border-b border-gray-100 dark:border-slate-800">
          <div className="flex items-start gap-2">
            <Link to="/profile/support" className="p-1 -ml-1 mt-0.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800" aria-label="Back to my tickets">
              <ArrowLeft size={16} />
            </Link>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs font-black text-gray-500">{t.ticketNumber}</span>
                <StatusPill status={t.status} />
              </div>
              <h2 className="text-base font-black text-[#0B192C] dark:text-white break-words">{t.subject}</h2>
              <p className="text-[11px] text-gray-500">
                {t.categoryLabel} · opened {fullTime(t.createdAt)}
                {t.relatedEntity ? ` · ${t.relatedEntity.label}` : ""}
              </p>
            </div>
          </div>
          {t.status === "WAITING_FOR_USER" && (
            <p className="rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 px-3 py-2 text-xs font-bold text-amber-800 dark:text-amber-300">
              Our team is waiting for your reply to continue.
            </p>
          )}
          {t.status === "RESOLVED" && (
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 px-3 py-2.5 flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
              <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                We marked this resolved. Is your problem solved?
              </p>
              <div className="flex gap-2">
                <EnterpriseButton size="sm" variant="success" icon={<CheckCircle2 size={13} />} loading={busy === "close"} onClick={() => run("close", () => supportApi.close(t._id), reload)}>
                  Yes, close it
                </EnterpriseButton>
                <EnterpriseButton size="sm" variant="outline" icon={<RotateCcw size={13} />} loading={busy === "reopen"} onClick={() => run("reopen", () => supportApi.reopen(t._id), reload)}>
                  No, reopen
                </EnterpriseButton>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 sm:p-5 max-h-[60vh] overflow-y-auto">
          <Thread items={items} />
        </div>

        {t.canReply ? (
          <form onSubmit={send} className="p-4 sm:p-5 border-t border-gray-100 dark:border-slate-800 space-y-2">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              maxLength={5000}
              placeholder="Write a reply…"
              className={inputClass}
              aria-label="Reply"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) send(e);
              }}
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <AttachmentPicker value={files} onChange={setFiles} onBusy={setUploading} compact />
              <div className="flex gap-2">
                {t.canClose && t.status !== "RESOLVED" && (
                  <EnterpriseButton
                    type="button"
                    size="sm"
                    variant="ghost"
                    loading={busy === "close"}
                    onClick={() => window.confirm("Close this ticket? You can reopen it within 30 days.") && run("close", () => supportApi.close(t._id), reload)}
                  >
                    Close ticket
                  </EnterpriseButton>
                )}
                <EnterpriseButton type="submit" size="sm" icon={<Send size={13} />} loading={sending} disabled={sending || uploading || !body.trim()}>
                  Send
                </EnterpriseButton>
              </div>
            </div>
          </form>
        ) : (
          <div className="p-4 sm:p-5 border-t border-gray-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <p className="text-xs text-gray-500">
              This ticket is closed{t.closedAt ? ` (${fullTime(t.closedAt)})` : ""}.
              {t.canReopen ? " Still need help? Reopen it." : " Please create a new ticket if you still need help."}
            </p>
            {t.canReopen ? (
              <EnterpriseButton
                size="sm"
                variant="outline"
                icon={<RotateCcw size={13} />}
                loading={busy === "reopen"}
                onClick={() => {
                  const reason = window.prompt("What is still wrong? (optional)") ?? undefined;
                  run("reopen", () => supportApi.reopen(t._id, reason?.trim() || undefined), reload);
                }}
              >
                Reopen ticket
              </EnterpriseButton>
            ) : (
              <Link to="/profile/support/new" className="text-xs font-black text-[#F28C28] hover:underline">
                Create a new ticket
              </Link>
            )}
          </div>
        )}
      </Panel>
    </div>
  );
};

export default ProfileSupportTab;
