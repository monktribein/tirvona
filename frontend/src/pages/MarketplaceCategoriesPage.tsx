import React, { useState, useEffect } from "react";
import api from "../lib/api";
import { useNavigate, Link } from "react-router-dom";
import {
  ShoppingBag,
  Search,
  MapPin,
  Star,
  ChevronRight,
  Award,
  CheckCircle2,
  Clock,
  ArrowRight,
} from "lucide-react";

export const MarketplaceCategoriesPage: React.FC = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const res = await api.get("/marketplace/categories");
      if (res.data.success) {
        setCategories(res.data.data);
      }
    } catch (err) {
      console.error("Fetch categories error:", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredCategories = categories.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.templeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.originCity.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="min-h-screen pb-20 space-y-10">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#0B192C] via-[#0A4DA6] to-[#0B192C] text-white py-14 px-4 sm:px-8 shadow-xl">
        <div className="max-w-6xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-black border border-amber-500/30 backdrop-blur-md">
            <ShoppingBag size={14} /> Sacred Temple Prashad & Authentic Sweets
            Marketplace
          </div>

          <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
            All Sacred Marketplace Categories
          </h1>

          <p className="text-sm sm:text-base text-gray-200 max-w-2xl font-medium leading-relaxed">
            Explore authentic temple prashad, traditional sweets, and sacred
            offerings sourced directly from certified temple vendors across
            Kashi, Tirupati, Ayodhya, Puri, and Mathura.
          </p>

          <div className="flex items-center gap-2 text-xs font-semibold text-gray-300 pt-2">
            <Link to="/" className="hover:text-white">
              Home
            </Link>
            <ChevronRight size={12} />
            <span className="text-amber-400 font-bold">
              Marketplace Categories
            </span>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-6xl mx-auto px-4 sm:px-8 space-y-8">
        {/* Search Bar */}
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-3xl p-4 shadow-sm flex items-center justify-between gap-4">
          <div className="relative w-full">
            <Search
              size={16}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              placeholder="Search category, temple name (e.g. Varanasi Peda, Tirupati Laddu, Ayodhya Prasad)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-full pl-11 pr-4 py-3 text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]"
            />
          </div>
        </div>

        {/* Categories Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div
                key={n}
                className="h-80 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-3xl animate-pulse"
              />
            ))}
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-3xl p-12 text-center space-y-4 shadow-sm">
            <ShoppingBag
              size={48}
              className="mx-auto text-gray-300 dark:text-gray-600"
            />
            <h3 className="text-xl font-black text-[#0B192C] dark:text-white">
              No Categories Found
            </h3>
            <p className="text-xs text-gray-400">
              Try adjusting your search query.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCategories.map((cat) => (
              <div
                key={cat._id}
                onClick={() => navigate(`/marketplace/category/${cat.slug}`)}
                className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[32px] overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 group cursor-pointer flex flex-col justify-between"
              >
                <div>
                  {/* Category Thumbnail */}
                  <div className="relative aspect-video bg-black overflow-hidden">
                    {cat.coverImage || cat.thumbnail ? (
                      <img
                        src={cat.coverImage || cat.thumbnail}
                        alt={cat.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90"
                      />
                    ) : null}
                    <span className="absolute top-3 left-3 px-3 py-1 rounded-full bg-[#0A4DA6] text-white text-[10px] font-black shadow-lg">
                      {cat.trendingBadge || "POPULAR"}
                    </span>
                    <span className="absolute top-3 right-3 px-3 py-1 rounded-full bg-white/95 dark:bg-[#0B192C]/90 text-[#0B192C] dark:text-white text-xs font-black shadow-lg flex items-center gap-1">
                      <Star
                        size={12}
                        className="text-amber-500 fill-amber-500"
                      />
                      {cat.rating || 4.9}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="p-6 space-y-3">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#0A4DA6] dark:text-amber-400">
                      <MapPin size={13} />
                      <span>
                        {cat.originCity}, {cat.originState}
                      </span>
                    </div>

                    <h3 className="font-black text-lg text-[#0B192C] dark:text-white group-hover:text-[#0A4DA6] dark:group-hover:text-amber-400 transition-colors">
                      {cat.name}
                    </h3>

                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed font-semibold">
                      {cat.description}
                    </p>

                    <div className="bg-blue-50/60 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30 rounded-2xl p-3 flex items-center justify-between text-xs">
                      <span className="font-bold text-gray-600 dark:text-gray-300">
                        Associated Temple:
                      </span>
                      <span className="font-black text-[#0B192C] dark:text-white truncate max-w-[160px]">
                        {cat.templeName}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="px-6 pb-6 pt-2 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between text-xs font-bold">
                  <span className="text-gray-400 flex items-center gap-1">
                    <Clock size={13} /> {cat.deliveryDays || 2} Days Delivery
                  </span>
                  <span className="text-[#0A4DA6] font-black flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                    Explore Category <ArrowRight size={13} />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MarketplaceCategoriesPage;
