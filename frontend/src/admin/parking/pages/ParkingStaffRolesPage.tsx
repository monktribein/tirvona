import React, { useCallback, useEffect, useState } from "react";
import {
  ShieldCheck,
  UserPlus,
  Search,
  Trash2,
  Loader2,
  AlertTriangle,
  RefreshCw,
  X,
} from "lucide-react";
import { EnterprisePageHeader } from "../../shared/components/EnterprisePageHeader";
import { EnterpriseStatusBadge } from "../../shared/components/EnterpriseStatusBadge";
import { useNotifications } from "../../../contexts/NotificationContext";
import api, { getErrorMessage } from "../../../lib/api";
import { parkingAdminService } from "../../../modules/parking/services/parking.service";
import { humanizeLabel } from "../../../utils/labels";

/**
 * Parking Staff & Roles.
 *
 * Parking authorisation does not live on `User.role`. A grant row in
 * `parking_staff` binds a user to a partner, optionally to specific locations,
 * and carries one of three roles whose capability sets the parking API checks on
 * every request. That is why these accounts are invisible to user management,
 * and why this screen exists.
 *
 * An empty location selection means partner-wide, which is what the API records
 * when `locationIds` is omitted — stated explicitly here so it is not mistaken
 * for "no access".
 */

const ROLE_BLURB: Record<string, string> = {
  parking_partner:
    "Full control of their own parking: locations, pricing, slots, staff, reports and refund requests.",
  parking_manager:
    "Day-to-day operations — bookings, occupancy, availability, reports. Can assign security guards only.",
  security_guard:
    "Gate duty only: scan a QR, view the booking, check vehicles in and out.",
};

/**
 * The three roles the parking API recognises. /parking/admin/staff/roles returns
 * these with their capability counts, but assigning a role must not depend on a
 * constants-only endpoint being reachable — so the picker and the cards fall
 * back to this list and simply omit the count, rather than inventing one that
 * could drift from PARKING_ROLE_CAPABILITIES on the server.
 */
const FALLBACK_ROLES = [
  "parking_partner",
  "parking_manager",
  "security_guard",
] as const;

export const ParkingStaffRolesPage: React.FC = () => {
  const { addNotification } = useNotifications();
  const [grants, setGrants] = useState<any[]>([]);
  const [partners, setPartners] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [roles, setRoles] = useState<
    { role: string; capabilities: string[] | null }[]
  >(FALLBACK_ROLES.map((role) => ({ role, capabilities: null })));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [roleFilter, setRoleFilter] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [userQuery, setUserQuery] = useState("");
  const [userResults, setUserResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [form, setForm] = useState<{
    userId: string;
    userLabel: string;
    partnerId: string;
    parkingRole: string;
    locationIds: string[];
    employeeCode: string;
    shift: string;
    phone: string;
  }>({
    userId: "",
    userLabel: "",
    partnerId: "",
    parkingRole: "security_guard",
    locationIds: [],
    employeeCode: "",
    shift: "general",
    phone: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [staffRes, partnersRes, locationsRes, rolesRes] =
        await Promise.allSettled([
          parkingAdminService.listStaff({
            limit: 100,
            ...(roleFilter ? { parkingRole: roleFilter } : {}),
          }),
          parkingAdminService.listPartners({ limit: 100 }),
          parkingAdminService.listLocations({ limit: 100 }),
          parkingAdminService.listRoles(),
        ]);
      // Clear a section that failed rather than leaving the previous response
      // on screen next to an error — stale rows beside a red banner read as
      // live data and hide which call actually broke.
      setGrants(
        staffRes.status === "fulfilled" ? (staffRes.value.data?.data ?? []) : [],
      );
      setPartners(
        partnersRes.status === "fulfilled"
          ? (partnersRes.value.data?.data ?? [])
          : [],
      );
      setLocations(
        locationsRes.status === "fulfilled"
          ? (locationsRes.value.data?.data ?? [])
          : [],
      );
      // Roles are a fixed set, so falling back keeps the picker usable.
      setRoles(
        rolesRes.status === "fulfilled" && rolesRes.value.data?.data?.length
          ? rolesRes.value.data.data
          : FALLBACK_ROLES.map((role) => ({ role, capabilities: null })),
      );

      const failures = [
        ["Staff roster", staffRes],
        ["Partners", partnersRes],
        ["Locations", locationsRes],
        ["Role catalogue", rolesRes],
      ]
        .filter(([, r]) => (r as PromiseSettledResult<unknown>).status === "rejected")
        .map(
          ([name, r]) =>
            `${name}: ${getErrorMessage((r as PromiseRejectedResult).reason)}`,
        );
      if (failures.length) setError(failures.join(" · "));
    } finally {
      setLoading(false);
    }
  }, [roleFilter]);

  useEffect(() => {
    load();
  }, [load]);

  // A grant needs a real user account, and the console's user directory is the
  // only searchable source of one. Super Admin already has read access to it.
  const searchUsers = async (term: string) => {
    setUserQuery(term);
    if (term.trim().length < 2) {
      setUserResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await api.get("/admin/crud/users", {
        params: { search: term.trim() },
      });
      setUserResults((res.data?.data ?? []).slice(0, 8));
    } catch {
      setUserResults([]);
    } finally {
      setSearching(false);
    }
  };

  const partnerLocations = locations.filter(
    (location) =>
      String(location.partnerId?._id ?? location.partnerId ?? "") ===
      form.partnerId,
  );

  const resetForm = () => {
    setForm({
      userId: "",
      userLabel: "",
      partnerId: "",
      parkingRole: "security_guard",
      locationIds: [],
      employeeCode: "",
      shift: "general",
      phone: "",
    });
    setUserQuery("");
    setUserResults([]);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.userId || !form.partnerId) {
      addNotification(
        "Missing Details",
        "Pick both a user and the partner the role belongs to.",
        "error",
      );
      return;
    }
    setSaving(true);
    try {
      const res = await parkingAdminService.assignStaff({
        userId: form.userId,
        partnerId: form.partnerId,
        parkingRole: form.parkingRole,
        locationIds: form.locationIds,
        employeeCode: form.employeeCode,
        shift: form.shift,
        phone: form.phone,
      });
      addNotification(
        "Role Assigned",
        res.data?.message || "Parking role assigned.",
        "success",
      );
      setIsModalOpen(false);
      resetForm();
      await load();
    } catch (err) {
      addNotification("Assign Failed", getErrorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  };

  const revoke = async (grant: any) => {
    const who = grant.userId?.name || grant.userId?.email || "this user";
    if (
      !window.confirm(
        `Revoke ${String(grant.parkingRole).replace(/_/g, " ")} from ${who}? They lose access immediately.`,
      )
    )
      return;
    setBusyId(grant._id);
    try {
      await parkingAdminService.revokeStaff(grant._id);
      addNotification("Role Revoked", "Parking access removed.", "info");
      await load();
    } catch (err) {
      addNotification("Revoke Failed", getErrorMessage(err), "error");
    } finally {
      setBusyId("");
    }
  };

  const card =
    "bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] shadow-sm";
  const th =
    "text-left px-4 py-3 text-[11px] font-black tracking-wider text-gray-400";
  const td = "px-4 py-3 text-sm text-[#0B192C] dark:text-slate-200";
  const input =
    "w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/30";
  const label =
    "text-[11px] font-black tracking-wider text-gray-400 block mb-1.5";

  return (
    <div className="space-y-6">
      <EnterprisePageHeader
        title="Parking Staff & Roles"
        subtitle="Parking permissions are grants against a partner, not account roles — they do not appear in user management."
        icon={<ShieldCheck size={22} />}
        badgeText="Super admin"
        actions={
          <div className="flex gap-2">
            <button
              onClick={load}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-700 text-sm font-bold disabled:opacity-60"
            >
              {loading ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <RefreshCw size={15} />
              )}
              Refresh
            </button>
            <button
              onClick={() => {
                resetForm();
                setIsModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0A4DA6] text-white text-sm font-bold hover:bg-[#083d85]"
            >
              <UserPlus size={15} />
              Assign Role
            </button>
          </div>
        }
      />

      {error && (
        <div className="flex items-start gap-2.5 p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <p className="text-sm font-semibold">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {roles.map((role) => (
          <button
            key={role.role}
            onClick={() =>
              setRoleFilter(roleFilter === role.role ? "" : role.role)
            }
            className={`${card} p-5 text-left transition-all hover:-translate-y-0.5 ${
              roleFilter === role.role ? "ring-2 ring-[#0A4DA6]" : ""
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-black text-[#0B192C] dark:text-white capitalize">
                {role.role.replace(/_/g, " ")}
              </span>
              {role.capabilities && (
                <span className="px-2 py-0.5 rounded-full bg-[#0A4DA6]/10 text-[#0A4DA6] text-[10px] font-black">
                  {role.capabilities.length} CAPS
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 font-semibold leading-relaxed">
              {ROLE_BLURB[role.role] ?? ""}
            </p>
          </button>
        ))}
      </div>

      <div className={`${card} overflow-hidden`}>
        <div className="p-5 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between gap-3">
          <h3 className="text-sm font-black tracking-wider text-gray-400">
            {roleFilter
              ? `${roleFilter.replace(/_/g, " ")} grants`
              : "All parking grants"}
          </h3>
          {roleFilter && (
            <button
              onClick={() => setRoleFilter("")}
              className="text-xs font-bold text-[#0A4DA6] hover:underline"
            >
              Clear filter
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px]">
            <thead className="bg-gray-50 dark:bg-slate-900/60">
              <tr>
                <th className={th}>Staff Member</th>
                <th className={th}>Partner</th>
                <th className={th}>Role</th>
                <th className={th}>Location Scope</th>
                <th className={th}>Shift</th>
                <th className={th}>Status</th>
                <th className={th}>Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
              {grants.map((grant) => (
                <tr key={grant._id}>
                  <td className={`${td} font-bold`}>
                    {grant.userId?.name || "—"}
                    <span className="block text-xs text-gray-400 font-semibold">
                      {grant.userId?.email || ""}
                    </span>
                  </td>
                  <td className={td}>
                    {grant.partnerId?.businessName || "—"}
                  </td>
                  <td className={`${td} capitalize`}>
                    {String(grant.parkingRole).replace(/_/g, " ")}
                    <span className="block text-xs text-gray-400 font-semibold">
                      {grant.capabilities?.length ?? 0} capabilities
                    </span>
                  </td>
                  <td className={td}>
                    {grant.scope === "all_partner_locations" ? (
                      <span className="px-2 py-0.5 rounded-full bg-[#0A4DA6]/10 text-[#0A4DA6] text-[11px] font-black">
                        ALL PARTNER LOCATIONS
                      </span>
                    ) : (
                      (grant.locationIds ?? [])
                        .map((l: any) => l?.name || "—")
                        .join(", ")
                    )}
                  </td>
                  <td className={`${td} capitalize`}>{grant.shift || "—"}</td>
                  <td className={td}>
                    <EnterpriseStatusBadge status={grant.status} />
                  </td>
                  <td className={td}>
                    {grant.status === "active" && (
                      <button
                        disabled={busyId === grant._id}
                        onClick={() => revoke(grant)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold disabled:opacity-50"
                      >
                        <Trash2 size={13} />
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!grants.length && !loading && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-sm font-bold text-gray-400"
                  >
                    No parking roles assigned yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#0B192C] rounded-[28px] w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white dark:bg-[#0B192C] p-6 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-lg font-black text-[#0B192C] dark:text-white">
                Assign Parking Role
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={submit} className="p-6 space-y-5">
              <div>
                <label className={label}>Staff Member</label>
                {form.userId ? (
                  <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900">
                    <span className="text-sm font-bold text-emerald-900 dark:text-emerald-300">
                      {form.userLabel}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setForm({ ...form, userId: "", userLabel: "" })
                      }
                      className="text-xs font-bold text-emerald-700 hover:underline"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search
                      size={15}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    />
                    <input
                      value={userQuery}
                      onChange={(e) => searchUsers(e.target.value)}
                      placeholder="Search by name or email (min 2 characters)"
                      className={`${input} pl-9`}
                    />
                    {searching && (
                      <Loader2
                        size={15}
                        className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400"
                      />
                    )}
                    {userResults.length > 0 && (
                      <div className="absolute z-10 mt-1 w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden">
                        {userResults.map((user) => (
                          <button
                            key={user._id}
                            type="button"
                            onClick={() => {
                              setForm({
                                ...form,
                                userId: user._id,
                                userLabel: `${user.name} · ${user.email}`,
                                phone: form.phone || user.phone || "",
                              });
                              setUserResults([]);
                              setUserQuery("");
                            }}
                            className="w-full text-left px-3.5 py-2.5 hover:bg-gray-50 dark:hover:bg-slate-800 border-b border-gray-100 dark:border-slate-800 last:border-0"
                          >
                            <span className="text-sm font-bold block">
                              {user.name}
                            </span>
                            <span className="text-xs text-gray-400">
                              {user.email} · {humanizeLabel(user.role)}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={label}>Partner</label>
                  <select
                    required
                    value={form.partnerId}
                    onChange={(e) =>
                      // Locations belong to a partner, so switching partner
                      // invalidates any location already ticked.
                      setForm({
                        ...form,
                        partnerId: e.target.value,
                        locationIds: [],
                      })
                    }
                    className={input}
                  >
                    <option value="">Select a partner…</option>
                    {partners.map((partner) => (
                      <option key={partner._id} value={partner._id}>
                        {partner.businessName} ({partner.partnerCode})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={label}>Parking Role</label>
                  <select
                    value={form.parkingRole}
                    onChange={(e) =>
                      setForm({ ...form, parkingRole: e.target.value })
                    }
                    className={input}
                  >
                    {(roles.length
                      ? roles.map((r) => r.role)
                      : [...FALLBACK_ROLES]
                    ).map((role) => (
                      <option key={role} value={role}>
                        {role.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-400 font-semibold mt-1.5 leading-relaxed">
                    {ROLE_BLURB[form.parkingRole] ?? ""}
                  </p>
                </div>
              </div>

              <div>
                <label className={label}>
                  Location Scope — leave empty for all partner locations
                </label>
                {!form.partnerId ? (
                  <p className="text-sm text-gray-400 font-semibold px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700">
                    Select a partner first.
                  </p>
                ) : partnerLocations.length ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto p-1">
                    {partnerLocations.map((location) => {
                      const checked = form.locationIds.includes(location._id);
                      return (
                        <label
                          key={location._id}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setForm({
                                ...form,
                                locationIds: checked
                                  ? form.locationIds.filter(
                                      (id) => id !== location._id,
                                    )
                                  : [...form.locationIds, location._id],
                              })
                            }
                          />
                          <span className="text-sm font-semibold truncate">
                            {location.name}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 font-semibold px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700">
                    This partner has no locations yet — the grant will cover
                    every location it adds later.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className={label}>Employee Code</label>
                  <input
                    value={form.employeeCode}
                    onChange={(e) =>
                      setForm({ ...form, employeeCode: e.target.value })
                    }
                    className={input}
                  />
                </div>
                <div>
                  <label className={label}>Shift</label>
                  <select
                    value={form.shift}
                    onChange={(e) =>
                      setForm({ ...form, shift: e.target.value })
                    }
                    className={input}
                  >
                    {[
                      "general",
                      "morning",
                      "evening",
                      "night",
                      "rotational",
                    ].map((shift) => (
                      <option key={shift} value={shift}>
                        {shift}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={label}>Phone</label>
                  <input
                    value={form.phone}
                    onChange={(e) =>
                      setForm({ ...form, phone: e.target.value })
                    }
                    className={input}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 text-sm font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0A4DA6] text-white text-sm font-bold hover:bg-[#083d85] disabled:opacity-60"
                >
                  {saving && <Loader2 size={15} className="animate-spin" />}
                  Assign Role
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ParkingStaffRolesPage;
