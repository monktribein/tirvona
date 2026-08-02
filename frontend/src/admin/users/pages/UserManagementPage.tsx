import React, { useState, useEffect, useMemo } from "react";
import {
  Search,
  RefreshCw,
  CheckCircle,
  Clock,
  UserCheck,
  UserX,
  X,
  Eye,
  Calendar,
  Mail,
  FileText,
  UserPlus,
  Key,
  Shield,
  Trash2,
  RotateCcw,
  Check,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Tag,
} from "lucide-react";
import { userService } from "../../../services";
import { getErrorMessage } from "../../../lib/api";
import { useAuth } from "../../../contexts/AuthContext";
import { useNotifications } from "../../../contexts/NotificationContext";

interface ManagedUser {
  _id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  status: string;
  employeeId?: string;
  username?: string;
  designation?: string;
  department?: string;
  aadhaarId?: string;
  gender?: string;
  dob?: string;
  assignedAshram?: any;
  joiningDate?: string;
  permissions?: string[];
  remarks?: string;
  isSuspended?: boolean;
  suspensionReason?: string;
  suspensionType?: string;
  suspendedBy?: any;
  suspendedAt?: string;
  suspensionEndDate?: string;
  internalNotes?: string;
  visibleMessage?: string;
  isDeleted?: boolean;
  deletedAt?: string;
  createdAt?: string;
}

const ALL_ROLES = [
  { id: "super_admin", label: "Super Admin" },
  { id: "national_admin", label: "National Admin" },
  { id: "state_admin", label: "State Admin" },
  { id: "govt_admin", label: "Government Admin" },
  { id: "district_officer", label: "District Officer" },
  { id: "owner", label: "Ashram Stay Admin" },
  { id: "manager", label: "Ashram Manager" },
  { id: "reception", label: "Receptionist" },
  { id: "housekeeping", label: "Housekeeping" },
  { id: "banner_manager", label: "Banner Manager" },
  { id: "content_manager", label: "Content Manager" },
  { id: "offer_manager", label: "Offer Manager" },
  { id: "blog_manager", label: "Blog Manager" },
  { id: "local_manager", label: "Local Hub Manager" },
  { id: "marketplace_manager", label: "Marketplace Manager" },
  { id: "finance_manager", label: "Finance Manager" },
  { id: "support", label: "Support Executive" },
  { id: "inspector", label: "Field Inspector" },
  { id: "staff", label: "General Staff" },
  { id: "volunteer", label: "Volunteer" },
  { id: "customer", label: "Pilgrim / Customer" },
];

const ALL_PERMISSIONS = [
  "Can Create Users",
  "Can Delete Users",
  "Can Approve Ashrams",
  "Can Manage Blogs",
  "Can Manage Offers",
  "Can Manage Banners",
  "Can View Reports",
  "Can Export Data",
  "Can Access Finance",
  "Can Manage Marketplace",
  "Can Manage Local Hub",
];

export const UserManagementPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const { addNotification } = useNotifications();

  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters & Search State
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  // Multi-step Create Account Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createStep, setCreateStep] = useState<1 | 2 | 3>(1);
  const [newAccountData, setNewAccountData] = useState<Record<string, any>>({
    name: "",
    email: "",
    phone: "",
    password: "",
    role: "staff",
    designation: "",
    department: "",
    city: "",
    state: "",
    aadhaarId: "",
    gender: "Male",
    status: "active",
    permissions: ["Can View Reports"],
    remarks: "",
  });

  // Action Modals State
  const [suspendTarget, setSuspendTarget] = useState<ManagedUser | null>(null);
  const [roleTarget, setRoleTarget] = useState<ManagedUser | null>(null);
  const [newSelectedRole, setNewSelectedRole] = useState("staff");
  const [permTarget, setPermTarget] = useState<ManagedUser | null>(null);
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);
  const [resetPassTarget, setResetPassTarget] = useState<ManagedUser | null>(
    null,
  );
  const [newTempPassword, setNewTempPassword] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ManagedUser | null>(null);
  const [deleteType, setDeleteType] = useState<"soft" | "permanent">("soft");
  const [adminPassword, setAdminPassword] = useState("");
  const [confirmDeleteText, setConfirmDeleteText] = useState("");
  const [viewingUser, setViewingUser] = useState<ManagedUser | null>(null);

  // Suspension Form State
  const [reason, setReason] = useState("Terms Violation");
  const [suspensionType, setSuspensionType] = useState<
    "temporary" | "permanent"
  >("temporary");
  const [durationDays, setDurationDays] = useState("7");
  const [customEndDate, setCustomEndDate] = useState("");
  const [visibleToUser, setVisibleToUser] = useState(true);
  const [visibleMessage, setVisibleMessage] = useState("");
  const [internalNotes, setInternalNotes] = useState("");

  const canModerate = currentUser?.role === "super_admin";

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await userService.list();
      if (res.data?.success) {
        setUsers(res.data.data);
      }
    } catch (err) {
      console.error("Fetch users error:", err);
      setError(getErrorMessage(err, "Unable to load users."));
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  // Create Account Handler
  const handleCreateAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await userService.createAccount(newAccountData);
      if (res.data?.success) {
        addNotification(
          "Account Created",
          `Successfully created account for ${newAccountData.name}. Temp password: ${res.data.tempPassword}`,
          "success",
        );
        setIsCreateOpen(false);
        setCreateStep(1);
        fetchUsers();
      }
    } catch (err) {
      addNotification(
        "Creation Failed",
        getErrorMessage(err, "Could not create user account."),
        "error",
      );
    }
  };

  // Suspend Handler
  const handleSuspendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!suspendTarget || !canModerate) return;

    try {
      const payload = {
        reason,
        suspensionType,
        durationDays: Number(durationDays),
        customEndDate: durationDays === "custom" ? customEndDate : undefined,
        visibleMessage: visibleToUser ? visibleMessage : "",
        internalNotes,
      };

      const res = await userService.suspend(suspendTarget._id, payload);
      if (res.data?.success) {
        addNotification(
          "Account Suspended",
          `${suspendTarget.name} has been ${suspensionType}ly suspended.`,
          "warning",
        );
        setSuspendTarget(null);
        fetchUsers();
      }
    } catch (err) {
      addNotification(
        "Action Failed",
        getErrorMessage(err, "Could not suspend user account."),
        "error",
      );
    }
  };

  // Reactivate Handler
  const handleReactivate = async (u: ManagedUser) => {
    if (!canModerate) return;
    try {
      const res = await userService.reactivate(u._id);
      if (res.data?.success) {
        addNotification(
          "Account Reactivated",
          `${u.name}'s account is now ACTIVE.`,
          "success",
        );
        fetchUsers();
      }
    } catch (err) {
      addNotification(
        "Action Failed",
        getErrorMessage(err, "Could not reactivate user account."),
        "error",
      );
    }
  };

  // Change Role Handler
  const handleChangeRoleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleTarget || !canModerate) return;
    try {
      const res = await userService.changeRole(roleTarget._id, newSelectedRole);
      if (res.data?.success) {
        addNotification(
          "Role Updated",
          `User role changed to ${newSelectedRole.toUpperCase()}`,
          "success",
        );
        setRoleTarget(null);
        fetchUsers();
      }
    } catch (err) {
      addNotification(
        "Action Failed",
        getErrorMessage(err, "Could not update role."),
        "error",
      );
    }
  };

  // Update Permissions Handler
  const handlePermissionsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!permTarget || !canModerate) return;
    try {
      const res = await userService.updatePermissions(
        permTarget._id,
        selectedPerms,
      );
      if (res.data?.success) {
        addNotification(
          "Permissions Updated",
          `Updated permissions matrix for ${permTarget.name}`,
          "success",
        );
        setPermTarget(null);
        fetchUsers();
      }
    } catch (err) {
      addNotification(
        "Action Failed",
        getErrorMessage(err, "Could not update permissions."),
        "error",
      );
    }
  };

  // Reset Password Handler
  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPassTarget || !canModerate) return;
    try {
      const res = await userService.resetPassword(
        resetPassTarget._id,
        newTempPassword,
      );
      if (res.data?.success) {
        addNotification(
          "Password Reset",
          `New temp password: ${res.data.tempPassword}`,
          "success",
        );
        setResetPassTarget(null);
        setNewTempPassword("");
      }
    } catch (err) {
      addNotification(
        "Action Failed",
        getErrorMessage(err, "Could not reset password."),
        "error",
      );
    }
  };

  // Delete Handler (Soft / Permanent)
  const handleDeleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deleteTarget || !canModerate) return;

    try {
      if (deleteType === "soft") {
        const res = await userService.softDelete(deleteTarget._id);
        if (res.data?.success) {
          addNotification(
            "Account Soft Deleted",
            "Moved to Deleted Accounts queue.",
            "info",
          );
          setDeleteTarget(null);
          fetchUsers();
        }
      } else {
        const res = await userService.permanentDelete(deleteTarget._id, {
          adminPassword,
          confirmText: confirmDeleteText,
        });
        if (res.data?.success) {
          addNotification(
            "Account Purged",
            "User permanently deleted from database.",
            "warning",
          );
          setDeleteTarget(null);
          setAdminPassword("");
          setConfirmDeleteText("");
          fetchUsers();
        }
      }
    } catch (err) {
      addNotification(
        "Delete Failed",
        getErrorMessage(err, "Could not delete user account."),
        "error",
      );
    }
  };

  // Restore Handler
  const handleRestore = async (u: ManagedUser) => {
    if (!canModerate) return;
    try {
      const res = await userService.restore(u._id);
      if (res.data?.success) {
        addNotification(
          "Account Restored",
          `${u.name} is now ACTIVE.`,
          "success",
        );
        fetchUsers();
      }
    } catch (err) {
      addNotification(
        "Restore Failed",
        getErrorMessage(err, "Could not restore account."),
        "error",
      );
    }
  };

  // Filter & Search Logic
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const searchMatch =
        !searchTerm ||
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.phone.includes(searchTerm) ||
        (u.employeeId &&
          u.employeeId.toLowerCase().includes(searchTerm.toLowerCase())) ||
        u.role.toLowerCase().includes(searchTerm.toLowerCase());

      const isSusp = Boolean(u.isSuspended);
      let statusMatch = true;

      if (filterStatus === "active")
        statusMatch = u.status === "active" && !isSusp && !u.isDeleted;
      else if (filterStatus === "pending")
        statusMatch = ["pending", "pending_approval"].includes(u.status);
      else if (filterStatus === "suspended")
        statusMatch =
          isSusp || ["suspended", "temp_suspended"].includes(u.status);
      else if (filterStatus === "permanent_suspended")
        statusMatch =
          u.status === "perm_suspended" ||
          (isSusp && u.suspensionType === "permanent");
      else if (filterStatus === "disabled")
        statusMatch = u.status === "disabled";
      else if (filterStatus === "deleted")
        statusMatch = u.status === "deleted" || Boolean(u.isDeleted);
      else if (filterStatus === "archived")
        statusMatch = u.status === "archived";

      return searchMatch && statusMatch;
    });
  }, [users, searchTerm, filterStatus]);

  return (
    <div className="space-y-6 text-left max-w-7xl mx-auto pb-12">
      {/* ── Page Header & Create Button ── */}
      <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 p-6 rounded-[28px] shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[#0A4DA6]/10 text-[#0A4DA6] flex items-center justify-center shrink-0 border border-[#0A4DA6]/15">
            <UserCheck size={22} />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-[#0B192C] dark:text-white tracking-tight">
              Enterprise Identity & Access Management (IAM)
            </h2>
            <p className="text-xs text-gray-400 font-semibold mt-0.5">
              Complete account lifecycle administration, granular permissions,
              role assignments, soft delete, and security auditing.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canModerate && (
            <button
              onClick={() => {
                setCreateStep(1);
                setIsCreateOpen(true);
              }}
              className="px-5 py-2.5 bg-[#0A4DA6] hover:bg-[#083b80] text-white rounded-full text-xs font-extrabold flex items-center gap-1.5 shadow-md shadow-[#0A4DA6]/20 cursor-pointer"
            >
              <UserPlus size={16} /> Create New Account
            </button>
          )}
          <button
            onClick={fetchUsers}
            className="p-2.5 bg-gray-50 dark:bg-slate-900 hover:bg-gray-100 dark:hover:bg-slate-800 border border-gray-100 dark:border-slate-800 rounded-full text-gray-500 cursor-pointer transition-colors"
            title="Refresh List"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-danger/10 text-danger border border-danger/20 text-xs font-bold rounded-2xl">
          {error}
        </div>
      )}

      {/* ── Filters & Search Toolbar ── */}
      <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 p-4 rounded-[24px] shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
            size={16}
          />
          <input
            type="text"
            placeholder="Search name, email, phone, EMP ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-full text-xs font-medium text-[#0B192C] dark:text-white focus:outline-none focus:border-[#0A4DA6]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          {[
            { id: "all", label: "All Accounts" },
            { id: "active", label: "Active" },
            { id: "pending", label: "Pending" },
            { id: "suspended", label: "Suspended" },
            { id: "permanent_suspended", label: "Perm Suspended" },
            { id: "disabled", label: "Disabled" },
            { id: "deleted", label: "Deleted Accounts" },
            { id: "archived", label: "Archived" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterStatus(tab.id)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                filterStatus === tab.id
                  ? "bg-[#0A4DA6] text-white shadow-sm"
                  : "bg-gray-50 dark:bg-slate-900 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── IAM Data Table ── */}
      {loading ? (
        <div className="h-64 bg-gray-50 border border-gray-100 rounded-[24px] animate-pulse" />
      ) : (
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-100 dark:border-slate-800 bg-gray-50/70 dark:bg-slate-900/50 text-gray-400 font-extrabold uppercase text-[10px] tracking-wider">
                  <th className="py-4 px-6">Employee / User Info</th>
                  <th className="py-4 px-6">Role</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6">Emp ID / Username</th>
                  <th className="py-4 px-6 text-right">IAM Control Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-12 text-center text-gray-400 font-semibold"
                    >
                      No matching user accounts found.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const isUserSuspended =
                      Boolean(u.isSuspended) ||
                      [
                        "suspended",
                        "temp_suspended",
                        "perm_suspended",
                      ].includes(u.status);
                    const isSoftDeleted =
                      u.status === "deleted" || Boolean(u.isDeleted);

                    return (
                      <tr
                        key={u._id}
                        className="border-b border-gray-50 dark:border-slate-850 hover:bg-gray-50/30 transition-colors"
                      >
                        <td className="py-4 px-6 font-bold text-[#0B192C] dark:text-white">
                          <div className="flex flex-col">
                            <span className="text-sm font-extrabold">
                              {u.name}
                            </span>
                            <span className="text-gray-400 text-[11px] font-normal">
                              {u.email} • {u.phone}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <span className="px-2.5 py-0.5 bg-[#0A4DA6]/10 text-[#0A4DA6] rounded-full text-[9px] font-extrabold uppercase">
                            {u.role.replace("_", " ")}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide ${
                              isSoftDeleted
                                ? "bg-gray-200 text-gray-700 dark:bg-slate-800 dark:text-gray-400"
                                : !isUserSuspended && u.status === "active"
                                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                                  : u.status === "perm_suspended"
                                    ? "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400"
                                    : isUserSuspended
                                      ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
                                      : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {isSoftDeleted
                              ? "Soft Deleted"
                              : isUserSuspended
                                ? "Suspended"
                                : u.status}
                          </span>
                        </td>
                        <td className="py-4 px-6 font-mono text-[11px] text-gray-500">
                          <div>{u.employeeId || "EMP-2026-8812"}</div>
                          <div className="text-[10px] text-gray-400">
                            {u.username ||
                              `@${u.name.toLowerCase().replace(/\s+/g, "")}`}
                          </div>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setViewingUser(u)}
                              className="p-1.5 text-gray-400 hover:text-[#0A4DA6] hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
                              title="View Details"
                            >
                              <Eye size={14} />
                            </button>

                            {isSoftDeleted ? (
                              <button
                                onClick={() => handleRestore(u)}
                                disabled={!canModerate}
                                className="px-3 py-1 bg-emerald-600 text-white rounded-full text-[10px] font-extrabold flex items-center gap-1 hover:bg-emerald-700 disabled:opacity-40 cursor-pointer shadow-sm"
                                title="Restore Account"
                              >
                                <RotateCcw size={12} /> Restore
                              </button>
                            ) : (
                              <>
                                <button
                                  onClick={() => {
                                    setRoleTarget(u);
                                    setNewSelectedRole(u.role);
                                  }}
                                  disabled={!canModerate}
                                  className="p-1.5 text-gray-400 hover:text-amber-500 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
                                  title="Change Role"
                                >
                                  <Shield size={14} />
                                </button>
                                <button
                                  onClick={() => {
                                    setPermTarget(u);
                                    setSelectedPerms(
                                      u.permissions || ["Can View Reports"],
                                    );
                                  }}
                                  disabled={!canModerate}
                                  className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
                                  title="Manage Permissions"
                                >
                                  <Tag size={14} />
                                </button>
                                <button
                                  onClick={() => setResetPassTarget(u)}
                                  disabled={!canModerate}
                                  className="p-1.5 text-gray-400 hover:text-purple-500 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
                                  title="Reset Password"
                                >
                                  <Key size={14} />
                                </button>

                                {isUserSuspended ? (
                                  <button
                                    onClick={() => handleReactivate(u)}
                                    disabled={!canModerate}
                                    className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-full cursor-pointer"
                                    title="Reactivate Account"
                                  >
                                    <UserCheck size={14} />
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => setSuspendTarget(u)}
                                    disabled={!canModerate}
                                    className="p-1.5 text-amber-500 hover:bg-amber-50 rounded-full cursor-pointer"
                                    title="Suspend Account"
                                  >
                                    <UserX size={14} />
                                  </button>
                                )}

                                <button
                                  onClick={() => {
                                    setDeleteTarget(u);
                                    setDeleteType("soft");
                                  }}
                                  disabled={!canModerate}
                                  className="p-1.5 text-gray-400 hover:text-rose-500 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
                                  title="Delete Account Options"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Multi-Step "Create New Account" Modal ── */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateAccountSubmit}
            className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 max-w-2xl w-full rounded-[28px] p-6 space-y-5 text-left shadow-2xl animate-in zoom-in-95 duration-150"
          >
            {/* Header */}
            <div className="flex justify-between items-center border-b border-gray-100 dark:border-slate-800 pb-4">
              <div>
                <h3 className="font-extrabold text-lg text-[#0B192C] dark:text-white flex items-center gap-2">
                  <UserPlus size={20} className="text-[#0A4DA6]" /> IAM
                  Onboarding — Create New Enterprise Account
                </h3>
                <span className="text-xs text-gray-400 font-semibold">
                  Step {createStep} of 3
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Step 1: Personal Details */}
            {createStep === 1 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="space-y-1 sm:col-span-2">
                  <label className="font-bold text-gray-700 dark:text-gray-300">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Inspector Ramesh Sharma"
                    value={newAccountData.name}
                    onChange={(e) =>
                      setNewAccountData({
                        ...newAccountData,
                        name: e.target.value,
                      })
                    }
                    className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-[#0A4DA6]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-gray-700 dark:text-gray-300">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="official@tirvona.gov.in"
                    value={newAccountData.email}
                    onChange={(e) =>
                      setNewAccountData({
                        ...newAccountData,
                        email: e.target.value,
                      })
                    }
                    className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-[#0A4DA6]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-gray-700 dark:text-gray-300">
                    Mobile Number *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="+91 98765 43210"
                    value={newAccountData.phone}
                    onChange={(e) =>
                      setNewAccountData({
                        ...newAccountData,
                        phone: e.target.value,
                      })
                    }
                    className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-[#0A4DA6]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-gray-700 dark:text-gray-300">
                    Gender
                  </label>
                  <select
                    value={newAccountData.gender}
                    onChange={(e) =>
                      setNewAccountData({
                        ...newAccountData,
                        gender: e.target.value,
                      })
                    }
                    className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl focus:outline-none"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-gray-700 dark:text-gray-300">
                    Aadhaar / Govt ID (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="XXXX-XXXX-1234"
                    value={newAccountData.aadhaarId}
                    onChange={(e) =>
                      setNewAccountData({
                        ...newAccountData,
                        aadhaarId: e.target.value,
                      })
                    }
                    className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl focus:outline-none"
                  />
                </div>
              </div>
            )}

            {/* Step 2: Role & Designation */}
            {createStep === 2 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="space-y-1">
                  <label className="font-bold text-gray-700 dark:text-gray-300">
                    Enterprise Role *
                  </label>
                  <select
                    value={newAccountData.role}
                    onChange={(e) =>
                      setNewAccountData({
                        ...newAccountData,
                        role: e.target.value,
                      })
                    }
                    className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl focus:outline-none font-bold text-[#0A4DA6]"
                  >
                    {ALL_ROLES.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-gray-700 dark:text-gray-300">
                    Designation
                  </label>
                  <input
                    type="text"
                    placeholder="Senior Audit Officer"
                    value={newAccountData.designation}
                    onChange={(e) =>
                      setNewAccountData({
                        ...newAccountData,
                        designation: e.target.value,
                      })
                    }
                    className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-gray-700 dark:text-gray-300">
                    Department
                  </label>
                  <input
                    type="text"
                    placeholder="Spiritual Tourism IT Cell"
                    value={newAccountData.department}
                    onChange={(e) =>
                      setNewAccountData({
                        ...newAccountData,
                        department: e.target.value,
                      })
                    }
                    className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-gray-700 dark:text-gray-300">
                    City & State
                  </label>
                  <input
                    type="text"
                    placeholder="Rishikesh, Uttarakhand"
                    value={newAccountData.city}
                    onChange={(e) =>
                      setNewAccountData({
                        ...newAccountData,
                        city: e.target.value,
                      })
                    }
                    className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl focus:outline-none"
                  />
                </div>
              </div>
            )}

            {/* Step 3: Auto Credentials & Permissions */}
            {createStep === 3 && (
              <div className="space-y-4 text-xs">
                <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-extrabold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                      <Sparkles size={16} /> Password & System Credentials
                    </h4>
                    <span className="text-[10px] font-mono bg-amber-100 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 px-2 py-0.5 rounded-md font-bold">
                      Employee ID: Auto
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="space-y-1">
                      <label className="font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1">
                        <Key size={13} className="text-[#0A4DA6]" /> Initial
                        Password (Custom / Manual)
                      </label>
                      <input
                        type="text"
                        placeholder="Enter custom password (or leave for auto)"
                        value={newAccountData.password || ""}
                        onChange={(e) =>
                          setNewAccountData({
                            ...newAccountData,
                            password: e.target.value,
                          })
                        }
                        className="w-full p-2.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-[#0A4DA6] font-mono text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-gray-500">
                        Active Password Summary
                      </label>
                      <div className="p-2.5 bg-white/80 dark:bg-slate-900/80 border border-gray-200 dark:border-slate-800 rounded-xl text-[11px] flex items-center gap-1.5">
                        <span className="text-gray-400 font-medium">
                          Setting:
                        </span>
                        <span className="font-mono font-bold text-emerald-600 truncate">
                          {newAccountData.password
                            ? newAccountData.password
                            : "Tirvona#2026!Pass (Auto)"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="text-[10px] text-amber-700 dark:text-amber-400 font-medium">
                    💡 Tip: Enter your own custom password above, or leave blank
                    to automatically assign the system default password (
                    <code className="font-bold">Tirvona#2026!Pass</code>).
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="font-bold text-gray-700 dark:text-gray-300">
                    Assigned Feature Permissions
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {ALL_PERMISSIONS.map((perm) => (
                      <label
                        key={perm}
                        className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-slate-900 rounded-lg cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={newAccountData.permissions.includes(perm)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewAccountData({
                                ...newAccountData,
                                permissions: [
                                  ...newAccountData.permissions,
                                  perm,
                                ],
                              });
                            } else {
                              setNewAccountData({
                                ...newAccountData,
                                permissions: newAccountData.permissions.filter(
                                  (p: string) => p !== perm,
                                ),
                              });
                            }
                          }}
                          className="rounded text-[#0A4DA6]"
                        />
                        <span className="text-[11px] font-bold text-gray-700 dark:text-gray-300">
                          {perm}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Multi-step Footer Navigation */}
            <div className="flex justify-between items-center pt-4 border-t border-gray-100 dark:border-slate-800">
              {createStep > 1 ? (
                <button
                  type="button"
                  onClick={() => setCreateStep((s) => (s - 1) as any)}
                  className="px-5 py-2.5 bg-gray-100 dark:bg-slate-800 text-gray-700 rounded-full text-xs font-bold"
                >
                  Previous
                </button>
              ) : (
                <div />
              )}

              {createStep < 3 ? (
                <button
                  type="button"
                  onClick={() => setCreateStep((s) => (s + 1) as any)}
                  className="px-6 py-2.5 bg-[#0A4DA6] text-white rounded-full text-xs font-bold shadow-md cursor-pointer flex items-center gap-1"
                >
                  Next Step <ArrowRight size={14} />
                </button>
              ) : (
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full text-xs font-black shadow-md cursor-pointer"
                >
                  Finalize & Create Account
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      {/* ── Change Role Modal ── */}
      {roleTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleChangeRoleSubmit}
            className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 max-w-md w-full rounded-[28px] p-6 space-y-4 text-left shadow-2xl"
          >
            <div className="flex justify-between items-center border-b border-gray-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-base text-[#0B192C] dark:text-white flex items-center gap-2">
                <Shield size={18} className="text-[#0A4DA6]" /> Change
                Enterprise Role
              </h3>
              <button
                type="button"
                onClick={() => setRoleTarget(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <span className="font-bold text-gray-400">
                Target User: {roleTarget.name}
              </span>
              <select
                value={newSelectedRole}
                onChange={(e) => setNewSelectedRole(e.target.value)}
                className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl font-bold text-[#0A4DA6]"
              >
                {ALL_ROLES.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-3 pt-3 border-t border-gray-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setRoleTarget(null)}
                className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-full font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2 bg-[#0A4DA6] text-white rounded-full font-bold text-xs"
              >
                Update Role
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Assign Permissions Modal ── */}
      {permTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handlePermissionsSubmit}
            className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 max-w-md w-full rounded-[28px] p-6 space-y-4 text-left shadow-2xl"
          >
            <div className="flex justify-between items-center border-b border-gray-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-base text-[#0B192C] dark:text-white flex items-center gap-2">
                <Tag size={18} className="text-[#0A4DA6]" /> Permission Matrix
                Control
              </h3>
              <button
                type="button"
                onClick={() => setPermTarget(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <span className="font-bold text-gray-400">
                Target User: {permTarget.name}
              </span>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {ALL_PERMISSIONS.map((perm) => (
                  <label
                    key={perm}
                    className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-slate-900 rounded-xl cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedPerms.includes(perm)}
                      onChange={(e) => {
                        if (e.target.checked)
                          setSelectedPerms([...selectedPerms, perm]);
                        else
                          setSelectedPerms(
                            selectedPerms.filter((p) => p !== perm),
                          );
                      }}
                      className="rounded text-[#0A4DA6]"
                    />
                    <span className="font-bold text-gray-700 dark:text-gray-200">
                      {perm}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-3 border-t border-gray-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setPermTarget(null)}
                className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-full font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2 bg-[#0A4DA6] text-white rounded-full font-bold text-xs"
              >
                Save Permissions
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Reset Password Modal ── */}
      {resetPassTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleResetPasswordSubmit}
            className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 max-w-md w-full rounded-[28px] p-6 space-y-4 text-left shadow-2xl animate-in zoom-in-95 duration-150"
          >
            <div className="flex justify-between items-center border-b border-gray-100 dark:border-slate-800 pb-3">
              <h3 className="font-extrabold text-base text-[#0B192C] dark:text-white flex items-center gap-2">
                <Key size={18} className="text-purple-600" /> Reset User
                Password
              </h3>
              <button
                type="button"
                onClick={() => {
                  setResetPassTarget(null);
                  setNewTempPassword("");
                }}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/50 rounded-xl space-y-1">
                <span className="font-bold text-purple-900 dark:text-purple-200">
                  Target Account: {resetPassTarget.name} (
                  {resetPassTarget.email})
                </span>
                <p className="text-[11px] text-gray-500">
                  Set a new custom password or leave blank to automatically
                  generate a secure system password.
                </p>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-gray-700 dark:text-gray-300">
                  New Password (Custom or Auto)
                </label>
                <input
                  type="text"
                  placeholder="Enter new password (or leave blank for auto)"
                  value={newTempPassword}
                  onChange={(e) => setNewTempPassword(e.target.value)}
                  className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl font-mono text-xs focus:outline-none focus:border-purple-600"
                />
              </div>

              <div className="p-2.5 bg-gray-50 dark:bg-slate-900 rounded-xl text-[11px] flex items-center justify-between border border-gray-200 dark:border-slate-800">
                <span className="text-gray-500 font-medium">
                  Assigned Password:
                </span>
                <span className="font-mono font-bold text-emerald-600">
                  {newTempPassword
                    ? newTempPassword
                    : "Auto-Generated Password"}
                </span>
              </div>
            </div>

            <div className="flex gap-3 pt-3 border-t border-gray-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setResetPassTarget(null);
                  setNewTempPassword("");
                }}
                className="flex-1 py-2.5 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 rounded-full font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-full font-extrabold text-xs shadow-md cursor-pointer"
              >
                Reset Password
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Soft & Permanent Delete Modal ── */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleDeleteSubmit}
            className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 max-w-md w-full rounded-[28px] p-6 space-y-4 text-left shadow-2xl"
          >
            <div className="flex justify-between items-center border-b border-gray-100 dark:border-slate-800 pb-3">
              <h3 className="font-extrabold text-base text-rose-600 flex items-center gap-2">
                <Trash2 size={18} /> Delete Account Confirmation
              </h3>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-rose-50 dark:bg-rose-950/30 rounded-xl space-y-1">
                <span className="font-bold text-rose-800 dark:text-rose-200">
                  Account: {deleteTarget.name} ({deleteTarget.email})
                </span>
                <p className="text-gray-500">
                  Choose between Soft Delete (Restorable) or Permanent DB Purge.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteType("soft")}
                  className={`flex-1 py-2.5 rounded-xl border font-bold ${deleteType === "soft" ? "bg-amber-50 border-amber-500 text-amber-700" : "bg-gray-50 border-gray-200 text-gray-400"}`}
                >
                  Soft Delete
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteType("permanent")}
                  className={`flex-1 py-2.5 rounded-xl border font-bold ${deleteType === "permanent" ? "bg-rose-50 border-rose-500 text-rose-700" : "bg-gray-50 border-gray-200 text-gray-400"}`}
                >
                  Permanent Delete
                </button>
              </div>

              {deleteType === "permanent" && (
                <div className="space-y-2 pt-2">
                  <div className="space-y-1">
                    <label className="font-bold text-gray-700 dark:text-gray-300">
                      Admin Password Verification *
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="Enter Super Admin Password"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 rounded-xl focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-gray-700 dark:text-gray-300">
                      Type "DELETE" to confirm *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="DELETE"
                      value={confirmDeleteText}
                      onChange={(e) => setConfirmDeleteText(e.target.value)}
                      className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 rounded-xl font-bold text-rose-600 focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-3 border-t border-gray-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-full font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2 bg-rose-600 text-white rounded-full font-black text-xs shadow"
              >
                Confirm Delete
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
export default UserManagementPage;
