import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  leadCollectionService,
  type LeadRegion,
  type LeadUser,
} from "../../../services/leadCollection.service";
import {
  getAllStates,
  getDistricts,
} from "india-state-district";
import { getErrorMessage } from "../../../lib/api";
import { toast } from "../../../lib/toast";
import { getFormattingLocale } from "../../../utils/format";
import {
  EnterpriseButton,
  EnterpriseModal,
  EnterprisePageHeader,
  EnterpriseStatusBadge,
} from "../../shared";
import {
  AlertTriangle,
  Calendar,
  ClipboardList,
  Clock,
  ExternalLink,
  KeyRound,
  Loader2,
  MapPin,
  MapPinned,
  Pencil,
  Plus,
  RefreshCw,
  Route,
  Search,
  Trash2,
  UserCheck,
  UserX,
  Users,
} from "lucide-react";

const inputClass =
  "w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-[#0B192C] dark:text-white focus:outline-none focus:border-[#F28C28]";

const Field: React.FC<{
  label: string;
  hint?: string;
  children: React.ReactNode;
}> = ({ label, hint, children }) => (
  <div className="space-y-1">
    <label className="text-[11px] font-black text-gray-500 block">{label}</label>
    {children}
    {hint && <p className="text-[10px] text-gray-400">{hint}</p>}
  </div>
);

interface AgentForm {
  name: string;
  phone: string;
  email: string;
  password: string;
  role: "field_agent" | "field_supervisor" | "lead_executive" | "document_verifier" | "field_executive";
  state: string;
  district: string;
  employeeCode: string;
  notes: string;
}

const BLANK: AgentForm = {
  name: "",
  phone: "",
  email: "",
  password: "",
  role: "field_agent",
  state: "",
  district: "",
  employeeCode: "",
  notes: "",
};

const formatDate = (value?: string | null): string =>
  value
    ? new Date(value).toLocaleString(getFormattingLocale(), {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Never";

const DEFAULT_REGIONS: LeadRegion[] = [
  { state: "Uttar Pradesh", district: "Mathura", source: "tirvona" },
  { state: "Uttar Pradesh", district: "Vrindavan", source: "tirvona" },
  { state: "Uttarakhand", district: "Dehradun", source: "tirvona" },
  { state: "Uttarakhand", district: "Haridwar", source: "tirvona" },
];

/** A From/To date filter for attendance; empty strings mean "no limit". */
interface AttendanceRange {
  startDate: string;
  endDate: string;
}

const NO_RANGE: AttendanceRange = { startDate: "", endDate: "" };

/** YYYY-MM-DD in IST, matching how attendance days are keyed. */
const istDay = (date: Date) => date.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

const daysAgo = (n: number) => istDay(new Date(Date.now() - n * 86_400_000));

const RANGE_PRESETS: { label: string; range: () => AttendanceRange }[] = [
  { label: "Today", range: () => ({ startDate: daysAgo(0), endDate: daysAgo(0) }) },
  { label: "Last 7 days", range: () => ({ startDate: daysAgo(6), endDate: daysAgo(0) }) },
  { label: "This month", range: () => ({ startDate: `${daysAgo(0).slice(0, 8)}01`, endDate: daysAgo(0) }) },
  { label: "Last 30 days", range: () => ({ startDate: daysAgo(29), endDate: daysAgo(0) }) },
  { label: "All time", range: () => NO_RANGE },
];

const prettyDay = (value: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export const LeadAgentsPage: React.FC = () => {
  const [agents, setAgents] = useState<LeadUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [regions, setRegions] = useState<LeadRegion[]>(DEFAULT_REGIONS);
  const [managingRegions, setManagingRegions] = useState(false);
  const [newRegionState, setNewRegionState] = useState("");
  const [newRegionDistrict, setNewRegionDistrict] = useState("");

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<LeadUser | null>(null);
  const [form, setForm] = useState<AgentForm>(BLANK);
  const [resetting, setResetting] = useState<LeadUser | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<LeadUser | null>(null);

  // Attendance Modal & Data State
  const [attendanceAgent, setAttendanceAgent] = useState<LeadUser | null>(null);
  const [attendanceData, setAttendanceData] = useState<any | null>(null);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  // The applied date filter, and the one being edited in the From/To inputs.
  const [attendanceRange, setAttendanceRange] = useState<AttendanceRange>(NO_RANGE);
  const [rangeDraft, setRangeDraft] = useState<AttendanceRange>(NO_RANGE);
  const [attendanceSummaryMap, setAttendanceSummaryMap] = useState<Record<string, any>>({});
  const [attendanceTodayMap, setAttendanceTodayMap] = useState<Record<string, any>>({});

  const limit = 20;
  const pages = Math.max(1, Math.ceil(total / limit));

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  const loadAttendanceSummary = useCallback(async () => {
    try {
      const res = await leadCollectionService.getAttendanceSummary();
      if (res.data?.data) {
        setAttendanceSummaryMap(res.data.data.summaryMap || {});
        setAttendanceTodayMap(res.data.data.todayMap || {});
      }
    } catch {
      // Non-blocking
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params: Record<string, string | number> = { page, limit };
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
      const res = await leadCollectionService.listUsers(params);
      setAgents(res.data.data.items ?? []);
      setTotal(res.data.data.total ?? 0);
      void loadAttendanceSummary();
    } catch (err) {
      setError(getErrorMessage(err, "Could not load field agents."));
      setAgents([]);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, loadAttendanceSummary]);

  /** Today's open shift (checked in, not out) for an agent, if any. */
  const onDutyShift = (agentId: string) => {
    const today = attendanceTodayMap[String(agentId)];
    return today?.checkedIn && !today?.checkedOut && today?._id ? today : null;
  };

  /** The monitoring page for today's shift, zoomed to where the agent is now. */
  const liveLink = (agentId: string) =>
    `/admin/lead-collection/agents/${agentId}/shifts/${onDutyShift(agentId)?._id}?live=1`;

  const loadAttendance = async (agent: LeadUser, range: AttendanceRange) => {
    setLoadingAttendance(true);
    try {
      const params: Record<string, string | number> = { limit: 100 };
      if (range.startDate) params.startDate = range.startDate;
      if (range.endDate) params.endDate = range.endDate;
      const res = await leadCollectionService.getAgentAttendance(agent._id, params);
      setAttendanceData(res.data.data);
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not load attendance records."));
    } finally {
      setLoadingAttendance(false);
    }
  };

  const openAttendanceModal = async (agent: LeadUser) => {
    setAttendanceAgent(agent);
    setAttendanceData(null);
    setAttendanceRange(NO_RANGE);
    setRangeDraft(NO_RANGE);
    await loadAttendance(agent, NO_RANGE);
  };

  const applyAttendanceRange = (range: AttendanceRange) => {
    if (!attendanceAgent) return;
    if (range.startDate && range.endDate && range.startDate > range.endDate) {
      toast.error("The 'From' date must be on or before the 'To' date.");
      return;
    }
    setAttendanceRange(range);
    setRangeDraft(range);
    void loadAttendance(attendanceAgent, range);
  };

  const loadRegions = useCallback(async () => {
    try {
      const res = await leadCollectionService.listRegions();
      const loaded = res.data.data ?? [];
      const map = new Map<string, LeadRegion>();
      for (const r of DEFAULT_REGIONS) {
        map.set(`${r.state}|${r.district}`.toLowerCase(), r);
      }
      for (const r of loaded) {
        map.set(`${r.state}|${r.district}`.toLowerCase(), r);
      }
      setRegions(
        [...map.values()].sort(
          (a, b) =>
            a.state.localeCompare(b.state) ||
            a.district.localeCompare(b.district),
        ),
      );
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not load regions."));
      setRegions(DEFAULT_REGIONS);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadRegions();
  }, [loadRegions]);

  const openCreate = () => {
    setForm(BLANK);
    setCreating(true);
  };

  const openEdit = (agent: LeadUser) => {
    setForm({
      name: agent.name,
      phone: agent.phone,
      email: agent.email ?? "",
      password: "",
      role: agent.role,
      state: agent.state ?? "",
      district: agent.district ?? "",
      employeeCode: agent.employeeCode ?? "",
      notes: agent.notes ?? "",
    });
    setEditing(agent);
  };

  const closeForm = () => {
    setCreating(false);
    setEditing(null);
  };

  const save = async () => {
    if (!form.name.trim()) return toast.error("Agent name is required");
    if (form.phone.replace(/\D/g, "").length < 10)
      return toast.error("Enter a valid 10-digit mobile number");
    if (!editing && form.password.length < 8)
      return toast.error("Password must be at least 8 characters");
    if (!form.state || !form.district)
      return toast.error("State and district region are required");

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        role: form.role,
        state: form.state,
        district: form.district,
        employeeCode: form.employeeCode.trim(),
        notes: form.notes.trim(),
      };
      if (form.email.trim()) payload.email = form.email.trim();

      if (editing) {
        await leadCollectionService.updateUser(editing._id, payload);
      } else {
        await leadCollectionService.createUser({
          ...payload,
          password: form.password,
        });
      }
      closeForm();
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not save the field agent."));
    } finally {
      setSaving(false);
    }
  };

  const addRegion = async () => {
    if (!newRegionState || !newRegionDistrict)
      return toast.error("Select a state and district");
    setSaving(true);
    try {
      await leadCollectionService.addRegion(
        newRegionState,
        newRegionDistrict,
      );
      setNewRegionDistrict("");
      await loadRegions();
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not add the region."));
    } finally {
      setSaving(false);
    }
  };

  const removeRegion = async (region: LeadRegion) => {
    setSaving(true);
    try {
      await leadCollectionService.deleteRegion(region.state, region.district);
      await loadRegions();
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not remove the region."));
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (agent: LeadUser) => {
    setSaving(true);
    try {
      await leadCollectionService.updateUser(agent._id, {
        status: agent.status === "active" ? "suspended" : "active",
      });
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not change the agent status."));
    } finally {
      setSaving(false);
    }
  };

  const resetPassword = async () => {
    if (!resetting) return;
    if (newPassword.length < 8)
      return toast.error("Password must be at least 8 characters");
    setSaving(true);
    try {
      await leadCollectionService.resetUserPassword(resetting._id, newPassword);
      setResetting(null);
      setNewPassword("");
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not reset the password."));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!confirmDelete) return;
    setSaving(true);
    try {
      await leadCollectionService.deleteUser(confirmDelete._id);
      setConfirmDelete(null);
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not delete the field agent."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <EnterprisePageHeader
        title="Field Executives"
        subtitle="Accounts that sign in to the Tirvona lead app to capture stay leads."
        icon={<Users size={22} />}
        badgeText="LEAD COLLECTION"
        actions={
          <>
            <Link to="/admin/lead-collection/leads">
              <EnterpriseButton
                variant="outline"
                icon={<ClipboardList size={14} />}
              >
                All Leads
              </EnterpriseButton>
            </Link>
            <EnterpriseButton
              variant="outline"
              icon={<RefreshCw size={14} />}
              onClick={() => void load()}
            >
              Refresh
            </EnterpriseButton>
            <EnterpriseButton
              variant="outline"
              icon={<MapPinned size={14} />}
              onClick={() => setManagingRegions(true)}
            >
              Regions
            </EnterpriseButton>
            <EnterpriseButton icon={<Plus size={14} />} onClick={openCreate}>
              Create Executive
            </EnterpriseButton>
          </>
        }
      />

      <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-4">
        <div className="relative w-full lg:w-96">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            className={`${inputClass} pl-9`}
            placeholder="Search by name, phone, email or employee code…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] overflow-hidden">
        {loading ? (
          <div className="p-16 flex flex-col items-center gap-3 text-gray-400">
            <Loader2 size={26} className="animate-spin" />
            <span className="text-xs font-bold">Loading field executives…</span>
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
        ) : agents.length === 0 ? (
          <div className="p-16 flex flex-col items-center gap-2 text-gray-400">
            <Users size={26} />
            <span className="text-sm font-black text-[#0B192C] dark:text-white">
              No field executives yet
            </span>
            <span className="text-xs font-semibold text-center max-w-sm">
              Create an account here and share the phone number and password
              with the executive — they sign in to the lead app with those.
            </span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 dark:bg-slate-900/60 border-b border-gray-100 dark:border-slate-800">
                <tr className="text-[10px] font-black text-gray-500 tracking-wider">
                  <th className="px-5 py-3">AGENT</th>
                  <th className="px-5 py-3">PHONE</th>
                  <th className="px-5 py-3">ROLE</th>
                  <th className="px-5 py-3">REGION</th>
                  <th className="px-5 py-3">LEADS</th>
                  <th className="px-5 py-3">ATTENDANCE</th>
                  <th className="px-5 py-3">STATUS</th>
                  <th className="px-5 py-3 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {agents.map((agent) => {
                  const summary = attendanceSummaryMap[agent._id];
                  const todayLog = attendanceTodayMap[agent._id];
                  return (
                  <tr
                    key={agent._id}
                    className="hover:bg-gray-50/70 dark:hover:bg-slate-900/40 transition-colors"
                  >
                    <td className="px-5 py-3">
                      <div className="text-xs font-black text-[#0B192C] dark:text-white">
                        {agent.name}
                      </div>
                      <div className="text-[10px] font-semibold text-gray-400">
                        {agent.email || agent.employeeCode || "—"}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-xs font-bold text-gray-600 dark:text-gray-300">
                      {agent.phone}
                    </td>
                    <td className="px-5 py-3 text-xs font-semibold text-gray-500 capitalize">
                      {agent.role.replace(/_/g, " ")}
                    </td>
                    <td className="px-5 py-3 text-xs font-semibold text-gray-500">
                      {agent.region || "—"}
                    </td>
                    <td className="px-5 py-3 text-xs font-black text-[#F28C28]">
                      {agent.leadCount ?? 0}
                    </td>
                    <td className="px-5 py-3 text-[11px] font-semibold text-gray-500">
                      {formatDate(agent.lastLoginAt)}
                    </td>
                    <td className="px-5 py-3">
                      {agent.role === 'field_agent' || agent.role === 'field_executive' ? (
                        <button
                          onClick={() => void openAttendanceModal(agent)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#FFF4E5]/40 text-[#F28C28] hover:bg-blue-100 dark:hover:bg-[#D97706]/50 border border-blue-200/60 dark:border-blue-800/40 transition-colors cursor-pointer"
                          title="View GPS & Attendance Logs"
                        >
                          <Calendar size={11} className="text-[#F28C28]" />
                          <span>{summary ? `${summary.daysPresent} Days` : "View Logs"}</span>
                          {todayLog?.checkedIn && (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" title="Checked in today" />
                          )}
                        </button>
                      ) : (
                        <span className="text-gray-400 font-semibold text-xs">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {agent.createdByAdminId ? (
                        <EnterpriseStatusBadge status={agent.status} size="sm" />
                      ) : (
                        <span className="inline-flex px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200">
                          UNAUTHORISED
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        {onDutyShift(agent._id) && (
                          <Link
                            to={liveLink(agent._id)}
                            title="Where is this agent right now?"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black whitespace-nowrap"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                            Live
                          </Link>
                        )}
                        {(agent.role === 'field_agent' || agent.role === 'field_executive') && (
                          <button
                            title="View Attendance & GPS Location"
                            onClick={() => void openAttendanceModal(agent)}
                            className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 cursor-pointer"
                          >
                            <MapPin size={15} />
                          </button>
                        )}
                        <button
                          title="Edit"
                          disabled={!agent.createdByAdminId}
                          onClick={() => openEdit(agent)}
                          className="p-1.5 rounded-lg text-[#F28C28] hover:bg-[#F28C28]/10 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          title="Reset password"
                          disabled={!agent.createdByAdminId}
                          onClick={() => {
                            setNewPassword("");
                            setResetting(agent);
                          }}
                          className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <KeyRound size={15} />
                        </button>
                        <button
                          title={
                            agent.status === "active" ? "Suspend" : "Reactivate"
                          }
                          disabled={saving || !agent.createdByAdminId}
                          onClick={() => void toggleStatus(agent)}
                          className={`p-1.5 rounded-lg cursor-pointer disabled:opacity-40 ${
                            agent.status === "active"
                              ? "text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800"
                              : "text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                          }`}
                        >
                          {agent.status === "active" ? (
                            <UserX size={15} />
                          ) : (
                            <UserCheck size={15} />
                          )}
                        </button>
                        <button
                          title="Delete"
                          onClick={() => setConfirmDelete(agent)}
                          className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                        >
                          <Trash2 size={15} />
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

        {!loading && !error && agents.length > 0 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 dark:border-slate-800">
            <span className="text-[11px] font-bold text-gray-400">
              Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of{" "}
              {total}
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

      <EnterpriseModal
        isOpen={creating || Boolean(editing)}
        onClose={closeForm}
        title={editing ? "Edit field executive" : "Create field executive"}
        subtitle="Signs in to the lead app with phone number and password."
        icon={<Users size={18} className="text-[#F28C28]" />}
        maxWidth="2xl"
        footer={
          <div className="flex justify-end gap-2">
            <EnterpriseButton variant="outline" onClick={closeForm}>
              Cancel
            </EnterpriseButton>
            <EnterpriseButton loading={saving} onClick={() => void save()}>
              {editing ? "Save changes" : "Create executive"}
            </EnterpriseButton>
          </div>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="FULL NAME *">
            <input
              className={inputClass}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field label="MOBILE NUMBER *" hint="Used as the sign-in handle.">
            <input
              className={inputClass}
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </Field>
          <Field label="EMAIL">
            <input
              className={inputClass}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </Field>
          {!editing && (
            <Field label="PASSWORD *" hint="Minimum 8 characters.">
              <input
                type="password"
                className={inputClass}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </Field>
          )}
          <Field label="ROLE">
            <select
              className={inputClass}
              value={form.role}
              onChange={(e) =>
                setForm({
                  ...form,
                  role: e.target.value as AgentForm["role"],
                })
              }
            >
              <option value="field_agent">Field executive</option>
              <option value="lead_executive">Lead executive</option>
              <option value="document_verifier">Document verifier</option>
              <option value="field_supervisor">Field supervisor</option>
            </select>
          </Field>
          <Field
            label="REGION *"
            hint="The agent is restricted to this state and district."
          >
            <select
              className={inputClass}
              value={form.state && form.district ? `${form.state}|${form.district}` : ""}
              onChange={(e) => {
                const selected = regions.find(
                  (region) => `${region.state}|${region.district}` === e.target.value,
                );
                setForm({
                  ...form,
                  state: selected?.state ?? "",
                  district: selected?.district ?? "",
                });
              }}
            >
              <option value="">Select state and district</option>
              {regions.map((region) => (
                <option
                  key={`${region.state}|${region.district}`}
                  value={`${region.state}|${region.district}`}
                >
                  {region.state} — {region.district}
                </option>
              ))}
            </select>
          </Field>
          <Field label="EMPLOYEE CODE">
            <input
              className={inputClass}
              value={form.employeeCode}
              onChange={(e) =>
                setForm({ ...form, employeeCode: e.target.value })
              }
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="INTERNAL NOTES">
              <textarea
                rows={3}
                className={inputClass}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </Field>
          </div>
        </div>
      </EnterpriseModal>

      <EnterpriseModal
        isOpen={managingRegions}
        onClose={() => setManagingRegions(false)}
        title="Manage lead regions"
        subtitle="Tirvona districts appear automatically. Add another Indian district when needed."
        icon={<MapPinned size={18} className="text-[#F28C28]" />}
        maxWidth="2xl"
        footer={
          <div className="flex justify-end">
            <EnterpriseButton
              variant="outline"
              onClick={() => setManagingRegions(false)}
            >
              Done
            </EnterpriseButton>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 items-end">
            <Field label="STATE / UNION TERRITORY">
              <select
                className={inputClass}
                value={newRegionState}
                onChange={(e) => {
                  setNewRegionState(e.target.value);
                  setNewRegionDistrict("");
                }}
              >
                <option value="">Select state</option>
                {getAllStates().map((state: any) => (
                  <option key={state.code} value={state.name}>{state.name}</option>
                ))}
              </select>
            </Field>
            <Field label="DISTRICT">
              <select
                className={inputClass}
                value={newRegionDistrict}
                disabled={!newRegionState}
                onChange={(e) => setNewRegionDistrict(e.target.value)}
              >
                <option value="">Select district</option>
                {getDistricts(
                  getAllStates().find((state: any) => state.name === newRegionState)?.code ?? "",
                ).map((district: any) => (
                  <option key={district} value={district}>{district}</option>
                ))}
              </select>
            </Field>
            <EnterpriseButton
              icon={<Plus size={14} />}
              loading={saving}
              onClick={() => void addRegion()}
            >
              Add
            </EnterpriseButton>
          </div>

          <div className="max-h-72 overflow-y-auto border border-gray-100 dark:border-slate-800 rounded-xl divide-y divide-gray-100 dark:divide-slate-800">
            {regions.map((region) => (
              <div
                key={`${region.state}|${region.district}`}
                className="flex items-center justify-between gap-3 px-3 py-2"
              >
                <div>
                  <div className="text-xs font-black text-[#0B192C] dark:text-white">
                    {region.district}
                  </div>
                  <div className="text-[10px] font-semibold text-gray-400">
                    {region.state} · {region.source === "tirvona" ? "From Tirvona" : "Added region"}
                  </div>
                </div>
                {region.source === "custom" && (
                  <button
                    type="button"
                    title="Remove region"
                    disabled={saving}
                    onClick={() => void removeRegion(region)}
                    className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 disabled:opacity-40 cursor-pointer"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </EnterpriseModal>

      <EnterpriseModal
        isOpen={Boolean(resetting)}
        onClose={() => setResetting(null)}
        title="Reset password"
        subtitle={`${resetting?.name ?? ""} will be signed out of the lead app.`}
        icon={<KeyRound size={18} className="text-amber-600" />}
        footer={
          <div className="flex justify-end gap-2">
            <EnterpriseButton
              variant="outline"
              onClick={() => setResetting(null)}
            >
              Cancel
            </EnterpriseButton>
            <EnterpriseButton
              variant="warning"
              loading={saving}
              onClick={() => void resetPassword()}
            >
              Reset password
            </EnterpriseButton>
          </div>
        }
      >
        <Field label="NEW PASSWORD" hint="Share this with the agent directly.">
          <input
            type="password"
            className={inputClass}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </Field>
      </EnterpriseModal>

      <EnterpriseModal
        isOpen={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        title="Delete this field executive?"
        subtitle="Captured leads are preserved with this executive's attribution."
        icon={<AlertTriangle size={18} className="text-rose-600" />}
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
          will lose access to the lead app immediately. The{" "}
          {confirmDelete?.leadCount ?? 0} lead(s) they captured stay in the
          system, still attributed to their name.
        </p>
      </EnterpriseModal>

      {/* Attendance & GPS Tracking Modal */}
      <EnterpriseModal
        isOpen={Boolean(attendanceAgent)}
        onClose={() => {
          setAttendanceAgent(null);
          setAttendanceData(null);
        }}
        title={`Attendance & GPS Logs — ${attendanceAgent?.name || ""}`}
        subtitle={`${attendanceAgent?.role?.replace(/_/g, " ").toUpperCase() || "FIELD AGENT"} • Phone: ${attendanceAgent?.phone || "—"} • District: ${attendanceAgent?.region || "—"}`}
        icon={<MapPin size={18} className="text-[#F28C28]" />}
        maxWidth="7xl"
        bodyMaxHeight="max-h-[calc(100vh-16rem)]"
        footer={
          <div className="flex justify-end">
            <EnterpriseButton
              variant="outline"
              onClick={() => {
                setAttendanceAgent(null);
                setAttendanceData(null);
              }}
            >
              Close
            </EnterpriseButton>
          </div>
        }
      >
        <div className="space-y-5">
          {/* Date filter: totals below cover exactly these dates */}
          <div className="p-3.5 rounded-xl border border-gray-100 dark:border-slate-800 bg-gray-50/60 dark:bg-slate-900/40 space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {RANGE_PRESETS.map((preset) => {
                const range = preset.range();
                const active =
                  range.startDate === attendanceRange.startDate && range.endDate === attendanceRange.endDate;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => applyAttendanceRange(range)}
                    disabled={loadingAttendance}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-extrabold border transition-colors disabled:opacity-60 ${
                      active
                        ? "bg-[#F28C28] border-[#F28C28] text-white"
                        : "bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-300 hover:border-[#F28C28]"
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
            <form
              className="flex flex-col sm:flex-row sm:items-end gap-2.5"
              onSubmit={(e) => {
                e.preventDefault();
                applyAttendanceRange(rangeDraft);
              }}
            >
              <label className="flex-1 min-w-0">
                <span className="block text-[10px] font-black uppercase text-gray-400 mb-1">From</span>
                <input
                  type="date"
                  value={rangeDraft.startDate}
                  max={rangeDraft.endDate || istDay(new Date())}
                  onChange={(e) => setRangeDraft((r) => ({ ...r, startDate: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-[#0B192C] dark:text-white"
                />
              </label>
              <label className="flex-1 min-w-0">
                <span className="block text-[10px] font-black uppercase text-gray-400 mb-1">To</span>
                <input
                  type="date"
                  value={rangeDraft.endDate}
                  min={rangeDraft.startDate || undefined}
                  max={istDay(new Date())}
                  onChange={(e) => setRangeDraft((r) => ({ ...r, endDate: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-[#0B192C] dark:text-white"
                />
              </label>
              <EnterpriseButton type="submit" disabled={loadingAttendance}>
                Apply
              </EnterpriseButton>
            </form>
            <p className="text-[11px] font-semibold text-gray-500">
              Showing:{" "}
              <strong className="text-[#0B192C] dark:text-white">
                {attendanceRange.startDate || attendanceRange.endDate
                  ? `${attendanceRange.startDate ? prettyDay(attendanceRange.startDate) : "the beginning"} – ${
                      attendanceRange.endDate ? prettyDay(attendanceRange.endDate) : "today"
                    }`
                  : "All time"}
              </strong>
            </p>
          </div>

          {loadingAttendance ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-7 h-7 text-[#F28C28] animate-spin" />
              <p className="text-xs font-bold text-gray-400">Loading attendance & GPS tracking data...</p>
            </div>
          ) : (
          <>
            {/* Totals for the selected dates */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl border border-indigo-100 dark:border-indigo-900/40 bg-indigo-50/50 dark:bg-indigo-950/20">
                <div className="flex items-center gap-2 text-xs font-bold text-indigo-700 dark:text-indigo-400 mb-1">
                  <Route size={14} />
                  Total Distance
                </div>
                <div className="text-2xl font-black text-[#0B192C] dark:text-white">
                  {Number(attendanceData?.summary?.totalDistanceKm ?? 0).toFixed(1)} <span className="text-xs font-semibold text-gray-400">km</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/50 dark:bg-blue-950/20">
                <div className="flex items-center gap-2 text-xs font-bold text-[#F28C28] dark:text-amber-400 mb-1">
                  <Calendar size={14} />
                  Days Present
                </div>
                <div className="text-2xl font-black text-[#0B192C] dark:text-white">
                  {attendanceData?.summary?.totalDaysPresent ?? 0} <span className="text-xs font-semibold text-gray-400">Days</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-sky-100 dark:border-sky-900/40 bg-sky-50/50 dark:bg-sky-950/20">
                <div className="flex items-center gap-2 text-xs font-bold text-sky-700 dark:text-sky-400 mb-1">
                  <MapPinned size={14} />
                  Average per Day
                </div>
                <div className="text-2xl font-black text-[#0B192C] dark:text-white">
                  {Number(attendanceData?.summary?.averageKmPerDay ?? 0).toFixed(1)} <span className="text-xs font-semibold text-gray-400">km</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-violet-100 dark:border-violet-900/40 bg-violet-50/50 dark:bg-violet-950/20">
                <div className="flex items-center gap-2 text-xs font-bold text-violet-700 dark:text-violet-400 mb-1">
                  <Clock size={14} />
                  Hours Worked
                </div>
                <div className="text-2xl font-black text-[#0B192C] dark:text-white">
                  {Number(attendanceData?.summary?.totalWorkingHours ?? 0).toFixed(1)} <span className="text-xs font-semibold text-gray-400">hrs</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div className="px-3.5 py-2.5 rounded-xl border border-gray-100 dark:border-slate-800">
                <div className="text-[10px] font-black uppercase text-gray-400">Longest Day</div>
                <div className="font-black text-[#0B192C] dark:text-white">
                  {attendanceData?.summary?.longestDayDate
                    ? `${Number(attendanceData.summary.longestDayKm ?? 0).toFixed(1)} km · ${prettyDay(attendanceData.summary.longestDayDate)}`
                    : "—"}
                </div>
              </div>
              <div className="px-3.5 py-2.5 rounded-xl border border-gray-100 dark:border-slate-800">
                <div className="text-[10px] font-black uppercase text-gray-400">Days with GPS Route</div>
                <div className="font-black text-[#0B192C] dark:text-white">
                  {attendanceData?.summary?.daysWithRoute ?? 0} of {attendanceData?.summary?.totalDaysPresent ?? 0}
                </div>
              </div>
              <div className="px-3.5 py-2.5 rounded-xl border border-gray-100 dark:border-slate-800">
                <div className="text-[10px] font-black uppercase text-gray-400">Present / Half Day</div>
                <div className="font-black text-[#0B192C] dark:text-white">
                  {attendanceData?.summary?.presentDays ?? 0} / {attendanceData?.summary?.halfDays ?? 0}
                </div>
              </div>
              <div className="px-3.5 py-2.5 rounded-xl border border-emerald-100 dark:border-emerald-900/40 bg-emerald-50/40 dark:bg-emerald-950/20">
                <div className="text-[10px] font-black uppercase text-gray-400">Today&apos;s Status</div>
                <div className="font-black">
                  {(() => {
                    const today = attendanceAgent ? attendanceTodayMap[String(attendanceAgent._id)] : null;
                    if (!today?.checkedIn) return <span className="text-gray-400">Not checked in today</span>;
                    if (today.checkedOut) return <span className="text-gray-500">Checked out</span>;
                    return (
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-emerald-600 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          On duty · location on
                        </span>
                        {attendanceAgent && onDutyShift(attendanceAgent._id) && (
                          <Link
                            to={liveLink(attendanceAgent._id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black whitespace-nowrap"
                          >
                            <MapPin size={11} />
                            Live location
                          </Link>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Attendance Records Table */}
            <div>
              <div className="text-xs font-black text-[#0B192C] dark:text-white mb-2 flex items-center justify-between">
                <span>Check-in & Check-out Records ({attendanceData?.records?.length || 0})</span>
                <span className="text-[10px] font-semibold text-gray-400">Location is on from check-in to check-out · click Monitor to see the full path</span>
              </div>

              {(!attendanceData?.records || attendanceData.records.length === 0) ? (
                <div className="p-8 text-center rounded-xl border border-dashed border-gray-200 dark:border-slate-800">
                  <MapPin className="w-8 h-8 text-gray-300 dark:text-slate-700 mx-auto mb-2" />
                  <p className="text-xs font-bold text-gray-500">No attendance logs found for this agent.</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">When the executive checks in from the mobile lead app, GPS coordinates and check-in times will appear here.</p>
                </div>
              ) : (
                <div className="border border-gray-100 dark:border-slate-800 rounded-xl overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[760px]">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-slate-800 bg-gray-50/75 dark:bg-slate-900/50 text-[10px] font-black uppercase text-gray-400">
                        <th className="px-3.5 py-2.5">Date</th>
                        <th className="px-3.5 py-2.5">Check In (Time & Location)</th>
                        <th className="px-3.5 py-2.5">Check Out (Time & Location)</th>
                        <th className="px-3.5 py-2.5">Distance</th>
                        <th className="px-3.5 py-2.5">Status</th>
                        <th className="px-3.5 py-2.5 text-right">Monitoring</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                      {attendanceData.records.map((rec: any) => (
                        <tr key={rec._id} className="hover:bg-gray-50/50 dark:hover:bg-slate-900/30 transition-colors">
                          <td className="px-3.5 py-3 text-xs font-bold text-[#0B192C] dark:text-white align-top whitespace-nowrap">
                            {rec.date}
                          </td>
                          <td className="px-3.5 py-3 text-xs align-top space-y-1">
                            <div className="font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                              <Clock size={12} />
                              {rec.checkInTime ? new Date(rec.checkInTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—"}
                            </div>
                            {rec.checkInLocation?.latitude ? (
                              <a
                                href={rec.checkInLocation.mapsUrl || `https://www.google.com/maps?q=${rec.checkInLocation.latitude},${rec.checkInLocation.longitude}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-[#F28C28] hover:underline"
                              >
                                <ExternalLink size={11} />
                                View GPS Map ({rec.checkInLocation.latitude.toFixed(4)}, {rec.checkInLocation.longitude.toFixed(4)})
                              </a>
                            ) : (
                              <span className="text-[10px] text-gray-400">No GPS coords</span>
                            )}
                            {rec.checkInLocation?.address && (
                              <div className="text-[10px] text-gray-500 line-clamp-2">
                                📍 {rec.checkInLocation.address}
                              </div>
                            )}
                          </td>
                          <td className="px-3.5 py-3 text-xs align-top space-y-1">
                            {rec.checkOutTime ? (
                              <>
                                <div className="font-bold text-indigo-700 dark:text-indigo-400 flex items-center gap-1">
                                  <Clock size={12} />
                                  {new Date(rec.checkOutTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                                </div>
                                {rec.checkOutLocation?.latitude ? (
                                  <a
                                    href={rec.checkOutLocation.mapsUrl || `https://www.google.com/maps?q=${rec.checkOutLocation.latitude},${rec.checkOutLocation.longitude}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[#F28C28] hover:underline"
                                  >
                                    <ExternalLink size={11} />
                                    View GPS Map ({rec.checkOutLocation.latitude.toFixed(4)}, {rec.checkOutLocation.longitude.toFixed(4)})
                                  </a>
                                ) : (
                                  <span className="text-[10px] text-gray-400">No GPS coords</span>
                                )}
                                {rec.checkOutLocation?.address && (
                                  <div className="text-[10px] text-gray-500 line-clamp-2">
                                    📍 {rec.checkOutLocation.address}
                                  </div>
                                )}
                              </>
                            ) : (
                              <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                In Progress
                              </span>
                            )}
                          </td>
                          <td className="px-3.5 py-3 text-xs align-top">
                            <div className="font-black text-[#0B192C] dark:text-white whitespace-nowrap">
                              {Number(rec.distanceKm ?? 0).toFixed(2)} km
                            </div>
                            <div className="text-[10px] font-semibold text-gray-400 whitespace-nowrap">
                              {rec.trackedPoints ? `${rec.trackedPoints} GPS points` : "No route recorded"}
                            </div>
                          </td>
                          <td className="px-3.5 py-3 align-top">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                rec.status === "present"
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : rec.status === "half_day"
                                  ? "bg-amber-50 text-amber-700 border border-amber-200"
                                  : "bg-gray-100 text-gray-700"
                              }`}
                            >
                              {rec.status}
                            </span>
                          </td>
                          <td className="px-3.5 py-3 text-right align-top">
                            {rec.checkInTime && attendanceAgent?._id ? (
                              <Link
                                to={`/admin/lead-collection/agents/${attendanceAgent._id}/shifts/${rec._id}`}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#F28C28] hover:bg-[#E07B1A] text-white text-[11px] font-extrabold whitespace-nowrap transition-colors"
                              >
                                <Route size={12} />
                                Monitor
                              </Link>
                            ) : (
                              <span className="text-[10px] text-gray-400">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
          )}
        </div>
      </EnterpriseModal>
    </div>
  );
};

export default LeadAgentsPage;
