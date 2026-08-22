import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { getAllStates, getDistricts } from "india-state-district";
import {
  AlertCircle,
  Ban,
  Check,
  Flame,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Send,
  Ticket,
  Trash2,
  X,
} from "lucide-react";
import { getErrorMessage } from "../../../lib/api";
import { EnterprisePageHeader } from "../../../admin/shared/components/EnterprisePageHeader";
import FileUploader from "../../../components/FileUploader";
import { useAuth } from "../../../contexts/AuthContext";
import { useNotifications } from "../../../contexts/NotificationContext";
import {
  aartiAdminService,
  aartiOwnerService,
} from "../services/aarti.service";
import {
  AARTI_FACILITIES,
  AARTI_KINDS,
  AARTI_KIND_LABELS,
  type AartiPassType,
  type AartiSession,
} from "../types/aarti.types";
import {
  sessionStatusLabel,
  sessionStatusStyle,
  WEEKDAYS,
  facilityLabel,
  formatClock,
  formatCurrency,
  formatSchedule,
} from "../utils/aartiFormat";

interface Ashram {
  _id: string;
  name: string;
  ashramCode?: string;
  address?: { city?: string; state?: string };
}

const today = () => new Date().toISOString().slice(0, 10);
const INDIA_STATES = getAllStates();
const DEFAULT_STATE =
  INDIA_STATES.find((state) => state.name === "Uttar Pradesh") ?? INDIA_STATES[0];
const stateForLocation = (stateName?: string, city?: string) =>
  INDIA_STATES.find((state) => state.name === stateName) ??
  INDIA_STATES.find((state) => city && getDistricts(state.code).includes(city)) ??
  DEFAULT_STATE;

const emptySession = {
  ashramId: "",
  name: "",
  kind: "ganga_aarti",
  deity: "",
  description: "",
  dressCode: "",
  instructions: "",
  startTime: "18:30",
  durationMinutes: 45,
  daysOfWeek: [] as number[],
  facilities: [] as string[],
  contactPhone: "",
  coverImage: "",
  startDate: today(),
  endDate: "",
  venue: {
    name: "",
    line1: "",
    city: DEFAULT_STATE ? getDistricts(DEFAULT_STATE.code)[0] ?? "" : "",
    state: DEFAULT_STATE?.name ?? "",
    pincode: "",
  },
};

const emptyPass = {
  name: "",
  code: "",
  description: "",
  basePrice: 101,
  totalCapacity: 100,
  maxPerBooking: 10,
  zoneLabel: "",
  includesPrasad: false,
  includesSankalp: false,
  isActive: true,
};

export const OwnerAartiSessionsPage: React.FC = () => {
  const { subKey } = useParams<{ subKey?: string }>();
  const { user } = useAuth();
  const { confirmAction } = useNotifications();
  const isSuperAdmin = user?.role === "super_admin";
  const [ashrams, setAshrams] = useState<Ashram[]>([]);
  const [sessions, setSessions] = useState<AartiSession[]>([]);
  const [statusFilter, setStatusFilter] = useState(
    subKey && subKey !== "all" ? subKey : "",
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [editing, setEditing] = useState<AartiSession | null>(null);
  const [form, setForm] = useState({ ...emptySession });
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusBusyId, setStatusBusyId] = useState("");

  const [passesFor, setPassesFor] = useState<AartiSession | null>(null);
  const [passes, setPasses] = useState<AartiPassType[]>([]);
  const [passForm, setPassForm] = useState({ ...emptyPass });
  const [editingPass, setEditingPass] = useState<AartiPassType | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await aartiOwnerService.listSessions({
        status: statusFilter || undefined,
        limit: 100,
      });
      setSessions(response.data?.data ?? []);
    } catch (err) {
      setError(getErrorMessage(err, "We could not load your aartis."));
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setStatusFilter(subKey && subKey !== "all" ? subKey : "");
  }, [subKey]);

  useEffect(() => {
    aartiOwnerService
      .ashrams()
      .then((response) => setAshrams(response.data?.data ?? []))
      .catch(() => undefined);
  }, []);

  const openCreate = () => {
    setEditing(null);
    const ashram = ashrams[0];
    const state =
      INDIA_STATES.find((item) => item.name === ashram?.address?.state) ??
      DEFAULT_STATE;
    const districts = state ? getDistricts(state.code) : [];
    const preferredCity = ashram?.address?.city ?? "";
    setForm({
      ...emptySession,
      ashramId: ashram?._id ?? "",
      startDate: today(),
      venue: {
        ...emptySession.venue,
        state: state?.name ?? "",
        city: districts.includes(preferredCity)
          ? preferredCity
          : districts[0] ?? "",
      },
    });
    setShowForm(true);
  };

  const openEdit = (session: AartiSession) => {
    setEditing(session);
    const state = stateForLocation(session.venue?.state, session.venue?.city);
    const districts = state ? getDistricts(state.code) : [];
    const city = session.venue?.city ?? "";
    setForm({
      ashramId:
        typeof session.ashramId === "object"
          ? session.ashramId._id
          : (session.ashramId ?? ""),
      name: session.name,
      kind: session.kind,
      deity: session.deity ?? "",
      description: session.description ?? "",
      dressCode: session.dressCode ?? "",
      instructions: session.instructions ?? "",
      startTime: session.startTime ?? "18:30",
      durationMinutes: session.durationMinutes ?? 45,
      daysOfWeek: session.daysOfWeek ?? [],
      facilities: session.facilities ?? [],
      contactPhone: session.contactPhone ?? "",
      coverImage: session.coverImage ?? "",
      startDate: session.startDate?.slice(0, 10) ?? today(),
      endDate: session.endDate?.slice(0, 10) ?? "",
      venue: {
        name: session.venue?.name ?? "",
        line1: session.venue?.line1 ?? "",
        city: districts.includes(city) ? city : districts[0] ?? city,
        state: state?.name ?? session.venue?.state ?? "",
        pincode: session.venue?.pincode ?? "",
      },
    });
    setShowForm(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const normalizedForm = {
        ...form,
        endDate: form.endDate || undefined,
      };
      if (editing) {
        const { ashramId: _ignored, ...payload } = normalizedForm;
        await aartiOwnerService.updateSession(editing._id, payload);
      } else {
        await aartiOwnerService.createSession(normalizedForm);
      }
      setShowForm(false);
      await load();
    } catch {
      // Toast interceptor already reported it.
    } finally {
      setSaving(false);
    }
  };

  const submitForReview = async (session: AartiSession) => {
    await aartiOwnerService.submitSession(session._id).catch(() => undefined);
    await load();
  };

  const deleteSession = async (session: AartiSession) => {
    const confirmed = await confirmAction({
      title: "Delete Aarti",
      message: `Permanently delete "${session.name}"? This cannot be undone.`,
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!confirmed) return;
    await aartiOwnerService.deleteSession(session._id).catch(() => undefined);
    await load();
  };

  const toggleSuspension = async (session: AartiSession) => {
    const isSuspended = session.status === "suspended";
    const nextStatus = isSuspended ? "approved" : "suspended";
    const action = isSuspended ? "reactivate" : "suspend";
    const confirmed = await confirmAction({
      title: isSuspended ? "Reactivate Aarti" : "Suspend Aarti",
      message: `${action[0].toUpperCase()}${action.slice(1)} "${session.name}"?`,
      confirmLabel: isSuspended ? "Reactivate" : "Suspend",
      tone: isSuspended ? "primary" : "warning",
    });
    if (!confirmed) return;

    setStatusBusyId(session._id);
    try {
      await aartiAdminService.setSessionStatus(session._id, nextStatus);
      await load();
    } catch {
      // The shared API interceptor displays the server error safely.
    } finally {
      setStatusBusyId("");
    }
  };

  const openPasses = async (session: AartiSession) => {
    setPassesFor(session);
    setEditingPass(null);
    setPassForm({ ...emptyPass });
    const response = await aartiOwnerService.getSession(session._id);
    setPasses(response.data?.data?.passTypes ?? []);
  };

  const savePass = async () => {
    if (!passesFor) return;
    try {
      if (editingPass) {
        const { code: _code, ...payload } = passForm;
        await aartiOwnerService.updatePassType(editingPass._id, payload);
      } else {
        await aartiOwnerService.createPassType({
          ...passForm,
          sessionId: passesFor._id,
        });
      }
      setEditingPass(null);
      setPassForm({ ...emptyPass });
      await openPasses(passesFor);
      await load();
    } catch {
      // Reported by the toast interceptor.
    }
  };

  const deletePass = async (pass: AartiPassType) => {
    if (!passesFor) return;
    const confirmed = await confirmAction({
      title: "Remove Aarti Pass",
      message: `Remove the "${pass.name}" pass?`,
      confirmLabel: "Remove",
      tone: "danger",
    });
    if (!confirmed) return;
    await aartiOwnerService.deletePassType(pass._id).catch(() => undefined);
    await openPasses(passesFor);
  };

  const toggleDay = (day: number) =>
    setForm((current) => ({
      ...current,
      daysOfWeek: current.daysOfWeek.includes(day)
        ? current.daysOfWeek.filter((value) => value !== day)
        : [...current.daysOfWeek, day],
    }));

  const toggleFacility = (facility: string) =>
    setForm((current) => ({
      ...current,
      facilities: current.facilities.includes(facility)
        ? current.facilities.filter((value) => value !== facility)
        : [...current.facilities, facility],
    }));

  const canSave = useMemo(
    () =>
      Boolean(
        form.name.trim() &&
          form.startTime &&
          form.startDate &&
          form.coverImage.trim() &&
          (editing || form.ashramId) &&
          (!form.endDate || form.endDate >= form.startDate),
      ),
    [form, editing],
  );

  return (
    <div className="space-y-6">
      <EnterprisePageHeader
        title="Aarti Management"
        subtitle="Publish your aartis, set pass prices and capacity, then send them for review."
        icon={<Flame size={22} />}
        actions={
          <>
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
          </select>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 bg-[#0A4DA6] hover:bg-[#083D85] text-white text-xs font-extrabold px-4 py-2.5 rounded-full shadow-md transition-all active:scale-95 cursor-pointer"
          >
            <Plus size={15} /> New aarti
          </button>
          </>
        }
      />

      {error ? (
        <div className="flex items-start gap-2.5 p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-sm font-semibold">
          <AlertCircle size={16} /> {error}
        </div>
      ) : loading ? (
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] shadow-sm p-12 flex items-center justify-center gap-3">
          <Loader2 size={20} className="animate-spin text-[#0A4DA6]" />
          <span className="text-sm font-bold text-gray-400">Loading…</span>
        </div>
      ) : sessions.length === 0 ? (
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] shadow-sm p-12 text-center space-y-3">
          <Flame size={36} className="text-gray-300 dark:text-slate-700 mx-auto" />
          <h3 className="font-extrabold text-base text-[#0B192C] dark:text-white">
            No aartis yet
          </h3>
          <p className="mt-1 text-xs text-gray-400 font-semibold leading-relaxed">
            Create your first aarti and add at least one pass before submitting.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] shadow-sm overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="border-b border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-900 text-left text-[10px] tracking-wider font-bold text-gray-400 uppercase">
              <tr>
                <th className="px-4 py-3">Aarti</th>
                <th className="px-4 py-3">Schedule</th>
                <th className="px-4 py-3">Passes</th>
                <th className="px-4 py-3">Bookings</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
              {sessions.map((session) => {
                const tone = sessionStatusStyle(session.status);
                return (
                  <tr key={session._id}>
                    <td className="px-4 py-3">
                      <p className="font-bold text-[#0B192C] dark:text-white">
                        {session.name}
                      </p>
                      <p className="text-[10px] font-bold text-gray-400">
                        {AARTI_KIND_LABELS[session.kind]}
                        {session.venue?.city ? ` · ${session.venue.city}` : ""}
                      </p>
                      {session.status === "rejected" && session.rejectionReason ? (
                        <p className="mt-1 text-[10px] font-bold text-rose-600">
                          {session.rejectionReason}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">
                      {formatClock(session.startTime)}
                      <span className="block text-xs text-gray-400">
                        {formatSchedule(session.daysOfWeek)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">
                      {session.passTypeCount ?? 0}
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
                          title="Manage passes"
                          onClick={() => openPasses(session)}
                          className="p-2 rounded-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 text-gray-500 hover:text-[#0A4DA6] hover:border-[#0A4DA6] transition-all active:scale-90 cursor-pointer"
                        >
                          <Ticket size={14} />
                        </button>
                        <button
                          type="button"
                          title="Edit"
                          onClick={() => openEdit(session)}
                          className="p-2 rounded-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 text-gray-500 hover:text-[#0A4DA6] hover:border-[#0A4DA6] transition-all active:scale-90 cursor-pointer"
                        >
                          <Pencil size={14} />
                        </button>
                        {["draft", "rejected"].includes(session.status) ? (
                          <button
                            type="button"
                            title="Submit for review"
                            onClick={() => submitForReview(session)}
                            className="p-2 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-400 transition-all active:scale-90 cursor-pointer"
                          >
                            <Send size={14} />
                          </button>
                        ) : null}
                        {isSuperAdmin &&
                        ["approved", "suspended"].includes(session.status) ? (
                          <button
                            type="button"
                            disabled={statusBusyId === session._id}
                            title={
                              session.status === "suspended"
                                ? "Reactivate aarti"
                                : "Suspend aarti"
                            }
                            onClick={() => toggleSuspension(session)}
                            className={`inline-flex items-center gap-1 rounded-full border px-3 py-2 text-[10px] font-extrabold transition-all active:scale-95 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
                              session.status === "suspended"
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-400"
                                : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-400"
                            }`}
                          >
                            {session.status === "suspended" ? (
                              <RotateCcw size={13} />
                            ) : (
                              <Ban size={13} />
                            )}
                            {session.status === "suspended"
                              ? "Reactivate"
                              : "Suspend"}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          title="Delete"
                          onClick={() => deleteSession(session)}
                          className="p-2 rounded-full bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-400 transition-all active:scale-90 cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showForm ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-16">
          <div className="w-full max-w-3xl bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-black text-[#0B192C] dark:text-white">
                {editing ? "Edit aarti" : "New aarti"}
              </h2>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="p-2 rounded-full text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-900 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 sm:col-span-2">
                  <span className="text-[10px] tracking-wider font-bold text-gray-400 px-1">
                    Ashram
                  </span>
                  <select
                    disabled={!!editing}
                    value={form.ashramId}
                    onChange={(event) => {
                      const ashram = ashrams.find(
                        (item) => item._id === event.target.value,
                      );
                      const state = INDIA_STATES.find(
                        (item) => item.name === ashram?.address?.state,
                      );
                      const districts = state ? getDistricts(state.code) : [];
                      const preferredCity = ashram?.address?.city ?? "";
                      setForm({
                        ...form,
                        ashramId: event.target.value,
                        venue: {
                          ...form.venue,
                          state: state?.name ?? form.venue.state,
                          city: districts.includes(preferredCity)
                            ? preferredCity
                            : districts[0] ?? form.venue.city,
                        },
                      });
                    }}
                    className="bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-[#0B192C] dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/30 transition-all disabled:opacity-60"
                  >
                    <option value="">Select an ashram</option>
                    {ashrams.map((ashram) => (
                      <option key={ashram._id} value={ashram._id}>
                        {ashram.name}
                        {ashram.address?.city ? ` — ${ashram.address.city}` : ""}
                      </option>
                    ))}
                  </select>
                </label>

              <label className="flex flex-col gap-1 sm:col-span-2">
                <span className="text-[10px] tracking-wider font-bold text-gray-400 px-1">
                  Aarti name
                </span>
                <input
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  placeholder="e.g. Evening Ganga Aarti at Har Ki Pauri"
                  className="bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-[#0B192C] dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/30 transition-all"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-[10px] tracking-wider font-bold text-gray-400 px-1">
                  Type
                </span>
                <select
                  value={form.kind}
                  onChange={(event) => setForm({ ...form, kind: event.target.value })}
                  className="bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-[#0B192C] dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/30 transition-all"
                >
                  {AARTI_KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {AARTI_KIND_LABELS[kind]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-[10px] tracking-wider font-bold text-gray-400 px-1">
                  Deity
                </span>
                <input
                  value={form.deity}
                  onChange={(event) => setForm({ ...form, deity: event.target.value })}
                  placeholder="e.g. Maa Ganga"
                  className="bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-[#0B192C] dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/30 transition-all"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-[10px] tracking-wider font-bold text-gray-400 px-1">
                  Start time (24h)
                </span>
                <input
                  type="time"
                  value={form.startTime}
                  onChange={(event) =>
                    setForm({ ...form, startTime: event.target.value })
                  }
                  className="bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-[#0B192C] dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/30 transition-all"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-[10px] tracking-wider font-bold text-gray-400 px-1">
                  Duration (minutes)
                </span>
                <input
                  type="number"
                  min={5}
                  max={720}
                  value={form.durationMinutes}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      durationMinutes: Number(event.target.value) || 45,
                    })
                  }
                  className="bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-[#0B192C] dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/30 transition-all"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-[10px] tracking-wider font-bold text-gray-400 px-1">
                  Start date
                </span>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(event) =>
                    setForm({ ...form, startDate: event.target.value })
                  }
                  className="bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-[#0B192C] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/30 transition-all"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-[10px] tracking-wider font-bold text-gray-400 px-1">
                  End date (optional)
                </span>
                <input
                  type="date"
                  min={form.startDate}
                  value={form.endDate}
                  onChange={(event) =>
                    setForm({ ...form, endDate: event.target.value })
                  }
                  className="bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-[#0B192C] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/30 transition-all"
                />
              </label>

              <div className="sm:col-span-2">
                <span className="text-[10px] tracking-wider font-bold text-gray-400 px-1">
                  Days held (none selected = every day)
                </span>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {WEEKDAYS.map((label, day) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => toggleDay(day)}
                      className={`rounded-full border px-3 py-1.5 text-[10px] font-bold transition-all active:scale-95 cursor-pointer ${
                        form.daysOfWeek.includes(day)
                          ? "border-[#0A4DA6] bg-[#0A4DA6] text-white shadow-sm"
                          : "border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-900 text-gray-500 dark:text-gray-400 hover:border-[#0A4DA6] hover:text-[#0A4DA6]"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex flex-col gap-1">
                <span className="text-[10px] tracking-wider font-bold text-gray-400 px-1">
                  Venue name
                </span>
                <input
                  value={form.venue.name}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      venue: { ...form.venue, name: event.target.value },
                    })
                  }
                  placeholder="e.g. Har Ki Pauri Ghat"
                  className="bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-[#0B192C] dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/30 transition-all"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-[10px] tracking-wider font-bold text-gray-400 px-1">
                  State
                </span>
                <select
                  value={form.venue.state}
                  onChange={(event) => {
                    const state = INDIA_STATES.find(
                      (item) => item.name === event.target.value,
                    );
                    const districts = state ? getDistricts(state.code) : [];
                    setForm({
                      ...form,
                      venue: {
                        ...form.venue,
                        state: event.target.value,
                        city: districts[0] ?? "",
                      },
                    });
                  }}
                  className="bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-[#0B192C] dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/30 transition-all"
                >
                  {INDIA_STATES.map((state) => (
                    <option key={state.code} value={state.name}>
                      {state.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-[10px] tracking-wider font-bold text-gray-400 px-1">
                  City / District
                </span>
                <select
                  value={form.venue.city}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      venue: { ...form.venue, city: event.target.value },
                    })
                  }
                  className="bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-[#0B192C] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/30 transition-all"
                >
                  {(INDIA_STATES.find(
                    (state) => state.name === form.venue.state,
                  )
                    ? getDistricts(
                        INDIA_STATES.find(
                          (state) => state.name === form.venue.state,
                        )!.code,
                      )
                    : []
                  ).map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>
              </label>

              <div className="sm:col-span-2 grid gap-3 sm:grid-cols-2 rounded-2xl border border-gray-100 dark:border-slate-800 p-3">
              {import.meta.env.DEV ? <label className="flex flex-col gap-1">
                <span className="text-[10px] tracking-wider font-bold text-gray-400 px-1">
                  Cover image URL (development only)
                </span>
                <input
                  type="url"
                  value={form.coverImage}
                  onChange={(event) =>
                    setForm({ ...form, coverImage: event.target.value })
                  }
                  placeholder="https://…"
                  className="bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-[#0B192C] dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/30 transition-all"
                />
              </label> : null}
                <div>
                  <span className="text-[10px] tracking-wider font-bold text-gray-400 px-1 block mb-1">
                    Or upload an image
                  </span>
                  <FileUploader
                    folder="aarti"
                    label="Upload Aarti image"
                    currentUrl={form.coverImage}
                    onUploaded={(url) =>
                      setForm({ ...form, coverImage: url })
                    }
                  />
                </div>
                {!form.coverImage.trim() ? (
                  <p className="sm:col-span-2 text-[10px] font-semibold text-amber-600">
                    Add one image using either the URL field or upload button.
                  </p>
                ) : null}
              </div>

              <label className="flex flex-col gap-1 sm:col-span-2">
                <span className="text-[10px] tracking-wider font-bold text-gray-400 px-1">
                  Description
                </span>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(event) =>
                    setForm({ ...form, description: event.target.value })
                  }
                  className="bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-[#0B192C] dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/30 transition-all"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-[10px] tracking-wider font-bold text-gray-400 px-1">
                  Dress code
                </span>
                <input
                  value={form.dressCode}
                  onChange={(event) =>
                    setForm({ ...form, dressCode: event.target.value })
                  }
                  className="bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-[#0B192C] dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/30 transition-all"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-[10px] tracking-wider font-bold text-gray-400 px-1">
                  Contact phone
                </span>
                <input
                  value={form.contactPhone}
                  onChange={(event) =>
                    setForm({ ...form, contactPhone: event.target.value })
                  }
                  className="bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-[#0B192C] dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/30 transition-all"
                />
              </label>

              <div className="sm:col-span-2">
                <span className="text-[10px] tracking-wider font-bold text-gray-400 px-1">
                  What is arranged
                </span>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {AARTI_FACILITIES.map((facility) => (
                    <button
                      key={facility}
                      type="button"
                      onClick={() => toggleFacility(facility)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                        form.facilities.includes(facility)
                          ? "border-[#0A4DA6] bg-[#0A4DA6] text-white shadow-sm"
                          : "border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-900 text-gray-500 dark:text-gray-400 hover:border-[#0A4DA6] hover:text-[#0A4DA6]"
                      }`}
                    >
                      {facilityLabel(facility)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="inline-flex items-center gap-1.5 bg-white dark:bg-[#0B192C] border border-gray-200 dark:border-slate-700 hover:border-[#0A4DA6] text-gray-500 dark:text-gray-400 hover:text-[#0A4DA6] text-xs font-extrabold px-4 py-2.5 rounded-full shadow-sm transition-all active:scale-95 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                disabled={!canSave || saving}
                className="inline-flex items-center gap-1.5 bg-[#0A4DA6] hover:bg-[#083D85] text-white text-xs font-extrabold px-4 py-2.5 rounded-full shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-50"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Save aarti
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {passesFor ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-16">
          <div className="w-full max-w-3xl bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-black text-[#0B192C] dark:text-white">
                Passes — {passesFor.name}
              </h2>
              <button
                type="button"
                onClick={() => setPassesFor(null)}
                className="p-2 rounded-full text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-900 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {passes.length === 0 ? (
                <p className="border border-dashed border-gray-200 dark:border-slate-800 rounded-2xl p-6 text-center text-xs font-medium text-gray-400">
                  No passes yet. Add one below — an aarti needs at least one pass
                  before it can be submitted.
                </p>
              ) : (
                passes.map((pass) => (
                  <div
                    key={pass._id}
                    className="flex flex-wrap items-center justify-between gap-3 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl p-3"
                  >
                    <div>
                      <p className="text-sm font-bold text-[#0B192C] dark:text-white">
                        {pass.name}{" "}
                        <span className="font-mono text-[10px] font-bold text-gray-400 tracking-wider">
                          {pass.code}
                        </span>
                      </p>
                      <p className="text-[10px] font-bold text-gray-400">
                        {formatCurrency(pass.basePrice)} · {pass.totalCapacity} seats
                        {pass.isActive ? "" : " · inactive"}
                      </p>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingPass(pass);
                          setPassForm({
                            name: pass.name,
                            code: pass.code,
                            description: pass.description ?? "",
                            basePrice: pass.basePrice,
                            totalCapacity: pass.totalCapacity,
                            maxPerBooking: pass.maxPerBooking ?? 10,
                            zoneLabel: pass.zoneLabel ?? "",
                            includesPrasad: Boolean(pass.includesPrasad),
                            includesSankalp: Boolean(pass.includesSankalp),
                            isActive: pass.isActive !== false,
                          });
                        }}
                        className="p-2 rounded-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 text-gray-500 hover:text-[#0A4DA6] hover:border-[#0A4DA6] transition-all active:scale-90 cursor-pointer"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => deletePass(pass)}
                        className="p-2 rounded-full bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-400 transition-all active:scale-90 cursor-pointer"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-5 rounded-xl border border-gray-100 p-4 dark:border-slate-700">
              <h3 className="text-sm font-bold text-[#0B192C] dark:text-white">
                {editingPass ? `Edit "${editingPass.name}"` : "Add a pass"}
              </h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <input
                  value={passForm.name}
                  onChange={(event) =>
                    setPassForm({ ...passForm, name: event.target.value })
                  }
                  placeholder="Pass name, e.g. VIP Ghat"
                  className="bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-[#0B192C] dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/30 transition-all"
                />
                <input
                  value={passForm.code}
                  disabled={Boolean(editingPass)}
                  onChange={(event) =>
                    setPassForm({ ...passForm, code: event.target.value.toUpperCase() })
                  }
                  placeholder="Code, e.g. VIP"
                  className="bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-[#0B192C] dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/30 disabled:opacity-60 transition-all"
                />
                <input
                  type="number"
                  min={0}
                  value={passForm.basePrice}
                  onChange={(event) =>
                    setPassForm({
                      ...passForm,
                      basePrice: Number(event.target.value) || 0,
                    })
                  }
                  placeholder="Price per pass"
                  className="bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-[#0B192C] dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/30 transition-all"
                />
                <input
                  type="number"
                  min={0}
                  value={passForm.totalCapacity}
                  onChange={(event) =>
                    setPassForm({
                      ...passForm,
                      totalCapacity: Number(event.target.value) || 0,
                    })
                  }
                  placeholder="Seats available"
                  className="bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-[#0B192C] dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/30 transition-all"
                />
                <input
                  value={passForm.zoneLabel}
                  onChange={(event) =>
                    setPassForm({ ...passForm, zoneLabel: event.target.value })
                  }
                  placeholder="Zone label (optional)"
                  className="bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-[#0B192C] dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/30 transition-all"
                />
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={passForm.maxPerBooking}
                  onChange={(event) =>
                    setPassForm({
                      ...passForm,
                      maxPerBooking: Number(event.target.value) || 1,
                    })
                  }
                  placeholder="Max per booking"
                  className="bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-[#0B192C] dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/30 transition-all"
                />
                <label className="flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
                  <input
                    type="checkbox"
                    checked={passForm.includesPrasad}
                    onChange={(event) =>
                      setPassForm({
                        ...passForm,
                        includesPrasad: event.target.checked,
                      })
                    }
                  />
                  Includes prasad
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
                  <input
                    type="checkbox"
                    checked={passForm.includesSankalp}
                    onChange={(event) =>
                      setPassForm({
                        ...passForm,
                        includesSankalp: event.target.checked,
                      })
                    }
                  />
                  Includes priest sankalp
                </label>
              </div>
              <div className="mt-3 flex justify-end gap-2">
                {editingPass ? (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingPass(null);
                      setPassForm({ ...emptyPass });
                    }}
                    className="inline-flex items-center gap-1.5 bg-white dark:bg-[#0B192C] border border-gray-200 dark:border-slate-700 hover:border-[#0A4DA6] text-gray-500 dark:text-gray-400 hover:text-[#0A4DA6] text-xs font-extrabold px-3 py-2 rounded-full shadow-sm transition-all active:scale-95 cursor-pointer"
                  >
                    Cancel edit
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={savePass}
                  disabled={!passForm.name.trim() || !passForm.code.trim()}
                  className="inline-flex items-center gap-1.5 bg-[#0A4DA6] hover:bg-[#083D85] text-white text-xs font-extrabold px-4 py-2 rounded-full shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  {editingPass ? "Update pass" : "Add pass"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default OwnerAartiSessionsPage;
