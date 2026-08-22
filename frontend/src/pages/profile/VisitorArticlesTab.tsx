import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  FileText,
  ImagePlus,
  Pencil,
  Video,
  Plus,
  CheckCircle2,
  Clock,
  XCircle,
  MapPin,
  Sparkles,
  Eye,
  Heart,
  Loader2,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import { EnterpriseModal } from "../../admin/shared";
import {
  visitorArticleService,
  type EligibleBooking,
  type VisitorArticle,
} from "../../services/visitorArticleService";
import { uploadService } from "../../services";
import { ImageUploadGrid } from "../../components/shared/ImageUploadGrid";
import { useNotifications } from "../../contexts/NotificationContext";
import { getErrorMessage } from "../../lib/api";

const CATEGORIES = [
  "Experience",
  "Travel Guide",
  "Temple History",
  "Food",
  "Festivals",
  "Photography",
  "Videos",
];

const LANGUAGES = [
  "English",
  "Hindi",
  "Sanskrit",
  "Bengali",
  "Tamil",
  "Telugu",
  "Marathi",
  "Gujarati",
];

export const VisitorArticlesTab: React.FC = () => {
  const { addNotification } = useNotifications();

  const [activeSubTab, setActiveSubTab] = useState<
    "all" | "draft" | "pending" | "approved" | "rejected"
  >("all");
  const [articles, setArticles] = useState<VisitorArticle[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({
    draft: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    total: 0,
  });
  const [loading, setLoading] = useState(true);

  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [eligibleBookings, setEligibleBookings] = useState<EligibleBooking[]>(
    [],
  );
  const [loadingEligible, setLoadingEligible] = useState(false);
  const [selectedBooking, setSelectedBooking] =
    useState<EligibleBooking | null>(null);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Experience");
  const [shortDescription, setShortDescription] = useState("");
  const [content, setContent] = useState("");
  const [featuredImage, setFeaturedImage] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tagsStr, setTagsStr] = useState("Rishikesh, AshramStay, SatvikLiving");
  const [language, setLanguage] = useState("English");
  const [submitting, setSubmitting] = useState(false);

  const fetchMyArticles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await visitorArticleService.getMyArticles(
        activeSubTab === "all" ? undefined : activeSubTab,
      );
      if (res.data.success) {
        setArticles(res.data.data);
        setCounts(res.data.counts || {});
      }
    } catch (err) {
      console.error("Error loading articles:", err);
    } finally {
      setLoading(false);
    }
  }, [activeSubTab]);

  useEffect(() => {
    fetchMyArticles();
  }, [fetchMyArticles]);

  const handleOpenWizard = async () => {
    setIsWizardOpen(true);
    setStep(1);
    setSelectedBooking(null);
    setLoadingEligible(true);

    try {
      const res = await visitorArticleService.getEligibleBookings();
      if (res.data.success) {
        setEligibleBookings(res.data.data);
      }
    } catch (err) {
      addNotification(
        "Error",
        getErrorMessage(err, "Failed to fetch completed bookings."),
        "error",
      );
    } finally {
      setLoadingEligible(false);
    }
  };

  const MAX_COVER_BYTES = 10 * 1024 * 1024;
  const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

  const handleCoverUpload = async (file: File) => {
    if (file.size > MAX_COVER_BYTES) {
      addNotification(
        "Photo Too Large",
        `That photo is ${(file.size / 1024 / 1024).toFixed(1)} MB. Choose one under 10 MB.`,
        "warning",
      );
      return;
    }
    setUploadingCover(true);
    try {
      const url = await uploadService.file(file, "visitor-articles");
      setFeaturedImage(url);
    } catch (err) {
      addNotification(
        "Upload Failed",
        getErrorMessage(err, "Could not upload that photo."),
        "error",
      );
    } finally {
      setUploadingCover(false);
      if (coverInputRef.current) coverInputRef.current.value = "";
    }
  };

  const handleVideoUpload = async (file: File) => {
    if (file.size > MAX_VIDEO_BYTES) {
      addNotification(
        "Video Too Large",
        `That video is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 100 MB.`,
        "warning",
      );
      return;
    }
    setUploadingVideo(true);
    try {
      const url = await uploadService.file(file, "visitor-articles");
      setVideoUrl(url);
    } catch (err) {
      addNotification(
        "Upload Failed",
        getErrorMessage(err, "Could not upload that video."),
        "error",
      );
    } finally {
      setUploadingVideo(false);
      if (videoInputRef.current) videoInputRef.current.value = "";
    }
  };

  const handleSelectBooking = (booking: EligibleBooking) => {
    if (booking.hasSubmittedArticle) {
      addNotification(
        "Notice",
        "You have already submitted an article for this completed stay.",
        "info",
      );
      return;
    }
    setSelectedBooking(booking);
    setStep(2);
  };

  const handleSubmitArticle = async (asDraft = false) => {
    if (!selectedBooking) return;
    if (!title.trim() || !shortDescription.trim() || !content.trim()) {
      addNotification(
        "Missing Information",
        "Please fill in Title, Description, and Content.",
        "error",
      );
      return;
    }
    if (uploadingCover || uploadingVideo) {
      addNotification(
        "Upload In Progress",
        "Wait for the upload to finish before submitting.",
        "warning",
      );
      return;
    }

    setSubmitting(true);
    try {
      const tags = tagsStr
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const payload = {
        title: title.trim(),
        category,
        shortDescription: shortDescription.trim(),
        content: content.trim(),
        featuredImage: featuredImage.trim(),
        videoUrl: videoUrl.trim(),
        galleryImages,
        tags,
        language,
        status: (asDraft ? "draft" : "pending") as "draft" | "pending",
      };

      const res = editingId
        ? await visitorArticleService.updateArticle(editingId, payload)
        : await visitorArticleService.createArticle({
            bookingId: selectedBooking._id,
            ...payload,
          });

      if (res.data.success) {
        addNotification("Success", res.data.message, "success");
        setIsWizardOpen(false);
        resetForm();
        fetchMyArticles();
      }
    } catch (err) {
      addNotification(
        "Submission Error",
        getErrorMessage(err, "Could not save article."),
        "error",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setTitle("");
    setCategory("Experience");
    setShortDescription("");
    setContent("");
    setFeaturedImage("");
    setVideoUrl("");
    setGalleryImages([]);
    setSelectedBooking(null);
    setEditingId(null);
    setStep(1);
  };

  const openEditor = (article: VisitorArticle) => {
    setEditingId(article._id);
    setTitle(article.title || "");
    setCategory(article.category || "Experience");
    setShortDescription(article.shortDescription || "");
    setContent(article.content || "");
    setFeaturedImage(article.featuredImage || "");
    setVideoUrl(article.videoUrl || "");
    setGalleryImages(article.galleryImages || []);
    setTagsStr((article.tags || []).join(", "));
    setLanguage(article.language || "English");
    setSelectedBooking({
      ...(article.bookingId as any),
      ashram: (article.bookingId as any)?.ashram ?? article.ashramId,
    } as any);
    setStep(2);
    setIsWizardOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-black text-[#0B192C] dark:text-white flex items-center gap-2">
            <BookOpen className="text-[#0A4DA6]" size={22} />
            <span>My Articles & Blogs</span>
          </h2>
          <p className="text-xs text-gray-400 font-medium">
            Share your verified ashram stay experience with the spiritual yatri
            community.
          </p>
        </div>

        <button
          onClick={handleOpenWizard}
          className="px-5 py-2.5 bg-[#0A4DA6] hover:bg-[#083D85] text-white rounded-full text-xs font-black transition-all cursor-pointer shadow-md flex items-center gap-2 shrink-0"
        >
          <Plus size={16} />
          <span>Write New Article</span>
        </button>
      </div>

      <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-2xl p-2 shadow-md flex items-center gap-1.5 overflow-x-auto text-xs font-extrabold scrollbar-none">
        {(["all", "draft", "pending", "approved", "rejected"] as const).map(
          (st) => {
            const isActive = activeSubTab === st;
            const count = st === "all" ? counts.total || 0 : counts[st] || 0;
            return (
              <button
                key={st}
                onClick={() => setActiveSubTab(st)}
                className={`px-4 py-2 rounded-xl capitalize transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  isActive
                    ? "bg-[#0A4DA6] text-white shadow-sm"
                    : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800"
                }`}
              >
                <span>{st}</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] ${isActive ? "bg-white/20 text-white" : "bg-gray-100 dark:bg-slate-800 text-gray-500"}`}
                >
                  {count}
                </span>
              </button>
            );
          },
        )}
      </div>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-32 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-2xl animate-pulse"
            />
          ))}
        </div>
      ) : articles.length === 0 ? (
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-10 text-center space-y-3 shadow-md">
          <FileText
            size={36}
            className="text-gray-300 dark:text-slate-700 mx-auto"
          />
          <h3 className="font-extrabold text-sm text-[#0B192C] dark:text-white">
            No articles found in {activeSubTab}
          </h3>
          <p className="text-xs text-gray-400 max-w-sm mx-auto font-medium">
            After completing an Ashram stay, write an article to share your
            experience with fellow yatris!
          </p>
          <button
            onClick={handleOpenWizard}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0A4DA6] hover:bg-[#083D85] text-white rounded-full text-xs font-black transition-all shadow-md mt-2 cursor-pointer"
          >
            <Plus size={14} /> Write First Article
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {articles.map((art) => (
            <div
              key={art._id}
              className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-2xl p-5 shadow-md flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center"
            >
              <div className="flex items-start gap-4 min-w-0">
                <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0 bg-gray-100 dark:bg-slate-800 flex items-center justify-center">
                  {art.featuredImage ? (
                    <img
                      src={art.featuredImage}
                      alt={art.title}
                      className="w-full h-full object-cover"
                    />
                  ) : art.videoUrl ? (
                    <Video size={20} className="text-gray-400" />
                  ) : (
                    <FileText size={20} className="text-gray-300 dark:text-slate-700" />
                  )}
                </div>

                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 bg-blue-50 text-[#0A4DA6] dark:bg-blue-950/40 dark:text-blue-300 rounded-full text-[10px] font-black">
                      {art.category}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-black flex items-center gap-1 ${
                        art.status === "approved"
                          ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
                          : art.status === "pending"
                            ? "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400"
                            : art.status === "rejected"
                              ? "bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400"
                              : "bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-gray-300"
                      }`}
                    >
                      {art.status === "approved" && <CheckCircle2 size={11} />}
                      {art.status === "pending" && <Clock size={11} />}
                      {art.status === "rejected" && <XCircle size={11} />}
                      <span className="capitalize">
                        {art.status === "approved"
                          ? "Published"
                          : art.status === "pending"
                            ? "Pending Owner Approval"
                            : art.status}
                      </span>
                    </span>
                  </div>

                  <h3 className="font-extrabold text-sm sm:text-base text-[#0B192C] dark:text-white line-clamp-1">
                    {art.title}
                  </h3>

                  <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 font-medium">
                    {art.shortDescription}
                  </p>

                  <p className="text-[10px] text-gray-400 font-semibold flex items-center gap-3 pt-1">
                    <span className="flex items-center gap-1">
                      <MapPin size={11} className="text-[#E58C28]" />{" "}
                      {art.ashramId?.name || "Ashram Stay"}
                    </span>
                    <span>
                      •{" "}
                      {new Date(art.createdAt).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </p>

                  {art.status === "rejected" && art.rejectionReason && (
                    <div className="mt-2 p-2 bg-rose-50 dark:bg-rose-950/30 text-rose-600 rounded-lg text-[11px] font-semibold border border-rose-100 dark:border-rose-900">
                      <strong>Rejection Reason:</strong> {art.rejectionReason}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center w-full sm:w-auto gap-3 shrink-0 pt-3 sm:pt-0 border-t sm:border-t-0 border-gray-100 dark:border-slate-800">
                <div className="flex items-center gap-3 text-xs font-bold text-gray-400">
                  <span className="flex items-center gap-1">
                    <Eye size={13} className="text-emerald-500" />{" "}
                    {art.viewsCount || 0}
                  </span>
                  <span className="flex items-center gap-1">
                    <Heart size={13} className="text-rose-500" />{" "}
                    {art.likesCount || 0}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openEditor(art)}
                    className="px-4 py-1.5 bg-[#EBF2FA] hover:bg-[#dbe8f7] dark:bg-blue-950/40 text-[#0A4DA6] dark:text-blue-300 text-xs font-black rounded-full transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Pencil size={12} /> Edit
                  </button>

                  {art.status === "approved" && (
                    <a
                      href={`/blog/${art.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-4 py-1.5 bg-[#0A4DA6] hover:bg-[#083D85] text-white text-xs font-black rounded-full transition-all flex items-center gap-1 shadow-xs"
                    >
                      <span>View Published</span>
                      <ArrowRight size={12} />
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <EnterpriseModal
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        title={
          step === 1
            ? "Step 1: Select Verified Ashram Stay"
            : editingId
              ? "Edit Your Experience Article"
              : "Step 2: Write Experience Article"
        }
        subtitle={
          step === 1
            ? "Choose from your completed stay bookings to link your article"
            : `Writing article for ${selectedBooking?.ashram?.name || "Ashram Stay"}`
        }
        maxWidth="2xl"
      >
        {step === 1 ? (
          <div className="space-y-4">
            {loadingEligible ? (
              <div className="py-8 text-center space-y-2">
                <Loader2
                  size={24}
                  className="animate-spin text-[#0A4DA6] mx-auto"
                />
                <p className="text-xs font-bold text-gray-400">
                  Checking completed stays...
                </p>
              </div>
            ) : eligibleBookings.length === 0 ? (
              <div className="p-6 text-center space-y-2 bg-amber-50 dark:bg-amber-950/20 rounded-2xl border border-amber-100 dark:border-amber-900 text-amber-800 dark:text-amber-300">
                <AlertCircle size={24} className="mx-auto text-amber-600" />
                <h4 className="font-extrabold text-sm">
                  No Completed Stays Found
                </h4>
                <p className="text-xs font-medium">
                  Articles can only be written for completed ashram stays. Once
                  your stay booking status becomes completed, you can write an
                  article here!
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {eligibleBookings.map((b) => (
                  <div
                    key={b._id}
                    onClick={() => handleSelectBooking(b)}
                    className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      b.hasSubmittedArticle
                        ? "bg-gray-50 dark:bg-slate-900 border-gray-200 dark:border-slate-800 opacity-60 cursor-not-allowed"
                        : "bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800 hover:border-[#0A4DA6] hover:shadow-md cursor-pointer"
                    }`}
                  >
                    <div className="space-y-1 text-xs min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-[#0B192C] dark:text-white text-sm truncate">
                          {b.ashram?.name}
                        </span>
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 rounded-full text-[10px] font-black flex items-center gap-1 shrink-0 whitespace-nowrap">
                          <ShieldCheck size={11} /> Verified Stay
                        </span>
                      </div>
                      <p className="text-gray-400 font-semibold">
                        Booking ID: {b.bookingId} • Check-in:{" "}
                        {new Date(b.checkInDate).toLocaleDateString("en-IN")}
                      </p>
                    </div>

                    <div className="shrink-0">
                      {b.hasSubmittedArticle ? (
                        <span className="inline-block px-3 py-1 bg-gray-200 dark:bg-slate-800 text-gray-600 dark:text-gray-300 text-[10px] font-extrabold rounded-full whitespace-nowrap capitalize">
                          Article {b.existingArticleStatus}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0A4DA6] text-white text-xs font-extrabold rounded-full whitespace-nowrap">
                          Select Stay <ArrowRight size={13} />
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmitArticle(false);
            }}
            className="space-y-4 text-xs font-bold"
          >
            <div className="p-3 bg-blue-50/80 dark:bg-blue-950/30 rounded-xl border border-blue-100 dark:border-slate-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <ShieldCheck size={16} className="text-[#0A4DA6]" />
                <div>
                  <span className="font-extrabold text-[#0B192C] dark:text-white block">
                    {selectedBooking?.ashram?.name}
                  </span>
                  <span className="text-[10px] text-gray-400 font-semibold">
                    Visit Date:{" "}
                    {selectedBooking?.checkInDate
                      ? new Date(
                          selectedBooking.checkInDate,
                        ).toLocaleDateString("en-IN")
                      : "Completed Stay"}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-[10px] text-[#0A4DA6] hover:underline font-extrabold"
              >
                Change Stay
              </button>
            </div>

            <div className="space-y-1">
              <label className="text-gray-700 dark:text-gray-300">
                Article Title *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Essential Guide To Planning Your First Sacred Ashram Stay in Rishikesh"
                className="w-full p-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl font-extrabold focus:outline-none focus:border-[#0A4DA6]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-gray-700 dark:text-gray-300">
                  Category *
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full p-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl font-bold focus:outline-none focus:border-[#0A4DA6]"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-gray-700 dark:text-gray-300">
                  Language
                </label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full p-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl font-bold focus:outline-none focus:border-[#0A4DA6]"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-gray-700 dark:text-gray-300">
                Short Summary / Description *
              </label>
              <textarea
                rows={2}
                required
                value={shortDescription}
                onChange={(e) => setShortDescription(e.target.value)}
                placeholder="A brief summary of your stay experience, etiquette tips, or daily schedule..."
                className="w-full p-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl font-medium focus:outline-none focus:border-[#0A4DA6]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-gray-700 dark:text-gray-300">
                Featured Cover Photo (optional)
              </label>
              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleCoverUpload(file);
                }}
              />
              {featuredImage ? (
                <div className="relative rounded-2xl overflow-hidden border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-900">
                  <img
                    src={featuredImage}
                    alt="Cover preview"
                    className="w-full h-44 object-cover"
                  />
                  <div className="absolute bottom-2 right-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => coverInputRef.current?.click()}
                      disabled={uploadingCover}
                      className="px-3 py-1.5 bg-white/95 text-[#0A4DA6] rounded-full text-[11px] font-extrabold shadow-sm cursor-pointer"
                    >
                      Replace
                    </button>
                    <button
                      type="button"
                      onClick={() => setFeaturedImage("")}
                      className="px-3 py-1.5 bg-white/95 text-rose-600 rounded-full text-[11px] font-extrabold shadow-sm cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => coverInputRef.current?.click()}
                  disabled={uploadingCover}
                  className="w-full py-8 rounded-2xl border-2 border-dashed border-[#0A4DA6]/35 bg-blue-50/40 dark:bg-slate-900 text-[#0A4DA6] flex flex-col items-center justify-center gap-1.5 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-60"
                >
                  {uploadingCover ? (
                    <Loader2 size={22} className="animate-spin" />
                  ) : (
                    <ImagePlus size={22} />
                  )}
                  <span className="text-xs font-extrabold">
                    {uploadingCover
                      ? "Uploading photo…"
                      : "Upload cover photo from your device"}
                  </span>
                  <span className="text-[10px] text-gray-400 font-semibold">
                    JPG, PNG, WEBP or HEIC · up to 10 MB
                  </span>
                </button>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-gray-700 dark:text-gray-300">
                Experience Video (optional)
              </label>
              <input
                ref={videoInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleVideoUpload(file);
                }}
              />
              {videoUrl ? (
                <div className="rounded-2xl overflow-hidden border border-gray-200 dark:border-slate-800 bg-black">
                  <video
                    src={videoUrl}
                    controls
                    preload="metadata"
                    className="w-full max-h-56"
                  />
                  <div className="flex justify-end gap-2 p-2 bg-gray-50 dark:bg-slate-900">
                    <button
                      type="button"
                      onClick={() => videoInputRef.current?.click()}
                      disabled={uploadingVideo}
                      className="px-3 py-1.5 text-[#0A4DA6] rounded-full text-[11px] font-extrabold cursor-pointer"
                    >
                      Replace
                    </button>
                    <button
                      type="button"
                      onClick={() => setVideoUrl("")}
                      className="px-3 py-1.5 text-rose-600 rounded-full text-[11px] font-extrabold cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => videoInputRef.current?.click()}
                  disabled={uploadingVideo}
                  className="w-full py-6 rounded-2xl border-2 border-dashed border-gray-300 dark:border-slate-700 bg-gray-50/60 dark:bg-slate-900 text-gray-500 dark:text-gray-300 flex flex-col items-center justify-center gap-1.5 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-60"
                >
                  {uploadingVideo ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : (
                    <Video size={20} />
                  )}
                  <span className="text-xs font-extrabold">
                    {uploadingVideo
                      ? "Uploading video…"
                      : "Upload a short video from your device"}
                  </span>
                  <span className="text-[10px] text-gray-400 font-semibold">
                    MP4, WEBM or MOV · up to 100 MB
                  </span>
                </button>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-gray-700 dark:text-gray-300">
                Article Content (Rich Text / Markdown Supported) *
              </label>
              <textarea
                rows={8}
                required
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write your article experience here... Support headings (###), bold, italic, quotes (>), and lists."
                className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl font-medium leading-relaxed focus:outline-none focus:border-[#0A4DA6]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-gray-700 dark:text-gray-300">
                  Photo Gallery
                </label>
                <ImageUploadGrid
                  value={galleryImages}
                  onChange={setGalleryImages}
                  folder="visitor-articles"
                  max={10}
                  onError={(t, m) => addNotification(t, m, "warning")}
                />
              </div>

              <div className="space-y-1">
                <label className="text-gray-700 dark:text-gray-300">
                  Tags (Comma-separated)
                </label>
                <input
                  type="text"
                  value={tagsStr}
                  onChange={(e) => setTagsStr(e.target.value)}
                  placeholder="AshramStay, Rishikesh, SatvikLiving"
                  className="w-full p-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl font-medium focus:outline-none focus:border-[#0A4DA6]"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => handleSubmitArticle(true)}
                disabled={submitting}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 text-gray-700 dark:text-gray-200 rounded-full text-xs font-bold transition-all cursor-pointer"
              >
                Save as Draft
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsWizardOpen(false)}
                  className="px-4 py-2 text-gray-500 hover:text-gray-700 text-xs font-bold"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2 bg-[#0A4DA6] hover:bg-[#083D85] text-white text-xs font-black rounded-full cursor-pointer transition-all flex items-center gap-1.5 shadow-md disabled:opacity-50"
                >
                  {submitting ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Sparkles size={14} />
                  )}
                  <span>
                    {submitting
                      ? "Saving..."
                      : editingId
                        ? "Save & Resubmit"
                        : "Submit for Approval"}
                  </span>
                </button>
              </div>
            </div>
          </form>
        )}
      </EnterpriseModal>
    </div>
  );
};

export default VisitorArticlesTab;
