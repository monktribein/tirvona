import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LifeBuoy, Search, Send, X } from "lucide-react";
import { EnterprisePageHeader } from "../../shared/components/EnterprisePageHeader";
import { EnterpriseButton } from "../../shared/components/EnterpriseButton";
import { Field, Panel, inputClass } from "../../../modules/marketplace/ui";
import { AttachmentPicker, PRIORITY_META } from "../../../modules/support/supportUi";
import { toast } from "../../../lib/toast";
import {
  ENTITY_TYPE_LABELS,
  TICKET_PRIORITIES,
  supportAdminApi,
  type LinkableRecord,
  type PersonRef,
  type SupportAttachment,
  type SupportCategory,
  type SupportStaffMember,
} from "../../../services/support.service";
import { humanizeLabel } from "../../../utils/labels";
import { useSupportRole } from "../supportAccess";

/** Staff raising a ticket for a customer (phone call, email, walk-in). */
export const SupportNewTicketPage: React.FC = () => {
  const navigate = useNavigate();
  const { userId, isSupervisor } = useSupportRole();
  const [search, setSearch] = useState("");
  const [matches, setMatches] = useState<PersonRef[]>([]);
  const [customer, setCustomer] = useState<PersonRef | null>(null);
  const [categories, setCategories] = useState<SupportCategory[]>([]);
  const [staff, setStaff] = useState<SupportStaffMember[]>([]);
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [entityType, setEntityType] = useState("");
  const [records, setRecords] = useState<LinkableRecord[]>([]);
  const [entityId, setEntityId] = useState("");
  const [reference, setReference] = useState("");
  const [files, setFiles] = useState<SupportAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supportAdminApi.categories().then((r) => setCategories((r.data.data ?? []).filter((c: SupportCategory) => c.isActive !== false))).catch(() => undefined);
    supportAdminApi.staff().then((r) => setStaff(r.data.data ?? [])).catch(() => undefined);
  }, []);

  useEffect(() => {
    const q = search.trim();
    if (q.length < 2 || customer) return setMatches([]);
    const timer = window.setTimeout(() => {
      supportAdminApi.customers(q).then((r) => setMatches(r.data.data ?? [])).catch(() => setMatches([]));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search, customer]);

  useEffect(() => {
    setEntityId("");
    setRecords([]);
    if (!customer || !entityType || ["other", "ashram", "temple"].includes(entityType)) return;
    supportAdminApi.customerLinkable(customer._id, entityType).then((r) => setRecords(r.data.data ?? [])).catch(() => setRecords([]));
  }, [customer, entityType]);

  const selectedCategory = categories.find((c) => c.key === category);
  const defaultPriority = selectedCategory?.defaultPriority ?? "MEDIUM";
  const assignable = useMemo(() => (isSupervisor ? staff : staff.filter((s) => s._id === userId)), [staff, isSupervisor, userId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer) return toast.error("Choose the customer this ticket is for.");
    if (!category) return toast.error("Choose a category.");
    setSaving(true);
    try {
      const res = await supportAdminApi.create({
        userId: customer._id,
        subject: subject.trim(),
        description: description.trim(),
        category,
        priority: priority || undefined,
        assignedTo: assignedTo || undefined,
        relatedEntity: entityType && (entityId || reference.trim()) ? { type: entityType, entityId: entityId || undefined, reference: reference.trim() || undefined } : undefined,
        attachmentIds: files.map((f) => f._id!).filter(Boolean),
      });
      navigate(`/admin/support/tickets/${res.data.data._id}`, { replace: true });
    } catch {
      // Shown by the API client.
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <EnterprisePageHeader title="Create Ticket" subtitle="Raise a ticket on a customer's behalf. They are notified and can follow it in Help & Support." icon={<LifeBuoy size={20} />} />
      <Panel>
        <form onSubmit={submit} className="space-y-4 max-w-3xl">
          <Field label="Customer" required>
            {customer ? (
              <div className="flex items-center justify-between gap-2 rounded-xl border border-gray-200 dark:border-slate-700 px-3 py-2 text-xs">
                <span>
                  <b>{customer.name}</b> · {customer.email} {customer.phone ? `· ${customer.phone}` : ""}
                </span>
                <button type="button" onClick={() => { setCustomer(null); setSearch(""); }} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-slate-800 cursor-pointer" aria-label="Change customer">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search size={14} className="absolute left-3 top-3 text-gray-400" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, email or phone" className={`${inputClass} pl-9`} />
                {matches.length > 0 && (
                  <ul className="absolute z-20 mt-1 w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-[#0B192C] shadow-lg max-h-64 overflow-y-auto">
                    {matches.map((m) => (
                      <li key={m._id}>
                        <button type="button" onClick={() => setCustomer(m)} className="w-full text-left px-3 py-2 text-xs hover:bg-orange-50 dark:hover:bg-slate-800 cursor-pointer">
                          <b>{m.name}</b> · {m.email} {m.phone ? `· ${m.phone}` : ""} <span className="text-gray-400">({humanizeLabel(m.role ?? "")})</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Category" required>
              <select value={category} onChange={(e) => { setCategory(e.target.value); setEntityType(""); }} className={inputClass} required>
                <option value="">Choose</option>
                {categories.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Priority">
              <select value={priority} onChange={(e) => setPriority(e.target.value)} className={inputClass}>
                <option value="">Category default ({PRIORITY_META[defaultPriority].label})</option>
                {TICKET_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_META[p].label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Assign to">
              <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} className={inputClass}>
                <option value="">Leave unassigned</option>
                {assignable.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s._id === userId ? "Me" : s.name} ({s.openTickets} active)
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Related record">
              <select value={entityType} onChange={(e) => setEntityType(e.target.value)} className={inputClass}>
                <option value="">None</option>
                {Object.entries(ENTITY_TYPE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            {records.length > 0 && (
              <Field label="Customer's records">
                <select value={entityId} onChange={(e) => setEntityId(e.target.value)} className={inputClass}>
                  <option value="">Choose one</option>
                  {records.map((r) => (
                    <option key={r.entityId} value={r.entityId}>
                      {r.reference}
                      {r.status ? ` (${r.status})` : ""}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            {entityType && !entityId && (
              <Field label="Reference / ID">
                <input value={reference} onChange={(e) => setReference(e.target.value)} maxLength={120} className={inputClass} placeholder="e.g. BK-12345" />
              </Field>
            )}
          </div>

          <Field label="Subject" required>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} required minLength={3} maxLength={200} className={inputClass} />
          </Field>
          <Field label="Description" required>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} required minLength={10} maxLength={5000} rows={6} className={inputClass} />
          </Field>
          <AttachmentPicker value={files} onChange={setFiles} onBusy={setUploading} />
          <div className="flex gap-2 justify-end">
            <EnterpriseButton type="button" variant="outline" onClick={() => navigate(-1)}>
              Cancel
            </EnterpriseButton>
            <EnterpriseButton type="submit" icon={<Send size={14} />} loading={saving} disabled={saving || uploading}>
              Create ticket
            </EnterpriseButton>
          </div>
        </form>
      </Panel>
    </div>
  );
};

export default SupportNewTicketPage;
