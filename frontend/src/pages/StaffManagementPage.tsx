import React, { useState, useEffect } from "react";
import { Users, Plus, X, Trash2, ShieldCheck } from "lucide-react";
import { userService, ashramService } from "../services";
import { getErrorMessage } from "../lib/api";
import { useNotifications } from "../contexts/NotificationContext";

interface Staff {
  _id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  status: string;
  employerAshramId?: { _id: string; name: string };
}

interface AshramOption {
  _id: string;
  name: string;
}

const ROLE_LABELS: Record<string, string> = {
  manager: "Manager",
  reception: "Reception",
  housekeeping: "Housekeeping",
};

export const StaffManagementPage: React.FC = () => {
  const { addNotification } = useNotifications();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [ashrams, setAshrams] = useState<AshramOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    role: "reception",
    ashramId: "",
    parkingRole: "",
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [staffRes, ashramRes] = await Promise.all([
        userService.listStaff(),
        ashramService.myListings(),
      ]);
      if (staffRes.data.success) setStaff(staffRes.data.data);
      if (ashramRes.data.success) {
        setAshrams(ashramRes.data.data);
        if (ashramRes.data.data.length > 0) {
          setForm((f) => ({ ...f, ashramId: ashramRes.data.data[0]._id }));
        }
      }
    } catch (err) {
      addNotification(
        "Load Failed",
        getErrorMessage(err, "Could not load staff."),
        "error",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);
    try {
      const res = await userService.createStaff(form);
      if (res.data.success) {
        setShowCreate(false);
        setForm({
          name: "",
          email: "",
          phone: "",
          password: "",
          role: "reception",
          ashramId: ashrams[0]?._id || "",
          parkingRole: "",
        });
        addNotification(
          "Staff Added",
          `${res.data.data.name} can now log in with the ${ROLE_LABELS[res.data.data.role]} portal.`,
          "success",
        );
        fetchData();
      }
    } catch (err) {
      setFormError(getErrorMessage(err, "Could not create staff account."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (id: string) => {
    try {
      const res = await userService.removeStaff(id);
      if (res.data.success) {
        addNotification(
          "Staff Deactivated",
          "The staff member can no longer sign in.",
          "info",
        );
        fetchData();
      }
    } catch (err) {
      addNotification(
        "Action Failed",
        getErrorMessage(err, "Could not deactivate staff."),
        "error",
      );
    }
  };

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-6 text-left w-full">
      <div className="flex flex-wrap justify-between items-start sm:items-center gap-3 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 p-4 sm:p-6 rounded-[24px] shadow-sm">
        <div className="min-w-0">
          <h2 className="text-base font-extrabold text-[#0B192C] dark:text-white flex items-center gap-2">
            <Users size={18} className="text-[#0A4DA6]" /> Staff Management
          </h2>
          <p className="text-xs text-gray-400 font-semibold mt-1">
            Create reception, housekeeping, and manager accounts tied to your
            ashrams.
          </p>
        </div>
        {ashrams.length > 0 && (
          <button
            onClick={() => setShowCreate(true)}
            className="shrink-0 px-5 py-2.5 bg-[#0A4DA6] text-white text-xs font-bold rounded-full hover:bg-opacity-95 shadow flex items-center gap-1.5 cursor-pointer"
          >
            <Plus size={14} /> Add Staff
          </button>
        )}
      </div>

      {loading ? (
        <div className="h-40 bg-gray-50 border border-gray-100 rounded-[24px] animate-pulse" />
      ) : staff.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] space-y-3">
          <ShieldCheck className="mx-auto text-gray-300" size={32} />
          <h4 className="font-extrabold text-base text-[#0B192C] dark:text-white">
            No staff yet
          </h4>
          <p className="text-xs text-gray-400 max-w-sm mx-auto">
            Add reception or housekeeping staff so they can run the front desk
            and room board for your ashram.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-50 dark:border-slate-850 bg-gray-50 dark:bg-slate-900 text-gray-400 font-bold text-[10px] tracking-wider">
                  <th className="py-4 px-6">Name</th>
                  <th className="py-4 px-6">Contact</th>
                  <th className="py-4 px-6">Role</th>
                  <th className="py-4 px-6">Ashram</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((s) => (
                  <tr
                    key={s._id}
                    className="border-b border-gray-50 dark:border-slate-850 hover:bg-gray-50/20"
                  >
                    <td className="py-4 px-6 font-bold text-[#0B192C] dark:text-white">
                      {s.name}
                    </td>
                    <td className="py-4 px-6 text-gray-500">
                      <div className="flex flex-col">
                        <span>{s.email}</span>
                        <span className="text-[10px] text-gray-400">
                          {s.phone}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="px-2.5 py-0.5 bg-[#0A4DA6]/10 text-[#0A4DA6] rounded-full text-[9px] font-bold">
                        {ROLE_LABELS[s.role] || s.role}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-gray-500">
                      {s.employerAshramId?.name || "—"}
                    </td>
                    <td className="py-4 px-6">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold ${s.status === "active" ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      {s.status === "active" && (
                        <button
                          onClick={() => handleRemove(s._id)}
                          className="p-1.5 rounded-lg text-danger hover:bg-danger/10 transition-colors cursor-pointer"
                          title="Deactivate"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreate}
            className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 max-w-4xl w-full rounded-[28px] p-6 sm:p-8 space-y-5 max-h-[88vh] overflow-y-auto text-left"
          >
            <div className="flex justify-between items-center border-b border-gray-100 dark:border-slate-800 pb-3">
              <h3 className="font-extrabold text-base text-[#0B192C] dark:text-white flex items-center gap-1.5">
                <Users size={18} className="text-[#0A4DA6]" /> Add Staff Member
              </h3>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-danger/10 text-danger border border-danger/20 text-xs rounded-xl font-semibold">
                {formError}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                required
                placeholder="Full name"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl text-xs focus:outline-none"
              />
              <input
                required
                type="email"
                placeholder="Email address"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl text-xs focus:outline-none"
              />
              <input
                required
                placeholder="Phone number"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl text-xs focus:outline-none"
              />
              <input
                required
                type="password"
                minLength={6}
                placeholder="Temporary password (min 6 chars)"
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl text-xs focus:outline-none"
              />
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={form.role}
                  onChange={(e) => set("role", e.target.value)}
                  className="w-full p-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl text-xs focus:outline-none"
                >
                  <option value="reception">Reception</option>
                  <option value="housekeeping">Housekeeping</option>
                  <option value="manager">Manager</option>
                </select>
                <select
                  value={form.ashramId}
                  onChange={(e) => set("ashramId", e.target.value)}
                  className="w-full p-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl text-xs focus:outline-none"
                >
                  {ashrams.map((a) => (
                    <option key={a._id} value={a._id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
              <label className="block space-y-1">
                <span className="text-[11px] font-bold text-gray-600 dark:text-gray-300">Parking role (optional)</span>
                <select
                  value={form.parkingRole}
                  onChange={(e) => set("parkingRole", e.target.value)}
                  className="w-full p-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl text-xs focus:outline-none"
                >
                  <option value="">No parking access</option>
                  <option value="security_guard">Parking - Security Guard</option>
                  <option value="parking_manager">Parking - Parking Manager</option>
                  <option value="parking_partner">Parking - Parking Partner</option>
                </select>
                <span className="block text-[10px] text-gray-400">Grants the parking console for this ashram's facilities only. Requires parking management to be activated.</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-[#0A4DA6] text-white rounded-full font-extrabold text-xs shadow-md cursor-pointer disabled:opacity-60"
            >
              {submitting ? "Creating…" : "Create Staff Account"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
export default StaffManagementPage;
