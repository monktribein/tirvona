import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  leadCollectionService,
  type Lead,
  type LeadStats,
  type LeadStatus,
} from "../../../services/leadCollection.service";
import { getErrorMessage } from "../../../lib/api";
import { toast } from "../../../lib/toast";
import {
  EnterpriseButton,
  EnterpriseModal,
  EnterprisePageHeader,
  EnterpriseStatsCard,
  EnterpriseStatusBadge,
} from "../../shared";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Clock,
  Eye,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  Users,
  XCircle,
} from "lucide-react";

const STATUS_TABS: { key: "" | LeadStatus; label: string }[] = [
  { key: "", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "converted", label: "Converted" },
  { key: "rejected", label: "Rejected" },
];

const INTERESTS = ["Interested", "Not Interested", "Follow-up Required"];

const inputClass =
  "w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-[#0B192C] dark:text-white focus:outline-none focus:border-[#0A4DA6]";

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <div className="space-y-1">
    <label className="text-[11px] font-black text-gray-500 block">{label}</label>
    {children}
  </div>
);

interface LeadForm {
  name: string;
  address: string;
  city: string;
  state: string;
  lat: string;
  lng: string;
  ownerName: string;
  phone: string;
  totalRooms: string;
  roomPrice: string;
  onlineRooms: string;
  offlineRooms: string;
  interest: string;
  meetingRequested: boolean;
  meetingTime: string;
  meetingMode: string;
  notes: string;
}

const BLANK: LeadForm = {
  name: "",
  address: "",
  city: "",
  state: "",
  lat: "",
  lng: "",
  ownerName: "",
  phone: "",
  totalRooms: "",
  roomPrice: "",
  onlineRooms: "",
  offlineRooms: "",
  interest: "Interested",
  meetingRequested: false,
  meetingTime: "",
  meetingMode: "Call",
  notes: "",
};

const toForm = (lead: Lead): LeadForm => ({
  name: lead.name ?? "",
  address: lead.location?.address ?? "",
  city: lead.location?.city ?? "",
  state: lead.location?.state ?? "",
  lat: lead.location?.coordinates?.lat?.toString() ?? "",
  lng: lead.location?.coordinates?.lng?.toString() ?? "",
  ownerName: lead.contact?.ownerName ?? "",
  phone: lead.contact?.phone ?? "",
  totalRooms: lead.roomInventory?.totalRooms?.toString() ?? "",
  roomPrice: lead.roomInventory?.roomPrice?.toString() ?? "",
  onlineRooms: lead.roomInventory?.onlineRooms?.toString() ?? "",
  offlineRooms: lead.roomInventory?.offlineRooms?.toString() ?? "",
  interest: lead.interest ?? "Interested",
  meetingRequested: Boolean(lead.meeting?.requested),
  meetingTime: lead.meeting?.time ?? "",
  meetingMode: lead.meeting?.mode || "Call",
  notes: lead.notes ?? "",
});

/** Empty strings become `undefined`, so a blank field is omitted rather than
 *  sent as NaN — the API validates numbers strictly. */
const num = (value: string): number | undefined => {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const toPayload = (form: LeadForm) => ({
  name: form.name.trim(),
  location: {
    address: form.address.trim(),
    city: form.city.trim(),
    state: form.state.trim(),
    coordinates: { lat: num(form.lat), lng: num(form.lng) },
  },
  roomInventory: {
    totalRooms: num(form.totalRooms),
    roomPrice: num(form.roomPrice),
    onlineRooms: num(form.onlineRooms),
    offlineRooms: num(form.offlineRooms),
  },
  contact: { ownerName: form.ownerName.trim(), phone: form.phone.trim() },
  notes: form.notes.trim(),
  interest: form.interest,
  meeting: {
    requested: form.meetingRequested,
    time: form.meetingRequested ? form.meetingTime : "",
    mode: form.meetingRequested ? form.meetingMode : "",
  },
});

const formatDate = (value?: string | null): string =>
  value
    ? new Date(value).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

export const LeadCollectionPage: React.FC = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<LeadStats | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<"" | LeadStatus>("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [viewing, setViewing] = useState<Lead | null>(null);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<LeadForm>(BLANK);
  const [confirmDelete, setConfirmDelete] = useState<Lead | null>(null);

  const limit = 20;
  const pages = Math.max(1, Math.ceil(total / limit));

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params: Record<string, string | number> = { page, limit };
      if (status) params.status = status;
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
      const [listRes, statsRes] = await Promise.all([
        leadCollectionService.listLeads(params),
        leadCollectionService.leadStats(),
      ]);
      setLeads(listRes.data.data.items ?? []);
      setTotal(listRes.data.data.total ?? 0);
      setStats(statsRes.data.data);
    } catch (err) {
      setError(getErrorMessage(err, "Could not load leads."));
      setLeads([]);
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [page, status, debouncedSearch]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setForm(BLANK);
    setCreating(true);
  };

  const openEdit = (lead: Lead) => {
    setForm(toForm(lead));
    setEditing(lead);
  };

  const closeForm = () => {
    setCreating(false);
    setEditing(null);
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast.error("Ashram / stay name is required");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await leadCollectionService.updateLead(editing._id, toPayload(form));
      } else {
        await leadCollectionService.createLead(toPayload(form));
      }
      closeForm();
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not save the lead."));
    } finally {
      setSaving(false);
    }
  };

  const decide = async (
    lead: Lead,
    action: "approve" | "reject" | "convert" | "reopen",
  ) => {
    setSaving(true);
    try {
      if (action === "approve") await leadCollectionService.approveLead(lead._id);
      if (action === "reject") await leadCollectionService.rejectLead(lead._id);
      if (action === "convert") await leadCollectionService.convertLead(lead._id);
      if (action === "reopen") await leadCollectionService.reopenLead(lead._id);
      setViewing(null);
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not update the lead."));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!confirmDelete) return;
    setSaving(true);
    try {
      await leadCollectionService.deleteLead(confirmDelete._id);
      setConfirmDelete(null);
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not delete the lead."));
    } finally {
      setSaving(false);
    }
  };

  const mapsUrl = useMemo(() => {
    const lat = viewing?.location?.coordinates?.lat;
    const lng = viewing?.location?.coordinates?.lng;
    return typeof lat === "number" && typeof lng === "number"
      ? `https://www.google.com/maps?q=${lat},${lng}`
      : "";
  }, [viewing]);

  const formBody = (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="ASHRAM / STAY NAME *">
          <input
            className={inputClass}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Field>
        <Field label="OWNER / TRUSTEE">
          <input
            className={inputClass}
            value={form.ownerName}
            onChange={(e) => setForm({ ...form, ownerName: e.target.value })}
          />
        </Field>
        <Field label="CONTACT NUMBER">
          <input
            className={inputClass}
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </Field>
        <Field label="INTEREST">
          <select
            className={inputClass}
            value={form.interest}
            onChange={(e) => setForm({ ...form, interest: e.target.value })}
          >
            {INTERESTS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="ADDRESS">
          <input
            className={inputClass}
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
        </Field>
        <Field label="CITY">
          <input
            className={inputClass}
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
          />
        </Field>
        <Field label="STATE">
          <input
            className={inputClass}
            value={form.state}
            onChange={(e) => setForm({ ...form, state: e.target.value })}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="LATITUDE">
            <input
              className={inputClass}
              value={form.lat}
              onChange={(e) => setForm({ ...form, lat: e.target.value })}
            />
          </Field>
          <Field label="LONGITUDE">
            <input
              className={inputClass}
              value={form.lng}
              onChange={(e) => setForm({ ...form, lng: e.target.value })}
            />
          </Field>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Field label="TOTAL ROOMS">
          <input
            className={inputClass}
            value={form.totalRooms}
            onChange={(e) => setForm({ ...form, totalRooms: e.target.value })}
          />
        </Field>
        <Field label="PRICE / NIGHT">
          <input
            className={inputClass}
            value={form.roomPrice}
            onChange={(e) => setForm({ ...form, roomPrice: e.target.value })}
          />
        </Field>
        <Field label="ONLINE ROOMS">
          <input
            className={inputClass}
            value={form.onlineRooms}
            onChange={(e) => setForm({ ...form, onlineRooms: e.target.value })}
          />
        </Field>
        <Field label="OFFLINE ROOMS">
          <input
            className={inputClass}
            value={form.offlineRooms}
            onChange={(e) => setForm({ ...form, offlineRooms: e.target.value })}
          />
        </Field>
      </div>

      <label className="flex items-center gap-2.5 p-3 rounded-2xl border border-gray-200 dark:border-slate-700 cursor-pointer">
        <input
          type="checkbox"
          className="accent-[#0A4DA6]"
          checked={form.meetingRequested}
          onChange={(e) =>
            setForm({ ...form, meetingRequested: e.target.checked })
          }
        />
        <span className="text-xs font-bold text-[#0B192C] dark:text-white">
          Owner requested a meeting with the Tirvona team
        </span>
      </label>

      {form.meetingRequested && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="PREFERRED TIME">
            <input
              type="datetime-local"
              className={inputClass}
              value={form.meetingTime}
              onChange={(e) => setForm({ ...form, meetingTime: e.target.value })}
            />
          </Field>
          <Field label="MODE">
            <select
              className={inputClass}
              value={form.meetingMode}
              onChange={(e) => setForm({ ...form, meetingMode: e.target.value })}
            >
              <option value="Call">Call</option>
              <option value="In-person">In-person</option>
            </select>
          </Field>
        </div>
      )}

      <Field label="DISCUSSION NOTES">
        <textarea
          rows={4}
          className={inputClass}
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />
      </Field>
    </div>
  );

  return (
    <div className="space-y-5">
      <EnterprisePageHeader
        title="Lead Collection"
        subtitle="Ashram onboarding leads captured in the field by Tirvona agents."
        icon={<ClipboardList size={22} />}
        badgeText="FIELD VERIFICATION"
        actions={
          <>
            <Link to="/admin/lead-collection/agents">
              <EnterpriseButton variant="outline" icon={<Users size={14} />}>
                Field Agents
              </EnterpriseButton>
            </Link>
            <EnterpriseButton
              variant="outline"
              icon={<RefreshCw size={14} />}
              onClick={() => void load()}
            >
              Refresh
            </EnterpriseButton>
            <EnterpriseButton icon={<Plus size={14} />} onClick={openCreate}>
              Add Lead
            </EnterpriseButton>
          </>
        }
      />

      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <EnterpriseStatsCard
            title="TOTAL LEADS"
            value={stats.total}
            icon={<ClipboardList size={18} />}
            description={`${stats.capturedLast7Days} captured in the last 7 days`}
          />
          <EnterpriseStatsCard
            title="AWAITING REVIEW"
            value={stats.pending}
            icon={<Clock size={18} />}
            badgeText="PENDING"
            badgeColor="bg-amber-100 text-amber-800 border-amber-200"
          />
          <EnterpriseStatsCard
            title="APPROVED"
            value={stats.approved + stats.converted}
            icon={<CheckCircle2 size={18} />}
            description={`${stats.converted} converted to listings`}
          />
          <EnterpriseStatsCard
            title="MEETINGS REQUESTED"
            value={stats.meetingsRequested}
            icon={<CalendarClock size={18} />}
            description={`${stats.interested} owners marked interested`}
          />
        </div>
      )}

      <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-4 flex flex-col lg:flex-row gap-3 lg:items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key || "all"}
              onClick={() => {
                setStatus(tab.key);
                setPage(1);
              }}
              className={`px-4 py-2 rounded-full text-xs font-extrabold transition-colors cursor-pointer ${
                status === tab.key
                  ? "bg-[#0A4DA6] text-white"
                  : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="relative w-full lg:w-80">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            className={`${inputClass} pl-9`}
            placeholder="Search name, city, owner, agent…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] overflow-hidden">
        {loading ? (
          <div className="p-16 flex flex-col items-center gap-3 text-gray-400">
            <Loader2 size={26} className="animate-spin" />
            <span className="text-xs font-bold">Loading leads…</span>
          </div>
        ) : error ? (
          <div className="p-16 flex flex-col items-center gap-3 text-rose-500">
            <AlertTriangle size={26} />
            <span className="text-xs font-bold">{error}</span>
            <EnterpriseButton
              variant="outline"
              size="sm"
              onClick={() => void load()}
            >
              Try again
            </EnterpriseButton>
          </div>
        ) : leads.length === 0 ? (
          <div className="p-16 flex flex-col items-center gap-2 text-gray-400">
            <ClipboardList size={26} />
            <span className="text-sm font-black text-[#0B192C] dark:text-white">
              No leads yet
            </span>
            <span className="text-xs font-semibold text-center max-w-sm">
              Leads appear here as field agents submit them from the Tirvona
              lead app. Create a field agent account to get started.
            </span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 dark:bg-slate-900/60 border-b border-gray-100 dark:border-slate-800">
                <tr className="text-[10px] font-black text-gray-500 tracking-wider">
                  <th className="px-5 py-3">ASHRAM</th>
                  <th className="px-5 py-3">LOCATION</th>
                  <th className="px-5 py-3">OWNER</th>
                  <th className="px-5 py-3">INTEREST</th>
                  <th className="px-5 py-3">AGENT</th>
                  <th className="px-5 py-3">CAPTURED</th>
                  <th className="px-5 py-3">STATUS</th>
                  <th className="px-5 py-3 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {leads.map((lead) => (
                  <tr
                    key={lead._id}
                    className="hover:bg-gray-50/70 dark:hover:bg-slate-900/40 transition-colors"
                  >
                    <td className="px-5 py-3">
                      <div className="text-xs font-black text-[#0B192C] dark:text-white">
                        {lead.name}
                      </div>
                      {lead.meeting?.requested && (
                        <div className="text-[10px] font-bold text-amber-600 flex items-center gap-1 mt-0.5">
                          <CalendarClock size={11} />
                          Meeting requested
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3 text-xs font-semibold text-gray-500">
                      {lead.location?.city || "—"}
                      {lead.location?.state ? `, ${lead.location.state}` : ""}
                    </td>
                    <td className="px-5 py-3 text-xs font-semibold text-gray-500">
                      <div>{lead.contact?.ownerName || "—"}</div>
                      <div className="text-[10px]">{lead.contact?.phone}</div>
                    </td>
                    <td className="px-5 py-3 text-xs font-bold text-gray-600 dark:text-gray-300">
                      {lead.interest || "—"}
                    </td>
                    <td className="px-5 py-3 text-xs font-semibold text-gray-500">
                      {lead.capturedByName || "—"}
                    </td>
                    <td className="px-5 py-3 text-[11px] font-semibold text-gray-500">
                      {formatDate(lead.capturedAt ?? lead.createdAt)}
                    </td>
                    <td className="px-5 py-3">
                      <EnterpriseStatusBadge status={lead.status} size="sm" />
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          title="View"
                          onClick={() => setViewing(lead)}
                          className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          title="Edit"
                          onClick={() => openEdit(lead)}
                          className="p-1.5 rounded-lg text-[#0A4DA6] hover:bg-[#0A4DA6]/10 cursor-pointer"
                        >
                          <Pencil size={15} />
                        </button>
                        {lead.status === "pending" ? (
                          <>
                            <button
                              title="Approve"
                              disabled={saving}
                              onClick={() => void decide(lead, "approve")}
                              className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 cursor-pointer disabled:opacity-40"
                            >
                              <CheckCircle2 size={15} />
                            </button>
                            <button
                              title="Reject"
                              disabled={saving}
                              onClick={() => void decide(lead, "reject")}
                              className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer disabled:opacity-40"
                            >
                              <XCircle size={15} />
                            </button>
                          </>
                        ) : (
                          <button
                            title="Reopen for review"
                            disabled={saving}
                            onClick={() => void decide(lead, "reopen")}
                            className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 cursor-pointer disabled:opacity-40"
                          >
                            <RotateCcw size={15} />
                          </button>
                        )}
                        <button
                          title="Delete"
                          onClick={() => setConfirmDelete(lead)}
                          className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !error && leads.length > 0 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 dark:border-slate-800">
            <span className="text-[11px] font-bold text-gray-400">
              Showing {(page - 1) * limit + 1}–
              {Math.min(page * limit, total)} of {total}
            </span>
            <div className="flex gap-2">
              <EnterpriseButton
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </EnterpriseButton>
              <EnterpriseButton
                size="sm"
                variant="outline"
                disabled={page >= pages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </EnterpriseButton>
            </div>
          </div>
        )}
      </div>

      {/* Create / edit */}
      <EnterpriseModal
        isOpen={creating || Boolean(editing)}
        onClose={closeForm}
        title={editing ? "Edit lead" : "Add lead"}
        subtitle={
          editing
            ? `Captured by ${editing.capturedByName || "—"}`
            : "Recorded directly from the admin console"
        }
        icon={<ClipboardList size={18} className="text-[#0A4DA6]" />}
        maxWidth="3xl"
        footer={
          <div className="flex justify-end gap-2">
            <EnterpriseButton variant="outline" onClick={closeForm}>
              Cancel
            </EnterpriseButton>
            <EnterpriseButton loading={saving} onClick={() => void save()}>
              {editing ? "Save changes" : "Create lead"}
            </EnterpriseButton>
          </div>
        }
      >
        {formBody}
      </EnterpriseModal>

      {/* Detail */}
      <EnterpriseModal
        isOpen={Boolean(viewing)}
        onClose={() => setViewing(null)}
        title={viewing?.name ?? ""}
        subtitle={`${viewing?.location?.city ?? ""}${
          viewing?.location?.state ? `, ${viewing.location.state}` : ""
        }`}
        icon={<MapPin size={18} className="text-[#0A4DA6]" />}
        maxWidth="3xl"
        footer={
          viewing && (
            <div className="flex flex-wrap justify-end gap-2">
              {viewing.status === "pending" && (
                <>
                  <EnterpriseButton
                    variant="danger"
                    loading={saving}
                    onClick={() => void decide(viewing, "reject")}
                  >
                    Reject
                  </EnterpriseButton>
                  <EnterpriseButton
                    variant="success"
                    loading={saving}
                    onClick={() => void decide(viewing, "approve")}
                  >
                    Approve
                  </EnterpriseButton>
                </>
              )}
              {viewing.status === "approved" && (
                <EnterpriseButton
                  loading={saving}
                  onClick={() => void decide(viewing, "convert")}
                >
                  Mark as converted
                </EnterpriseButton>
              )}
            </div>
          )
        }
      >
        {viewing && (
          <div className="space-y-4 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <EnterpriseStatusBadge status={viewing.status} />
              <span className="px-2.5 py-1 rounded-full bg-gray-100 dark:bg-slate-800 font-bold text-gray-600 dark:text-gray-300">
                {viewing.interest}
              </span>
              {mapsUrl && (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 rounded-full bg-[#0A4DA6]/10 text-[#0A4DA6] font-bold inline-flex items-center gap-1"
                >
                  <MapPin size={12} /> Open in Maps
                </a>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                ["Address", viewing.location?.address],
                ["Owner", viewing.contact?.ownerName],
                ["Contact", viewing.contact?.phone],
                ["Captured by", viewing.capturedByName],
                ["Captured at", formatDate(viewing.capturedAt)],
                [
                  "Meeting",
                  viewing.meeting?.requested
                    ? `${viewing.meeting.mode || "—"} · ${viewing.meeting.time || "time not set"}`
                    : "Not requested",
                ],
                ["Total rooms", viewing.roomInventory?.totalRooms],
                ["Price / night", viewing.roomInventory?.roomPrice],
                ["Online rooms", viewing.roomInventory?.onlineRooms],
                ["Offline rooms", viewing.roomInventory?.offlineRooms],
                ["Reviewed by", viewing.reviewedByAdminName],
                ["Reviewed at", formatDate(viewing.reviewedAt)],
              ].map(([label, value]) => (
                <div
                  key={String(label)}
                  className="p-3 rounded-2xl bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800"
                >
                  <div className="text-[10px] font-black text-gray-400">
                    {String(label).toUpperCase()}
                  </div>
                  <div className="font-bold text-[#0B192C] dark:text-white break-words">
                    {value === null || value === undefined || value === ""
                      ? "—"
                      : String(value)}
                  </div>
                </div>
              ))}
            </div>

            {viewing.notes && (
              <div className="p-3 rounded-2xl bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800">
                <div className="text-[10px] font-black text-gray-400 mb-1">
                  DISCUSSION NOTES
                </div>
                <p className="font-semibold text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                  {viewing.notes}
                </p>
              </div>
            )}

            {(viewing.images?.length ?? 0) > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {viewing.images?.map((src, index) => (
                  <img
                    key={index}
                    src={src}
                    alt={`Lead photo ${index + 1}`}
                    className="w-full h-24 object-cover rounded-xl border border-gray-100 dark:border-slate-800"
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </EnterpriseModal>

      {/* Delete confirmation */}
      <EnterpriseModal
        isOpen={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        title="Delete this lead?"
        subtitle="This removes the field capture permanently."
        icon={<Trash2 size={18} className="text-rose-600" />}
        footer={
          <div className="flex justify-end gap-2">
            <EnterpriseButton
              variant="outline"
              onClick={() => setConfirmDelete(null)}
            >
              Cancel
            </EnterpriseButton>
            <EnterpriseButton
              variant="danger"
              loading={saving}
              onClick={() => void remove()}
            >
              Delete
            </EnterpriseButton>
          </div>
        }
      >
        <p className="text-xs font-semibold text-gray-500">
          <span className="font-black text-[#0B192C] dark:text-white">
            {confirmDelete?.name}
          </span>{" "}
          and its photos, notes and review trail will be deleted. This cannot be
          undone.
        </p>
      </EnterpriseModal>
    </div>
  );
};

export default LeadCollectionPage;
