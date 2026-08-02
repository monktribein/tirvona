import React, { useState, useEffect } from "react";
import api from "../lib/api";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  UserPlus,
  Key,
  ShieldAlert,
  Search,
  Mail,
  Phone,
  CheckCircle,
  XCircle,
  RefreshCw,
  Eye,
  EyeOff,
  Sparkles,
  X,
  Lock,
  User,
  Shield,
  Copy,
} from "lucide-react";

export const OwnerUsersPage: React.FC = () => {
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const [copiedUserId, setCopiedUserId] = useState<string | null>(null);
  const [showPasswords, setShowPasswords] = useState<{
    [key: string]: boolean;
  }>({});

  const togglePasswordVisibility = (userId: string) => {
    setShowPasswords((prev) => ({ ...prev, [userId]: !prev[userId] }));
  };

  const handleCopyCredentials = (email: string, userId: string) => {
    const text = `User ID / Email: ${email}`;
    navigator.clipboard.writeText(text);
    setCopiedUserId(userId);
    setTimeout(() => setCopiedUserId(null), 2000);
  };

  // Add User Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    role: "manager",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createMsg, setCreateMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Password Reset Modal State
  const [showResetModal, setShowResetModal] = useState(false);
  const [targetUser, setTargetUser] = useState<any>(null);
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMsg, setResetMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    fetchStaff();
  }, []);

  const fetchStaff = async () => {
    setLoading(true);
    try {
      const res = await api.get("/auth/owner-staff");
      if (res.data.success) {
        setStaff(res.data.data);
      }
    } catch (err: any) {
      console.error("Fetch staff error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);
    setCreateMsg(null);
    try {
      const res = await api.post("/auth/owner-staff", formData);
      if (res.data.success) {
        setCreateMsg({
          type: "success",
          text: "Staff account created successfully!",
        });
        setFormData({
          name: "",
          email: "",
          phone: "",
          password: "",
          role: "manager",
        });
        fetchStaff();
        setTimeout(() => {
          setShowAddModal(false);
          setCreateMsg(null);
        }, 1200);
      }
    } catch (err: any) {
      setCreateMsg({
        type: "error",
        text: err.response?.data?.message || "Failed to create staff account.",
      });
    } finally {
      setCreateLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUser) return;
    setResetLoading(true);
    setResetMsg(null);
    try {
      const res = await api.put(
        `/auth/owner-staff/${targetUser._id}/password`,
        {
          password: newPassword,
        },
      );
      if (res.data.success) {
        setResetMsg({
          type: "success",
          text: `Password reset successfully for ${targetUser.name}!`,
        });
        setNewPassword("");
        setTimeout(() => {
          setShowResetModal(false);
          setResetMsg(null);
          setTargetUser(null);
        }, 1200);
      }
    } catch (err: any) {
      setResetMsg({
        type: "error",
        text: err.response?.data?.message || "Failed to reset password.",
      });
    } finally {
      setResetLoading(false);
    }
  };

  const handleToggleStatus = async (userId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === "active" ? "suspended" : "active";
      const res = await api.put(`/auth/owner-staff/${userId}/status`, {
        status: newStatus,
      });
      if (res.data.success) {
        fetchStaff();
      }
    } catch (err: any) {
      console.error("Toggle status error:", err);
    }
  };

  const generateRandomPassword = (setter: (val: string) => void) => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#$";
    let pwd = "";
    for (let i = 0; i < 10; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setter(pwd);
  };

  const filteredStaff = staff.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.phone.includes(searchQuery);
    const matchesRole = roleFilter === "all" || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "owner":
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20 flex items-center gap-1 w-fit">
            <Shield size={12} /> Ashram Admin
          </span>
        );
      case "manager":
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-600 border border-blue-500/20 flex items-center gap-1 w-fit">
            <User size={12} /> Manager
          </span>
        );
      case "reception":
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 flex items-center gap-1 w-fit">
            <CheckCircle size={12} /> Receptionist
          </span>
        );
      case "housekeeping":
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-500/10 text-slate-600 border border-slate-500/20 flex items-center gap-1 w-fit">
            <RefreshCw size={12} /> Housekeeping
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-700 capitalize">
            {role}
          </span>
        );
    }
  };

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#0B192C] via-[#0A4DA6] to-[#0B192C] rounded-[28px] p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-amber-300 text-xs font-bold backdrop-blur-md">
            <Users size={14} /> User & Staff Administration
          </div>
          <h1 className="text-2xl sm:text-3xl font-black">
            Ashram Users & Admin Credentials
          </h1>
          <p className="text-xs sm:text-sm text-gray-200 max-w-2xl font-medium">
            Create, manage, and assign login IDs and passwords for your Ashram
            Managers, Receptionists, Housekeeping staff, and Co-Admins.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="bg-[#E58C28] hover:bg-[#d47d1f] text-white font-extrabold text-xs sm:text-sm px-6 py-3.5 rounded-full flex items-center justify-center gap-2 shadow-lg shadow-black/20 transition-all cursor-pointer shrink-0 active:scale-95"
        >
          <UserPlus size={16} />
          <span>Add New Staff / Admin</span>
        </button>
      </div>

      {/* Stats Overview Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 p-5 rounded-2xl shadow-sm space-y-2">
          <span className="text-xs font-extrabold uppercase tracking-wider text-gray-400">
            Total Staff
          </span>
          <div className="text-2xl font-black text-[#0B192C] dark:text-white">
            {staff.length}
          </div>
        </div>
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 p-5 rounded-2xl shadow-sm space-y-2">
          <span className="text-xs font-extrabold uppercase tracking-wider text-gray-400">
            Ashram Admins
          </span>
          <div className="text-2xl font-black text-amber-600">
            {staff.filter((s) => s.role === "owner").length}
          </div>
        </div>
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 p-5 rounded-2xl shadow-sm space-y-2">
          <span className="text-xs font-extrabold uppercase tracking-wider text-gray-400">
            Managers & Desk
          </span>
          <div className="text-2xl font-black text-[#0A4DA6]">
            {
              staff.filter((s) => ["manager", "reception"].includes(s.role))
                .length
            }
          </div>
        </div>
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 p-5 rounded-2xl shadow-sm space-y-2">
          <span className="text-xs font-extrabold uppercase tracking-wider text-gray-400">
            Active Accounts
          </span>
          <div className="text-2xl font-black text-emerald-600">
            {staff.filter((s) => s.status === "active").length}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 p-4 rounded-2xl shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search size={15} className="absolute left-3.5 top-3 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, email, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]"
          />
        </div>

        {/* Role Filter Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto">
          {[
            { id: "all", label: "All Users" },
            { id: "owner", label: "Admins" },
            { id: "manager", label: "Managers" },
            { id: "reception", label: "Reception" },
            { id: "housekeeping", label: "Housekeeping" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setRoleFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                roleFilter === tab.id
                  ? "bg-[#0A4DA6] text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Staff Users Table */}
      <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-xs font-bold text-gray-400">
            Loading staff accounts...
          </div>
        ) : filteredStaff.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Users size={32} className="mx-auto text-gray-300" />
            <p className="text-sm font-extrabold text-gray-500">
              No staff members found
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50 text-[10px] font-black uppercase tracking-wider text-gray-400">
                  <th className="py-4 px-6">User Name</th>
                  <th className="py-4 px-6">Login Email / Phone</th>
                  <th className="py-4 px-6">Password / Credentials</th>
                  <th className="py-4 px-6">Assigned Role</th>
                  <th className="py-4 px-6">Account Status</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800 text-xs font-semibold text-[#0B192C] dark:text-gray-200">
                {filteredStaff.map((u) => (
                  <tr
                    key={u._id}
                    className="hover:bg-gray-50/60 dark:hover:bg-slate-900/60 transition-colors"
                  >
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-[#0A4DA6]/10 text-[#0A4DA6] border border-[#0A4DA6]/20 flex items-center justify-center font-black text-xs shrink-0">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-extrabold text-sm text-[#0B192C] dark:text-white">
                            {u.name}
                          </div>
                          <div className="text-[10px] text-gray-400">
                            ID: {u._id.slice(-6)}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6 space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-[#0A4DA6] dark:text-amber-400">
                        <Mail size={13} />
                        <span className="font-mono text-xs">{u.email}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-gray-400 text-[11px]">
                        <Phone size={12} />
                        <span>{u.phone}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <div className="bg-gray-100 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 px-2.5 py-1 rounded-xl text-xs font-mono font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                          <Lock size={12} className="text-amber-500" />
                          <span>
                            {showPasswords[u._id] ? "Protected" : "••••••••"}
                          </span>
                          <button
                            onClick={() => togglePasswordVisibility(u._id)}
                            className="text-gray-400 hover:text-gray-600 ml-1 p-0.5 cursor-pointer"
                            title="Toggle Show/Hide Password"
                          >
                            {showPasswords[u._id] ? (
                              <EyeOff size={12} />
                            ) : (
                              <Eye size={12} />
                            )}
                          </button>
                        </div>

                        <button
                          onClick={() => handleCopyCredentials(u.email, u._id)}
                          className="px-2.5 py-1 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-[#0A4DA6] dark:text-amber-400 hover:bg-blue-100 transition-all cursor-pointer flex items-center gap-1 text-[10px] font-bold"
                          title="Copy Login Credentials"
                        >
                          <Copy size={12} />
                          {copiedUserId === u._id ? (
                            <span className="text-emerald-600 font-black">
                              Copied!
                            </span>
                          ) : (
                            <span>Copy</span>
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="py-4 px-6">{getRoleBadge(u.role)}</td>
                    <td className="py-4 px-6">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-extrabold capitalize ${
                          u.status === "active"
                            ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                            : "bg-rose-500/10 text-rose-600 border border-rose-500/20"
                        }`}
                      >
                        {u.status}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Change / Reset Password Button */}
                        <button
                          onClick={() => {
                            setTargetUser(u);
                            setShowResetModal(true);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 border border-amber-500/20 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                          title="Reset Password"
                        >
                          <Key size={13} />
                          <span>Reset Password</span>
                        </button>

                        {/* Toggle Status Button */}
                        <button
                          onClick={() => handleToggleStatus(u._id, u.status)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                            u.status === "active"
                              ? "bg-gray-100 hover:bg-gray-200 text-gray-600 border-gray-200"
                              : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 border-emerald-500/20"
                          }`}
                        >
                          {u.status === "active" ? "Suspend" : "Activate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ══════════════════════ MODAL 1: ADD NEW STAFF / ADMIN ══════════════════════ */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowAddModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-lg bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl z-10 space-y-6"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-[#0A4DA6]/10 text-[#0A4DA6] flex items-center justify-center font-bold">
                    <UserPlus size={18} />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-[#0B192C] dark:text-white">
                      Create Staff Account / Admin
                    </h3>
                    <p className="text-xs text-gray-400">
                      Assign login ID and password for ashram staff.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-gray-400 hover:text-gray-600 p-1 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Message Banner */}
              {createMsg && (
                <div
                  className={`p-3 rounded-2xl text-xs font-bold flex items-center gap-2 ${
                    createMsg.type === "success"
                      ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                      : "bg-rose-500/10 text-rose-600 border border-rose-500/20"
                  }`}
                >
                  {createMsg.type === "success" ? (
                    <CheckCircle size={14} />
                  ) : (
                    <XCircle size={14} />
                  )}
                  <span>{createMsg.text}</span>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleCreateStaff} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rajesh Kumar"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">
                      Login Email / Username
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. manager@ashram.com"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                      className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">
                      Phone Number
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="+91 98765 43210"
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData({ ...formData, phone: e.target.value })
                      }
                      className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[10px] font-black uppercase text-gray-400">
                      Login Password
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        generateRandomPassword((val) =>
                          setFormData({ ...formData, password: val }),
                        )
                      }
                      className="text-[10px] font-extrabold text-[#0A4DA6] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles size={11} /> Auto Generate
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      placeholder="Enter password..."
                      value={formData.password}
                      onChange={(e) =>
                        setFormData({ ...formData, password: e.target.value })
                      }
                      className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl pl-4 pr-10 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">
                    Assigned Role
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) =>
                      setFormData({ ...formData, role: e.target.value })
                    }
                    className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0A4DA6] cursor-pointer"
                  >
                    <option value="manager">👔 Ashram Manager</option>
                    <option value="reception">
                      🛎️ Front Desk / Receptionist
                    </option>
                    <option value="housekeeping">🧹 Housekeeping Staff</option>
                    <option value="owner">🛡️ Ashram Admin / Co-Owner</option>
                  </select>
                </div>

                <div className="pt-2 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-extrabold rounded-2xl text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createLoading}
                    className="flex-1 py-3 bg-[#0A4DA6] hover:bg-[#083b80] text-white font-extrabold rounded-2xl text-xs shadow-md shadow-[#0A4DA6]/20 cursor-pointer flex items-center justify-center gap-2"
                  >
                    {createLoading
                      ? "Creating Account..."
                      : "Create Staff Account"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ══════════════════════ MODAL 2: RESET PASSWORD ══════════════════════ */}
      <AnimatePresence>
        {showResetModal && targetUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowResetModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-md bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl z-10 space-y-5"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
                    <Key size={18} />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-[#0B192C] dark:text-white">
                      Reset Password
                    </h3>
                    <p className="text-xs text-gray-400">
                      User: {targetUser.name} ({targetUser.email})
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowResetModal(false)}
                  className="text-gray-400 hover:text-gray-600 p-1 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Message */}
              {resetMsg && (
                <div
                  className={`p-3 rounded-2xl text-xs font-bold flex items-center gap-2 ${
                    resetMsg.type === "success"
                      ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                      : "bg-rose-500/10 text-rose-600 border border-rose-500/20"
                  }`}
                >
                  {resetMsg.type === "success" ? (
                    <CheckCircle size={14} />
                  ) : (
                    <XCircle size={14} />
                  )}
                  <span>{resetMsg.text}</span>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[10px] font-black uppercase text-gray-400">
                      New Password
                    </label>
                    <button
                      type="button"
                      onClick={() => generateRandomPassword(setNewPassword)}
                      className="text-[10px] font-extrabold text-[#0A4DA6] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles size={11} /> Auto Generate
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showNewPassword ? "text" : "password"}
                      required
                      placeholder="Enter new password..."
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl pl-4 pr-10 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                    >
                      {showNewPassword ? (
                        <EyeOff size={14} />
                      ) : (
                        <Eye size={14} />
                      )}
                    </button>
                  </div>
                </div>

                <div className="pt-2 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowResetModal(false)}
                    className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-extrabold rounded-2xl text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-white font-extrabold rounded-2xl text-xs shadow-md shadow-amber-500/20 cursor-pointer flex items-center justify-center gap-2"
                  >
                    {resetLoading ? "Updating..." : "Update Password"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default OwnerUsersPage;
