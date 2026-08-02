import React, { useState, useEffect, useRef } from "react";
import {
  LayoutDashboard,
  Image as ImageIcon,
  FileText,
  FolderOpen,
  Bell,
  Clock,
  History,
  User,
  Send,
  CheckCircle,
  XCircle,
  RefreshCw,
  ExternalLink,
  ShieldAlert,
  Upload,
  Maximize2,
  Trash2,
  FileImage,
} from "lucide-react";
import api, { getErrorMessage } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { useNotifications } from "../contexts/NotificationContext";

interface ChangeRequest {
  _id: string;
  page: string;
  section: string;
  title: string;
  oldValue: any;
  newValue: any;
  status: "pending" | "approved" | "rejected" | "draft";
  reason?: string;
  createdAt: string;
  approvedBy?: { name: string; email: string };
  rejectedBy?: { name: string; email: string };
}

// Banner Dimension Presets
const BANNER_SIZE_PRESETS = [
  {
    id: "1920x600",
    label: "Desktop Hero Banner",
    width: 1920,
    height: 600,
    ratio: "16:5",
  },
  {
    id: "800x600",
    label: "Mobile Hero Banner",
    width: 800,
    height: 600,
    ratio: "4:3",
  },
  {
    id: "1200x400",
    label: "Festival Special Banner",
    width: 1200,
    height: 400,
    ratio: "3:1",
  },
  {
    id: "1000x500",
    label: "Offer Directory Banner",
    width: 1000,
    height: 500,
    ratio: "2:1",
  },
  {
    id: "600x600",
    label: "Square Marketplace Banner",
    width: 600,
    height: 600,
    ratio: "1:1",
  },
  {
    id: "custom",
    label: "Custom Specification",
    width: 1920,
    height: 600,
    ratio: "Custom",
  },
];

export const BannerBoyDashboard: React.FC = () => {
  const { user } = useAuth();
  const { addNotification } = useNotifications();

  const [activeTab, setActiveTab] = useState<
    | "dashboard"
    | "banners"
    | "homepage"
    | "media"
    | "announcements"
    | "pending"
    | "activity"
    | "profile"
  >("dashboard");

  const [myRequests, setMyRequests] = useState<ChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Editor Form State
  const [selectedSection, setSelectedSection] = useState("hero_banner");
  const [editTitle, setEditTitle] = useState("Homepage Hero Banner Upgrade");
  const [heroHeading, setHeroHeading] = useState(
    "Experience Divine Peace & Serenity at Sacred Ashrams",
  );
  const [heroSubtitle, setHeroSubtitle] = useState(
    "Book verified ashram stays, Mahakumbh 2026 packages, and Satvik dining across Haridwar, Rishikesh & Vrindavan.",
  );
  const [bannerImageUrl, setBannerImageUrl] = useState(
    "https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=1600&q=80",
  );
  const [ctaText, setCtaText] = useState("Explore Sacred Ashrams");
  const [announcementText, setAnnouncementText] = useState(
    "🎉 Special 20% OFF on Mahakumbh 2026 Bookings — Use Code KUMBH2026",
  );

  // Banner Dimension Specs State
  const [selectedPreset, setSelectedPreset] = useState("1920x600");
  const [bannerWidth, setBannerWidth] = useState(1920);
  const [bannerHeight, setBannerHeight] = useState(600);
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchMyRequests();
  }, []);

  const fetchMyRequests = async () => {
    setLoading(true);
    try {
      const res = await api.get("/cms/my-requests");
      if (res.data?.success) {
        setMyRequests(res.data.data);
      }
    } catch (err) {
      console.error("Fetch requests error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handlePresetChange = (presetId: string) => {
    setSelectedPreset(presetId);
    const found = BANNER_SIZE_PRESETS.find((p) => p.id === presetId);
    if (found && presetId !== "custom") {
      setBannerWidth(found.width);
      setBannerHeight(found.height);
    }
  };

  // Direct Computer File Upload Handler
  const handleFileUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      addNotification(
        "Invalid File Type",
        "Please upload an image file (JPG, PNG, WEBP, GIF).",
        "error",
      );
      return;
    }

    setUploadingImage(true);
    setUploadedFileName(file.name);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "banners");

      const res = await api.post("/uploads", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (res.data?.success && res.data?.data?.url) {
        const uploadedUrl = res.data.data.url;
        setBannerImageUrl(uploadedUrl);

        // Preload image to measure actual pixel dimensions
        const img = new Image();
        img.src = uploadedUrl;
        img.onload = () => {
          addNotification(
            "Banner Image Uploaded",
            `Successfully uploaded image (${img.naturalWidth} × ${img.naturalHeight} px)`,
            "success",
          );
        };
      }
    } catch (err) {
      addNotification(
        "Upload Failed",
        getErrorMessage(err, "Failed to upload image from computer."),
        "error",
      );
    } finally {
      setUploadingImage(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!bannerImageUrl) {
      addNotification(
        "Missing Image",
        "Please upload or provide a banner image URL.",
        "warning",
      );
      return;
    }

    setSubmitting(true);
    try {
      const activePreset = BANNER_SIZE_PRESETS.find(
        (p) => p.id === selectedPreset,
      );

      const payload = {
        page: "homepage",
        section: selectedSection,
        title: editTitle,
        oldValue: {
          heading: "Default Tirvona Hero",
          bannerImage: "/banner/ashram_rishikesh.png",
          bannerWidth: 1920,
          bannerHeight: 600,
        },
        newValue: {
          heading: heroHeading,
          subtitle: heroSubtitle,
          bannerImage: bannerImageUrl,
          bannerWidth: Number(bannerWidth),
          bannerHeight: Number(bannerHeight),
          bannerSizePreset: activePreset?.label || "Custom Specification",
          aspectRatio: `${bannerWidth}:${bannerHeight}`,
          ctaText,
          announcement: announcementText,
          updatedAt: new Date().toISOString(),
        },
      };

      const res = await api.post("/cms/request-change", payload);
      if (res.data?.success) {
        addNotification(
          "Change Submitted for Approval",
          `Banner edit (${bannerWidth}×${bannerHeight} px) submitted for Owner review.`,
          "info",
        );
        fetchMyRequests();
        setActiveTab("activity");
      }
    } catch (err: any) {
      if (err?.response?.status === 401) {
        addNotification(
          "Session Expired (401)",
          "Your authentication session has expired. Please sign out and log in again with your assigned account.",
          "error",
        );
      } else {
        addNotification(
          "Submission Failed",
          getErrorMessage(err, "Could not submit change request."),
          "error",
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRequest = async (id: string) => {
    try {
      const res = await api.delete(`/cms/request/${id}`);
      if (res.data?.success) {
        addNotification(
          "Deleted & Reverted",
          "Request removed. Reverted to default system image & text.",
          "info",
        );
        fetchMyRequests();
      }
    } catch (err) {
      addNotification(
        "Delete Failed",
        getErrorMessage(err, "Could not delete request."),
        "error",
      );
    }
  };

  const pendingCount = myRequests.filter((r) => r.status === "pending").length;
  const approvedCount = myRequests.filter(
    (r) => r.status === "approved",
  ).length;
  const rejectedCount = myRequests.filter(
    (r) => r.status === "rejected",
  ).length;

  return (
    <div className="space-y-6">
      {/* ── Sub-navigation Tab Bar ── */}
      <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 p-2 rounded-2xl flex flex-wrap gap-2 text-xs font-bold shadow-sm">
        <button
          onClick={() => setActiveTab("dashboard")}
          className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === "dashboard"
              ? "bg-[#0A4DA6] text-white shadow-sm"
              : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800"
          }`}
        >
          <LayoutDashboard size={14} /> Overview
        </button>
        <button
          onClick={() => setActiveTab("banners")}
          className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === "banners"
              ? "bg-[#0A4DA6] text-white shadow-sm"
              : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800"
          }`}
        >
          <ImageIcon size={14} /> Banner Management
        </button>
        <button
          onClick={() => setActiveTab("homepage")}
          className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === "homepage"
              ? "bg-[#0A4DA6] text-white shadow-sm"
              : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800"
          }`}
        >
          <FileText size={14} /> Homepage CMS
        </button>
        <button
          onClick={() => setActiveTab("media")}
          className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === "media"
              ? "bg-[#0A4DA6] text-white shadow-sm"
              : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800"
          }`}
        >
          <FolderOpen size={14} /> Media Library
        </button>
        <button
          onClick={() => setActiveTab("announcements")}
          className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === "announcements"
              ? "bg-[#0A4DA6] text-white shadow-sm"
              : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800"
          }`}
        >
          <Bell size={14} /> Announcements
        </button>
        <button
          onClick={() => setActiveTab("pending")}
          className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === "pending"
              ? "bg-[#0A4DA6] text-white shadow-sm"
              : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800"
          }`}
        >
          <Clock size={14} /> Pending Approvals ({pendingCount})
        </button>
        <button
          onClick={() => setActiveTab("activity")}
          className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === "activity"
              ? "bg-[#0A4DA6] text-white shadow-sm"
              : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800"
          }`}
        >
          <History size={14} /> My Activity
        </button>
        <button
          onClick={() => setActiveTab("profile")}
          className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === "profile"
              ? "bg-[#0A4DA6] text-white shadow-sm"
              : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800"
          }`}
        >
          <User size={14} /> CMS Profile
        </button>
      </div>

      {/* ── Top Welcome Card ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 p-6 rounded-[24px] shadow-sm">
        <div>
          <h1 className="font-black text-xl text-[#0B192C] dark:text-white flex items-center gap-2">
            Welcome, {user?.name || "BannerBoy"} 👋
          </h1>
          <p className="text-xs text-gray-500 font-medium mt-0.5">
            Enterprise CMS Portal — Upload banners, set pixel dimensions, and
            manage homepage media.
          </p>
        </div>
        <a
          href="/"
          target="_blank"
          rel="noreferrer"
          className="px-4 py-2 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-200 rounded-full text-xs font-bold flex items-center gap-1.5 hover:bg-gray-200 cursor-pointer"
        >
          Preview Live Website <ExternalLink size={14} />
        </a>
      </div>

      {/* ── Tab: Overview ── */}
      {activeTab === "dashboard" && (
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
            <div className="p-5 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] shadow-lg shadow-gray-200/40 dark:shadow-none hover:shadow-xl transition-all space-y-1">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">
                Total Submissions
              </span>
              <h3 className="text-2xl font-black text-[#0B192C] dark:text-white mt-1">
                {myRequests.length} Submissions
              </h3>
            </div>
            <div className="p-5 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] shadow-lg shadow-gray-200/40 dark:shadow-none hover:shadow-xl transition-all space-y-1">
              <span className="text-[10px] font-black text-amber-500 uppercase tracking-wider block">
                Pending Approvals
              </span>
              <h3 className="text-2xl font-black text-amber-600 mt-1">
                {pendingCount} Pending
              </h3>
            </div>
            <div className="p-5 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] shadow-lg shadow-gray-200/40 dark:shadow-none hover:shadow-xl transition-all space-y-1">
              <span className="text-[10px] font-black text-emerald-500 uppercase tracking-wider block">
                Approved & Live
              </span>
              <h3 className="text-2xl font-black text-emerald-600 mt-1">
                {approvedCount} Published
              </h3>
            </div>
            <div className="p-5 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] shadow-lg shadow-gray-200/40 dark:shadow-none hover:shadow-xl transition-all space-y-1">
              <span className="text-[10px] font-black text-rose-500 uppercase tracking-wider block">
                Rejected Changes
              </span>
              <h3 className="text-2xl font-black text-rose-600 mt-1">
                {rejectedCount} Rejected
              </h3>
            </div>
          </div>

          {/* Quick Editor Form with Direct File Upload & Size Specifications */}
          <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 p-6 rounded-[24px] shadow-sm space-y-6">
            <div className="flex justify-between items-center border-b border-gray-100 dark:border-slate-800 pb-4">
              <div>
                <h3 className="font-extrabold text-base text-[#0B192C] dark:text-white">
                  Banner Upload & CMS Specification Studio
                </h3>
                <p className="text-xs text-gray-400">
                  Upload banner files directly from your device and set target
                  pixel dimensions.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmitRequest} className="space-y-6 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-bold text-gray-700 dark:text-gray-300">
                    Target Page Section *
                  </label>
                  <select
                    value={selectedSection}
                    onChange={(e) => setSelectedSection(e.target.value)}
                    className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl focus:outline-none font-bold"
                  >
                    <option value="hero_banner">Homepage Hero Banner</option>
                    <option value="slider">Homepage Slider</option>
                    <option value="festival_banner">
                      Festival Special Banner
                    </option>
                    <option value="offer_banner">Offer Directory Banner</option>
                    <option value="announcement">Top Bar Announcement</option>
                    <option value="footer_text">Footer & Social Info</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-gray-700 dark:text-gray-300">
                    Request Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              {/* ── Banner Dimension & Pixel Specifications Section ── */}
              <div className="p-5 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-4">
                <div className="flex justify-between items-center">
                  <span className="font-extrabold text-xs text-[#0B192C] dark:text-white flex items-center gap-2">
                    <Maximize2 size={16} className="text-[#0A4DA6]" /> Banner
                    Size & Aspect Ratio Specifications
                  </span>
                  <span className="text-[10px] font-mono font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-900">
                    Target: {bannerWidth} × {bannerHeight} px
                  </span>
                </div>

                {/* Preset Options */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {BANNER_SIZE_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handlePresetChange(preset.id)}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        selectedPreset === preset.id
                          ? "bg-[#0A4DA6] text-white border-[#0A4DA6] shadow-sm"
                          : "bg-white dark:bg-slate-950 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-slate-800 hover:border-[#0A4DA6]"
                      }`}
                    >
                      <span className="font-extrabold text-[11px] block truncate">
                        {preset.label}
                      </span>
                      <span className="text-[10px] opacity-80 font-mono block mt-0.5">
                        {preset.width} × {preset.height} px ({preset.ratio})
                      </span>
                    </button>
                  ))}
                </div>

                {/* Custom Width x Height Input */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div className="space-y-1">
                    <label className="font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1">
                      Target Width (px)
                    </label>
                    <input
                      type="number"
                      value={bannerWidth}
                      onChange={(e) => {
                        setSelectedPreset("custom");
                        setBannerWidth(Number(e.target.value));
                      }}
                      className="w-full p-2.5 bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl focus:outline-none font-mono font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1">
                      Target Height (px)
                    </label>
                    <input
                      type="number"
                      value={bannerHeight}
                      onChange={(e) => {
                        setSelectedPreset("custom");
                        setBannerHeight(Number(e.target.value));
                      }}
                      className="w-full p-2.5 bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl focus:outline-none font-mono font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* ── Direct Image File Upload & Dropzone Section ── */}
              <div className="space-y-2">
                <label className="font-bold text-gray-700 dark:text-gray-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Upload size={16} className="text-[#0A4DA6]" /> Upload
                    Banner Image File
                  </span>
                  <span className="text-[10px] text-gray-400 font-normal">
                    Supports JPG, PNG, WEBP, GIF (Max 10MB)
                  </span>
                </label>

                {/* Hidden File Input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileUpload(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                />

                {/* Drag and Drop Box */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragOver(true);
                  }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`p-8 border-2 border-dashed rounded-2xl text-center cursor-pointer transition-all ${
                    isDragOver
                      ? "border-[#0A4DA6] bg-[#0A4DA6]/10 scale-[0.99]"
                      : "border-gray-300 dark:border-slate-800 hover:border-[#0A4DA6] bg-gray-50/50 dark:bg-slate-900/40"
                  }`}
                >
                  {uploadingImage ? (
                    <div className="py-4 space-y-2 flex flex-col items-center">
                      <RefreshCw
                        size={28}
                        className="animate-spin text-[#0A4DA6]"
                      />
                      <span className="font-extrabold text-xs text-[#0A4DA6]">
                        Uploading banner file to server...
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-3 flex flex-col items-center">
                      <div className="w-12 h-12 rounded-full bg-[#0A4DA6]/10 text-[#0A4DA6] flex items-center justify-center">
                        <Upload size={22} />
                      </div>
                      <div className="space-y-1">
                        <p className="font-extrabold text-xs text-[#0B192C] dark:text-white">
                          Click to browse file from your computer or drag & drop
                          here
                        </p>
                        <p className="text-[11px] text-gray-400">
                          Recommended format: JPG/WEBP optimized for{" "}
                          {bannerWidth} × {bannerHeight} px
                        </p>
                      </div>
                      <button
                        type="button"
                        className="px-4 py-2 bg-[#0A4DA6] text-white rounded-full text-xs font-bold shadow-sm pointer-events-none"
                      >
                        Choose Computer File
                      </button>
                    </div>
                  )}
                </div>

                {/* Live Image Preview Card */}
                {bannerImageUrl && (
                  <div className="p-4 bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-2xl flex flex-col sm:flex-row items-center gap-4 shadow-sm mt-3">
                    <div className="w-full sm:w-48 h-28 rounded-xl overflow-hidden bg-gray-100 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 relative flex-shrink-0">
                      <img
                        src={bannerImageUrl}
                        alt="Banner Preview"
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/70 text-white rounded text-[9px] font-mono">
                        {bannerWidth}×{bannerHeight}
                      </span>
                    </div>

                    <div className="flex-1 space-y-1.5 text-xs min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-xs text-[#0B192C] dark:text-white truncate">
                          {uploadedFileName || "Selected Banner Image"}
                        </span>
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[9px] font-black uppercase">
                          Ready for Submission
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-400 font-mono truncate">
                        {bannerImageUrl}
                      </p>
                      <div className="flex items-center gap-3 text-[11px] text-gray-500 pt-1">
                        <span>
                          Preset:{" "}
                          <strong>
                            {
                              BANNER_SIZE_PRESETS.find(
                                (p) => p.id === selectedPreset,
                              )?.label
                            }
                          </strong>
                        </span>
                        <span>•</span>
                        <span>
                          Dimensions:{" "}
                          <strong>
                            {bannerWidth} × {bannerHeight} px
                          </strong>
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setBannerImageUrl("");
                        setUploadedFileName("");
                      }}
                      className="p-2 text-rose-500 hover:bg-rose-50 rounded-full transition-colors cursor-pointer"
                      title="Remove Image"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>

              {/* Text Fields */}
              <div className="space-y-1">
                <label className="font-bold text-gray-700 dark:text-gray-300">
                  Hero Heading
                </label>
                <input
                  type="text"
                  value={heroHeading}
                  onChange={(e) => setHeroHeading(e.target.value)}
                  className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-gray-700 dark:text-gray-300">
                  Hero Subtitle
                </label>
                <textarea
                  rows={2}
                  value={heroSubtitle}
                  onChange={(e) => setHeroSubtitle(e.target.value)}
                  className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-bold text-gray-700 dark:text-gray-300">
                    CTA Button Text
                  </label>
                  <input
                    type="text"
                    value={ctaText}
                    onChange={(e) => setCtaText(e.target.value)}
                    className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-gray-700 dark:text-gray-300">
                    Top Bar Announcement
                  </label>
                  <input
                    type="text"
                    value={announcementText}
                    onChange={(e) => setAnnouncementText(e.target.value)}
                    className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={submitting || uploadingImage}
                  className="px-6 py-3 bg-[#0A4DA6] hover:bg-blue-700 text-white rounded-full font-black text-xs shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Send size={14} /> Submit Change Request for Owner Review
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Tab: Banner Management / Homepage CMS / Announcements ── */}
      {(activeTab === "banners" ||
        activeTab === "homepage" ||
        activeTab === "announcements" ||
        activeTab === "media") && (
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 p-6 rounded-[24px] shadow-sm space-y-5">
          <div className="flex justify-between items-center border-b border-gray-100 dark:border-slate-800 pb-4">
            <div>
              <h3 className="font-extrabold text-base text-[#0B192C] dark:text-white capitalize">
                {activeTab.replace("_", " ")} Studio
              </h3>
              <p className="text-xs text-gray-400">
                Propose new banners, image media, text, and promo announcements.
              </p>
            </div>
          </div>

          <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 rounded-2xl text-xs space-y-2">
            <span className="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
              <ShieldAlert size={16} /> Content Change Workflow Active
            </span>
            <p className="text-gray-600 dark:text-gray-300">
              Any changes submitted from this section are saved as{" "}
              <strong>Pending Approval</strong> and forwarded to the Ashram
              Owner console. Once approved by the Owner, changes instantly
              publish to the live site.
            </p>
          </div>

          <button
            onClick={() => setActiveTab("dashboard")}
            className="px-5 py-2.5 bg-[#0A4DA6] text-white rounded-full text-xs font-bold cursor-pointer"
          >
            Open Editor in Overview Tab
          </button>
        </div>
      )}

      {/* ── Tab: Pending & Activity History ── */}
      {(activeTab === "pending" || activeTab === "activity") && (
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 p-6 rounded-[24px] shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-gray-100 dark:border-slate-800 pb-4">
            <div>
              <h3 className="font-extrabold text-base text-[#0B192C] dark:text-white flex items-center gap-2">
                <History size={18} className="text-[#0A4DA6]" />
                {activeTab === "pending"
                  ? "Pending Change Approvals"
                  : "My Submission Activity History"}
              </h3>
              <p className="text-xs text-gray-400">
                Track real-time status of your proposed homepage & banner edits.
              </p>
            </div>
            <button
              onClick={fetchMyRequests}
              className="p-2 text-gray-400 hover:text-[#0A4DA6] rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
              title="Refresh"
            >
              <RefreshCw size={16} />
            </button>
          </div>

          {loading ? (
            <div className="py-12 text-center text-xs text-gray-400 font-bold">
              Loading submission history...
            </div>
          ) : myRequests.length === 0 ? (
            <div className="py-12 text-center text-xs text-gray-400">
              No submission requests found.
            </div>
          ) : (
            <div className="space-y-3">
              {myRequests
                .filter((r) =>
                  activeTab === "pending" ? r.status === "pending" : true,
                )
                .map((req) => (
                  <div
                    key={req._id}
                    className="p-4 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm text-[#0B192C] dark:text-white">
                          {req.title}
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-gray-200 dark:bg-slate-800 font-bold">
                          {req.section}
                        </span>
                      </div>
                      <p className="text-gray-500 font-mono text-[11px]">
                        Submitted: {new Date(req.createdAt).toLocaleString()}
                      </p>
                      {req.reason && (
                        <p className="text-rose-600 dark:text-rose-400 text-[11px] font-bold">
                          Owner Rejection Note: "{req.reason}"
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      {req.status === "pending" && (
                        <span className="px-3 py-1.5 bg-amber-100 text-amber-800 rounded-full font-bold text-[11px] flex items-center gap-1">
                          <Clock size={12} /> Pending Owner Review
                        </span>
                      )}
                      {req.status === "approved" && (
                        <span className="px-3 py-1.5 bg-emerald-100 text-emerald-800 rounded-full font-bold text-[11px] flex items-center gap-1">
                          <CheckCircle size={12} /> Approved & Published
                        </span>
                      )}
                      {req.status === "rejected" && (
                        <span className="px-3 py-1.5 bg-rose-100 text-rose-800 rounded-full font-bold text-[11px] flex items-center gap-1">
                          <XCircle size={12} /> Rejected by Owner
                        </span>
                      )}

                      <button
                        onClick={() => handleDeleteRequest(req._id)}
                        className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-full transition-colors cursor-pointer"
                        title="Delete & Revert to System Default"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Profile ── */}
      {activeTab === "profile" && (
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 p-6 rounded-[24px] shadow-sm space-y-4 max-w-md">
          <h3 className="font-extrabold text-base text-[#0B192C] dark:text-white">
            BannerBoy CMS Profile
          </h3>
          <div className="space-y-2 text-xs">
            <div>
              <span className="text-gray-400 block font-bold">Name:</span>
              <span className="font-extrabold text-sm">{user?.name}</span>
            </div>
            <div>
              <span className="text-gray-400 block font-bold">Email:</span>
              <span className="font-mono text-sm">{user?.email}</span>
            </div>
            <div>
              <span className="text-gray-400 block font-bold">Role:</span>
              <span className="font-bold text-amber-500 uppercase">
                {user?.role}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BannerBoyDashboard;
