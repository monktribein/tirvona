import React, { useState, useEffect, useMemo } from "react";
import { getFormattingLocale } from "../../../utils/format";
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
  Building2,
} from "lucide-react";
import { userService } from "../../../services";
import { getErrorMessage } from "../../../lib/api";
import { useAuth } from "../../../contexts/AuthContext";
import { useNotifications } from "../../../contexts/NotificationContext";
import { humanizeLabel } from "../../../utils/labels";
import { FileUploader } from "../../../components/FileUploader";

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
  assignedAshram?: {
    _id: string;
    name: string;
    city?: string;
    state?: string;
  } | null;
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
  hasAadhaarCard?: boolean;
  hasPanCard?: boolean;
}

interface AssignableAshram {
  _id: string;
  name: string;
  address?: { city?: string; state?: string };
}

const ASSIGNED_OWNER_ROLE = "ashram_owner";
const ASHRAM_SCOPED_ROLES = new Set([
  ASSIGNED_OWNER_ROLE,
  "manager",
  "reception",
  "housekeeping",
]);

const ALL_ROLES = [
  { id: "super_admin", label: "Super Admin" },
  { id: "national_admin", label: "National Admin" },
  { id: "state_admin", label: "State Admin" },
  { id: "govt_admin", label: "Government Admin" },
  { id: "district_officer", label: "District Officer" },
  { id: "ashram_admin", label: "Ashram Admin (All Ashrams)" },
  { id: "ashram_owner", label: "Ashram Owner (Assigned Ashrams Only)" },
  { id: "manager", label: "Ashram Manager" },
  { id: "reception", label: "Ashram Reception" },
  { id: "housekeeping", label: "Ashram Housekeeping" },
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
  "ashrams.manage_all",
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

  const [searchTerm, setSearchTerm] = useState(
    () => new URLSearchParams(window.location.search).get("q") ?? "",
  );
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterRole, setFilterRole] = useState("all");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createStep, setCreateStep] = useState<1 | 2 | 3>(1);
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [newAccountData, setNewAccountData] = useState<Record<string, any>>({
    name: "",
    email: "",
    phone: "",
    role: "customer",
    gender: "Male",
    aadhaarCardUrl: "",
    panCardUrl: "",
    assignedAshramId: "",
    password: "",
    confirmPassword: "",
  });

  const [ashramSearch, setAshramSearch] = useState("");
  const [ashramOptions, setAshramOptions] = useState<AssignableAshram[]>([]);
  const [loadingAshrams, setLoadingAshrams] = useState(false);

  const [suspendTarget, setSuspendTarget] = useState<ManagedUser | null>(null);
  const [roleTarget, setRoleTarget] = useState<ManagedUser | null>(null);
  const [newSelectedRole, setNewSelectedRole] = useState("staff");
  const [roleDocuments, setRoleDocuments] = useState({
    aadhaarCardUrl: "",
    panCardUrl: "",
  });
  const [changingRole, setChangingRole] = useState(false);
  const [statusTarget, setStatusTarget] = useState<ManagedUser | null>(null);
  const [newSelectedStatus, setNewSelectedStatus] = useState("active");
  const [changingStatus, setChangingStatus] = useState(false);
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
  const [editingUser, setEditingUser] = useState(false);
  const [savingUser, setSavingUser] = useState(false);
  const [editUserData, setEditUserData] = useState({
    name: "",
    email: "",
    phone: "",
    gender: "Male",
  });

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

  const needsAssignedAshram = ASHRAM_SCOPED_ROLES.has(newAccountData.role);

  useEffect(() => {
    if (!isCreateOpen || !needsAssignedAshram) return;
    let cancelled = false;
    setLoadingAshrams(true);
    const timer = window.setTimeout(async () => {
      try {
        const res = await userService.assignableAshrams(ashramSearch.trim());
        if (!cancelled && res.data?.success) setAshramOptions(res.data.data);
      } catch {
        if (!cancelled) setAshramOptions([]);
      } finally {
        if (!cancelled) setLoadingAshrams(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isCreateOpen, needsAssignedAshram, ashramSearch]);

  useEffect(() => {
    if (!needsAssignedAshram && newAccountData.assignedAshramId)
      setNewAccountData((current: Record<string, any>) => ({
        ...current,
        assignedAshramId: "",
      }));
  }, [needsAssignedAshram, newAccountData.assignedAshramId]);

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

  const handleCreateAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((newAccountData.password ?? "").length < 8) {
      addNotification(
        "Password Required",
        "Create a password containing at least 8 characters.",
        "error",
      );
      return;
    }
    if (newAccountData.password !== newAccountData.confirmPassword) {
      addNotification(
        "Passwords Do Not Match",
        "Password and confirm password must match.",
        "error",
      );
      return;
    }
    const isPilgrim = newAccountData.role === "customer";
    if (
      !isPilgrim &&
      (!newAccountData.aadhaarCardUrl ||
        !newAccountData.panCardUrl)
    ) {
      addNotification(
        "Documents Required",
        "Aadhaar card and PAN card are mandatory for role accounts.",
        "error",
      );
      return;
    }
    if (
      needsAssignedAshram &&
      !newAccountData.assignedAshramId
    ) {
      addNotification(
        "Ashram Required",
        "Select the ashram this account will be assigned to.",
        "error",
      );
      return;
    }
    setCreatingAccount(true);
    try {
      const accountPayload = { ...newAccountData };
      delete accountPayload.confirmPassword;
      const res = await userService.createAccount(accountPayload);
      if (res.data?.success) {
        addNotification(
          "Account Created",
          `Successfully created account for ${newAccountData.name}. The account can use the password you set.`,
          "success",
        );
        setIsCreateOpen(false);
        setNewAccountData({
          name: "",
          email: "",
          phone: "",
          role: "customer",
          gender: "Male",
          aadhaarCardUrl: "",
          panCardUrl: "",
          assignedAshramId: "",
          password: "",
          confirmPassword: "",
        });
        setAshramSearch("");
        setAshramOptions([]);
        fetchUsers();
      }
    } catch (err) {
      addNotification(
        "Creation Failed",
        getErrorMessage(err, "Could not create user account."),
        "error",
      );
    } finally {
      setCreatingAccount(false);
    }
  };

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

  const handleChangeRoleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleTarget || !canModerate) return;
    const needsDocuments = newSelectedRole !== "customer";
    if (
      needsDocuments &&
      ((!roleTarget.hasAadhaarCard && !roleDocuments.aadhaarCardUrl) ||
        (!roleTarget.hasPanCard && !roleDocuments.panCardUrl))
    ) {
      addNotification(
        "Documents Required",
        "Upload the missing Aadhaar card and PAN card before changing this role.",
        "error",
      );
      return;
    }
    setChangingRole(true);
    try {
      const res = await userService.changeRole(roleTarget._id, {
        role: newSelectedRole,
        ...roleDocuments,
      });
      if (res.data?.success) {
        addNotification(
          "Role Updated",
          `User role changed to ${humanizeLabel(newSelectedRole)}`,
          "success",
        );
        setRoleTarget(null);
        setRoleDocuments({ aadhaarCardUrl: "", panCardUrl: "" });
        fetchUsers();
      }
    } catch (err) {
      addNotification(
        "Action Failed",
        getErrorMessage(err, "Could not update role."),
        "error",
      );
    } finally {
      setChangingRole(false);
    }
  };

  const handleStatusChangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusTarget || !canModerate) return;
    setChangingStatus(true);
    try {
      const res = await userService.updateStatus(
        statusTarget._id,
        newSelectedStatus,
      );
      if (res.data?.success) {
        addNotification(
          "Status Updated",
          `${statusTarget.name}'s account is now ${humanizeLabel(newSelectedStatus)}.`,
          "success",
        );
        setStatusTarget(null);
        fetchUsers();
      }
    } catch (err) {
      addNotification(
        "Action Failed",
        getErrorMessage(err, "Could not update account status."),
        "error",
      );
    } finally {
      setChangingStatus(false);
    }
  };

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

  const startAccountEdit = (user: ManagedUser) => {
    setEditUserData({
      name: user.name || "",
      email: user.email || "",
      phone: user.phone || "",
      gender: user.gender || "Male",
    });
    setEditingUser(true);
  };

  const handleAccountEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewingUser || !canModerate) return;
    setSavingUser(true);
    try {
      const res = await userService.updateAccount(viewingUser._id, editUserData);
      if (res.data?.success) {
        const updated = { ...viewingUser, ...res.data.data };
        setViewingUser(updated);
        setEditingUser(false);
        setUsers((current) =>
          current.map((user) => (user._id === updated._id ? updated : user)),
        );
        addNotification(
          "Account Updated",
          `${updated.name}'s account details were saved.`,
          "success",
        );
      }
    } catch (err) {
      addNotification(
        "Update Failed",
        getErrorMessage(err, "Could not update account details."),
        "error",
      );
    } finally {
      setSavingUser(false);
    }
  };

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
      const roleMatch = filterRole === "all" || u.role === filterRole;
      let statusMatch = true;

      if (filterStatus === "active")
        statusMatch = u.status === "active" && !isSusp && !u.isDeleted;
      else if (filterStatus === "pending")
        statusMatch = ["pending", "pending_approval"].includes(u.status);
      else if (filterStatus === "suspended")
        statusMatch =
          (isSusp && u.suspensionType !== "permanent") ||
          ["suspended", "temp_suspended"].includes(u.status);
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

      return searchMatch && roleMatch && statusMatch;
    });
  }, [users, searchTerm, filterRole, filterStatus]);

  const availableRoleFilters = useMemo(() => {
    const roles = [...ALL_ROLES];
    const knownRoleIds = new Set(roles.map((role) => role.id));

    users.forEach((user) => {
      if (user.role && !knownRoleIds.has(user.role)) {
        roles.push({ id: user.role, label: humanizeLabel(user.role) });
        knownRoleIds.add(user.role);
      }
    });

    return roles;
  }, [users]);

  const selectableFilteredIds = useMemo(
    () =>
      filteredUsers
        .filter(
          (user) =>
            user._id !== currentUser?.id &&
            user.status !== "deleted" &&
            !user.isDeleted,
        )
        .map((user) => user._id),
    [filteredUsers, currentUser?.id],
  );
  const allFilteredSelected =
    selectableFilteredIds.length > 0 &&
    selectableFilteredIds.every((id) => selectedUserIds.includes(id));

  const toggleSelectAllFiltered = () => {
    setSelectedUserIds((current) =>
      allFilteredSelected
        ? current.filter((id) => !selectableFilteredIds.includes(id))
        : [...new Set([...current, ...selectableFilteredIds])],
    );
  };

  const handleBulkDelete = async () => {
    if (!canModerate || !selectedUserIds.length) return;
    setBulkDeleting(true);
    try {
      const res = await userService.bulkSoftDelete(selectedUserIds);
      if (res.data?.success) {
        addNotification(
          "Accounts Deleted",
          `${res.data.count ?? selectedUserIds.length} account(s) moved to Deleted Accounts.`,
          "success",
        );
        setSelectedUserIds([]);
        setBulkDeleteOpen(false);
        await fetchUsers();
      }
    } catch (err) {
      addNotification(
        "Bulk Delete Failed",
        getErrorMessage(err, "Could not delete the selected accounts."),
        "error",
      );
    } finally {
      setBulkDeleting(false);
    }
  };

  return (
    <div className="space-y-6 text-left w-full">
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

      <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 p-4 rounded-[24px] shadow-sm space-y-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(260px,1fr)_240px_220px_auto] md:items-end">
          <div className="relative w-full">
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
          <label className="space-y-1 text-[10px] font-extrabold uppercase tracking-wider text-gray-400">
            Account Type / Role
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="w-full rounded-full border border-gray-200 bg-gray-50 px-4 py-2.5 text-xs font-bold normal-case tracking-normal text-[#0B192C] outline-none focus:border-[#0A4DA6] dark:border-slate-800 dark:bg-slate-900 dark:text-white"
            >
              <option value="all">All Account Types</option>
              {availableRoleFilters.map((role) => (
                <option key={role.id} value={role.id}>{role.label}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-[10px] font-extrabold uppercase tracking-wider text-gray-400">
            Account Status
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full rounded-full border border-gray-200 bg-gray-50 px-4 py-2.5 text-xs font-bold normal-case tracking-normal text-[#0B192C] outline-none focus:border-[#0A4DA6] dark:border-slate-800 dark:bg-slate-900 dark:text-white"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Accounts</option>
              <option value="pending">Pending Accounts</option>
              <option value="suspended">Suspended Accounts</option>
              <option value="permanent_suspended">Permanently Suspended</option>
              <option value="disabled">Disabled Accounts</option>
              <option value="deleted">Deleted Accounts</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => {
              setSearchTerm("");
              setFilterRole("all");
              setFilterStatus("all");
            }}
            disabled={!searchTerm && filterRole === "all" && filterStatus === "all"}
            className="rounded-full border border-gray-200 px-4 py-2.5 text-xs font-bold text-gray-500 hover:border-[#0A4DA6]/30 hover:text-[#0A4DA6] disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-800"
          >
            Clear Filters
          </button>
        </div>
        <div className="flex items-center justify-between gap-3 px-1 text-[10px] font-semibold text-gray-400">
          <span>Showing {filteredUsers.length} of {users.length} account(s)</span>
          {(filterRole !== "all" || filterStatus !== "all") && (
            <span className="text-[#0A4DA6]">Filtered results</span>
          )}
        </div>
        {selectedUserIds.length > 0 && (
          <div className="flex flex-col gap-2 rounded-2xl border border-rose-100 bg-rose-50/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-rose-900/40 dark:bg-rose-950/20">
            <span className="text-xs font-extrabold text-rose-700 dark:text-rose-300">
              {selectedUserIds.length} account(s) selected
            </span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setSelectedUserIds([])} className="rounded-full bg-white px-4 py-2 text-[10px] font-bold text-gray-600 shadow-sm dark:bg-slate-900 dark:text-gray-300">Clear Selection</button>
              <button type="button" onClick={() => setBulkDeleteOpen(true)} disabled={!canModerate} className="inline-flex items-center gap-1.5 rounded-full bg-rose-600 px-4 py-2 text-[10px] font-extrabold text-white shadow-sm disabled:opacity-50"><Trash2 size={13} /> Delete Selected</button>
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="h-64 bg-gray-50 border border-gray-100 rounded-[24px] animate-pulse" />
      ) : (
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-100 dark:border-slate-800 bg-gray-50/70 dark:bg-slate-900/50 text-gray-400 font-extrabold text-[10px] tracking-wider">
                  <th className="py-4 pl-6 pr-2">
                    <input
                      type="checkbox"
                      checked={allFilteredSelected}
                      onChange={toggleSelectAllFiltered}
                      disabled={!selectableFilteredIds.length}
                      aria-label="Select all filtered accounts"
                      className="h-4 w-4 rounded border-gray-300 accent-[#0A4DA6]"
                    />
                  </th>
                  <th className="py-4 px-4">Employee / User Info</th>
                  <th className="py-4 px-6">Role</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6">Emp ID / Username</th>
                  <th className="py-4 px-6 text-right">Edit / View</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
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
                        <td className="py-4 pl-6 pr-2">
                          <input
                            type="checkbox"
                            checked={selectedUserIds.includes(u._id)}
                            onChange={() =>
                              setSelectedUserIds((current) =>
                                current.includes(u._id)
                                  ? current.filter((id) => id !== u._id)
                                  : [...current, u._id],
                              )
                            }
                            disabled={u._id === currentUser?.id || isSoftDeleted}
                            aria-label={`Select ${u.name}`}
                            className="h-4 w-4 rounded border-gray-300 accent-[#0A4DA6] disabled:opacity-30"
                          />
                        </td>
                        <td className="py-4 px-4 font-bold text-[#0B192C] dark:text-white">
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
                          <span className="px-2.5 py-0.5 bg-[#0A4DA6]/10 text-[#0A4DA6] rounded-full text-[9px] font-extrabold">
                            {u.role.replace("_", " ")}
                          </span>
                          {u.assignedAshram && (
                            <span
                              className="mt-1 flex items-center gap-1 text-[10px] font-bold text-gray-500"
                              title={`Scoped to ${u.assignedAshram.name}`}
                            >
                              <Building2 size={11} className="shrink-0" />
                              <span className="truncate">
                                {u.assignedAshram.name}
                              </span>
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-6">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[9px] font-black tracking-wide ${
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
                          <div className="flex items-center justify-end">
                            <button
                              onClick={() => setViewingUser(u)}
                              className="inline-flex items-center gap-1.5 rounded-full border border-[#0A4DA6]/20 bg-[#0A4DA6]/5 px-3 py-1.5 text-[10px] font-extrabold text-[#0A4DA6] transition-colors hover:bg-[#0A4DA6] hover:text-white"
                              title="Edit or view account"
                            >
                              <Eye size={13} /> Edit / View
                            </button>
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

      {bulkDeleteOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => !bulkDeleting && setBulkDeleteOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label="Delete selected accounts" onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-[28px] border border-gray-100 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-[#0B192C]">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600 dark:bg-rose-950/40"><Trash2 size={20} /></div>
              <div>
                <h3 className="text-lg font-extrabold text-[#0B192C] dark:text-white">Delete selected accounts?</h3>
                <p className="mt-1 text-xs leading-5 text-gray-500">{selectedUserIds.length} account(s) will be soft deleted, signed out, and moved to Deleted Accounts. They can be restored later.</p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2 border-t border-gray-100 pt-4 dark:border-slate-800">
              <button type="button" onClick={() => setBulkDeleteOpen(false)} disabled={bulkDeleting} className="rounded-full bg-gray-100 px-5 py-2.5 text-xs font-bold text-gray-600 disabled:opacity-50 dark:bg-slate-800 dark:text-gray-300">Cancel</button>
              <button type="button" onClick={handleBulkDelete} disabled={bulkDeleting} className="rounded-full bg-rose-600 px-5 py-2.5 text-xs font-extrabold text-white disabled:opacity-50">{bulkDeleting ? "Deleting..." : "Delete Accounts"}</button>
            </div>
          </div>
        </div>
      )}

      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <form onSubmit={handleCreateAccountSubmit} className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-[28px] border border-gray-100 bg-white p-6 text-left shadow-2xl dark:border-slate-800 dark:bg-[#0B192C] sm:p-8">
            <div className="flex items-start justify-between gap-4 border-b border-gray-100 pb-4 dark:border-slate-800">
              <div>
                <h3 className="flex items-center gap-2 text-xl font-extrabold text-[#0B192C] dark:text-white"><UserPlus size={22} className="text-[#0A4DA6]" /> Create Account</h3>
                <p className="mt-1 text-xs font-medium text-gray-500">Enter account details and verification documents in one step.</p>
              </div>
              <button type="button" onClick={() => setIsCreateOpen(false)} disabled={creatingAccount} className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800" aria-label="Close account form"><X size={18} /></button>
            </div>

            <div className="grid grid-cols-1 gap-4 py-6 text-xs md:grid-cols-2">
              <label className="space-y-1 font-bold text-gray-700 dark:text-gray-300">Full Name *
                <input type="text" required minLength={2} autoComplete="name" placeholder="Enter full name" value={newAccountData.name} onChange={(e) => setNewAccountData({ ...newAccountData, name: e.target.value })} className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 font-normal focus:border-[#0A4DA6] focus:outline-none dark:border-slate-800 dark:bg-slate-900" />
              </label>
              <label className="space-y-1 font-bold text-gray-700 dark:text-gray-300">Email Address *
                <input type="email" required autoComplete="email" placeholder="name@example.com" value={newAccountData.email} onChange={(e) => setNewAccountData({ ...newAccountData, email: e.target.value })} className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 font-normal focus:border-[#0A4DA6] focus:outline-none dark:border-slate-800 dark:bg-slate-900" />
              </label>
              <label className="space-y-1 font-bold text-gray-700 dark:text-gray-300">Phone Number *
                <input type="tel" required autoComplete="tel" placeholder="+91 98765 43210" value={newAccountData.phone} onChange={(e) => setNewAccountData({ ...newAccountData, phone: e.target.value })} className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 font-normal focus:border-[#0A4DA6] focus:outline-none dark:border-slate-800 dark:bg-slate-900" />
              </label>
              <label className="space-y-1 font-bold text-gray-700 dark:text-gray-300">Gender *
                <select required value={newAccountData.gender} onChange={(e) => setNewAccountData({ ...newAccountData, gender: e.target.value })} className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 font-normal focus:border-[#0A4DA6] focus:outline-none dark:border-slate-800 dark:bg-slate-900"><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option></select>
              </label>
              <label className="space-y-1 font-bold text-gray-700 dark:text-gray-300 md:col-span-2">Role *
                <select required value={newAccountData.role} onChange={(e) => setNewAccountData({ ...newAccountData, role: e.target.value })} className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 font-bold text-[#0A4DA6] focus:border-[#0A4DA6] focus:outline-none dark:border-slate-800 dark:bg-slate-900">{ALL_ROLES.map((role) => <option key={role.id} value={role.id}>{role.label}</option>)}</select>
              </label>
              <label className="space-y-1 font-bold text-gray-700 dark:text-gray-300">Password *
                <input type="password" required minLength={8} autoComplete="new-password" placeholder="Minimum 8 characters" value={newAccountData.password} onChange={(e) => setNewAccountData({ ...newAccountData, password: e.target.value })} className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 font-normal focus:border-[#0A4DA6] focus:outline-none dark:border-slate-800 dark:bg-slate-900" />
              </label>
              <label className="space-y-1 font-bold text-gray-700 dark:text-gray-300">Confirm Password *
                <input type="password" required minLength={8} autoComplete="new-password" placeholder="Re-enter password" value={newAccountData.confirmPassword} onChange={(e) => setNewAccountData({ ...newAccountData, confirmPassword: e.target.value })} className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 font-normal focus:border-[#0A4DA6] focus:outline-none dark:border-slate-800 dark:bg-slate-900" />
              </label>
              {needsAssignedAshram && (
                <div className="space-y-1 md:col-span-2">
                  <p className="font-bold text-gray-700 dark:text-gray-300">Assign Ashram *</p>
                  <p className="text-[11px] font-normal text-gray-500">This account will be scoped to the selected ashram and will only access that ashram's data.</p>
                  <div className="relative">
                    <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="search"
                      value={ashramSearch}
                      onChange={(e) => setAshramSearch(e.target.value)}
                      placeholder="Search approved ashrams by name, city or state"
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 pl-9 font-normal focus:border-[#0A4DA6] focus:outline-none dark:border-slate-800 dark:bg-slate-900"
                    />
                  </div>
                  <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-gray-200 dark:border-slate-800">
                    {loadingAshrams ? (
                      <p className="p-3 text-xs text-gray-500">Loading ashrams…</p>
                    ) : ashramOptions.length === 0 ? (
                      <p className="p-3 text-xs text-gray-500">{ashramSearch.trim() ? "No approved ashram matches that search." : "No approved ashrams are available to assign."}</p>
                    ) : (
                      ashramOptions.map((ashram) => {
                        const selected = newAccountData.assignedAshramId === ashram._id;
                        return (
                          <button
                            key={ashram._id}
                            type="button"
                            onClick={() => setNewAccountData((current: Record<string, any>) => ({ ...current, assignedAshramId: ashram._id }))}
                            className={`flex w-full items-center justify-between gap-3 border-b border-gray-100 p-3 text-left last:border-b-0 dark:border-slate-800 ${selected ? "bg-[#0A4DA6]/10" : "hover:bg-gray-50 dark:hover:bg-slate-900"}`}
                          >
                            <span>
                              <span className="block text-sm font-bold text-[#0B192C] dark:text-white">{ashram.name}</span>
                              <span className="block text-[11px] font-normal text-gray-500">{[ashram.address?.city, ashram.address?.state].filter(Boolean).join(", ") || "Location not set"}</span>
                            </span>
                            {selected && <CheckCircle size={16} className="shrink-0 text-[#0A4DA6]" />}
                          </button>
                        );
                      })
                    )}
                  </div>
                  {!newAccountData.assignedAshramId && <p className="text-[11px] font-normal text-red-500">Select the ashram this account will access before creating it.</p>}
                </div>
              )}
            </div>

            <section className="rounded-2xl border border-gray-200 bg-gray-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/60">
              <h4 className="flex items-center gap-2 text-sm font-extrabold text-[#0B192C] dark:text-white"><FileText size={16} className="text-[#0A4DA6]" />{newAccountData.role === "customer" ? "Identity Documents (Optional)" : "Role Verification Documents (Required)"}</h4>
              <p className="mb-4 mt-1 text-[11px] text-gray-500">{newAccountData.role === "customer" ? "Pilgrim accounts may be created without Aadhaar or PAN documents." : "Aadhaar card and PAN card must be uploaded for every role account."}</p>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div><p className="mb-1 text-xs font-bold">Aadhaar Card {newAccountData.role === "customer" ? "(Optional)" : "*"}</p><FileUploader folder="user-documents/aadhaar" accept="image/*,application/pdf" label="Upload Aadhaar" currentUrl={newAccountData.aadhaarCardUrl} onUploaded={(aadhaarCardUrl) => setNewAccountData((current: Record<string, any>) => ({ ...current, aadhaarCardUrl }))} /></div>
                <div><p className="mb-1 text-xs font-bold">PAN Card {newAccountData.role === "customer" ? "(Optional)" : "*"}</p><FileUploader folder="user-documents/pan" accept="image/*,application/pdf" label="Upload PAN" currentUrl={newAccountData.panCardUrl} onUploaded={(panCardUrl) => setNewAccountData((current: Record<string, any>) => ({ ...current, panCardUrl }))} /></div>
              </div>
            </section>

            <div className="mt-6 flex flex-col-reverse gap-3 border-t border-gray-100 pt-5 dark:border-slate-800 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setIsCreateOpen(false)} disabled={creatingAccount} className="rounded-full bg-gray-100 px-6 py-2.5 text-xs font-bold disabled:opacity-60 dark:bg-slate-800">Cancel</button>
              <button type="submit" disabled={creatingAccount} className="rounded-full bg-[#0A4DA6] px-7 py-2.5 text-xs font-extrabold text-white shadow-md disabled:opacity-60">{creatingAccount ? "Creating Account..." : "Create Account"}</button>
            </div>
          </form>
        </div>
      )}

      {false && isCreateOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateAccountSubmit}
            className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 max-w-5xl w-full rounded-[28px] p-6 sm:p-8 space-y-6 text-left shadow-2xl animate-in zoom-in-95 duration-150"
          >
            <div className="flex justify-between items-center border-b border-gray-100 dark:border-slate-800 pb-4">
              <div>
                <h3 className="font-extrabold text-lg sm:text-xl text-[#0B192C] dark:text-white flex items-center gap-2">
                  <UserPlus size={22} className="text-[#0A4DA6]" /> IAM
                  Onboarding — Create New Enterprise Account
                </h3>
                <span className="text-xs text-gray-400 font-semibold">
                  Step {createStep} of 3
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {createStep === 1 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
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
                onClick={() => {
                  setRoleTarget(null);
                  setRoleDocuments({ aadhaarCardUrl: "", panCardUrl: "" });
                }}
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
                onChange={(e) => {
                  setNewSelectedRole(e.target.value);
                  setRoleDocuments({ aadhaarCardUrl: "", panCardUrl: "" });
                }}
                className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl font-bold text-[#0A4DA6]"
              >
                {ALL_ROLES.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            {newSelectedRole !== "customer" && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-3 space-y-3">
                <div>
                  <p className="text-xs font-extrabold text-amber-900">
                    Role Verification Documents
                  </p>
                  <p className="mt-0.5 text-[10px] font-medium text-amber-700">
                    Aadhaar and PAN are required for every operational role.
                    Existing verified documents can be retained.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <p className="mb-1 text-[10px] font-bold text-gray-700">
                      Aadhaar Card {roleTarget.hasAadhaarCard ? "(On file)" : "*"}
                    </p>
                    <FileUploader
                      folder="user-documents/aadhaar"
                      accept="image/*,application/pdf"
                      label={roleTarget.hasAadhaarCard ? "Replace Aadhaar" : "Upload Aadhaar"}
                      currentUrl={roleDocuments.aadhaarCardUrl}
                      onUploaded={(aadhaarCardUrl) =>
                        setRoleDocuments((current) => ({
                          ...current,
                          aadhaarCardUrl,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <p className="mb-1 text-[10px] font-bold text-gray-700">
                      PAN Card {roleTarget.hasPanCard ? "(On file)" : "*"}
                    </p>
                    <FileUploader
                      folder="user-documents/pan"
                      accept="image/*,application/pdf"
                      label={roleTarget.hasPanCard ? "Replace PAN" : "Upload PAN"}
                      currentUrl={roleDocuments.panCardUrl}
                      onUploaded={(panCardUrl) =>
                        setRoleDocuments((current) => ({
                          ...current,
                          panCardUrl,
                        }))
                      }
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-3 border-t border-gray-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setRoleTarget(null);
                  setRoleDocuments({ aadhaarCardUrl: "", panCardUrl: "" });
                }}
                disabled={changingRole}
                className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-full font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={changingRole}
                className="flex-1 py-2 bg-[#0A4DA6] text-white rounded-full font-bold text-xs disabled:opacity-60"
              >
                {changingRole ? "Updating..." : "Update Role"}
              </button>
            </div>
          </form>
        </div>
      )}

      {statusTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleStatusChangeSubmit}
            className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 max-w-md w-full rounded-[28px] p-6 space-y-4 text-left shadow-2xl"
          >
            <div className="flex justify-between items-center border-b border-gray-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-base text-[#0B192C] dark:text-white flex items-center gap-2">
                <UserCheck size={18} className="text-[#0A4DA6]" /> Change Account Status
              </h3>
              <button type="button" onClick={() => setStatusTarget(null)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-2 text-xs">
              <span className="font-bold text-gray-400">Target User: {statusTarget.name}</span>
              <select
                value={newSelectedStatus}
                onChange={(e) => setNewSelectedStatus(e.target.value)}
                className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl font-bold text-[#0A4DA6]"
              >
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="pending_approval">Pending Approval</option>
                <option value="suspended">Suspended</option>
                <option value="disabled">Disabled</option>
              </select>
              <p className="text-[10px] font-medium text-gray-500">
                Only Active accounts can sign in. Changing status invalidates existing sessions.
              </p>
            </div>
            <div className="flex gap-3 pt-3 border-t border-gray-100 dark:border-slate-800">
              <button type="button" onClick={() => setStatusTarget(null)} disabled={changingStatus} className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-full font-bold text-xs disabled:opacity-60">Cancel</button>
              <button type="submit" disabled={changingStatus || newSelectedStatus === statusTarget.status} className="flex-1 py-2 bg-[#0A4DA6] text-white rounded-full font-bold text-xs disabled:opacity-60">
                {changingStatus ? "Updating..." : "Update Status"}
              </button>
            </div>
          </form>
        </div>
      )}

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

      {viewingUser && (
        <div
          className="fixed inset-0 z-[70] flex items-start sm:items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm overflow-y-auto"
          onClick={() => {
            setEditingUser(false);
            setViewingUser(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Account details"
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] max-w-2xl w-full my-4 sm:my-8 shadow-2xl flex flex-col max-h-[calc(100dvh-2rem)] overflow-hidden"
          >
            <div className="shrink-0 flex items-start justify-between gap-3 border-b border-gray-100 dark:border-slate-800 px-5 sm:px-7 pt-5 pb-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 shrink-0 rounded-full bg-[#0A4DA6]/10 text-[#0A4DA6] flex items-center justify-center font-black text-sm uppercase">
                  {(viewingUser.name || "?").slice(0, 2)}
                </div>
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg font-extrabold text-[#0B192C] dark:text-white truncate">
                    {viewingUser.name}
                  </h3>
                  <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                    <span className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-slate-800 text-[#0A4DA6] dark:text-blue-400 text-[10px] font-black">
                      {viewingUser.role}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                        viewingUser.isDeleted
                          ? "bg-gray-100 dark:bg-slate-800 text-gray-500"
                          : viewingUser.status === "active"
                            ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600"
                            : "bg-amber-50 dark:bg-amber-950/40 text-amber-600"
                      }`}
                    >
                      {viewingUser.isDeleted ? "deleted" : viewingUser.status}
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingUser(false);
                  setViewingUser(null);
                }}
                aria-label="Close"
                className="shrink-0 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-5 sm:px-7 py-5 space-y-5">
              {editingUser && (
                <form
                  id="account-details-form"
                  onSubmit={handleAccountEditSubmit}
                  className="grid grid-cols-1 gap-3 rounded-2xl border border-blue-100 bg-blue-50/40 p-4 sm:grid-cols-2 dark:border-slate-700 dark:bg-slate-900/60"
                >
                  <label className="space-y-1 text-[10px] font-bold text-gray-500">Full Name
                    <input required minLength={2} value={editUserData.name} onChange={(e) => setEditUserData({ ...editUserData, name: e.target.value })} className="w-full rounded-xl border border-gray-200 bg-white p-2.5 text-xs text-[#0B192C] outline-none focus:border-[#0A4DA6] dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
                  </label>
                  <label className="space-y-1 text-[10px] font-bold text-gray-500">Email
                    <input type="email" required value={editUserData.email} onChange={(e) => setEditUserData({ ...editUserData, email: e.target.value })} className="w-full rounded-xl border border-gray-200 bg-white p-2.5 text-xs text-[#0B192C] outline-none focus:border-[#0A4DA6] dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
                  </label>
                  <label className="space-y-1 text-[10px] font-bold text-gray-500">Phone
                    <input type="tel" required value={editUserData.phone} onChange={(e) => setEditUserData({ ...editUserData, phone: e.target.value })} className="w-full rounded-xl border border-gray-200 bg-white p-2.5 text-xs text-[#0B192C] outline-none focus:border-[#0A4DA6] dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
                  </label>
                  <label className="space-y-1 text-[10px] font-bold text-gray-500">Gender
                    <select required value={editUserData.gender} onChange={(e) => setEditUserData({ ...editUserData, gender: e.target.value })} className="w-full rounded-xl border border-gray-200 bg-white p-2.5 text-xs text-[#0B192C] outline-none focus:border-[#0A4DA6] dark:border-slate-700 dark:bg-slate-950 dark:text-white"><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option></select>
                  </label>
                </form>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { label: "Email", value: viewingUser.email },
                  { label: "Phone", value: viewingUser.phone },
                  { label: "Employee ID", value: viewingUser.employeeId },
                  { label: "Username", value: viewingUser.username },
                  { label: "Designation", value: viewingUser.designation },
                  { label: "Department", value: viewingUser.department },
                  { label: "Gender", value: viewingUser.gender },
                  {
                    label: "Date of Birth",
                    value: viewingUser.dob
                      ? new Date(viewingUser.dob).toLocaleDateString(getFormattingLocale())
                      : "",
                  },
                  {
                    label: "Joined",
                    value: viewingUser.joiningDate
                      ? new Date(viewingUser.joiningDate).toLocaleDateString(
                          getFormattingLocale(),
                        )
                      : "",
                  },
                  {
                    label: "Account Created",
                    value: viewingUser.createdAt
                      ? new Date(viewingUser.createdAt).toLocaleDateString(
                          getFormattingLocale(),
                        )
                      : "",
                  },
                  {
                    label: "Assigned Ashram",
                    value:
                      viewingUser.assignedAshram?.name ||
                      (typeof viewingUser.assignedAshram === "string"
                        ? viewingUser.assignedAshram
                        : ""),
                  },
                ]
                  .filter((f) => String(f.value ?? "").trim())
                  .map((f) => (
                    <div
                      key={f.label}
                      className="bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-800 rounded-2xl p-3"
                    >
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                        {f.label}
                      </p>
                      <p className="text-xs font-black text-[#0B192C] dark:text-white mt-0.5 break-words">
                        {f.value}
                      </p>
                    </div>
                  ))}
              </div>

              {viewingUser.permissions && viewingUser.permissions.length > 0 && (
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1.5">
                    Permissions
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {viewingUser.permissions.map((p) => (
                      <span
                        key={p}
                        className="px-2.5 py-1 rounded-full bg-blue-50 dark:bg-slate-800 text-[#0A4DA6] dark:text-blue-400 text-[10px] font-bold"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {(viewingUser.isSuspended || viewingUser.suspensionReason) && (
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-2xl p-3.5 space-y-1">
                  <p className="text-[10px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                    Suspension
                  </p>
                  {viewingUser.suspensionReason && (
                    <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                      {viewingUser.suspensionReason}
                    </p>
                  )}
                  <p className="text-[11px] font-semibold text-amber-700/80 dark:text-amber-400/80">
                    {viewingUser.suspensionType || "suspended"}
                    {viewingUser.suspendedAt &&
                      ` · from ${new Date(viewingUser.suspendedAt).toLocaleDateString(getFormattingLocale())}`}
                    {viewingUser.suspensionEndDate &&
                      ` · until ${new Date(viewingUser.suspensionEndDate).toLocaleDateString(getFormattingLocale())}`}
                  </p>
                </div>
              )}

              {viewingUser.isDeleted && (
                <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-2xl p-3.5">
                  <p className="text-[10px] font-black text-rose-700 dark:text-rose-400 uppercase tracking-wider">
                    Soft Deleted
                  </p>
                  <p className="text-xs font-semibold text-rose-800 dark:text-rose-300 mt-0.5">
                    {viewingUser.deletedAt
                      ? `Removed on ${new Date(viewingUser.deletedAt).toLocaleDateString(getFormattingLocale())}. The record is retained and can be restored.`
                      : "The record is retained and can be restored."}
                  </p>
                </div>
              )}

              {(viewingUser.remarks || viewingUser.internalNotes) && (
                <div className="space-y-2">
                  {viewingUser.remarks && (
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">
                        Remarks
                      </p>
                      <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 mt-0.5">
                        {viewingUser.remarks}
                      </p>
                    </div>
                  )}
                  {viewingUser.internalNotes && (
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">
                        Internal Notes
                      </p>
                      <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 mt-0.5">
                        {viewingUser.internalNotes}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="shrink-0 flex flex-wrap items-center justify-end gap-2 px-5 sm:px-7 py-4 border-t border-gray-100 dark:border-slate-800">
              {canModerate && !viewingUser.isDeleted && !editingUser && (
                <button
                  type="button"
                  onClick={() => startAccountEdit(viewingUser)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#0A4DA6]/20 bg-[#0A4DA6]/5 px-3.5 py-2 text-[10px] font-extrabold text-[#0A4DA6] hover:bg-[#0A4DA6] hover:text-white"
                >
                  Edit Details
                </button>
              )}
              {editingUser && (
                <>
                  <button type="button" onClick={() => setEditingUser(false)} disabled={savingUser} className="rounded-full bg-gray-100 px-4 py-2 text-[10px] font-bold text-gray-600 disabled:opacity-60">Cancel Edit</button>
                  <button type="submit" form="account-details-form" disabled={savingUser} className="rounded-full bg-emerald-600 px-4 py-2 text-[10px] font-extrabold text-white disabled:opacity-60">{savingUser ? "Saving..." : "Save Details"}</button>
                </>
              )}
              {canModerate && !viewingUser.isDeleted && !editingUser && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setRoleTarget(viewingUser);
                      setNewSelectedRole(viewingUser.role);
                      setRoleDocuments({ aadhaarCardUrl: "", panCardUrl: "" });
                      setViewingUser(null);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 px-3.5 py-2 text-[10px] font-extrabold text-amber-700 hover:bg-amber-50"
                  >
                    <Shield size={13} /> Change Role
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStatusTarget(viewingUser);
                      setNewSelectedStatus(
                        ["temp_suspended", "perm_suspended"].includes(viewingUser.status)
                          ? "suspended"
                          : viewingUser.status,
                      );
                      setViewingUser(null);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-full border border-cyan-200 px-3.5 py-2 text-[10px] font-extrabold text-cyan-700 hover:bg-cyan-50"
                  >
                    <RefreshCw size={13} /> Change Status
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPermTarget(viewingUser);
                      setSelectedPerms(viewingUser.permissions || []);
                      setViewingUser(null);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 px-3.5 py-2 text-[10px] font-extrabold text-blue-700 hover:bg-blue-50"
                  >
                    <Tag size={13} /> Permissions
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setResetPassTarget(viewingUser);
                      setViewingUser(null);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-full border border-purple-200 px-3.5 py-2 text-[10px] font-extrabold text-purple-700 hover:bg-purple-50"
                  >
                    <Key size={13} /> Reset Password
                  </button>
                  {viewingUser.isSuspended || ["suspended", "temp_suspended", "perm_suspended"].includes(viewingUser.status) ? (
                    <button
                      type="button"
                      onClick={async () => {
                        await handleReactivate(viewingUser);
                        setViewingUser(null);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 px-3.5 py-2 text-[10px] font-extrabold text-emerald-700 hover:bg-emerald-50"
                    >
                      <UserCheck size={13} /> Reactivate
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setSuspendTarget(viewingUser);
                        setViewingUser(null);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 px-3.5 py-2 text-[10px] font-extrabold text-amber-700 hover:bg-amber-50"
                    >
                      <UserX size={13} /> Suspend
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteTarget(viewingUser);
                      setDeleteType("soft");
                      setViewingUser(null);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 px-3.5 py-2 text-[10px] font-extrabold text-rose-700 hover:bg-rose-50"
                  >
                    <Trash2 size={13} /> Delete
                  </button>
                </>
              )}
              {canModerate && viewingUser.isDeleted && (
                <button
                  type="button"
                  onClick={async () => {
                    await handleRestore(viewingUser);
                    setViewingUser(null);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 px-3.5 py-2 text-[10px] font-extrabold text-emerald-700 hover:bg-emerald-50"
                >
                  <RotateCcw size={13} /> Restore Account
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setEditingUser(false);
                  setViewingUser(null);
                }}
                className="px-5 py-2 rounded-full bg-[#0A4DA6] hover:bg-blue-900 text-white text-[10px] font-extrabold shadow-md cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default UserManagementPage;
