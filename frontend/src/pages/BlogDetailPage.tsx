import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../lib/api";
import { visitorArticleService } from "../services/visitorArticleService";
import { useAuth } from "../contexts/AuthContext";
import { AutoImageSlider } from "../components/shared/AutoImageSlider";
import { toast } from "../lib/toast";
import {
  Calendar,
  Clock,
  Eye,
  Heart,
  Share2,
  Bookmark,
  Printer,
  ShieldCheck,
  MessageSquare,
  Sparkles,
} from "lucide-react";

export const BlogDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [likes, setLikes] = useState(0);
  const [hasLiked, setHasLiked] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);

  const [userName, setUserName] = useState("");
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [source, setSource] = useState<"blog" | "visitor">("blog");
  const [articleId, setArticleId] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  const fetchPostDetail = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api
        .get(`/blog/posts/${slug}`, { skipToast: true })
        .catch(() => null);

      if (res?.data?.success) {
        setSource("blog");
        setData(res.data.data);
        setLikes(res.data.data.post.likes || 0);
      } else {
        const vRes = await visitorArticleService.getPublicArticleBySlug(slug!);
        if (vRes.data?.success) {
          const va = vRes.data.data.article;
          setSource("visitor");
          setArticleId(va._id);
          setData({
            post: {
              _id: va._id,
              title: va.title,
              category: va.category,
              content: va.content,
              subtitle: va.shortDescription,
              coverImage: va.featuredImage,
              videoUrl: va.videoUrl,
              createdAt: va.createdAt,
              readingTime: "5 min read",
              views: va.viewsCount || 1,
              likes: va.likesCount || 0,
              gallery: va.galleryImages || [],
              tags: va.tags || [],
              isVerifiedStay: true,
              ashramName: va.ashramId?.name,
              authorId: {
                name: va.visitorId?.name || "Verified Pilgrim",
                photo:
                  va.visitorId?.avatar ||
                  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100%25' height='100%25' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='1.5'%3E%3Crect width='100%25' height='100%25' fill='%23f1f5f9'/%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'/%3E%3Cpath d='m21 15-5-5-11 11'/%3E%3C/svg%3E",
                verified: true,
                designation: "Verified Stay Traveler",
                bio: `Completed stay at ${va.ashramId?.name || "Ashram"}. Shared authentic pilgrim experience.`,
              },
            },
            comments: vRes.data.data.comments || [],
            relatedPosts: vRes.data.data.relatedArticles || [],
          });
          setLikes(va.likesCount || 0);
        }
      }
    } catch (err) {
      console.error("Error fetching blog detail:", err);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchPostDetail();
  }, [fetchPostDetail]);

  const handleLike = async () => {
    if (hasLiked) return;
    try {
      if (source === "visitor") {
        if (!user) {
          toast.info("Sign in to like this article.");
          return;
        }
        const res = await visitorArticleService.toggleLike(articleId);
        if (res.data.success) {
          setLikes(res.data.likesCount);
          setHasLiked(res.data.liked);
        }
        return;
      }
      const res = await api.post(`/blog/posts/${slug}/like`);
      if (res.data.success) {
        setLikes(res.data.likes);
        setHasLiked(true);
      }
    } catch (err) {
      console.error("Like error:", err);
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: data?.post?.title,
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success("Article link copied to clipboard.", { title: "Ready to share" });
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const submitComment = async (text: string, parentId?: string) => {
    const body = text.trim();
    if (!body) return false;
    setSubmittingComment(true);
    try {
      if (source === "visitor") {
        if (!user) {
          toast.info("Sign in to join the discussion.");
          return false;
        }
        const res = await visitorArticleService.addComment(
          articleId,
          body,
          parentId,
        );
        if (!res.data.success) return false;
      } else {
        const res = await api.post(`/blog/posts/${slug}/comments`, {
          userName: userName || "Devotee Pilgrim",
          comment: body,
        });
        if (!res.data.success) return false;
      }
      await fetchPostDetail();
      return true;
    } catch (err) {
      console.error("Add comment error:", err);
      return false;
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await submitComment(commentText)) setCommentText("");
  };

  const handleAddReply = async (e: React.FormEvent, parentId: string) => {
    e.preventDefault();
    if (await submitComment(replyText, parentId)) {
      setReplyText("");
      setReplyTo(null);
    }
  };

  const renderCommentHeader = (c: any) => (
    <div className="flex justify-between items-center gap-2">
      <div className="flex items-center gap-2 flex-wrap min-w-0">
        <div className="w-7 h-7 rounded-full bg-[#0A4DA6] text-white font-extrabold text-xs flex items-center justify-center shrink-0">
          {String(c.userName || "?").charAt(0).toUpperCase()}
        </div>
        <h5 className="font-bold text-xs text-[#0B192C] dark:text-white truncate">
          {c.userName || "Devotee Pilgrim"}
        </h5>
        {c.isAuthor && (
          <span className="px-2 py-0.5 rounded-full bg-[#EBF2FA] dark:bg-blue-950 text-[#0A4DA6] dark:text-blue-300 text-[9px] font-black shrink-0">
            AUTHOR
          </span>
        )}
        <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-600 text-[9px] font-black shrink-0">
          VERIFIED PILGRIM
        </span>
      </div>
      <span className="text-[10px] text-gray-400 shrink-0">
        {c.createdAt
          ? new Date(c.createdAt).toLocaleDateString("en-IN")
          : ""}
      </span>
    </div>
  );

  const heroImages: string[] = (() => {
    const post = data?.post;
    if (!post) return [];
    const unique = [
      ...new Set(
        [post.coverImage, ...(post.gallery ?? [])].filter(
          (src: unknown): src is string =>
            typeof src === "string" && src.trim().length > 0,
        ),
      ),
    ];
    if (unique.length) return unique;
    return post.videoUrl ? [] : ["/blogs/rishikesh_ashram_1785404729056.png"];
  })();

  const totalComments = (data?.comments ?? []).reduce(
    (sum: number, c: any) => sum + 1 + (c.replies?.length ?? 0),
    0,
  );

  if (loading) {
    return (
      <div className="min-h-screen pt-32 text-center">
        <div className="w-12 h-12 border-4 border-[#0A4DA6] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-xs font-bold text-gray-500">
          Loading Sacred Article...
        </p>
      </div>
    );
  }

  if (!data?.post) {
    return (
      <div className="min-h-screen pt-32 text-center">
        <h2 className="text-xl font-black text-gray-700 dark:text-gray-200 mb-4">
          Article Not Found
        </h2>
        <button
          onClick={() => navigate("/blog")}
          className="px-6 py-2.5 rounded-full bg-[#0A4DA6] text-white font-bold text-xs shadow-md hover:bg-blue-900 transition-colors"
        >
          Back to Spiritual Knowledge Hub
        </button>
      </div>
    );
  }

  const { post, comments, relatedPosts } = data;
  const author = post.authorId || {};

  const renderFormattedContent = (text: string) => {
    if (!text) return null;
    const blocks = text.split("\n\n");
    return blocks.map((block, idx) => {
      const trimmed = block.trim();
      if (trimmed.startsWith("### ")) {
        return (
          <h3
            key={idx}
            className="text-lg sm:text-xl font-extrabold text-[#0B192C] dark:text-white pt-2 pb-1 border-b border-gray-100 dark:border-slate-800"
          >
            {trimmed.replace("### ", "")}
          </h3>
        );
      }
      if (trimmed.startsWith("## ")) {
        return (
          <h2
            key={idx}
            className="text-xl sm:text-2xl font-black text-[#0B192C] dark:text-white pt-3 pb-1"
          >
            {trimmed.replace("## ", "")}
          </h2>
        );
      }
      if (trimmed.startsWith("- ")) {
        const lines = trimmed.split("\n");
        return (
          <ul key={idx} className="space-y-2 py-1 pl-1">
            {lines.map((line, lIdx) => {
              const cleanLine = line.replace(/^- /, "");
              const parts = cleanLine.split(/(\*\*.*?\*\*)/g);
              return (
                <li
                  key={lIdx}
                  className="flex items-start gap-2 text-slate-700 dark:text-gray-200 text-sm sm:text-base"
                >
                  <span className="w-2 h-2 rounded-full bg-[#0A4DA6] mt-2 shrink-0" />
                  <span>
                    {parts.map((p, pIdx) => {
                      if (p.startsWith("**") && p.endsWith("**")) {
                        return (
                          <strong
                            key={pIdx}
                            className="font-extrabold text-[#0B192C] dark:text-white"
                          >
                            {p.slice(2, -2)}
                          </strong>
                        );
                      }
                      return p;
                    })}
                  </span>
                </li>
              );
            })}
          </ul>
        );
      }
      const parts = trimmed.split(/(\*\*.*?\*\*)/g);
      return (
        <p
          key={idx}
          className="leading-relaxed text-slate-700 dark:text-gray-200 text-sm sm:text-base font-medium"
        >
          {parts.map((p, pIdx) => {
            if (p.startsWith("**") && p.endsWith("**")) {
              return (
                <strong
                  key={pIdx}
                  className="font-extrabold text-[#0B192C] dark:text-white"
                >
                  {p.slice(2, -2)}
                </strong>
              );
            }
            return p;
          })}
        </p>
      );
    });
  };

  return (
    <div className="min-h-screen pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-1 sm:pt-3 space-y-8">
        <div className="text-center space-y-3 max-w-4xl mx-auto py-2">
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <span className="px-3.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/40 text-[#0A4DA6] dark:text-blue-300 border border-blue-100 dark:border-slate-800 text-[11px] font-black tracking-wider flex items-center gap-1.5 shadow-xs">
              <ShieldCheck size={12} className="text-emerald-500" />
              {post.category || "TRAVEL GUIDE"} • RISHIKESH, UTTARAKHAND
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-[#0B192C] dark:text-white tracking-tight leading-tight">
            {post.title}
          </h1>

          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-semibold flex items-center justify-center gap-3 flex-wrap pt-1">
            <span className="flex items-center gap-2 text-[#0B192C] dark:text-gray-200 font-extrabold">
              <img
                src={
                  author.photo ||
                  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100%25' height='100%25' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='1.5'%3E%3Crect width='100%25' height='100%25' fill='%23f1f5f9'/%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'/%3E%3Cpath d='m21 15-5-5-11 11'/%3E%3C/svg%3E"
                }
                alt={author.name}
                className="w-6 h-7 rounded-md object-cover border border-[#0A4DA6] shrink-0 shadow-xs"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src =
                    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100%25' height='100%25' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='1.5'%3E%3Crect width='100%25' height='100%25' fill='%23f1f5f9'/%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'/%3E%3Cpath d='m21 15-5-5-11 11'/%3E%3C/svg%3E";
                }}
              />
              <span>{author.name || "Gordon V. Shastri"}</span>
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Calendar size={13} className="text-[#E58C28]" />{" "}
              {new Date(post.createdAt).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Clock size={13} className="text-[#0A4DA6]" /> {post.readingTime}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Eye size={13} className="text-emerald-600" />{" "}
              {post.views || 3840} Views
            </span>
          </p>

          <div className="flex items-center justify-center gap-2 pt-2">
            <button
              onClick={handleLike}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-black transition-all cursor-pointer shadow-xs border ${
                hasLiked
                  ? "bg-rose-600 text-white border-rose-600"
                  : "bg-white dark:bg-slate-800 text-[#0B192C] dark:text-gray-200 border-gray-200 dark:border-slate-700 hover:bg-rose-50"
              }`}
            >
              <Heart
                size={14}
                className={hasLiked ? "fill-white text-white" : "text-rose-500"}
              />
              <span>{likes} Likes</span>
            </button>

            <button
              onClick={handleShare}
              className="px-3.5 py-1.5 rounded-full bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-slate-700 text-xs font-extrabold flex items-center gap-1.5 hover:bg-gray-50 cursor-pointer shadow-xs transition-all"
              title="Share Article"
            >
              <Share2 size={14} className="text-[#0A4DA6]" />
              <span>Share</span>
            </button>

            <button
              onClick={() => setIsBookmarked(!isBookmarked)}
              className={`px-3.5 py-1.5 rounded-full border text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shadow-xs transition-all ${
                isBookmarked
                  ? "bg-amber-500 text-white border-amber-500"
                  : "bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-slate-700 hover:bg-amber-50"
              }`}
              title="Bookmark"
            >
              <Bookmark
                size={14}
                className={isBookmarked ? "fill-white" : "text-amber-500"}
              />
              <span>{isBookmarked ? "Saved" : "Save"}</span>
            </button>

            <button
              onClick={handlePrint}
              className="p-2 rounded-full bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 cursor-pointer hidden sm:flex items-center justify-center shadow-xs"
              title="Print Article"
            >
              <Printer size={14} />
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {heroImages.length > 0 && (
            <AutoImageSlider
              images={heroImages}
              alt={post.title}
              className="h-[380px] sm:h-[480px] w-full"
            />
          )}

          {post.videoUrl && (
            <video
              src={post.videoUrl}
              controls
              preload="metadata"
              className="w-full rounded-[28px] bg-black border border-gray-100 dark:border-slate-800 shadow-xl max-h-[480px]"
            />
          )}

        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-[#0B192C] rounded-[32px] p-6 sm:p-10 border border-gray-100 dark:border-slate-800 shadow-sm space-y-8">
              {(post.contentType === "video" ||
                post.youtubeUrl ||
                post.youtubeVideoId) && (
                <div className="relative rounded-2xl overflow-hidden shadow-xl bg-black aspect-video w-full mb-6 border border-gray-800">
                  <iframe
                    src={`https://www.youtube.com/embed/${(() => {
                      const input =
                        post.youtubeVideoId ||
                        post.youtubeUrl ||
                        post.videoUrl ||
                        post.content;
                      if (!input) return "50HnOmsPpxI";
                      const str =
                        typeof input === "string"
                          ? input.trim()
                          : String(input);
                      if (/^[a-zA-Z0-9_-]{11}$/.test(str)) return str;
                      const regExp =
                        /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/;
                      const match = str.match(regExp);
                      return match && match[1] ? match[1] : "50HnOmsPpxI";
                    })()}?autoplay=1&enablejsapi=1&rel=0`}
                    title={post.title}
                    className="w-full h-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                </div>
              )}

              <div className="space-y-4">
                {renderFormattedContent(post.content)}
              </div>

              <div className="my-6 p-6 rounded-2xl bg-blue-50/70 dark:bg-slate-900/80 border-l-4 border-[#0A4DA6] space-y-2">
                <p className="font-['Kalam'] text-base sm:text-lg font-bold text-[#0A4DA6] dark:text-amber-400">
                  "Every pilgrimage is a sacred inward journey towards peace,
                  self-realization, and divine grace."
                </p>
                <span className="text-xs font-extrabold text-gray-500 block">
                  — Tirvona Spiritual Guidelines
                </span>
              </div>

              {post.gallery?.length > 0 && (
                <div className="space-y-3 pt-2">
                  <h4 className="font-black text-base text-[#0B192C] dark:text-white">
                    Sacred Photo Gallery
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    {post.gallery.map((img: string, i: number) => (
                      <div
                        key={i}
                        className="rounded-2xl overflow-hidden h-44 shadow-sm border border-gray-100 dark:border-slate-800"
                      >
                        <img
                          src={img}
                          alt={`Gallery ${i}`}
                          className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-6 border-t border-gray-100 dark:border-slate-800 space-y-6">
                <h3 className="font-black text-xl text-[#0B192C] dark:text-white flex items-center gap-2">
                  <MessageSquare size={20} className="text-[#0A4DA6]" />
                  <span>
                    Pilgrim Discussion & Comments ({totalComments})
                  </span>
                </h3>

                <form
                  onSubmit={handleAddComment}
                  className="space-y-3 p-5 rounded-2xl bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800"
                >
                  <h5 className="font-bold text-xs text-[#0B192C] dark:text-white">
                    Leave a Devotional Comment
                  </h5>
                  {source === "blog" && (
                    <input
                      type="text"
                      placeholder="Your Name (e.g. Ramesh Devotee)..."
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-[#0B192C] border border-gray-200 dark:border-slate-800 text-xs font-bold focus:outline-none"
                    />
                  )}
                  {source === "visitor" && !user && (
                    <p className="text-[11px] font-bold text-amber-600">
                      Sign in to join the discussion on this pilgrim story.
                    </p>
                  )}
                  <textarea
                    rows={3}
                    placeholder="Share your spiritual thoughts or feedback on this article..."
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-[#0B192C] border border-gray-200 dark:border-slate-800 text-xs font-medium focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={submittingComment}
                    className="px-6 py-2.5 rounded-full bg-[#0A4DA6] hover:bg-blue-900 text-white font-black text-xs shadow-md transition-colors cursor-pointer"
                  >
                    Submit Comment
                  </button>
                </form>

                <div className="space-y-4">
                  {totalComments === 0 && (
                    <p className="text-xs font-semibold text-gray-400 py-2">
                      No comments yet — be the first to share a thought.
                    </p>
                  )}
                  {comments?.map((c: any) => (
                    <div
                      key={c._id}
                      className="p-4 rounded-2xl bg-gray-50/80 dark:bg-slate-900/80 border border-gray-100 dark:border-slate-800 space-y-2"
                    >
                      {renderCommentHeader(c)}
                      <p className="text-xs text-gray-600 dark:text-gray-300 font-medium pl-9 whitespace-pre-line">
                        {c.comment}
                      </p>

                      {c.replies?.length > 0 && (
                        <div className="pl-9 space-y-3 pt-1">
                          {c.replies.map((r: any) => (
                            <div
                              key={r._id}
                              className="p-3 rounded-xl bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 space-y-1.5"
                            >
                              {renderCommentHeader(r)}
                              <p className="text-xs text-gray-600 dark:text-gray-300 font-medium pl-9 whitespace-pre-line">
                                {r.comment}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}

                      {source === "visitor" && (
                        <div className="pl-9 pt-1">
                          {replyTo === c._id ? (
                            <form
                              onSubmit={(e) => handleAddReply(e, c._id)}
                              className="space-y-2"
                            >
                              <textarea
                                rows={2}
                                autoFocus
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                placeholder={`Reply to ${c.userName}...`}
                                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#0B192C] border border-gray-200 dark:border-slate-800 text-xs font-medium focus:outline-none focus:border-[#0A4DA6]"
                              />
                              <div className="flex gap-2">
                                <button
                                  type="submit"
                                  disabled={submittingComment}
                                  className="px-4 py-1.5 rounded-full bg-[#0A4DA6] hover:bg-blue-900 text-white font-black text-[11px] cursor-pointer disabled:opacity-60"
                                >
                                  Post Reply
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReplyTo(null);
                                    setReplyText("");
                                  }}
                                  className="px-4 py-1.5 rounded-full text-gray-500 font-bold text-[11px] cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </div>
                            </form>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                if (!user) {
                                  toast.info("Sign in to reply to a comment.");
                                  return;
                                }
                                setReplyTo(c._id);
                                setReplyText("");
                              }}
                              className="text-[11px] font-extrabold text-[#0A4DA6] hover:underline cursor-pointer"
                            >
                              Reply
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white dark:bg-[#0B192C] rounded-[32px] p-6 border border-gray-100 dark:border-slate-800 shadow-sm space-y-4">
              <div className="pt-2 border-t border-gray-100 dark:border-slate-800 space-y-3">
                <h5 className="font-black text-xs text-gray-400 tracking-wider">
                  Related Articles
                </h5>
                <div className="space-y-3">
                  {relatedPosts?.map((item: any) => (
                    <div
                      key={item._id}
                      onClick={() => navigate(`/blog/${item.slug}`)}
                      className="flex gap-3 items-center group cursor-pointer"
                    >
                      <img
                        src={
                          item.coverImage ||
                          item.featuredImage ||
                          "/blogs/rishikesh_ashram_1785404729056.png"
                        }
                        alt={item.title}
                        className="w-14 h-14 rounded-xl object-cover shrink-0 group-hover:scale-105 transition-transform"
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src =
                            "/blogs/rishikesh_ashram_1785404729056.png";
                        }}
                      />
                      <div className="space-y-0.5">
                        <h6 className="font-extrabold text-xs text-[#0B192C] dark:text-white line-clamp-2 group-hover:text-[#0A4DA6] transition-colors">
                          {item.title}
                        </h6>
                        <span className="text-[10px] text-gray-400 font-bold">
                          {item.readingTime || "5 min read"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-gradient-to-br from-[#0B192C] to-[#0A4DA6] text-white p-6 rounded-2xl space-y-3 text-center shadow-lg">
                <Sparkles size={24} className="text-amber-400 mx-auto" />
                <h5 className="font-black text-sm">Planning a Pilgrimage?</h5>
                <p className="text-xs text-blue-100 font-medium">
                  Book verified ashram stays, satvik rooms & temple darshan
                  online.
                </p>
                <button
                  onClick={() => navigate("/search")}
                  className="w-full py-2.5 rounded-full bg-[#E58C28] hover:bg-amber-600 text-white font-black text-xs shadow-md transition-colors cursor-pointer"
                >
                  Explore Ashram Stays →
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
