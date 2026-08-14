import React, { useState, useEffect, useCallback, useRef } from "react";
import { getFormattingLocale } from "../../utils/format";
import {
  FileText,
  CheckCircle2,
  ShieldCheck,
  Loader2,
  Pencil,
  Trash2,
  ImagePlus,
  Video,
} from "lucide-react";
import {
  EnterpriseModal,
  EnterprisePageHeader,
} from "../shared";
import {
  visitorArticleService,
  type VisitorArticle,
} from "../../services/visitorArticleService";
import { uploadService } from "../../services";
import { ImageUploadGrid } from "../../components/shared/ImageUploadGrid";
import { useNotifications } from "../../contexts/NotificationContext";
import { getErrorMessage } from "../../lib/api";
import { humanizeLabel } from "../../utils/labels";

export const OwnerVisitorArticlesPage: React.FC = () => {
  const { addNotification, confirmAction } = useNotifications();

  // Approved first: most visits here are to manage what is already live on the
  // public blog, not to clear a queue that is usually empty.
  const [activeTab, setActiveTab] = useState<
    "approved" | "pending" | "rejected" | "all"
  >("approved");
  const [articles, setArticles] = useState<VisitorArticle[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({
    pending: 0,
    approved: 0,
    rejected: 0,
  });
  const [loading, setLoading] = useState(true);

  // Selected Article Detail Modal / Review Drawer State
  const [selectedArticle, setSelectedArticle] = useState<VisitorArticle | null>(
    null,
  );
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [processing, setProcessing] = useState(false);

  // Administrator edit. Holds only the fields the API accepts, so the form
  // cannot offer a change the server will reject.
  const [editingArticle, setEditingArticle] = useState<VisitorArticle | null>(
    null,
  );
  const [editForm, setEditForm] = useState({
    title: "",
    category: "",
    shortDescription: "",
    content: "",
    featuredImage: "",
    videoUrl: "",
    galleryImages: [] as string[],
  });
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const openEditor = (article: VisitorArticle) => {
    setSelectedArticle(null);
    setEditingArticle(article);
    setEditForm({
      title: article.title || "",
      category: article.category || "",
      shortDescription: article.shortDescription || "",
      content: article.content || "",
      featuredImage: article.featuredImage || "",
      videoUrl: article.videoUrl || "",
      galleryImages: article.galleryImages || [],
    });
  };

  // Same ceilings the server enforces per file type.
  const MAX_COVER_BYTES = 10 * 1024 * 1024;
  const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

  const uploadInto = async (
    file: File,
    maxBytes: number,
    label: string,
    setBusy: (busy: boolean) => void,
    apply: (url: string) => void,
    inputRef: React.RefObject<HTMLInputElement | null>,
  ) => {
    if (file.size > maxBytes) {
      addNotification(
        `${label} Too Large`,
        `That ${label.toLowerCase()} is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is ${maxBytes / 1024 / 1024} MB.`,
        "warning",
      );
      return;
    }
    setBusy(true);
    try {
      apply(await uploadService.file(file, "visitor-articles"));
    } catch (err) {
      addNotification(
        "Upload Failed",
        getErrorMessage(err, `Could not upload that ${label.toLowerCase()}.`),
        "error",
      );
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const fetchOwnerArticles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await visitorArticleService.getOwnerArticles(activeTab);
      if (res.data.success) {
        setArticles(res.data.data);
        setCounts(res.data.counts || {});
      }
    } catch (err) {
      console.error("Error loading owner visitor articles:", err);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchOwnerArticles();
  }, [fetchOwnerArticles]);

  const handleApprove = async (article: VisitorArticle) => {
    setProcessing(true);
    try {
      const res = await visitorArticleService.reviewArticle(
        article._id,
        "approve",
      );
      if (res.data.success) {
        addNotification(
          "Article Approved",
          `Article "${article.title}" is now published!`,
          "success",
        );
        setSelectedArticle(null);
        fetchOwnerArticles();
      }
    } catch (err) {
      addNotification(
        "Error",
        getErrorMessage(err, "Failed to approve article."),
        "error",
      );
    } finally {
      setProcessing(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingArticle) return;
    setProcessing(true);
    try {
      const res = await visitorArticleService.adminUpdateArticle(
        editingArticle._id,
        {
          title: editForm.title.trim(),
          category: editForm.category.trim(),
          shortDescription: editForm.shortDescription.trim(),
          content: editForm.content.trim(),
          featuredImage: editForm.featuredImage.trim(),
          videoUrl: editForm.videoUrl.trim(),
          galleryImages: editForm.galleryImages,
        },
      );
      if (res.data.success) {
        addNotification(
          "Article Updated",
          `"${editForm.title.trim()}" was saved.`,
          "success",
        );
        setEditingArticle(null);
        fetchOwnerArticles();
      }
    } catch (err) {
      addNotification(
        "Error",
        getErrorMessage(err, "Failed to update article."),
        "error",
      );
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = async (article: VisitorArticle) => {
    // Deleting also clears the article's comments, likes and status history,
    // so it is worth naming the article in the prompt.
    const confirmed = await confirmAction({
      title: "Delete this article?",
      message: `"${article.title}" and its comments and likes will be permanently removed. This cannot be undone.`,
      confirmLabel: "Delete permanently",
      tone: "danger",
    });
    if (!confirmed) return;
    setProcessing(true);
    try {
      const res = await visitorArticleService.deleteArticle(article._id);
      if (res.data.success) {
        addNotification("Article Deleted", `"${article.title}" was removed.`, "info");
        setSelectedArticle(null);
        setEditingArticle(null);
        fetchOwnerArticles();
      }
    } catch (err) {
      addNotification(
        "Error",
        getErrorMessage(err, "Failed to delete article."),
        "error",
      );
    } finally {
      setProcessing(false);
    }
  };

  const handleConfirmReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedArticle) return;
    if (!rejectionReason.trim()) {
      addNotification(
        "Mandatory Field",
        "Please provide a reason for rejecting this article.",
        "error",
      );
      return;
    }

    setProcessing(true);
    try {
      const res = await visitorArticleService.reviewArticle(
        selectedArticle._id,
        "reject",
        rejectionReason.trim(),
      );
      if (res.data.success) {
        addNotification(
          "Article Rejected",
          `Article status updated to rejected.`,
          "info",
        );
        setIsRejectModalOpen(false);
        setSelectedArticle(null);
        setRejectionReason("");
        fetchOwnerArticles();
      }
    } catch (err) {
      addNotification(
        "Error",
        getErrorMessage(err, "Failed to reject article."),
        "error",
      );
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6 text-left w-full">
      {/* Page Title */}
      <EnterprisePageHeader
        title="Visitor Articles & Stories"
        subtitle="Review and manage experience articles submitted by verified ashram visitors."
        icon={<FileText size={22} />}
        badgeText="Community Content"
      />

      {/* Tabs Bar */}
      <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-2xl p-2 shadow-sm flex items-center gap-2 overflow-x-auto text-xs font-extrabold">
        {(["approved", "pending", "rejected", "all"] as const).map((tab) => {
          const isActive = activeTab === tab;
          const count =
            tab === "all"
              ? (counts.pending || 0) +
                (counts.approved || 0) +
                (counts.rejected || 0)
              : counts[tab] || 0;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-xl capitalize transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                isActive
                  ? "bg-[#0A4DA6] text-white shadow-sm"
                  : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800"
              }`}
            >
              <span>{tab === "all" ? "All Submissions" : tab}</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] ${isActive ? "bg-white/20 text-white" : "bg-gray-100 dark:bg-slate-800 text-gray-500"}`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Content List */}
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
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-10 text-center space-y-3 shadow-sm">
          <FileText
            size={36}
            className="text-gray-300 dark:text-slate-700 mx-auto"
          />
          <h3 className="font-extrabold text-sm text-[#0B192C] dark:text-white">
            No articles in {activeTab}
          </h3>
          <p className="text-xs text-gray-400 max-w-sm mx-auto font-medium">
            Visitor experience articles submitted for your Ashram will appear
            here for review.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {articles.map((art) => (
            <div
              key={art._id}
              className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-5"
            >
              <div className="flex items-start gap-4 min-w-0">
                {/* The cover is optional; a video-only article shows a film
                    icon rather than a broken image. */}
                <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0 bg-gray-100 dark:bg-slate-800 flex items-center justify-center">
                  {art.featuredImage ? (
                    <img
                      src={art.featuredImage}
                      alt={art.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <FileText size={20} className="text-gray-300 dark:text-slate-700" />
                  )}
                </div>

                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 rounded-full text-[10px] font-black flex items-center gap-1">
                      <ShieldCheck size={11} /> Verified Visitor Stay
                    </span>
                    <span className="px-2.5 py-0.5 bg-blue-50 text-[#0A4DA6] dark:bg-blue-950/40 dark:text-blue-300 rounded-full text-[10px] font-black">
                      {humanizeLabel(art.category)}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold capitalize ${
                        art.status === "approved"
                          ? "bg-emerald-100 text-emerald-700"
                          : art.status === "pending"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-rose-100 text-rose-700"
                      }`}
                    >
                      {humanizeLabel(art.status)}
                    </span>
                  </div>

                  <h3 className="font-extrabold text-base text-[#0B192C] dark:text-white line-clamp-1">
                    {art.title}
                  </h3>

                  <p className="text-xs text-gray-400 font-semibold flex items-center gap-3">
                    <span>
                      By:{" "}
                      <strong className="text-[#0B192C] dark:text-white">
                        {art.visitorId?.name || "Visitor"}
                      </strong>
                    </span>
                    <span>
                      • Ashram:{" "}
                      <strong className="text-[#0B192C] dark:text-white">
                        {art.ashramId?.name}
                      </strong>
                    </span>
                    <span>
                      • Submitted:{" "}
                      {new Date(art.createdAt).toLocaleDateString(getFormattingLocale())}
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 w-full md:w-auto justify-end border-t md:border-t-0 border-gray-100 dark:border-slate-800 pt-3 md:pt-0">
                <button
                  onClick={() => setSelectedArticle(art)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 text-gray-700 dark:text-gray-200 text-xs font-extrabold rounded-full transition-colors cursor-pointer"
                >
                  Inspect &amp; Review
                </button>

                <button
                  onClick={() => openEditor(art)}
                  disabled={processing}
                  className="px-4 py-2 bg-[#EBF2FA] hover:bg-[#dbe8f7] dark:bg-blue-950/40 text-[#0A4DA6] dark:text-blue-300 text-xs font-extrabold rounded-full transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Pencil size={13} /> Edit
                </button>

                <button
                  onClick={() => handleDelete(art)}
                  disabled={processing}
                  className="px-4 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs font-extrabold rounded-full transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 size={13} /> Delete
                </button>

                {art.status === "pending" && (
                  <>
                    <button
                      onClick={() => handleApprove(art)}
                      disabled={processing}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-full transition-all cursor-pointer shadow-xs"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => {
                        setSelectedArticle(art);
                        setIsRejectModalOpen(true);
                      }}
                      disabled={processing}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-full transition-all cursor-pointer shadow-xs"
                    >
                      Reject
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Inspect Article Detail Modal */}
      {selectedArticle && !isRejectModalOpen && (
        <EnterpriseModal
          isOpen={Boolean(selectedArticle)}
          onClose={() => setSelectedArticle(null)}
          title="Review Visitor Experience Article"
          subtitle={`Submitted for ${selectedArticle.ashramId?.name}`}
          maxWidth="5xl"
          // The action bar lives in the modal's footer slot, which sits
          // outside the scrolling body — so it stays reachable on a long
          // article instead of scrolling away with the text.
          footer={
            <div className="flex items-center justify-between gap-3 flex-wrap text-xs font-bold">
              <button
                type="button"
                onClick={() => setSelectedArticle(null)}
                className="px-4 py-2 text-gray-500 font-bold cursor-pointer"
              >
                Close Preview
              </button>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => openEditor(selectedArticle)}
                  disabled={processing}
                  className="px-5 py-2 bg-[#EBF2FA] hover:bg-[#dbe8f7] dark:bg-blue-950/40 text-[#0A4DA6] dark:text-blue-300 rounded-full font-black cursor-pointer flex items-center gap-1.5"
                >
                  <Pencil size={14} /> Edit
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(selectedArticle)}
                  disabled={processing}
                  className="px-5 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-full font-black cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 size={14} /> Delete
                </button>

                {selectedArticle.status === "pending" && (
                  <>
                    <button
                      type="button"
                      onClick={() => setIsRejectModalOpen(true)}
                      disabled={processing}
                      className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-full font-black cursor-pointer shadow-xs"
                    >
                      Reject Article
                    </button>

                    <button
                      type="button"
                      onClick={() => handleApprove(selectedArticle)}
                      disabled={processing}
                      className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full font-black cursor-pointer shadow-xs flex items-center gap-1.5"
                    >
                      {processing ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <CheckCircle2 size={14} />
                      )}
                      <span>Approve &amp; Publish</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          }
        >
          {/* Two columns on desktop: media and provenance on the left, the
              article text on the right, so a long body no longer pushes the
              cover photo and stay record off the top of a narrow scroller. */}
          <div className="text-xs font-bold text-left">
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] gap-6">
              {/* ── Left: media + provenance ──────────────────────────────── */}
              <div className="space-y-4">
                {/* Photo and video are independent and both optional, so each
                    is rendered only when the author actually attached it. */}
                {selectedArticle.featuredImage ? (
                  <div className="aspect-video w-full rounded-2xl overflow-hidden bg-gray-100 dark:bg-slate-800">
                    <img
                      src={selectedArticle.featuredImage}
                      alt={selectedArticle.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : !selectedArticle.videoUrl ? (
                  <div className="aspect-video w-full rounded-2xl bg-gray-50 dark:bg-slate-900 border border-dashed border-gray-200 dark:border-slate-800 flex items-center justify-center text-[11px] font-bold text-gray-400">
                    No photo or video attached
                  </div>
                ) : null}

                {/* An uploaded clip is part of what is being reviewed, so it
                    has to be playable here and not just referenced. */}
                {selectedArticle.videoUrl && (
                  <div className="space-y-1.5">
                    <span className="text-gray-400 text-[10px]">
                      Experience Video
                    </span>
                    <video
                      src={selectedArticle.videoUrl}
                      controls
                      preload="metadata"
                      className="w-full rounded-2xl bg-black max-h-56"
                    />
                  </div>
                )}

                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200 dark:border-emerald-900 space-y-1.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-emerald-700 dark:text-emerald-400 font-black text-[11px] flex items-center gap-1.5">
                      <ShieldCheck size={14} /> Verified Stay Record
                    </span>
                    <span className="text-[10px] text-gray-500 font-mono">
                      {selectedArticle.bookingId?.bookingId || "Verified"}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Visitor: <strong>{selectedArticle.visitorId?.name}</strong>
                    <br />
                    <span className="text-[11px] text-gray-500">
                      {selectedArticle.visitorId?.email || "Registered User"}
                    </span>
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 bg-gray-50 dark:bg-slate-900 rounded-xl">
                    <span className="text-gray-400 text-[10px] block">
                      Category
                    </span>
                    <span className="text-[#0B192C] dark:text-white">
                      {humanizeLabel(selectedArticle.category)}
                    </span>
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-slate-900 rounded-xl">
                    <span className="text-gray-400 text-[10px] block">
                      Status
                    </span>
                    <span className="text-[#0B192C] dark:text-white">
                      {humanizeLabel(selectedArticle.status)}
                    </span>
                  </div>
                </div>

                {selectedArticle.galleryImages?.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-gray-400 text-[10px]">
                      Gallery Photos ({selectedArticle.galleryImages.length})
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      {selectedArticle.galleryImages.map((img, i) => (
                        <div
                          key={i}
                          className="h-20 rounded-xl overflow-hidden bg-gray-100 dark:bg-slate-800"
                        >
                          <img
                            src={img}
                            alt={`Gallery ${i}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* ── Right: the article itself ─────────────────────────────── */}
              <div className="space-y-4 min-w-0">
                <h2 className="text-lg font-black text-[#0B192C] dark:text-white leading-tight">
                  {selectedArticle.title}
                </h2>

                <div className="space-y-1">
                  <span className="text-gray-400 text-[10px]">
                    Short Description
                  </span>
                  <p className="p-3 bg-gray-50 dark:bg-slate-900 rounded-xl font-medium text-gray-700 dark:text-gray-200">
                    {selectedArticle.shortDescription}
                  </p>
                </div>

                <div className="space-y-1">
                  <span className="text-gray-400 text-[10px]">
                    Article Body Content
                  </span>
                  <div className="p-4 bg-gray-50 dark:bg-slate-900 rounded-xl font-medium text-gray-700 dark:text-gray-200 whitespace-pre-line leading-relaxed break-words">
                    {selectedArticle.content}
                  </div>
                </div>
              </div>
            </div>

          </div>
        </EnterpriseModal>
      )}

      {/* Administrator Edit Modal */}
      {editingArticle && (
        <EnterpriseModal
          isOpen={Boolean(editingArticle)}
          onClose={() => setEditingArticle(null)}
          title="Edit Visitor Article"
          subtitle={`By ${editingArticle.visitorId?.name || "Visitor"} · ${editingArticle.ashramId?.name || ""}`}
          maxWidth="4xl"
        >
          <form
            onSubmit={handleSaveEdit}
            // EnterpriseModal's body scrolls already; a nested scroller here
            // produced a second scrollbar.
            className="space-y-4 text-xs font-bold text-left"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-gray-700 dark:text-gray-300">
                  Article Title *
                </label>
                <input
                  required
                  value={editForm.title}
                  onChange={(e) =>
                    setEditForm({ ...editForm, title: e.target.value })
                  }
                  className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl font-medium focus:outline-none focus:border-[#0A4DA6]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-gray-700 dark:text-gray-300">
                  Category
                </label>
                <input
                  value={editForm.category}
                  onChange={(e) =>
                    setEditForm({ ...editForm, category: e.target.value })
                  }
                  className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl font-medium focus:outline-none focus:border-[#0A4DA6]"
                />
              </div>
            </div>

            {/* Cover photo — upload, matching the visitor's own form. */}
            <div className="space-y-1.5">
              <label className="text-gray-700 dark:text-gray-300">
                Featured Cover Photo
              </label>
              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file)
                    void uploadInto(
                      file,
                      MAX_COVER_BYTES,
                      "Photo",
                      setUploadingCover,
                      (url) =>
                        setEditForm((prev) => ({ ...prev, featuredImage: url })),
                      coverInputRef,
                    );
                }}
              />
              {editForm.featuredImage ? (
                <div className="relative rounded-2xl overflow-hidden border border-gray-200 dark:border-slate-800">
                  <img
                    src={editForm.featuredImage}
                    alt="Cover"
                    className="w-full h-40 object-cover"
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
                      onClick={() =>
                        setEditForm({ ...editForm, featuredImage: "" })
                      }
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
                  className="w-full py-6 rounded-2xl border-2 border-dashed border-[#0A4DA6]/35 bg-blue-50/40 dark:bg-slate-900 text-[#0A4DA6] flex flex-col items-center justify-center gap-1 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-60"
                >
                  {uploadingCover ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <ImagePlus size={18} />
                  )}
                  <span className="text-xs font-extrabold">
                    {uploadingCover ? "Uploading…" : "Upload cover photo"}
                  </span>
                  <span className="text-[10px] text-gray-400 font-semibold">
                    up to 10 MB
                  </span>
                </button>
              )}
            </div>

            {/* Experience video */}
            <div className="space-y-1.5">
              <label className="text-gray-700 dark:text-gray-300">
                Experience Video
              </label>
              <input
                ref={videoInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file)
                    void uploadInto(
                      file,
                      MAX_VIDEO_BYTES,
                      "Video",
                      setUploadingVideo,
                      (url) => setEditForm((prev) => ({ ...prev, videoUrl: url })),
                      videoInputRef,
                    );
                }}
              />
              {editForm.videoUrl ? (
                <div className="rounded-2xl overflow-hidden border border-gray-200 dark:border-slate-800 bg-black">
                  <video
                    src={editForm.videoUrl}
                    controls
                    preload="metadata"
                    className="w-full max-h-48"
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
                      onClick={() => setEditForm({ ...editForm, videoUrl: "" })}
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
                  className="w-full py-5 rounded-2xl border-2 border-dashed border-gray-300 dark:border-slate-700 bg-gray-50/60 dark:bg-slate-900 text-gray-500 dark:text-gray-300 flex flex-col items-center justify-center gap-1 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-60"
                >
                  {uploadingVideo ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Video size={18} />
                  )}
                  <span className="text-xs font-extrabold">
                    {uploadingVideo ? "Uploading…" : "Upload a video"}
                  </span>
                  <span className="text-[10px] text-gray-400 font-semibold">
                    MP4, WEBM or MOV · up to 100 MB
                  </span>
                </button>
              )}
            </div>

            {/* Gallery — the photos that feed the article slider. */}
            <div className="space-y-1.5">
              <label className="text-gray-700 dark:text-gray-300">
                Photo Gallery
              </label>
              <ImageUploadGrid
                value={editForm.galleryImages}
                onChange={(next) =>
                  setEditForm((prev) => ({ ...prev, galleryImages: next }))
                }
                folder="visitor-articles"
                max={10}
                onError={(t, m) => addNotification(t, m, "warning")}
              />
            </div>

            <div className="space-y-1">
              <label className="text-gray-700 dark:text-gray-300">
                Short Description
              </label>
              <textarea
                rows={2}
                maxLength={350}
                value={editForm.shortDescription}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    shortDescription: e.target.value,
                  })
                }
                className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl font-medium focus:outline-none focus:border-[#0A4DA6]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-gray-700 dark:text-gray-300">
                Article Body Content
              </label>
              <textarea
                rows={12}
                value={editForm.content}
                onChange={(e) =>
                  setEditForm({ ...editForm, content: e.target.value })
                }
                className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl font-medium focus:outline-none focus:border-[#0A4DA6] leading-relaxed"
              />
            </div>

            <p className="text-[10px] text-gray-400 font-semibold">
              The linked booking and the review status are not editable here —
              status changes go through Approve / Reject.
            </p>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEditingArticle(null)}
                className="flex-1 py-2.5 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-200 rounded-full font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={processing}
                className="flex-1 py-2.5 bg-[#0A4DA6] hover:bg-[#083b80] text-white rounded-full font-extrabold shadow-md cursor-pointer disabled:opacity-60 flex items-center justify-center gap-1.5"
              >
                {processing && <Loader2 size={14} className="animate-spin" />}
                Save Changes
              </button>
            </div>
          </form>
        </EnterpriseModal>
      )}

      {/* Reject Modal */}
      {isRejectModalOpen && selectedArticle && (
        <EnterpriseModal
          isOpen={isRejectModalOpen}
          onClose={() => setIsRejectModalOpen(false)}
          title="Reject Visitor Article"
          subtitle="A mandatory reason is required to notify the visitor"
        >
          <form
            onSubmit={handleConfirmReject}
            className="space-y-4 text-xs font-bold text-left"
          >
            <div className="space-y-1">
              <label className="text-gray-700 dark:text-gray-300">
                Rejection Reason *
              </label>
              <textarea
                rows={4}
                required
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Explain why this article cannot be published (e.g. offensive content, incorrect details, low photo quality)..."
                className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl font-medium focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsRejectModalOpen(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-full font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={processing}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-full font-black shadow-xs"
              >
                Confirm Rejection
              </button>
            </div>
          </form>
        </EnterpriseModal>
      )}
    </div>
  );
};

export default OwnerVisitorArticlesPage;
