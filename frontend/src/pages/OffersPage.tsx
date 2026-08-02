import React, { useState, useEffect } from "react";
import api from "../lib/api";
import { useNavigate, useParams } from "react-router-dom";
import {
  Search,
  Sparkles,
  Building,
  Copy,
  Filter,
  Flame,
  ChevronRight,
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
  const [selectedCategory, setSelectedCategory] = useState(
    urlCategory || "All",
  );
  const [selectedCity, setSelectedCity] = useState(urlCity || "All");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const categories = [
    "All",
    "Festival Offer",
    "Mahakumbh Offer",
    "Weekend Offer",
    "Meditation Camp",
    "Yoga Camp",
    "Room Upgrade",
    "Food Offer",
    "Senior Citizen Offer",
  ];

  const cities = [
    "All",
    "Rishikesh",
    "Haridwar",
    "Vrindavan",
    "Varanasi",
    "Kedarnath",
  ];

  useEffect(() => {
    fetchOffers();
  }, [selectedCategory, selectedCity]);

  const fetchOffers = async () => {
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
      if (res.data.success) {
        setOffers(res.data.data);
      }
    } catch (err) {
      console.error("Fetch public offers error:", err);
    } finally {
      setLoading(false);
    }
  };

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

  const handleBookWithOffer = (offer: any) => {
    const ashram =
      offer.ashramId || (offer.applicableAshrams && offer.applicableAshrams[0]);
    if (ashram?._id) {
      navigate(
        `/ashram/${ashram._id}?promoCode=${encodeURIComponent(offer.promoCode)}`,
      );
    } else {
      navigate(`/search?promoCode=${encodeURIComponent(offer.promoCode)}`);
    }
  };

  const filteredOffers = offers.filter(
    (o) =>
      o.offerTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.promoCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.description &&
        o.description.toLowerCase().includes(searchQuery.toLowerCase())),
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 pb-20 space-y-10">
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
              No Offers Found
            </h3>
            <p className="text-xs text-gray-400">
              Try selecting another category or city filter.
            </p>
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
