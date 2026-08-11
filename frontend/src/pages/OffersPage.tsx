import React, { useState, useEffect, useCallback } from "react";
import api from "../lib/api";
import { useNavigate, useParams } from "react-router-dom";
import {
  Search,
  Sparkles,
  Gift,
} from "lucide-react";
import { useNotifications } from "../contexts/NotificationContext";
import { CouponVoucherCard } from "../components/CouponVoucherCard";

export const OffersPage: React.FC = () => {
  const { category: urlCategory, city: urlCity } = useParams();
  const { addNotification } = useNotifications();
  const navigate = useNavigate();

  const [offers, setOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const selectedCategory = urlCategory || "All";
  const selectedCity = urlCity || "All";
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // This page used to substitute five invented campaigns whenever the API
  // returned nothing — or failed. Visitors were offered promo codes
  // (KUMBH2026, VRINDAVAN25, YOGA2026 …) that no coupon backed, so every one
  // of them was rejected at checkout. An empty catalogue now shows the empty
  // state, and a failed request says so instead of quietly inventing stock.
  const [loadFailed, setLoadFailed] = useState(false);

  const fetchOffers = useCallback(async () => {
    setLoading(true);
    try {
      let url = "/offers?status=active";
      if (selectedCategory !== "All") {
        url += `&category=${encodeURIComponent(selectedCategory)}`;
      }
      if (selectedCity !== "All") {
        url += `&city=${encodeURIComponent(selectedCity)}`;
      }

      const res = await api.get(url);
      setOffers(
        res.data?.success && Array.isArray(res.data.data) ? res.data.data : [],
      );
      setLoadFailed(false);
    } catch (err) {
      console.error("Fetch public offers error:", err);
      setOffers([]);
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, selectedCity]);

  useEffect(() => {
    fetchOffers();
  }, [fetchOffers]);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    addNotification(
      "Promo Code Copied!",
      `"${code}" copied to clipboard.`,
      "success",
    );
    setTimeout(() => setCopiedCode(null), 2500);
  };

  /**
   * A coupon bound to one ashram opens that ashram's booking page with the
   * code already in the query, where the detail page validates and applies it.
   * Only an unbound, platform-wide coupon falls back to search.
   */
  const handleBookWithOffer = (offer: any) => {
    const ashramId = String(
      offer.ashramId?._id ??
        offer.ashramId ??
        offer.applicableAshrams?.[0]?._id ??
        offer.applicableAshrams?.[0] ??
        "",
    );
    const promo = encodeURIComponent(offer.promoCode || "");
    navigate(
      ashramId
        ? `/ashram/${ashramId}?promoCode=${promo}`
        : `/search?promoCode=${promo}`,
    );
  };

  const filteredOffers = offers.filter((o) => {
    const q = searchQuery.toLowerCase().trim();
    const titleMatch = (o.offerTitle || o.title || "").toLowerCase().includes(q);
    const codeMatch = (o.promoCode || "").toLowerCase().includes(q);
    const descMatch = (o.description || o.bannerText || "").toLowerCase().includes(q);
    const matchesSearch = !q || titleMatch || codeMatch || descMatch;

    const offerCat = (o.offerType || o.category || "").toLowerCase();
    const matchesCategory =
      selectedCategory === "All" ||
      offerCat.includes(selectedCategory.toLowerCase()) ||
      selectedCategory.toLowerCase().includes(offerCat);

    const offerCity = (
      o.ashramId?.address?.city ||
      o.city ||
      (o.applicableCities && o.applicableCities[0]) ||
      ""
    ).toLowerCase();
    const matchesCity =
      selectedCity === "All" ||
      offerCity.includes(selectedCity.toLowerCase()) ||
      selectedCity.toLowerCase().includes(offerCity);

    return matchesSearch && matchesCategory && matchesCity;
  });

  return (
    <div className="min-h-screen pb-20 space-y-10">
      {/* Clean Text Header (Matching all other section headers on the site) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6">
        <div className="text-center space-y-2.5 max-w-3xl mx-auto py-2">
          <p className="font-['Kalam'] text-2xl sm:text-4xl lg:text-5xl font-bold text-[#E58C28]">
            Exclusive Offers &amp; Deals
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
            Unlock instant room rate discounts, complimentary Satvik meals, and
            festival packages across verified ashrams.
          </p>
          {/* Centered Search Bar */}
          <div className="w-full max-w-xl mx-auto pt-3 relative z-10">
            <div className="bg-white dark:bg-[#0B192C] rounded-full p-2 shadow-lg border border-gray-200 dark:border-slate-800 flex items-center">
              <Search size={18} className="text-gray-400 ml-4 shrink-0" />
              <input
                type="text"
                placeholder="Search offer or promo code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent px-3 text-sm font-semibold text-[#0B192C] dark:text-white focus:outline-none"
              />
              <button
                type="button"
                className="px-6 py-2.5 rounded-full bg-[#0A4DA6] hover:bg-blue-900 text-white font-black text-xs transition-colors shrink-0 shadow-sm cursor-pointer"
              >
                Search
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Offers Cards Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-96 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-3xl animate-pulse"
              />
            ))}
          </div>
        ) : filteredOffers.length === 0 ? (
          <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-3xl p-12 text-center space-y-4 shadow-sm">
            <Gift size={48} className="mx-auto text-amber-500/50" />
            <h3 className="text-xl font-black text-[#0B192C] dark:text-white">
              {loadFailed ? "Offers Unavailable" : "No Offers Found"}
            </h3>
            <p className="text-xs text-gray-400">
              {loadFailed
                ? "We could not reach the offers service. Please try again shortly."
                : offers.length === 0
                  ? "There are no active offers right now. Please check back soon."
                  : "Try selecting another category or city filter."}
            </p>
            {loadFailed && (
              <button
                type="button"
                onClick={fetchOffers}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#0A4DA6] hover:bg-[#083b80] text-white text-xs font-extrabold cursor-pointer"
              >
                Try Again
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
            {filteredOffers.map((offer) => (
              <CouponVoucherCard
                key={offer._id}
                offer={offer}
                onBookNow={handleBookWithOffer}
                onCopyCode={handleCopyCode}
                copiedCode={copiedCode}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default OffersPage;
