import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../lib/api";
import {
  Play,
  Eye,
  Heart,
  Share2,
  ArrowLeft,
  MessageSquare,
  CheckCircle2,
  Video,
  Sparkles,
  Clock,
} from "lucide-react";

export const VideoDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [likes, setLikes] = useState(0);
  const [hasLiked, setHasLiked] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    fetchVideoDetail();
  }, [slug]);

  const fetchVideoDetail = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/blog/posts/${slug}`);
      if (res.data.success) {
        setData(res.data.data);
        setLikes(res.data.data.post.likes || 0);
      }
    } catch (err) {
      console.error("Error fetching video detail:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async () => {
    if (hasLiked) return;
    try {
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
      alert("Video link copied to clipboard!");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#070F1B] pt-32 text-center">
        <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-xs font-bold text-gray-500">
          Loading Sacred Video...
        </p>
      </div>
    );
  }

  if (!data?.post) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#070F1B] pt-32 text-center">
        <h2 className="text-xl font-black text-gray-700 dark:text-gray-200 mb-4">
          Video Not Found
        </h2>
        <button
          onClick={() => navigate("/blog")}
          className="px-6 py-2.5 rounded-full bg-[#0A4DA6] text-white font-bold text-xs shadow-md"
        >
          Back to Knowledge Hub
        </button>
      </div>
    );
  }

  const { post, comments, relatedPosts } = data;
  const author = post?.authorId || {};

  const extractYouTubeId = (input?: any): string => {
    if (!input) return "50HnOmsPpxI";
    const str = typeof input === "string" ? input.trim() : String(input);
    if (/^[a-zA-Z0-9_-]{11}$/.test(str)) {
      return str;
    }
    const regExp =
      /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/;
    const match = str.match(regExp);
    return match && match[1] ? match[1] : "50HnOmsPpxI";
  };

  const videoId = extractYouTubeId(
    post.youtubeVideoId || post.youtubeUrl || post.videoUrl || post.content,
  );
  const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&enablejsapi=1&rel=0`;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#070F1B] pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-1 sm:pt-3 space-y-8">
        {/* 2. Embedded 16:9 Responsive Video Player Container */}
        <div className="relative rounded-[32px] overflow-hidden shadow-2xl bg-black border border-gray-800 aspect-video w-full">
          <iframe
            src={embedUrl}
            title={post.title || "Sacred Video"}
            className="w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>

        {/* 3. Main 2-Column Desktop Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Main Content Area (2 Cols) */}
          <div className="lg:col-span-2 space-y-8">
            {/* Video Header & Meta Details */}
            <div className="bg-white dark:bg-[#0B192C] rounded-[32px] p-6 sm:p-8 border border-gray-100 dark:border-slate-800 shadow-sm space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-3.5 py-1 rounded-full bg-red-600 text-white text-xs font-black tracking-wider flex items-center gap-1.5 shadow-md">
                    <Video size={14} /> Sacred Video
                  </span>
                  <span className="px-3 py-1 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 text-xs font-bold flex items-center gap-1.5">
                    <Eye size={14} className="text-red-500" />
                    {post.youtubeViews || "45.2K Views"}
                  </span>
                  <span className="px-3 py-1 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 text-xs font-bold flex items-center gap-1.5">
                    <Clock size={14} className="text-red-500" />
                    {post.youtubeDuration || "18:45"}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleLike}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-black transition-all cursor-pointer shadow-sm ${
                      hasLiked
                        ? "bg-red-600 text-white"
                        : "bg-gray-100 dark:bg-slate-800 hover:bg-red-50 text-gray-700"
                    }`}
                  >
                    <Heart
                      size={14}
                      className={
                        hasLiked ? "fill-white text-white" : "text-red-500"
                      }
                    />
                    <span>{likes}</span>
                  </button>
                  <button
                    onClick={handleShare}
                    className="p-2.5 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 transition-colors"
                  >
                    <Share2 size={15} />
                  </button>
                </div>
              </div>

              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-[#0B192C] dark:text-white leading-tight">
                {post.title}
              </h1>

              {/* Channel & Author Bar */}
              <div className="flex flex-wrap items-center justify-between gap-4 py-4 border-y border-gray-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <img
                    src={
                      author.photo ||
                      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=300&h=300&q=80"
                    }
                    alt={author.name}
                    className="w-12 h-12 rounded-full object-cover border-2 border-red-600 shadow-sm"
                  />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h4 className="font-extrabold text-sm text-[#0B192C] dark:text-white">
                        {post.youtubeChannel || author.name}
                      </h4>
                      <CheckCircle2
                        size={15}
                        className="text-red-500 fill-red-500/20"
                      />
                    </div>
                    <p className="text-[11px] text-gray-400 font-bold">
                      {author.designation || "Sacred Content Creator"}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsSubscribed(!isSubscribed)}
                  className={`px-5 py-2.5 rounded-full font-black text-xs transition-all shadow-md cursor-pointer ${
                    isSubscribed
                      ? "bg-gray-200 text-gray-700"
                      : "bg-red-600 hover:bg-red-700 text-white"
                  }`}
                >
                  {isSubscribed ? "Subscribed ✓" : "Subscribe Channel"}
                </button>
              </div>

              {/* Description */}
              <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed font-medium whitespace-pre-line">
                {post.content}
              </div>

              {/* Tags */}
              {post.tags?.length > 0 && (
                <div className="pt-4 border-t border-gray-100 dark:border-slate-800 flex flex-wrap gap-2">
                  {post.tags.map((tag: string, i: number) => (
                    <span
                      key={i}
                      className="px-3 py-1 rounded-full bg-red-50 dark:bg-slate-800 text-xs font-bold text-red-600 dark:text-red-400"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Author Profile Card */}
            <div className="bg-white dark:bg-[#0B192C] rounded-[32px] p-6 sm:p-8 border border-gray-100 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center sm:items-start gap-6">
              <img
                src={
                  author.photo ||
                  "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=300&h=300&q=80"
                }
                alt={author.name}
                className="w-20 h-20 rounded-full object-cover border-4 border-red-600 shadow-md shrink-0"
              />
              <div className="space-y-2 text-center sm:text-left">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <h4 className="font-black text-lg text-[#0B192C] dark:text-white">
                    {author.name}
                  </h4>
                  <span className="px-3 py-0.5 rounded-full bg-red-500/10 text-red-600 text-[10px] font-black">
                    VERIFIED CREATOR
                  </span>
                </div>
                <p className="text-xs font-bold text-red-600 dark:text-red-400">
                  {author.designation} • {author.organization}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed font-medium">
                  {author.bio}
                </p>
              </div>
            </div>

            {/* Comments Section */}
            <div className="bg-white dark:bg-[#0B192C] rounded-[32px] p-6 sm:p-8 border border-gray-100 dark:border-slate-800 shadow-sm space-y-6">
              <h3 className="font-black text-xl text-[#0B192C] dark:text-white flex items-center gap-2">
                <MessageSquare size={20} className="text-red-600" />
                <span>Devotee Comments ({comments?.length || 0})</span>
              </h3>

              <div className="space-y-4">
                {comments?.map((c: any) => (
                  <div
                    key={c._id}
                    className="p-4 rounded-2xl bg-gray-50/80 dark:bg-slate-900/80 border border-gray-100 dark:border-slate-800 space-y-2"
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-red-600 text-white font-extrabold text-xs flex items-center justify-center">
                          {c.userName.charAt(0)}
                        </div>
                        <h5 className="font-bold text-xs text-[#0B192C] dark:text-white">
                          {c.userName}
                        </h5>
                      </div>
                      <span className="text-[10px] text-gray-400">
                        {new Date(c.createdAt).toLocaleDateString("en-IN")}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-300 font-medium pl-9">
                      {c.comment}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Static Sidebar (Desktop Only) */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-[#0B192C] rounded-[32px] p-6 border border-gray-100 dark:border-slate-800 shadow-sm space-y-4">
              <h5 className="font-black text-xs text-gray-400 tracking-wider">
                Related Videos & Media
              </h5>

              <div className="space-y-4">
                {relatedPosts?.map((item: any) => (
                  <div
                    key={item._id}
                    onClick={() => navigate(`/video/${item.slug}`)}
                    className="flex gap-3 items-center group cursor-pointer"
                  >
                    <div className="relative w-20 h-14 rounded-xl overflow-hidden bg-slate-900 shrink-0">
                      <img
                        src={item.coverImage}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <Play size={14} className="fill-white text-white" />
                      </div>
                    </div>
                    <div className="space-y-0.5">
                      <h6 className="font-extrabold text-xs text-[#0B192C] dark:text-white line-clamp-2 group-hover:text-red-600 transition-colors">
                        {item.title}
                      </h6>
                      <span className="text-[10px] text-gray-400 font-bold">
                        {item.youtubeDuration || "Video"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Ashram Booking Banner */}
              <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-2xl space-y-3 text-center shadow-lg border border-indigo-500/20">
                <Sparkles size={24} className="text-amber-400 mx-auto" />
                <h5 className="font-black text-sm">Experience Sacred Stays</h5>
                <p className="text-xs text-indigo-200 font-medium">
                  Book verified ashram rooms near holy ghats & temples.
                </p>
                <button
                  onClick={() => navigate("/search")}
                  className="w-full py-2.5 rounded-full bg-[#0A4DA6] hover:bg-blue-900 text-white font-black text-xs shadow-md transition-colors cursor-pointer"
                >
                  Book Ashram Stay →
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 4. Pre-Footer CTA Banner */}
        <div className="mt-12 bg-gradient-to-r from-[#0B192C] via-[#0A4DA6] to-[#0B192C] text-white rounded-[32px] p-8 sm:p-10 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6 border border-white/10">
          <div className="space-y-2 text-center md:text-left max-w-2xl">
            <span className="px-3.5 py-1 rounded-full bg-white/10 text-amber-300 text-xs font-black tracking-wider">
              Continue Your Sacred Journey
            </span>
            <h3 className="text-2xl sm:text-3xl font-black">
              Explore Verified Ashrams & Sacred Videos
            </h3>
            <p className="text-xs sm:text-sm text-blue-100 font-medium">
              Watch live temple documentaries, Ganga Aarti, and book 500+
              verified ashrams across India.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={() => navigate("/search")}
              className="px-6 py-3 rounded-full bg-[#E58C28] hover:bg-amber-600 text-white font-black text-xs shadow-xl transition-all"
            >
              Book Ashram Stay
            </button>
            <button
              onClick={() => navigate("/blog")}
              className="px-6 py-3 rounded-full bg-white/10 hover:bg-white/20 text-white font-black text-xs border border-white/20 backdrop-blur-md transition-all"
            >
              Watch More Videos
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
