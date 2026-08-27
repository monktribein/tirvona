import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2, RefreshCw, ShieldCheck, Trash2, UserPlus, X } from "lucide-react";
import { EnterprisePageHeader } from "../../shared/components/EnterprisePageHeader";
import { EnterpriseStatusBadge } from "../../shared/components/EnterpriseStatusBadge";
import { useNotifications } from "../../../contexts/NotificationContext";
import { useAuth } from "../../../contexts/AuthContext";
import { getErrorMessage } from "../../../lib/api";
import { parkingPartnerService } from "../../../modules/parking/services/parking.service";
import { humanizeLabel } from "../../../utils/labels";

type StaffForm = {
  name: string;
  email: string;
  phone: string;
  ashramId: string;
  locationId: string;
  parkingRole: "parking_manager" | "security_guard";
  shift: string;
  password: string;
  confirmPassword: string;
};

const emptyForm = (): StaffForm => ({
  name: "",
  email: "",
  phone: "",
  ashramId: "",
  locationId: "",
  parkingRole: "security_guard",
  shift: "general",
  password: "",
  confirmPassword: "",
});

const refId = (value: any): string => String(value?._id ?? value?.id ?? value ?? "");

export const ParkingStaffRolesPage: React.FC = () => {
  const { addNotification, confirmAction } = useNotifications();
  const { user } = useAuth();
  const [locations, setLocations] = useState<any[]>([]);
  const [grants, setGrants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [form, setForm] = useState<StaffForm>(emptyForm);
  const [credentials, setCredentials] = useState<any>(null);
  const isParkingManagerOnly =
    (user?.parkingRoles ?? []).includes("parking_manager") &&
    !(user?.parkingRoles ?? []).includes("parking_partner") &&
    !["super_admin", "ashram_owner", "ashram_admin", "owner", "stay_admin"].includes(
      user?.role ?? "",
    );
  const canApprove = [
    "super_admin",
    "ashram_owner",
    "ashram_admin",
    "owner",
    "stay_admin",
  ].includes(user?.role ?? "");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const locationsRes = await parkingPartnerService.listLocations();
      const scopedLocations = locationsRes.data?.data ?? [];
      setLocations(scopedLocations);
      const partnerIds = [...new Set(scopedLocations.map((row: any) => refId(row.partnerId)))].filter(Boolean) as string[];
      const staffResponses = await Promise.all(
        partnerIds.map((partnerId) => parkingPartnerService.listStaff(partnerId)),
      );
      const unique = new Map<string, any>();
      staffResponses.forEach((response) =>
        (response.data?.data ?? []).forEach((grant: any) => unique.set(String(grant._id), grant)),
      );
      setGrants([...unique.values()]);
    } catch (err) {
      const message = getErrorMessage(err, "Unable to load parking staff.");
      setError(message);
      setLocations([]);
      setGrants([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const ashrams = useMemo(() => {
    const unique = new Map<string, any>();
    locations.forEach((location) => {
      const id = refId(location.ashramId);
      if (id) unique.set(id, location.ashramId);
    });
    return [...unique.entries()].map(([id, value]) => ({ id, name: value?.name ?? "Ashram" }));
  }, [locations]);

  const ashramLocations = locations.filter((location) => refId(location.ashramId) === form.ashramId);
  const visibleGrants = grants.filter((grant) => statusFilter === "all" || grant.status === statusFilter);

  const openCreate = () => {
    const next = emptyForm();
    if (ashrams.length === 1) next.ashramId = ashrams[0].id;
    setForm(next);
    setCredentials(null);
    setShowForm(true);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.ashramId || !form.locationId) {
      addNotification("Parking Required", "Select an ashram and one of its parking facilities.", "error");
      return;
    }
    if (form.password.length < 8) {
      addNotification("Password Required", "Create a password containing at least 8 characters.", "error");
      return;
    }
    if (form.password !== form.confirmPassword) {
      addNotification("Passwords Do Not Match", "Password and confirm password must match.", "error");
      return;
    }
    setSaving(true);
    try {
      const response = await parkingPartnerService.createStaffAccount({
        name: form.name,
        email: form.email,
        phone: form.phone,
        ashramId: form.ashramId,
        locationIds: [form.locationId],
        parkingRole: form.parkingRole,
        shift: form.shift,
        password: form.password,
      });
      setCredentials(response.data?.data);
      addNotification(
        response.data?.data?.approvalRequired
          ? "Approval Required"
          : "Parking Staff Created",
        response.data?.data?.approvalRequired
          ? "Security guard account created and sent to the Ashram Owner/Admin for approval."
          : response.data?.message || "The parking staff account is ready.",
        "success",
      );
      await load();
    } catch (err) {
      addNotification("Account Creation Failed", getErrorMessage(err, "Unable to create parking staff."), "error");
    } finally {
      setSaving(false);
    }
  };

  const approve = async (grant: any) => {
    setBusyId(String(grant._id));
    try {
      await parkingPartnerService.approveStaff(String(grant._id));
      addNotification("Staff Approved", "The security guard can now sign in and use the parking gate.", "success");
      await load();
    } catch (err) {
      addNotification("Approval Failed", getErrorMessage(err), "error");
    } finally {
      setBusyId("");
    }
  };

  const revoke = async (grant: any) => {
    const name = grant.userId?.name ?? grant.userId?.email ?? "this account";
    const confirmed = await confirmAction({
      title: "Remove parking access?",
      message: `${name} will no longer be able to access the selected parking facility.`,
      confirmLabel: "Remove Access",
      tone: "danger",
    });
    if (!confirmed) return;
    setBusyId(String(grant._id));
    try {
      await parkingPartnerService.revokeStaff(String(grant._id));
      addNotification("Access Removed", "Parking access was removed.", "info");
      await load();
    } catch (err) {
      addNotification("Remove Failed", getErrorMessage(err), "error");
    } finally {
      setBusyId("");
    }
  };

  const inputClass = "w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#0A4DA6]/20 dark:border-slate-700 dark:bg-slate-900";
  const labelClass = "mb-1.5 block text-xs text-gray-500";

  return (
    <div className="w-full space-y-6 text-left">
      <EnterprisePageHeader
        title="Parking Staff"
        subtitle="Create dedicated staff accounts scoped to one ashram and its parking facility."
        icon={<ShieldCheck size={22} />}
        actions={<div className="flex gap-2">
          <button type="button" onClick={openCreate} className="flex items-center gap-2 rounded-full bg-[#0A4DA6] px-5 py-2.5 text-xs text-white"><UserPlus size={15} /> Create Parking Staff</button>
          <button type="button" onClick={() => void load()} className="rounded-full border border-gray-200 p-2.5 text-gray-600" title="Refresh"><RefreshCw size={16} className={loading ? "animate-spin" : ""} /></button>
        </div>}
      />

      {error && <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><AlertTriangle size={17} /> {error}</div>}

      <div className="rounded-[24px] border border-gray-100 bg-white shadow-sm dark:border-slate-800 dark:bg-[#0B192C]">
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 p-4 dark:border-slate-800">
          <div><h3 className="text-base text-[#0B192C] dark:text-white">Parking Team</h3><p className="mt-1 text-xs text-gray-400">Staff see only the parking facilities assigned to them.</p></div>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-full border border-gray-200 bg-white px-4 py-2 text-xs dark:border-slate-700 dark:bg-slate-900">
            <option value="all">All statuses</option><option value="pending_approval">Pending approval</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="suspended">Suspended</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs text-gray-400 dark:bg-slate-900"><tr><th className="px-5 py-3">Staff</th><th className="px-5 py-3">Parking role</th><th className="px-5 py-3">Parking facility</th><th className="px-5 py-3">Employee code</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Action</th></tr></thead>
            <tbody>
              {visibleGrants.map((grant) => <tr key={grant._id} className="border-t border-gray-100 dark:border-slate-800">
                <td className="px-5 py-4"><div>{grant.userId?.name ?? "Parking staff"}</div><div className="text-xs text-gray-400">{grant.userId?.email}</div></td>
                <td className="px-5 py-4">{humanizeLabel(grant.parkingRole)}</td>
                <td className="px-5 py-4">{(grant.locationIds ?? []).map((row: any) => row.name).join(", ") || "All partner parking"}</td>
                <td className="px-5 py-4 font-mono text-xs">{grant.employeeCode || "—"}</td>
                <td className="px-5 py-4"><EnterpriseStatusBadge status={grant.status} size="sm" /></td>
                <td className="px-5 py-4 text-right"><div className="flex justify-end gap-2">{grant.status === "pending_approval" && canApprove && <button type="button" onClick={() => void approve(grant)} disabled={busyId === String(grant._id)} className="rounded-full bg-[#0A4DA6] px-3 py-2 text-xs text-white disabled:opacity-50">Approve</button>}{["active", "pending_approval"].includes(grant.status) && <button type="button" onClick={() => void revoke(grant)} disabled={busyId === String(grant._id)} className="rounded-full border border-red-200 p-2 text-red-600 disabled:opacity-50" title="Remove parking access">{busyId === String(grant._id) ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}</button>}</div></td>
              </tr>)}
              {!loading && visibleGrants.length === 0 && <tr><td colSpan={6} className="px-5 py-12 text-center text-sm text-gray-400">No parking staff found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
        <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[28px] bg-white p-6 dark:bg-[#0B192C]">
          <div className="mb-5 flex items-center justify-between border-b border-gray-100 pb-4 dark:border-slate-800">
            <div><h3 className="text-lg text-[#0B192C] dark:text-white">Create Parking Staff Account</h3><p className="mt-1 text-xs text-gray-400">Set the staff member's login password. The employee code is generated automatically.</p></div>
            <button type="button" onClick={() => setShowForm(false)} className="text-gray-400"><X size={19} /></button>
          </div>

          {credentials ? <div className="space-y-4">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{credentials.approvalRequired ? "Account created and awaiting Ashram Owner/Admin approval. Share the login details only after approval." : "Account created. The staff member can sign in with the password you set."}</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-gray-50 p-4"><div className="text-xs text-gray-400">Email</div><div className="mt-1 break-all">{credentials.account?.email}</div></div>
              <div className="rounded-2xl bg-gray-50 p-4"><div className="text-xs text-gray-400">Employee code</div><div className="mt-1 font-mono">{credentials.account?.employeeCode}</div></div>
            </div>
            <button type="button" onClick={() => setShowForm(false)} className="w-full rounded-full bg-[#0A4DA6] py-3 text-sm text-white">Done</button>
          </div> : <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label><span className={labelClass}>Full name</span><input required minLength={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} /></label>
              <label><span className={labelClass}>Email</span><input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputClass} /></label>
              <label><span className={labelClass}>Phone</span><input required inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputClass} /></label>
              <label><span className={labelClass}>Parking role</span><select value={form.parkingRole} onChange={(e) => setForm({ ...form, parkingRole: e.target.value as StaffForm["parkingRole"] })} className={inputClass}><option value="security_guard">Parking Security Guard</option>{!isParkingManagerOnly && <option value="parking_manager">Parking Manager</option>}</select></label>
              <label><span className={labelClass}>Ashram</span><select required value={form.ashramId} onChange={(e) => setForm({ ...form, ashramId: e.target.value, locationId: "" })} className={inputClass}><option value="">Select ashram</option>{ashrams.map((ashram) => <option key={ashram.id} value={ashram.id}>{ashram.name}</option>)}</select></label>
              <label><span className={labelClass}>Parking facility</span><select required disabled={!form.ashramId} value={form.locationId} onChange={(e) => setForm({ ...form, locationId: e.target.value })} className={inputClass}><option value="">Select parking</option>{ashramLocations.map((location) => <option key={location._id} value={location._id}>{location.name}</option>)}</select></label>
              <label className="sm:col-span-2"><span className={labelClass}>Shift</span><select value={form.shift} onChange={(e) => setForm({ ...form, shift: e.target.value })} className={inputClass}><option value="general">General</option><option value="morning">Morning</option><option value="evening">Evening</option><option value="night">Night</option></select></label>
              <label><span className={labelClass}>Password</span><input required type="password" minLength={8} autoComplete="new-password" placeholder="Minimum 8 characters" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={inputClass} /></label>
              <label><span className={labelClass}>Confirm password</span><input required type="password" minLength={8} autoComplete="new-password" placeholder="Re-enter password" value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} className={inputClass} /></label>
            </div>
            <div className="flex gap-3 border-t border-gray-100 pt-4 dark:border-slate-800"><button type="button" onClick={() => setShowForm(false)} className="flex-1 rounded-full bg-gray-100 py-3 text-sm">Cancel</button><button disabled={saving} type="submit" className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[#0A4DA6] py-3 text-sm text-white disabled:opacity-60">{saving && <Loader2 size={16} className="animate-spin" />} Create Account</button></div>
          </form>}
        </div>
      </div>}
    </div>
  );
};

export default ParkingStaffRolesPage;
