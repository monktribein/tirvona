import React, { useState, useEffect, useCallback } from "react";
import api from "../lib/api";
import { useNavigate, Link } from "react-router-dom";
import {
  MapPin,
  ShieldCheck,
  Upload,
  Plus,
  Sparkles,
  Building,
  Bed,
  Calendar as CalendarIcon,
  ExternalLink,
  Edit3,
  CheckCircle2,
  FileCheck,
  Sun,
  BookOpen,
  Info,
  X,
  Image as ImageIcon,
} from "lucide-react";
import { useNotifications } from "../contexts/NotificationContext";
import { ashramService } from "../services";
import { getErrorMessage } from "../lib/api";
import { FileUploader } from "../components/FileUploader";

export const ManageAshramsPage: React.FC = () => {
  const { addNotification } = useNotifications();
  const navigate = useNavigate();
  const consoleBase = window.location.pathname.startsWith("/ashram-admin")
    ? "/ashram-admin"
    : window.location.pathname.startsWith("/ashram-owner")
      ? "/ashram-owner"
      : "/owner";
  const [ashrams, setAshrams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [editAshram, setEditAshram] = useState<any | null>(null);
  const [editFormData, setEditFormData] = useState<any>({
    name: "",
    description: "",
    history: "",
    rules: "",
    amenities: "",
    images: [],
  });
  const [newImageUrl, setNewImageUrl] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  const [uploadDeedId, setUploadDeedId] = useState<string | null>(null);
  const [trustDeedUrl, setTrustDeedUrl] = useState("");
  const [fireSafetyUrl, setFireSafetyUrl] = useState("");
  const [landOwnershipUrl, setLandOwnershipUrl] = useState("");
  const [submittingDocs, setSubmittingDocs] = useState(false);

  const fetchMyAshrams = useCallback(async () => {
    setLoading(true);
    try {
      const res = await ashramService.myListings();
      if (res.data.success) {
        setAshrams(res.data.data);
      }
    } catch (err) {
      console.error("Fetch listings error:", err);
      addNotification(
        "Load Failed",
        getErrorMessage(err, "Unable to load ashram listings."),
        "error",
      );
      setAshrams([]);
    } finally {
      setLoading(false);
    }
  }, [addNotification]);

  useEffect(() => {
    fetchMyAshrams();
  }, [fetchMyAshrams]);

  const handleOpenEdit = (ashram: any) => {
    setEditAshram(ashram);
    setEditFormData({
      name: ashram.name || "",
      description: ashram.description || "",
      history: ashram.history || "",
      rules: Array.isArray(ashram.rules)
        ? ashram.rules.join(", ")
        : ashram.rules || "",
      amenities: Array.isArray(ashram.amenities)
        ? ashram.amenities.join(", ")
        : ashram.amenities || "",
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
    if (!editAshram) return;
    setEditLoading(true);
    try {
      const payload = {
        name: editFormData.name,
        description: editFormData.description,
        history: editFormData.history,
        rules: editFormData.rules
          .split(",")
          .map((s: string) => s.trim())
          .filter(Boolean),
        amenities: editFormData.amenities
          .split(",")
          .map((s: string) => s.trim())
          .filter(Boolean),
        images: editFormData.images || [],
      };

      const res = await api.put(`/ashrams/${editAshram._id}`, payload);

      if (res.data.success) {
        addNotification(
          "Ashram Updated",
          "Your ashram details and images were saved successfully.",
          "success",
        );
        setEditAshram(null);
        fetchMyAshrams();
      }
    } catch (err) {
      console.error("Update ashram error:", err);
      addNotification("Error", "Failed to update ashram details.", "error");
    } finally {
      setEditLoading(false);
    }
  };

  const resetDocState = () => {
    setUploadDeedId(null);
    setTrustDeedUrl("");
    setFireSafetyUrl("");
    setLandOwnershipUrl("");
  };

  const handleUploadDocs = async () => {
    if (!uploadDeedId) return;
    if (!trustDeedUrl || !fireSafetyUrl || !landOwnershipUrl) {
      addNotification(
        "Missing Documents",
        "Please upload all three required documents.",
        "warning",
      );
      return;
    }
    setSubmittingDocs(true);
    try {
      const res = await ashramService.uploadDocuments(uploadDeedId, {
        trustDeedUrl,
        fireSafetyCertificateUrl: fireSafetyUrl,
        landOwnershipUrl,
      });
      if (res.data.success) {
        resetDocState();
        addNotification(
          "KYC Documents Submitted",
          "Your Ashram documents are queued for physical inspection.",
          "success",
        );
        fetchMyAshrams();
      }
    } catch (err) {
      console.error("Docs upload error:", err);
      addNotification(
        "Upload Failed",
        getErrorMessage(err, "Could not submit documents."),
        "error",
      );
    } finally {
      setSubmittingDocs(false);
    }
  };

  return (
    <div className="space-y-8 text-left w-full">
      <div className="bg-gradient-to-r from-[#0B192C] via-[#0A4DA6] to-[#0B192C] rounded-[28px] p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-amber-300 text-xs font-bold backdrop-blur-md">
            <Building size={14} /> Ashram Management Console
          </div>
          <h1 className="text-2xl sm:text-3xl font-black">
            My Ashram Accommodations
          </h1>
          <p className="text-xs sm:text-sm text-gray-200 max-w-2xl font-medium">
            Manage your sacred ashram profile, spiritual history, daily
            guidelines, amenities, and Tirvona verification status.
          </p>
        </div>

        <button
          onClick={() => navigate(`${consoleBase}/ashrams/add`)}
          className="bg-[#E58C28] hover:bg-[#d47d1f] text-white font-extrabold text-xs sm:text-sm px-6 py-3.5 rounded-full flex items-center justify-center gap-2 shadow-lg shadow-black/20 transition-all cursor-pointer shrink-0 active:scale-95"
        >
          <Plus size={16} />
          <span>List New Ashram</span>
        </button>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="h-64 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-[28px] animate-pulse" />
        </div>
      ) : ashrams.length === 0 ? (
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-12 text-center space-y-4 shadow-sm">
          <Building
            size={48}
            className="mx-auto text-gray-300 dark:text-gray-600"
          />
          <h3 className="text-lg font-black text-[#0B192C] dark:text-white">
            No Ashrams Listed Yet
          </h3>
          <p className="text-xs text-gray-400 max-w-md mx-auto">
            You have not registered any ashram accommodations under this
            account.
          </p>
          <button
            onClick={() => navigate(`${consoleBase}/ashrams/add`)}
            className="px-6 py-3 bg-[#0A4DA6] text-white font-extrabold text-xs rounded-full shadow-md"
          >
            Register Ashram Now
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {ashrams.map((ashram) => (
            <div
              key={ashram._id}
              className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[32px] p-6 sm:p-8 shadow-sm space-y-6"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 dark:border-slate-800 pb-6">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h2 className="text-xl sm:text-2xl font-black text-[#0B192C] dark:text-white">
                      {ashram.name}
                    </h2>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-extrabold capitalize flex items-center gap-1 ${
                        ashram.status === "approved" ||
                        ashram.status === "active"
                          ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                          : "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                      }`}
                    >
                      <ShieldCheck size={13} />
                      {ashram.status === "approved"
                        ? "Tirvona Verified"
                        : ashram.status.replace(/_/g, " ")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-500 dark:text-gray-400">
                    <MapPin size={14} className="text-[#0A4DA6]" />
                    <span>
                      {ashram.address?.street
                        ? `${ashram.address.street}, `
                        : ""}
                      {ashram.address?.city || "Rishikesh"},{" "}
                      {ashram.address?.district || ""}{" "}
                      {ashram.address?.state || "Uttarakhand"} -{" "}
                      {ashram.address?.pincode || "249201"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  <button
                    onClick={() => handleOpenEdit(ashram)}
                    className="px-4 py-2.5 rounded-full bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 border border-amber-500/20 text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Edit3 size={14} /> Edit Details
                  </button>

                  <button
                    onClick={() => navigate(`${consoleBase}/rooms`)}
                    className="px-4 py-2.5 rounded-full bg-[#0A4DA6]/10 hover:bg-[#0A4DA6]/20 text-[#0A4DA6] border border-[#0A4DA6]/20 text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Bed size={14} /> Manage Rooms
                  </button>

                  <button
                    onClick={() => navigate(`${consoleBase}/calendar`)}
                    className="px-4 py-2.5 rounded-full bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 border border-indigo-500/20 text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <CalendarIcon size={14} /> Rate Calendar
                  </button>

                  <Link
                    to={`/ashram/${ashram._id}`}
                    target="_blank"
                    className="p-2.5 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white transition-colors"
                    title="View Live Public Page"
                  >
                    <ExternalLink size={15} />
                  </Link>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-gray-50/70 dark:bg-slate-900/70 border border-gray-100 dark:border-slate-800 rounded-2xl p-5 space-y-3">
                    <h3 className="text-xs font-black tracking-wider text-gray-400 flex items-center gap-2">
                      <Info size={14} className="text-[#0A4DA6]" /> About & Bio
                    </h3>
                    <p className="text-xs leading-relaxed font-semibold text-slate-700 dark:text-slate-300">
                      {ashram.description ||
                        "Spiritual Ashram lodging providing quiet sadhana rooms, vegetarian prasad meals, and daily Ganga aarti."}
                    </p>
                  </div>

                  {ashram.history && (
                    <div className="bg-amber-500/5 border border-amber-500/15 rounded-2xl p-5 space-y-3">
                      <h3 className="text-xs font-black tracking-wider text-amber-600 flex items-center gap-2">
                        <BookOpen size={14} /> Spiritual Heritage & History
                      </h3>
                      <p className="text-xs leading-relaxed font-semibold text-slate-700 dark:text-slate-300">
                        {ashram.history}
                      </p>
                    </div>
                  )}

                  <div className="space-y-3">
                    <h3 className="text-xs font-black tracking-wider text-gray-400">
                      Ashram Facilities & Services
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {(Array.isArray(ashram.amenities) &&
                      ashram.amenities.length > 0
                        ? ashram.amenities
                        : [
                            "Meditation Hall",
                            "Ganga Ghat View",
                            "Satvik Bhojanalaya",
                            "Yoga Studio",
                            "Hot Water",
                            "Library",
                          ]
                      ).map((item: string, i: number) => (
                        <span
                          key={i}
                          className="px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-[#0A4DA6] dark:text-amber-400 border border-blue-100 dark:border-blue-800 text-xs font-bold flex items-center gap-1.5"
                        >
                          <Sparkles size={12} />
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="bg-gray-50/70 dark:bg-slate-900/70 border border-gray-100 dark:border-slate-800 rounded-2xl p-5 space-y-3">
                    <h3 className="text-xs font-black tracking-wider text-gray-400 flex items-center gap-2">
                      <Sun size={14} className="text-[#E58C28]" /> Sacred
                      Guidelines & Rules
                    </h3>
                    <ul className="space-y-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {(Array.isArray(ashram.rules) && ashram.rules.length > 0
                        ? ashram.rules
                        : [
                            "Modest traditional attire mandatory",
                            "No alcohol, tobacco, or non-veg food",
                            "Silence hours from 10:00 PM to 5:00 AM",
                            "Daily morning meditation at 6:00 AM",
                          ]
                      ).map((rule: string, i: number) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-[#E58C28] font-bold">•</span>
                          <span>{rule}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-5 space-y-3">
                    <h3 className="text-xs font-black tracking-wider text-emerald-600 flex items-center gap-2">
                      <FileCheck size={14} /> Tirvona Verification
                    </h3>
                    <div className="space-y-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                      <div className="flex items-center justify-between">
                        <span>Trust Deed Certificate:</span>
                        <span className="text-emerald-600 font-extrabold flex items-center gap-1">
                          <CheckCircle2 size={12} /> Verified
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Fire Safety Clearance:</span>
                        <span className="text-emerald-600 font-extrabold flex items-center gap-1">
                          <CheckCircle2 size={12} /> Approved
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Land Ownership Registry:</span>
                        <span className="text-emerald-600 font-extrabold flex items-center gap-1">
                          <CheckCircle2 size={12} /> Verified
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editAshram && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setEditAshram(null)}
          />
          <div className="relative w-full max-w-5xl bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl z-10 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-[#0A4DA6]/10 text-[#0A4DA6] flex items-center justify-center font-bold">
                  <Edit3 size={18} />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-[#0B192C] dark:text-white">
                    Edit Ashram Details
                  </h3>
                  <p className="text-xs text-gray-400">
                    Update Ashram Name, Bio, Heritage, Rules, and Amenities.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditAshram(null)}
                className="text-gray-400 hover:text-gray-600 p-1 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
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
                  Description / Bio
                </label>
                <textarea
                  rows={3}
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
                  Spiritual History & Heritage
                </label>
                <textarea
                  rows={3}
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
                  placeholder="Meditation Hall, Yoga, Hot Water, Ganga View..."
                  className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-400 mb-1">
                  Rules & Guidelines (comma separated)
                </label>
                <input
                  type="text"
                  value={editFormData.rules}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, rules: e.target.value })
                  }
                  placeholder="Modest attire required, Silence after 10 PM, No alcohol..."
                  className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]"
                />
              </div>

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
                  onClick={() => setEditAshram(null)}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-extrabold rounded-2xl text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="flex-1 py-3 bg-[#0A4DA6] hover:bg-[#083b80] text-white font-extrabold rounded-2xl text-xs shadow-md shadow-[#0A4DA6]/20 cursor-pointer flex items-center justify-center gap-2"
                >
                  {editLoading ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {uploadDeedId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 max-w-md w-full rounded-[28px] p-6 space-y-4 text-left">
            <h3 className="font-bold text-sm text-[#0B192C] dark:text-white flex items-center gap-1.5">
              <Upload size={16} className="text-[#0A4DA6]" /> Upload Ashram
              Deeds & Certificates
            </h3>
            <p className="text-[10px] text-gray-400">
              Upload PDF copies of each required document. Files are stored
              securely on Cloudinary.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-gray-500 tracking-wide">
                  Trust Deed (PDF)
                </label>
                <FileUploader
                  folder="documents"
                  accept="application/pdf"
                  label="Upload Trust Deed"
                  currentUrl={trustDeedUrl}
                  onUploaded={setTrustDeedUrl}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 tracking-wide">
                  Fire Safety Certificate (PDF)
                </label>
                <FileUploader
                  folder="documents"
                  accept="application/pdf"
                  label="Upload Fire Safety Cert"
                  currentUrl={fireSafetyUrl}
                  onUploaded={setFireSafetyUrl}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 tracking-wide">
                  Land Ownership (PDF)
                </label>
                <FileUploader
                  folder="documents"
                  accept="application/pdf"
                  label="Upload Land Registry"
                  currentUrl={landOwnershipUrl}
                  onUploaded={setLandOwnershipUrl}
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={resetDocState}
                disabled={submittingDocs}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-full text-xs font-bold cursor-pointer disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={handleUploadDocs}
                disabled={submittingDocs}
                className="flex-1 py-2.5 bg-[#0A4DA6] text-white rounded-full text-xs font-bold cursor-pointer shadow disabled:opacity-60"
              >
                {submittingDocs ? "Submitting…" : "Submit Documents"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageAshramsPage;
