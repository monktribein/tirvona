import React, { useState, useEffect, useCallback } from "react";
import api from "../lib/api";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useCart } from "../contexts/CartContext";
import {
  ShoppingBag,
  MapPin,
  Star,
  ShieldCheck,
  Truck,
  Award,
  BookOpen,
  ChevronRight,
  HelpCircle,
  Flame,
  Zap,
} from "lucide-react";
import { useNotifications } from "../contexts/NotificationContext";
import { formatCurrency } from "../utils/format";
import { useAuth } from "../contexts/AuthContext";
import {
  clearGuestPendingIntent,
  getGuestPendingIntent,
} from "../utils/guestGate";

export const MarketplaceCategoryDetailPage: React.FC = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { addNotification } = useNotifications();
  const { user } = useAuth();
  const { add, close } = useCart();

  const [categoryData, setCategoryData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const [selectedPrice, setSelectedPrice] = useState("All");
  const [filterOrganic, setFilterOrganic] = useState(false);

  const fetchCategoryDetail = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/marketplace/category/${slug}`);
      if (res.data.success) {
        setCategoryData(res.data.data);
      }
    } catch (err) {
      console.error("Fetch category detail error:", err);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchCategoryDetail();
  }, [fetchCategoryDetail]);

  useEffect(() => {
    if (!user || !categoryData) return;
    const intent = getGuestPendingIntent();
    if (intent?.type !== "marketplace_cart" || !intent.data) return;
    const productName = String(intent.data.productName ?? "Selected product");
    addNotification(
      "Selection Restored",
      `“${productName}” is ready in your sacred cart flow.`,
      "success",
    );
    clearGuestPendingIntent();
  }, [addNotification, categoryData, user]);

  if (loading) {
    return (
      <div className="min-h-screen p-8 flex items-center justify-center">
        <div className="space-y-4 text-center">
          <div className="w-12 h-12 border-4 border-[#0A4DA6] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-extrabold text-gray-400">
            Loading Sacred Category Landing Page...
          </p>
        </div>
      </div>
    );
  }

  if (!categoryData || !categoryData.category) {
    return (
      <div className="min-h-screen p-12 text-center space-y-4">
        <ShoppingBag size={48} className="mx-auto text-gray-400" />
        <h2 className="text-2xl font-black text-[#0B192C] dark:text-white">
          Category Not Found
        </h2>
        <p className="text-xs text-gray-400">
          This marketplace category might have been renamed or moved.
        </p>
        <Link
          to="/marketplace/categories"
          className="inline-block px-6 py-3 bg-[#0A4DA6] text-white font-bold text-xs rounded-full"
        >
          Browse All Categories
        </Link>
      </div>
    );
  }

  const {
    category,
    products,
    trustedSellers,
    faqs,
  } = categoryData;

  const filteredProducts = (products || []).filter((p: any) => {
    let matchesPrice = true;
    if (selectedPrice === "under-350") matchesPrice = p.price <= 350;
    if (selectedPrice === "350-600")
      matchesPrice = p.price > 350 && p.price <= 600;
    if (selectedPrice === "over-600") matchesPrice = p.price > 600;

    let matchesOrganic = !filterOrganic || p.organic;

    return matchesPrice && matchesOrganic;
  });

  return (
    <div className="min-h-screen pb-28 space-y-10">
      <div className="relative bg-black text-white min-h-[460px] flex items-center overflow-hidden">
        {category.bannerImage || category.coverImage ? (
          <img
            src={category.bannerImage || category.coverImage}
            alt={category.name}
            className="absolute inset-0 w-full h-full object-cover opacity-50 filter brightness-75"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B192C] via-[#0B192C]/65 to-transparent" />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-8 py-12 space-y-6 z-10 w-full">
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-300">
            <Link to="/" className="hover:text-white">
              Home
            </Link>
            <ChevronRight size={12} />
            <Link to="/marketplace/categories" className="hover:text-white">
              Marketplace
            </Link>
            <ChevronRight size={12} />
            <span className="text-amber-400 font-bold">{category.name}</span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="px-4 py-1.5 rounded-full bg-amber-500 text-white text-xs font-black tracking-wider shadow-lg flex items-center gap-1">
              <Flame size={14} />{" "}
              {category.trendingBadge || "AUTHENTIC MAHASWET"}
            </span>
            <span className="px-4 py-1.5 rounded-full bg-[#0A4DA6] text-white text-xs font-black shadow-lg flex items-center gap-1.5">
              <MapPin size={13} /> {category.originCity}, {category.originState}
            </span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black max-w-3xl leading-tight">
            {category.name}
          </h1>

          <p className="text-sm sm:text-base text-gray-200 max-w-2xl font-medium leading-relaxed">
            {category.description}
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 text-white max-w-3xl">
            <div className="space-y-0.5">
              <div className="text-[10px] font-bold text-gray-300">
                Famous Temple
              </div>
              <div className="font-extrabold text-xs sm:text-sm text-amber-400 truncate">
                {category.templeName}
              </div>
            </div>

            <div className="space-y-0.5">
              <div className="text-[10px] font-bold text-gray-300">
                Avg Delivery
              </div>
              <div className="font-black text-xs sm:text-sm flex items-center gap-1">
                <Truck size={14} className="text-emerald-400" />{" "}
                {category.deliveryDays || 2} Days
              </div>
            </div>

            <div className="space-y-0.5">
              <div className="text-[10px] font-bold text-gray-300">
                Verified Vendors
              </div>
              <div className="font-black text-xs sm:text-sm flex items-center gap-1">
                <ShieldCheck size={14} className="text-amber-400" />{" "}
                {category.sellerCount || 15}+ Vendors
              </div>
            </div>

            <div className="space-y-0.5">
              <div className="text-[10px] font-bold text-gray-300">
                Customer Rating
              </div>
              <div className="font-black text-xs sm:text-sm flex items-center gap-1">
                <Star size={14} className="text-amber-400 fill-amber-400" />{" "}
                {category.rating || 4.9} / 5.0
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-8 space-y-12">
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-sm">
          <h2 className="text-xl font-black text-[#0B192C] dark:text-white">
            Sacred History & Religious Significance
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-gray-600 dark:text-gray-300 font-semibold leading-relaxed">
            <div className="space-y-3 bg-gray-50 dark:bg-slate-900/60 p-5 rounded-2xl border border-gray-100 dark:border-slate-800">
              <h3 className="font-extrabold text-sm text-[#0B192C] dark:text-white flex items-center gap-1.5">
                <BookOpen size={15} className="text-[#0A4DA6]" /> Origin &
                Temple History
              </h3>
              <p>
                {category.history ||
                  `${category.name} has been prepared at ${category.templeName} for centuries following authentic Vedic recipes using pure cow ghee.`}
              </p>
            </div>

            <div className="space-y-3 bg-gray-50 dark:bg-slate-900/60 p-5 rounded-2xl border border-gray-100 dark:border-slate-800">
              <h3 className="font-extrabold text-sm text-[#0B192C] dark:text-white flex items-center gap-1.5">
                <Award size={15} className="text-amber-500" /> Why Devotees
                Revere It
              </h3>
              <p>
                {category.importance ||
                  category.whyFamous ||
                  `Crafted by traditional halwais and offered directly as Mahaprasad to the deity before packaging.`}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black text-[#0B192C] dark:text-white">
                Fresh Temple Products ({filteredProducts.length})
              </h2>
              <p className="text-xs text-gray-400 font-semibold">
                Packed directly from certified temple vendors in{" "}
                {category.originCity}.
              </p>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
              {[
                { value: "All", label: "All" },
                { value: "under-350", label: `Under ${formatCurrency(350)}` },
                { value: "350-600", label: `${formatCurrency(350)} - ${formatCurrency(600)}` },
                { value: "over-600", label: `${formatCurrency(600)}+` },
              ].map((p) => (
                <button
                  key={p.value}
                  onClick={() => setSelectedPrice(p.value)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-black cursor-pointer whitespace-nowrap transition-all ${selectedPrice === p.value
                    ? "bg-[#0A4DA6] text-white shadow-sm"
                    : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200"
                    }`}
                >
                  {p.label}
                </button>
              ))}

              <button
                onClick={() => setFilterOrganic(!filterOrganic)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-black cursor-pointer whitespace-nowrap transition-all ${filterOrganic
                  ? "bg-emerald-600 text-white"
                  : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300"
                  }`}
              >
                100% Organic
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts.map((prod: any) => (
              <div
                key={prod._id}
                onClick={() => navigate(`/marketplace/products/${prod.slug || prod._id}`)}
                className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[32px] overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between group cursor-pointer"
              >
                <div>
                  <div className="relative aspect-video bg-black overflow-hidden">
                    {prod.images?.[0] || category.coverImage ? (
                      <img
                        src={prod.images?.[0] || category.coverImage}
                        alt={prod.productName || prod.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90"
                      />
                    ) : null}
                    <span className="absolute top-3 right-3 px-3 py-1 rounded-full bg-amber-500 text-white text-xs font-black">
                      {formatCurrency(prod.price)} ({prod.weight || "500g"})
                    </span>
                  </div>

                  <div className="p-6 space-y-3">
                    <h3 className="font-extrabold text-base text-[#0B192C] dark:text-white group-hover:text-[#0A4DA6] transition-colors">
                      {prod.productName || prod.name}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed font-semibold">
                      {prod.description}
                    </p>

                    <div className="flex items-center justify-between text-xs font-bold text-gray-400 pt-1">
                      <span className="flex items-center gap-1 text-[#0A4DA6] dark:text-amber-400">
                        <ShieldCheck size={13} />{" "}
                        {prod.storeName || category.templeName}
                      </span>
                      <span className="flex items-center gap-1 text-amber-500">
                        <Star size={12} className="fill-amber-500" />{" "}
                        {prod.rating || 4.9}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-6 pt-0 flex items-center gap-2 border-t border-gray-100 dark:border-slate-800/80 pt-4">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      add({
                        productId: prod._id,
                        name: prod.productName || prod.name,
                        slug: prod.slug,
                        image: prod.images?.[0] || category.coverImage,
                        displayPrice: prod.price,
                      });
                    }}
                    className="flex-1 py-3 bg-[#0A4DA6]/10 hover:bg-[#0A4DA6] text-[#0A4DA6] hover:text-white font-extrabold text-xs rounded-full cursor-pointer transition-all flex items-center justify-center gap-1.5"
                  >
                    <ShoppingBag size={14} /> Add to cart
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      add(
                        {
                          productId: prod._id,
                          name: prod.productName || prod.name,
                          slug: prod.slug,
                          image: prod.images?.[0] || category.coverImage,
                          displayPrice: prod.price,
                        },
                        1,
                        false,
                      );
                      close();
                      navigate("/marketplace/checkout");
                    }}
                    className="flex-1 py-3 bg-[#E58C28] hover:bg-amber-600 text-white font-extrabold text-xs rounded-full cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow-md"
                  >
                    <Zap size={14} /> Buy now
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {trustedSellers && trustedSellers.length > 0 && (
          <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-sm">
            <h2 className="text-xl font-black text-[#0B192C] dark:text-white flex items-center gap-2">
              <ShieldCheck size={20} className="text-[#0A4DA6]" /> Verified &
              Certified Temple Vendors
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {trustedSellers.map((seller: any) => (
                <div
                  key={seller.id}
                  className="bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 flex items-center gap-4"
                >
                  <img
                    src={seller.photo}
                    alt={seller.name}
                    className="w-14 h-14 rounded-2xl object-cover shrink-0"
                  />
                  <div className="space-y-1">
                    <div className="font-extrabold text-sm text-[#0B192C] dark:text-white flex items-center gap-1.5">
                      <span>{seller.name}</span>
                      <ShieldCheck size={14} className="text-emerald-500" />
                    </div>
                    <p className="text-xs text-gray-500 font-semibold">
                      {seller.templeAssociation} • {seller.yearsOfService} Yrs
                      Service
                    </p>
                    <div className="text-[11px] font-black text-amber-500 flex items-center gap-1">
                      <Star size={11} className="fill-amber-500" />{" "}
                      {seller.rating} Rating
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {faqs && faqs.length > 0 && (
          <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-3xl p-6 sm:p-8 space-y-4 shadow-sm">
            <h2 className="text-xl font-black text-[#0B192C] dark:text-white flex items-center gap-2">
              <HelpCircle size={20} className="text-gray-400" /> Frequently
              Asked Questions
            </h2>

            <div className="space-y-3">
              {faqs.map((faq: any, idx: number) => (
                <div
                  key={idx}
                  className="bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl p-4 space-y-1"
                >
                  <h4 className="font-extrabold text-sm text-[#0B192C] dark:text-white flex items-center gap-2">
                    <span className="text-[#0A4DA6] font-black">Q:</span>{" "}
                    {faq.q}
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold pl-5 leading-relaxed">
                    {faq.a}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MarketplaceCategoryDetailPage;
