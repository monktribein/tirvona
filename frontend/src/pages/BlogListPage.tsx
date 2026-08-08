import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import {
  Search,
  Play,
  BookOpen,
  Calendar,
  Eye,
  CheckCircle2,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { visitorArticleService } from "../services/visitorArticleService";

export const BlogListPage: React.FC = () => {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const selectedCategory = "All";
  const selectedType = "All";
  const [searchTerm, setSearchTerm] = useState("");

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const blogParams: Record<string, any> = {};
      const visitorParams: Record<string, any> = {};

      if (selectedCategory && selectedCategory.toLowerCase() !== "all") {
        blogParams.category = selectedCategory;
        visitorParams.category = selectedCategory;
      }
      if (selectedType && selectedType.toLowerCase() !== "all") {
        blogParams.contentType = selectedType;
      }
      if (searchTerm && searchTerm.trim() !== "") {
        blogParams.search = searchTerm.trim();
        visitorParams.search = searchTerm.trim();
      }

      const [blogRes, visitorRes] = await Promise.all([
        api
          .get("/blog/posts", { params: blogParams })
          .catch(() => ({ data: { success: false, data: [] } })),
        visitorArticleService
          .getPublicArticles(visitorParams)
          .catch(() => ({ data: { success: false, data: [] } })),
      ]);

      const blogPosts = blogRes.data?.success ? blogRes.data.data : [];
      const visitorPosts = (
        visitorRes.data?.success ? visitorRes.data.data : []
      ).map((va: any) => ({
        _id: va._id,
        title: va.title,
        slug: va.slug,
        excerpt: va.shortDescription,
        coverImage: va.featuredImage,
        category: va.category || "Visitor Story",
        createdAt: va.createdAt,
        views: va.viewsCount || 0,
        readingTime: "5 min read",
        isVerifiedStay: true,
        ashramName: va.ashramId?.name,
        authorId: {
          name: va.visitorId?.name || "Verified Visitor",
          photo:
            va.visitorId?.avatar ||
            "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100%25' height='100%25' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='1.5'%3E%3Crect width='100%25' height='100%25' fill='%23f1f5f9'/%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'/%3E%3Cpath d='m21 15-5-5-11 11'/%3E%3C/svg%3E",
        },
      }));

      setPosts([...visitorPosts, ...blogPosts]);
    } catch (err) {
      console.error("Error fetching blog list:", err);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, selectedCategory, selectedType]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchPosts();
  };

  return (
    <div className="min-h-screen pb-16">
      {/* Primary Clean Text Header (Matching all other section headers on the site) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 mb-6">
        <div className="text-center space-y-2.5 max-w-3xl mx-auto py-2">
          <p className="font-['Kalam'] text-2xl sm:text-4xl lg:text-5xl font-bold text-[#E58C28]">
            Sacred Articles &amp; Knowledge Hub
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
            Explore authentic temple history, travel guides, live video
            documentaries, ashram experiences, and mahaprasad stories.
          </p>
          {/* Integrated Search Bar */}
          <form
            onSubmit={handleSearch}
            className="max-w-xl mx-auto pt-3 flex items-center relative z-10"
          >
            <div className="w-full bg-white dark:bg-[#0B192C] rounded-full p-2 shadow-lg border border-gray-200 dark:border-slate-800 flex items-center">
              <Search size={18} className="text-gray-400 ml-4 shrink-0" />
              <input
                type="text"
                placeholder="Search articles, videos, temples, or authors..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-transparent px-3 text-xs sm:text-sm font-semibold text-[#0B192C] dark:text-white focus:outline-none"
              />
              <button
                type="submit"
                className="px-6 py-2.5 rounded-full bg-[#0A4DA6] hover:bg-blue-900 text-white font-black text-xs transition-colors shrink-0 shadow-sm cursor-pointer"
              >
                Search
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Post Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-8">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-80 bg-gray-200 dark:bg-slate-800 animate-pulse rounded-3xl"
              />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-[#0B192C] rounded-3xl border border-gray-200 dark:border-slate-800">
            <BookOpen size={48} className="text-gray-400 mx-auto mb-3" />
            <h3 className="font-black text-lg text-gray-700 dark:text-gray-200">
              No Posts Found
            </h3>
            <p className="text-xs text-gray-400">
              Try adjusting your filters or search term.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((item) => {
              const isVideo = item.youtubeUrl || item.contentType === "video";
              const targetUrl = isVideo
                ? `/video/${item.slug}`
                : `/blog/${item.slug}`;
              const author = item.authorId || {};

              return (
                <div
                  key={item._id}
                  onClick={() => navigate(targetUrl)}
                  className="bg-white dark:bg-[#0B192C] rounded-3xl border border-gray-100 dark:border-slate-800 overflow-hidden shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between cursor-pointer group"
                >
                  <div>
                    {/* Image / Video Thumbnail Container */}
                    <div className="relative h-52 overflow-hidden bg-slate-900">
                      <img
                        src={item.coverImage}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src =
                            "/blogs/rishikesh_ashram_1785404729056.png";
                        }}
                      />

                      {/* Dynamic Video Overlay Detection */}
                      {isVideo ? (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <div className="w-12 h-12 rounded-full bg-red-600/90 text-white flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform">
                            <Play size={20} className="fill-white ml-1" />
                          </div>
                          <span className="absolute bottom-3 right-3 bg-black/80 backdrop-blur-md text-white text-[10px] font-extrabold px-2.5 py-1 rounded-md">
                            {item.youtubeDuration || "Video"}
                          </span>
                        </div>
                      ) : (
                        <span className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-md text-white text-[10px] font-extrabold px-2.5 py-1 rounded-md">
                          {item.readingTime || "5 min read"}
                        </span>
                      )}
                    </div>

                    <div className="p-6 space-y-3 flex-1 flex flex-col justify-between">
                      <div className="flex items-center gap-3 text-[11px] font-bold text-gray-400">
                        <span className="flex items-center gap-1">
                          <Calendar size={12} className="text-[#0A4DA6]" />{" "}
                          {new Date(item.createdAt).toLocaleDateString(
                            "en-IN",
                            { day: "numeric", month: "short", year: "numeric" },
                          )}
                        </span>
                        <span className="flex items-center gap-1">
                          <Eye size={12} className="text-[#0A4DA6]" />{" "}
                          {item.views} Views
                        </span>
                      </div>

                      <h3 className="font-black text-lg text-[#0B192C] dark:text-white leading-tight group-hover:text-[#0A4DA6] transition-colors line-clamp-2 h-12 flex items-start">
                        {item.title}
                      </h3>

                      <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed h-9 overflow-hidden">
                        {item.excerpt}
                      </p>
                    </div>
                  </div>

                  {/* Author Strip Footer */}
                  <div className="px-6 py-4 flex items-center justify-between border-t border-gray-50 dark:border-slate-800/50 mt-auto shrink-0 h-16">
                    <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                      <img
                        src={
                          author.photo ||
                          "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100%25' height='100%25' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='1.5'%3E%3Crect width='100%25' height='100%25' fill='%23f1f5f9'/%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'/%3E%3Cpath d='m21 15-5-5-11 11'/%3E%3C/svg%3E"
                        }
                        alt={author.name}
                        className="w-7 h-7 rounded-full object-cover border border-[#0A4DA6] shrink-0"
                      />
                      <span className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1 truncate">
                        <span className="truncate">
                          {author.name || "Verified Author"}
                        </span>
                        <CheckCircle2
                          size={12}
                          className="text-emerald-500 shrink-0"
                        />
                      </span>
                    </div>

                    <button className="px-3.5 py-1.5 rounded-full bg-gray-100 dark:bg-slate-800 group-hover:bg-[#0A4DA6] group-hover:text-white text-gray-700 dark:text-gray-200 text-xs font-bold transition-all flex items-center gap-1 whitespace-nowrap shrink-0">
                      <span>{isVideo ? "Watch" : "Read"}</span>
                      <ArrowRight size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
