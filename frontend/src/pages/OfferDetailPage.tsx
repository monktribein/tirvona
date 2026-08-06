import React, { useState, useEffect } from "react";
import api from "../lib/api";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  Clock,
  Sparkles,
  MapPin,
  Building,
  CheckCircle2,
  Copy,
  ArrowRight,
  Percent,
  ChevronRight,
  Gift,
  FileText,
  Sun,
  HeartHandshake,
} from "lucide-react";
import { useNotifications } from "../contexts/NotificationContext";

export const OfferDetailPage: React.FC = () => {
  const { offerId } = useParams();
  const { addNotification } = useNotifications();
  const navigate = useNavigate();

  const [offer, setOffer] = useState<any | null>(null);
  const [relatedOffers, setRelatedOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // Countdown timer state
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  }>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  useEffect(() => {
    fetchOfferDetail();
  }, [offerId]);

  useEffect(() => {
    if (!offer?.validTill) return;
    const interval = setInterval(() => {
      const distance =
        new Date(offer.validTill).getTime() - new Date().getTime();
      if (distance < 0) {
        clearInterval(interval);
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      } else {
        setTimeLeft({
          days: Math.floor(distance / (1000 * 60 * 60 * 24)),
          hours: Math.floor(
            (distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
          ),
          minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((distance % (1000 * 60)) / 1000),
        });
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [offer]);

  const fetchOfferDetail = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/offers/${offerId}`);
      if (res.data.success) {
        setOffer(res.data.data);
        setRelatedOffers(res.data.relatedOffers || []);
      }
    } catch (err) {
      console.error("Fetch offer detail error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = () => {
    if (!offer) return;
    navigator.clipboard.writeText(offer.promoCode);
    setCopied(true);
    addNotification(
      "Promo Code Copied!",
      `"${offer.promoCode}" copied to clipboard.`,
      "success",
    );
    setTimeout(() => setCopied(false), 2500);
  };

  const handleBookNow = () => {
    if (!offer) return;
    const targetAshram =
      offer.ashramId || (offer.applicableAshrams && offer.applicableAshrams[0]);
    if (targetAshram?._id) {
      navigate(
        `/ashram/${targetAshram._id}?promoCode=${encodeURIComponent(offer.promoCode)}`,
      );
    } else {
      navigate(`/search?promoCode=${encodeURIComponent(offer.promoCode)}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen p-8 flex items-center justify-center">
        <div className="space-y-4 text-center">
          <div className="w-12 h-12 border-4 border-[#0A4DA6] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-extrabold text-gray-400">
            Loading Offer Landing Page...
          </p>
        </div>
      </div>
    );
  }

  if (!offer) {
    return (
      <div className="min-h-screen p-12 text-center space-y-4">
        <Gift size={48} className="mx-auto text-gray-400" />
        <h2 className="text-2xl font-black text-[#0B192C] dark:text-white">
          Offer Not Found
        </h2>
        <p className="text-xs text-gray-400">
          This promotion might have expired or been removed.
        </p>
        <Link
          to="/offers"
          className="inline-block px-6 py-3 bg-[#0A4DA6] text-white font-bold text-xs rounded-full"
        >
          Browse All Offers
        </Link>
      </div>
    );
  }

  const primaryAshram =
    offer.ashramId || (offer.applicableAshrams && offer.applicableAshrams[0]);

  return (
    <div className="min-h-screen pb-28 space-y-10">
      {/* Hero Section */}
      <div className="relative bg-black text-white min-h-[420px] flex items-center overflow-hidden">
        {/* Background Image with Dark Gradient Overlay */}
        <img
          src={offer.bannerImage || "/banner/ashram_rishikesh.png"}
          alt={offer.offerTitle}
          className="absolute inset-0 w-full h-full object-cover opacity-50 filter brightness-75"
          onError={(e: any) => {
            e.target.src = "/banner/ashram_rishikesh.png";
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B192C] via-[#0B192C]/60 to-transparent" />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-8 py-12 space-y-6 z-10 w-full">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-300">
            <Link to="/" className="hover:text-white">
              Home
            </Link>
            <ChevronRight size={12} />
            <Link to="/offers" className="hover:text-white">
              Offers
            </Link>
            <ChevronRight size={12} />
            <span className="text-amber-400 font-bold">
              {offer.shortTitle || offer.offerTitle}
            </span>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="px-4 py-1.5 rounded-full bg-[#0A4DA6] text-white text-xs font-black tracking-wider shadow-lg">
              {offer.offerType || "Special Promotion"}
            </span>
            <span className="px-4 py-1.5 rounded-full bg-amber-500 text-white text-xs font-black shadow-lg flex items-center gap-1.5">
              <Percent size={14} />
              {offer.discountType === "Percentage"
                ? `${offer.discountValue}% OFF`
                : `FLAT ₹${offer.discountValue} OFF`}
            </span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black max-w-3xl leading-tight">
            {offer.offerTitle}
          </h1>

          <p className="text-sm sm:text-base text-gray-200 max-w-2xl font-medium leading-relaxed">
            {offer.description}
          </p>

          {/* Countdown Timer */}
          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 inline-flex items-center gap-4 text-white">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-400 border-r border-white/20 pr-4">
              <Clock size={16} /> Offer Ends In:
            </div>
            <div className="flex items-center gap-3 font-mono font-black text-lg">
              <div>
                <span className="text-amber-400">{timeLeft.days}</span>
                <span className="text-[10px] block font-sans text-gray-300">
                  DAYS
                </span>
              </div>
              <span>:</span>
              <div>
                <span className="text-amber-400">{timeLeft.hours}</span>
                <span className="text-[10px] block font-sans text-gray-300">
                  HRS
                </span>
              </div>
              <span>:</span>
              <div>
                <span className="text-amber-400">{timeLeft.minutes}</span>
                <span className="text-[10px] block font-sans text-gray-300">
                  MINS
                </span>
              </div>
              <span>:</span>
              <div>
                <span className="text-amber-400">{timeLeft.seconds}</span>
                <span className="text-[10px] block font-sans text-gray-300">
                  SECS
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Body */}
      <div className="max-w-6xl mx-auto px-4 sm:px-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Overview, Highlights, Benefits, Terms */}
        <div className="lg:col-span-2 space-y-8">
          {/* Highlights & Included Benefits */}
          <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-sm">
            <h2 className="text-xl font-black text-[#0B192C] dark:text-white">
              Offer Highlights & Included Perks
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(offer.highlights && offer.highlights.length > 0
                ? offer.highlights
                : [
                    "Complimentary pure Satvik breakfast & tea",
                    "Direct access to sacred Ganga Aarti ghats",
                    "Free room upgrade subject to availability",
                    "Special Vedic prasad packet upon check-in",
                  ]
              ).map((h: string, i: number) => (
                <div
                  key={i}
                  className="flex items-start gap-3 bg-blue-50/50 dark:bg-blue-900/10 p-3.5 rounded-2xl border border-blue-100 dark:border-blue-800/30"
                >
                  <CheckCircle2
                    size={16}
                    className="text-[#0A4DA6] dark:text-amber-400 shrink-0 mt-0.5"
                  />
                  <span className="text-xs font-bold text-gray-700 dark:text-gray-200">
                    {h}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Applicable Ashrams */}
          {primaryAshram && (
            <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-3xl p-6 sm:p-8 space-y-4 shadow-sm">
              <h2 className="text-xl font-black text-[#0B192C] dark:text-white flex items-center gap-2">
                <Building size={20} className="text-[#0A4DA6]" /> Applicable
                Ashram Accommodation
              </h2>

              <div className="bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1 text-center sm:text-left">
                  <h3 className="font-extrabold text-base text-[#0B192C] dark:text-white">
                    {primaryAshram.name}
                  </h3>
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 font-bold">
                    <MapPin size={13} className="text-[#0A4DA6]" />
                    <span>
                      {primaryAshram.address?.city || "Haridwar"},{" "}
                      {primaryAshram.address?.state || "Uttarakhand"}
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleBookNow}
                  className="px-6 py-3 bg-[#0A4DA6] hover:bg-[#083b80] text-white font-extrabold text-xs rounded-full cursor-pointer shadow-md shadow-[#0A4DA6]/20 transition-all shrink-0"
                >
                  Book This Ashram
                </button>
              </div>
            </div>
          )}

          {/* Terms & Conditions */}
          <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-3xl p-6 sm:p-8 space-y-4 shadow-sm">
            <h2 className="text-xl font-black text-[#0B192C] dark:text-white flex items-center gap-2">
              <FileText size={20} className="text-gray-400" /> Terms &
              Guidelines
            </h2>

            <ul className="space-y-2 text-xs text-gray-600 dark:text-gray-300 font-semibold list-disc list-inside leading-relaxed">
              {(offer.termsAndConditions && offer.termsAndConditions.length > 0
                ? offer.termsAndConditions
                : [
                    "Valid for new bookings made through Tirvona platform.",
                    "Promo code must be applied prior to payment confirmation.",
                    "Cannot be combined with any other promotional coupons.",
                    "Subject to room availability during high festival dates.",
                  ]
              ).map((t: string, i: number) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* Right Column: Promo Box Sidebar & Booking Card */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#0B192C] border border-amber-500/30 rounded-3xl p-6 space-y-6 shadow-xl sticky top-24">
            <div className="space-y-2 border-b border-gray-100 dark:border-slate-800 pb-4">
              <span className="text-[10px] font-black tracking-widest text-amber-500">
                EXCLUSIVE PROMO CODE
              </span>
              <div className="flex items-center justify-between bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4">
                <span className="font-mono font-black text-xl text-[#0B192C] dark:text-white">
                  {offer.promoCode}
                </span>
                <button
                  onClick={handleCopyCode}
                  className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs rounded-xl flex items-center gap-1 cursor-pointer"
                >
                  <Copy size={13} /> {copied ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>

            <div className="space-y-3 text-xs font-bold text-gray-600 dark:text-gray-300">
              <div className="flex justify-between">
                <span>Discount Offer:</span>
                <span className="text-emerald-600 font-black">
                  {offer.discountType === "Percentage"
                    ? `${offer.discountValue}% OFF`
                    : `FLAT ₹${offer.discountValue} OFF`}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Min Booking Amount:</span>
                <span className="font-black text-[#0B192C] dark:text-white">
                  {offer.minimumBookingAmount > 0
                    ? `₹${offer.minimumBookingAmount}`
                    : "No Minimum"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Remaining Redemptions:</span>
                <span className="font-black text-[#0A4DA6] dark:text-amber-400">
                  {offer.remainingRedemptions} Left
                </span>
              </div>
            </div>

            <button
              onClick={handleBookNow}
              className="w-full py-4 bg-[#0A4DA6] hover:bg-[#083b80] text-white font-black text-sm rounded-full shadow-xl shadow-[#0A4DA6]/30 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
            >
              Book Offer Now <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Sticky Bottom Booking Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/90 dark:bg-[#0B192C]/90 backdrop-blur-md border-t border-gray-200 dark:border-slate-800 p-4 shadow-2xl">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div>
            <div className="text-[10px] font-black text-amber-500">
              APPLY CODE AT CHECKOUT
            </div>
            <div className="font-mono font-black text-sm text-[#0B192C] dark:text-white">
              {offer.promoCode}
            </div>
          </div>

          <button
            onClick={handleBookNow}
            className="px-8 py-3 bg-[#0A4DA6] hover:bg-[#083b80] text-white font-black text-xs sm:text-sm rounded-full shadow-lg shadow-[#0A4DA6]/30 flex items-center gap-2 cursor-pointer active:scale-95"
          >
            Book This Offer <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default OfferDetailPage;
