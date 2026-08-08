import React, { useState, useEffect } from "react";
import api from "../lib/api";
import { useNavigate, Link } from "react-router-dom";
import {
  Building,
  MapPin,
  ShieldCheck,
  Search,
  Edit3,
  Bed,
  ExternalLink,
  CheckCircle2,
  Users,
  Sparkles,
  Sun,
  X,
  Check,
  Plus,
  Image as ImageIcon,
} from "lucide-react";
import { useNotifications } from "../contexts/NotificationContext";
import FileUploader from "../components/FileUploader";

export const AllAshramsPage: React.FC = () => {
  const { addNotification } = useNotifications();
  const navigate = useNavigate();

  const [ashrams, setAshrams] = useState<any[]>([]);
  const [ownerUsers, setOwnerUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCity, setSelectedCity] = useState("All");

  // Edit Modal State
  const [selectedAshram, setSelectedAshram] = useState<any | null>(null);
  const [editFormData, setEditFormData] = useState<any>({
    name: "",
    description: "",
    history: "",
    street: "",
    city: "",
    district: "",
    state: "",
    pincode: "",
    status: "approved",
    ownerId: "",
    amenities: "",
    rules: "",
    images: [],
  });
  const [newImageUrl, setNewImageUrl] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch all ashrams (Master Owner / Super Admin gets all)
      const ashramRes = await api.get("/ashrams/my-listings/all");
      if (ashramRes.data.success) {
        setAshrams(ashramRes.data.data);
      }

      // Fetch all staff / owner users for reassignment dropdown
      const usersRes = await api.get("/auth/owner-staff");
      if (usersRes.data.success) {
        setOwnerUsers(
          usersRes.data.data.filter((u: any) => u.role === "owner"),
        );
      }
    } catch (err) {
      console.error("Fetch all ashrams error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEditModal = (ashram: any) => {
    setSelectedAshram(ashram);
    setEditFormData({
      name: ashram.name || "",
      description: ashram.description || "",
      history: ashram.history || "",
      street: ashram.address?.street || "",
      city: ashram.address?.city || "",
      district: ashram.address?.district || "",
      state: ashram.address?.state || "Uttarakhand",
      pincode: ashram.address?.pincode || "",
      status: ashram.status || "approved",
      ownerId: ashram.ownerId?._id || ashram.ownerId || "",
      amenities: Array.isArray(ashram.amenities)
        ? ashram.amenities.join(", ")
        : ashram.amenities || "",
      rules: Array.isArray(ashram.rules)
        ? ashram.rules.join(", ")
        : ashram.rules || "",
      images: Array.isArray(ashram.images) ? [...ashram.images] : [],
    });
    setNewImageUrl("");
  };

  const handleAddImage = (urlToAdd?: string) => {
    const url = urlToAdd || newImageUrl.trim();
    if (!url) return;
    setEditFormData((prev: any) => ({
      ...prev,
      images: [...(prev.images || []), url],
    }));
    if (!urlToAdd) setNewImageUrl("");
  };

  const handleRemoveImage = (indexToRemove: number) => {
    setEditFormData((prev: any) => ({
      ...prev,
      images: (prev.images || []).filter(
        (_: any, idx: number) => idx !== indexToRemove,
      ),
    }));
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAshram) return;

    setSubmitLoading(true);
    try {
      const payload = {
        name: editFormData.name,
        description: editFormData.description,
        history: editFormData.history,
        address: {
          street: editFormData.street,
          city: editFormData.city,
          district: editFormData.district || editFormData.city,
          state: editFormData.state,
          pincode: editFormData.pincode,
        },
        status: editFormData.status,
        ownerId: editFormData.ownerId,
        amenities: editFormData.amenities
          .split(",")
          .map((s: string) => s.trim())
          .filter(Boolean),
        rules: editFormData.rules
          .split(",")
          .map((s: string) => s.trim())
          .filter(Boolean),
        images: editFormData.images || [],
      };

      const res = await api.put(`/ashrams/${selectedAshram._id}`, payload);

      if (res.data.success) {
        addNotification(
          "Ashram Saved Successfully!",
          "Ashram details and assigned owner updated live.",
          "success",
        );
        setSelectedAshram(null);
        fetchData();
      }
    } catch (err) {
      console.error("Update ashram error:", err);
      addNotification("Error", "Failed to update ashram details.", "error");
    } finally {
      setSubmitLoading(false);
    }
  };

  // Dynamic city filter options from fetched ashrams
  const cities = React.useMemo(() => {
    const set = new Set<string>();
    ashrams.forEach((a) => {
      const city = a.address?.city || a.address?.district;
      if (city) set.add(city);
    });
    return ["All", ...Array.from(set)];
  }, [ashrams]);
  const filteredAshrams = ashrams.filter((a) => {
    const matchesSearch =
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.address?.city?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.address?.state?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCity =
      selectedCity === "All" ||
      a.address?.city?.toLowerCase() === selectedCity.toLowerCase();

    return matchesSearch && matchesCity;
  });

  return (
    <div className="space-y-8">
      {/* Clean Text Header */}
      <div className="text-center space-y-2.5 max-w-3xl mx-auto py-2">
        <p className="font-['Kalam'] text-2xl sm:text-4xl lg:text-5xl font-bold text-[#E58C28]">
          Registered Ashrams &amp; Dharamshalas
        </p>
        {/* Decorative Saffron Underline Divider */}
        <div className="flex items-center justify-center gap-2.5 my-1.5">
          <div className="h-[1.5px] w-12 sm:w-24 bg-[#E58C28] rounded-full" />
          <Sparkles
            size={14}
            className="text-[#E58C28] fill-[#E58C28] shrink-0"
          />
          <div className="h-[1.5px] w-12 sm:w-24 bg-[#E58C28] rounded-full" />
        </div>
        <p className="text-xs sm:text-sm font-bold text-[#0B192C] dark:text-gray-200 max-w-xl mx-auto leading-relaxed">
          Inspect, manage, and edit details for all {ashrams.length} registered
          ashram accommodations across India.
        </p>
      </div>

      {/* Stats Summary Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-1">
          <div className="text-xs font-bold text-gray-400 tracking-wider">
            Total Ashrams
          </div>
          <div className="text-2xl font-black text-[#0B192C] dark:text-white">
            {ashrams.length}
          </div>
        </div>

        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-1">
          <div className="text-xs font-bold text-gray-400 tracking-wider">
            Government Verified
          </div>
          <div className="text-2xl font-black text-emerald-600 flex items-center gap-1.5">
            <span>
              {
                ashrams.filter(
                  (a) => a.status === "approved" || a.status === "active",
                ).length
              }
            </span>
            <ShieldCheck size={18} />
          </div>
        </div>

        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-1">
          <div className="text-xs font-bold text-gray-400 tracking-wider">
            Pilgrimage Cities
          </div>
          <div className="text-2xl font-black text-[#0A4DA6] dark:text-amber-400">
            5
          </div>
        </div>

        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-1">
          <div className="text-xs font-bold text-gray-400 tracking-wider">
            Assigned Owner Accounts
          </div>
          <div className="text-2xl font-black text-amber-500">
            {ownerUsers.length}
          </div>
        </div>
      </div>

      {/* Search & City Filter Bar */}
      <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* City Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {cities.map((c) => (
            <button
              key={c}
              onClick={() => setSelectedCity(c)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-extrabold whitespace-nowrap transition-all cursor-pointer ${
                selectedCity === c
                  ? "bg-[#0A4DA6] text-white shadow-sm"
                  : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search
            size={14}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder="Search ashram name or location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-full pl-9 pr-4 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]"
          />
        </div>
      </div>

      {/* Ashrams Directory Cards */}
      {loading ? (
        <div className="space-y-4">
          <div className="h-64 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl animate-pulse" />
        </div>
      ) : filteredAshrams.length === 0 ? (
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-3xl p-12 text-center space-y-4 shadow-sm">
          <Building
            size={48}
            className="mx-auto text-gray-300 dark:text-gray-600"
          />
          <h3 className="text-lg font-black text-[#0B192C] dark:text-white">
            No Ashrams Found
          </h3>
          <p className="text-xs text-gray-400">
            Try adjusting your city filter or search term.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredAshrams.map((ashram) => {
            const assignedOwner = ownerUsers.find(
              (u) => u._id === (ashram.ownerId?._id || ashram.ownerId),
            );

            return (
              <div
                key={ashram._id}
                className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[32px] p-6 shadow-sm flex flex-col justify-between space-y-5"
              >
                <div className="space-y-4">
                  {/* Title & Status */}
                  <div className="flex items-start justify-between gap-3 border-b border-gray-100 dark:border-slate-850 pb-4">
                    <div>
                      <h3 className="font-extrabold text-lg text-[#0B192C] dark:text-white">
                        {ashram.name}
                      </h3>
                      <div className="flex items-center gap-1.5 text-xs font-bold text-gray-500 dark:text-gray-400 mt-1">
                        <MapPin size={13} className="text-[#0A4DA6]" />
                        <span>
                          {ashram.address?.street
                            ? `${ashram.address.street}, `
                            : ""}
                          {ashram.address?.city || "Rishikesh"},{" "}
                          {ashram.address?.state || "Uttarakhand"}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`px-3 py-1 rounded-full text-xs font-extrabold capitalize shrink-0 flex items-center gap-1 ${
                        ashram.status === "approved" ||
                        ashram.status === "active"
                          ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                          : "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                      }`}
                    >
                      <ShieldCheck size={13} />
                      {ashram.status === "approved"
                        ? "Verified"
                        : ashram.status.replace(/_/g, " ")}
                    </span>
                  </div>

                  {/* Assigned Owner User Info */}
                  <div className="bg-blue-50/60 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/40 rounded-2xl p-3 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <Users
                        size={14}
                        className="text-[#0A4DA6] dark:text-amber-400"
                      />
                      <span className="font-bold text-gray-700 dark:text-gray-300">
                        Assigned Owner:
                      </span>
                    </div>
                    <span className="font-mono font-bold text-[#0A4DA6] dark:text-amber-400">
                      {assignedOwner?.email ||
                        ashram.ownerId?.email ||
                        "sapt@tirvona.com"}
                    </span>
                  </div>

                  {/* Description Snippet */}
                  <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-2 leading-relaxed font-semibold">
                    {ashram.description ||
                      "Spiritual Ashram lodging & accommodation."}
                  </p>

                  {/* Amenities */}
                  <div className="flex flex-wrap gap-1.5">
                    {(Array.isArray(ashram.amenities) &&
                    ashram.amenities.length > 0
                      ? ashram.amenities.slice(0, 4)
                      : ["Meditation Hall", "Satvik Meals", "Ganga Ghat"]
                    ).map((item: string, i: number) => (
                      <span
                        key={i}
                        className="px-2.5 py-0.5 rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 text-[10px] font-bold"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-4 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  <button
                    onClick={() => handleOpenEditModal(ashram)}
                    className="px-4 py-2 rounded-full bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 border border-amber-500/20 text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Edit3 size={13} /> View & Edit Ashram
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => navigate("/owner/rooms")}
                      className="p-2 rounded-full bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 text-gray-700 dark:text-gray-300 cursor-pointer"
                      title="Manage Rooms"
                    >
                      <Bed size={14} />
                    </button>

                    <Link
                      to={`/ashram/${ashram._id}`}
                      target="_blank"
                      className="p-2 rounded-full bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 text-gray-700 dark:text-gray-300 cursor-pointer"
                      title="View Public Page"
                    >
                      <ExternalLink size={14} />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ══════════════════════ MASTER EDIT ASHRAM MODAL ══════════════════════ */}
      {selectedAshram && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setSelectedAshram(null)}
          />
          <div className="relative w-full max-w-3xl bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl z-10 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-[#0A4DA6]/10 text-[#0A4DA6] flex items-center justify-center font-bold">
                  <Edit3 size={18} />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-[#0B192C] dark:text-white">
                    Master Edit: {selectedAshram.name}
                  </h3>
                  <p className="text-xs text-gray-400">
                    Update Ashram profile, address, assigned owner, and
                    verification status.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedAshram(null)}
                className="text-gray-400 hover:text-gray-600 p-1 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 mb-1">
                    Ashram Name
                  </label>
                  <input
                    type="text"
                    required
                    value={editFormData.name}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, name: e.target.value })
                    }
                    className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-gray-400 mb-1">
                    Reassign Owner Account
                  </label>
                  <select
                    value={editFormData.ownerId}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        ownerId: e.target.value,
                      })
                    }
                    className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]"
                  >
                    {ownerUsers.map((u) => (
                      <option key={u._id} value={u._id}>
                        {u.name} ({u.email})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-400 mb-1">
                  Description / Bio
                </label>
                <textarea
                  rows={2}
                  value={editFormData.description}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      description: e.target.value,
                    })
                  }
                  className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-400 mb-1">
                  Spiritual Heritage & History
                </label>
                <textarea
                  rows={2}
                  value={editFormData.history}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      history: e.target.value,
                    })
                  }
                  className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]"
                />
              </div>

              {/* Address Fields */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 mb-1">
                    Street Address
                  </label>
                  <input
                    type="text"
                    value={editFormData.street}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        street: e.target.value,
                      })
                    }
                    className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    required
                    value={editFormData.city}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, city: e.target.value })
                    }
                    className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 mb-1">
                    State
                  </label>
                  <input
                    type="text"
                    required
                    value={editFormData.state}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        state: e.target.value,
                      })
                    }
                    className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 mb-1">
                    Pincode
                  </label>
                  <input
                    type="text"
                    required
                    value={editFormData.pincode}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        pincode: e.target.value,
                      })
                    }
                    className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 mb-1">
                    Facilities & Amenities (comma separated)
                  </label>
                  <input
                    type="text"
                    value={editFormData.amenities}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        amenities: e.target.value,
                      })
                    }
                    className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-gray-400 mb-1">
                    Government Verification Status
                  </label>
                  <select
                    value={editFormData.status}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        status: e.target.value,
                      })
                    }
                    className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs font-bold text-emerald-600 focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]"
                  >
                    <option value="approved">Approved & Verified</option>
                    <option value="pending_inspection">
                      Pending Inspection
                    </option>
                    <option value="pending_docs">Pending Documents</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
              </div>

              {/* ════════════ Image Gallery Manager ════════════ */}
              <div className="bg-gray-50/80 dark:bg-slate-900/80 border border-gray-100 dark:border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black text-gray-400 flex items-center gap-1.5">
                    <ImageIcon size={14} className="text-[#0A4DA6]" /> Ashram
                    Photo Gallery ({editFormData.images?.length || 0} Photos)
                  </label>
                  <span className="text-[10px] text-gray-400 font-bold">
                    Click 🗑️ to remove any image
                  </span>
                </div>

                {/* Thumbnails Grid */}
                {editFormData.images && editFormData.images.length > 0 ? (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                    {editFormData.images.map((imgUrl: string, idx: number) => (
                      <div
                        key={idx}
                        className="relative group aspect-video rounded-xl overflow-hidden border border-gray-200 dark:border-slate-800 bg-black"
                      >
                        <img
                          src={imgUrl}
                          alt={`Ashram photo ${idx + 1}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(idx)}
                          className="absolute top-1 right-1 p-1 bg-rose-600/90 text-white rounded-full opacity-90 hover:opacity-100 hover:bg-rose-700 transition-all shadow cursor-pointer"
                          title="Remove this photo"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic">
                    No photos added yet. Paste a photo URL below to add to
                    gallery.
                  </p>
                )}

                {/* Direct Upload from Device & URL Input */}
                <div className="space-y-2 pt-1">
                  <FileUploader
                    folder="ashrams"
                    accept="image/*"
                    label="📁 Choose Image File from Device / System"
                    onUploaded={(url) => handleAddImage(url)}
                  />

                  <div className="flex items-center gap-2">
                    <input
                      type="url"
                      placeholder="Or paste image URL (e.g. https://... or /banner/...)"
                      value={newImageUrl}
                      onChange={(e) => setNewImageUrl(e.target.value)}
                      className="flex-1 bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddImage()}
                      className="px-3.5 py-2 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 text-gray-700 dark:text-gray-300 text-xs font-bold rounded-xl flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <Plus size={14} /> Add URL
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-3 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedAshram(null)}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-extrabold rounded-2xl text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitLoading}
                  className="flex-1 py-3 bg-[#0A4DA6] hover:bg-[#083b80] text-white font-extrabold rounded-2xl text-xs shadow-md shadow-[#0A4DA6]/20 cursor-pointer flex items-center justify-center gap-2"
                >
                  {submitLoading ? "Saving Edits..." : "Save All Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AllAshramsPage;
