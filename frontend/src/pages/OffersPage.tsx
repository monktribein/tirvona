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

  const DEFAULT_OFFERS = [
    {
      _id: "default-1",
      offerType: "MAHAKUMBH OFFER",
      discountPercentage: 20,
      offerTitle: "Mahakumbh Sacred Stay Special",
      description:
        "Experience the holy Kumbh Mela 2026 with 20% OFF accommodation & VIP Ganga Aarti pass.",
      promoCode: "KUMBH2026",
      image: "",
      validity: "31 Dec 2026",
      ashramId: {
        address: { city: "Prayagraj" },
        name: "Tirvona Sacred Stay",
      },
    },
    {
      _id: "default-2",
      offerType: "WEEKEND OFFER",
      discountValue: 500,
      discountType: "FixedAmount",
      offerTitle: "Weekend Spiritual Yoga & Retreat",
      description:
        "Recharge your mind & soul with our weekend spiritual retreat package in Haridwar.",
      promoCode: "WEEKEND500",
      image: "",
      validity: "30 Jun 2026",
      ashramId: {
        address: { city: "Haridwar" },
        name: "Prem Nagar Ashram",
      },
    },
    {
      _id: "default-3",
      offerType: "FESTIVAL OFFER",
      discountPercentage: 15,
      offerTitle: "Festival Season Kashi Discount",
      description:
        "Get 15% instant savings on top verified ashrams across Kashi & Haridwar.",
      promoCode: "FESTIVAL2026",
      image: "",
      validity: "31 Dec 2026",
      ashramId: {
        address: { city: "Varanasi" },
        name: "Kashi Vishwanath Ashram",
      },
    },
    {
      _id: "default-4",
      offerType: "SPECIAL OFFER",
      discountPercentage: 25,
      offerTitle: "Vrindavan Dham Yatra Deal",
      description:
        "Exclusive 25% discount on serene dharamshala stays in holy Vrindavan.",
      promoCode: "VRINDAVAN25",
      image: "",
      validity: "31 Dec 2026",
      ashramId: {
        address: { city: "Vrindavan" },
        name: "Bhagwat Dham Ashram",
      },
    },
    {
      _id: "default-5",
      offerType: "YOGA CAMP",
      discountPercentage: 18,
      offerTitle: "Rishikesh Yoga & Meditation Retreat",
      description:
        "Immerse yourself in authentic Vedic yoga sessions along holy Ganga at 18% OFF.",
      promoCode: "YOGA2026",
      image: "",
      validity: "30 Sep 2026",
      ashramId: {
        address: { city: "Rishikesh" },
        name: "Parmarth Niketan Ashram",
      },
    },
  ];

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
      if (
        res.data.success &&
        Array.isArray(res.data.data) &&
        res.data.data.length > 0
      ) {
        setOffers(res.data.data);
      } else {
        setOffers(DEFAULT_OFFERS);
      }
    } catch (err) {
      console.error("Fetch public offers error:", err);
      setOffers(DEFAULT_OFFERS);
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

  const handleBookWithOffer = (offer: any) => {
    const ashram =
      offer.ashramId || (offer.applicableAshrams && offer.applicableAshrams[0]);
    if (ashram?._id && !String(ashram._id).startsWith("default-") && !String(ashram._id).startsWith("ashram-")) {
      navigate(
        `/ashram/${ashram._id}?promoCode=${encodeURIComponent(offer.promoCode)}`,
      );
    } else {
      navigate(`/search?promoCode=${encodeURIComponent(offer.promoCode)}`);
    }
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
