import React, { useState, useEffect, useCallback } from "react";
import api from "../lib/api";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  Clock,
  MapPin,
  Building,
  CheckCircle2,
  Copy,
  ArrowRight,
  Percent,
  ChevronLeft,
  Gift,
  FileText,
} from "lucide-react";
import { useNotifications } from "../contexts/NotificationContext";
import { formatCurrency } from "../utils/format";

export const OfferDetailPage: React.FC = () => {
  const { offerId } = useParams();
  const { addNotification } = useNotifications();
  const navigate = useNavigate();

  const [offer, setOffer] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

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

  const fetchOfferDetail = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/offers/${offerId}`);
      if (res.data.success) {
        setOffer(res.data.data);
      }
    } catch (err) {
      console.error("Fetch offer detail error:", err);
    } finally {
      setLoading(false);
    }
  }, [offerId]);

  useEffect(() => {
    fetchOfferDetail();
  }, [fetchOfferDetail]);

  useEffect(() => {
    if (!offer?.validTill) return;
    const deadline = new Date(offer.validTill);
    deadline.setHours(23, 59, 59, 999);

    const tick = () => {
      const remaining = deadline.getTime() - Date.now();
      if (remaining <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }
      const seconds = Math.floor(remaining / 1000);
      setTimeLeft({
        days: Math.floor(seconds / 86400),
        hours: Math.floor((seconds % 86400) / 3600),
        minutes: Math.floor((seconds % 3600) / 60),
        seconds: seconds % 60,
      });
    };

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [offer?.validTill]);

  const expiresAt = offer?.validTill ? new Date(offer.validTill) : null;
  if (expiresAt) expiresAt.setHours(23, 59, 59, 999);
  const hasExpired = Boolean(expiresAt && expiresAt.getTime() < Date.now());

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
    <div className="min-h-screen pt-24 pb-28 text-left space-y-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex items-center gap-2 text-xs font-extrabold text-gray-400 overflow-x-auto whitespace-nowrap">
          <Link to="/" className="hover:text-[#0A4DA6] transition-colors">
            Home
          </Link>
          <span>/</span>
          <Link to="/offers" className="hover:text-[#0A4DA6] transition-colors">
            Offers
          </Link>
          {primaryAshram?.address?.city && (
            <>
              <span>/</span>
              <span className="text-[#0A4DA6]">
                {primaryAshram.address.city}
              </span>
            </>
          )}
          <span>/</span>
          <span className="text-[#0B192C] dark:text-white truncate max-w-xs">
            {offer.shortTitle || offer.offerTitle}
          </span>
        </div>

        <Link
          to="/offers"
          className="inline-flex items-center gap-1.5 text-xs font-black text-[#0A4DA6] hover:underline cursor-pointer"
        >
          <ChevronLeft size={14} /> View All Offers
        </Link>

        <div className="bg-white dark:bg-[#0B192C] border border-gray-150 dark:border-slate-800 rounded-[32px] shadow-sm overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-[#0A4DA6] via-[#E58C28] to-[#0A4DA6]" />

          {offer.bannerImage && (
            <img
              src={offer.bannerImage}
              alt={offer.offerTitle}
              className="w-full h-48 sm:h-64 object-cover"
            />
          )}

          <div className="p-6 sm:p-8 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-blue-50 dark:bg-slate-800 text-[#0A4DA6] dark:text-blue-400 text-xs font-black tracking-wider">
                {offer.offerType || "Special Promotion"}
              </span>
              <span className="px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 text-xs font-black flex items-center gap-1.5">
                <Percent size={13} />
                {offer.discountType === "Percentage"
                  ? `${offer.discountValue}% OFF`
                  : `FLAT ${formatCurrency(offer.discountValue)} OFF`}
              </span>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold ${
                  hasExpired
                    ? "bg-rose-50 text-rose-600 dark:bg-rose-950/30"
                    : "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30"
                }`}
              >
                {hasExpired ? "● Offer Expired" : "● Offer Live"}
              </span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-black text-[#0B192C] dark:text-white max-w-3xl leading-tight">
              {offer.offerTitle}
            </h1>

            {offer.description && (
              <p className="text-sm text-gray-600 dark:text-gray-300 max-w-2xl font-medium leading-relaxed">
                {offer.description}
              </p>
            )}

            {expiresAt && !hasExpired && (
              <div className="bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-800 rounded-2xl p-4 inline-flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2 text-xs font-black text-[#E58C28] sm:border-r sm:border-gray-200 dark:sm:border-slate-700 sm:pr-4">
                  <Clock size={15} /> Offer Ends In:
                </div>
                <div className="flex items-center gap-3 font-mono font-black text-lg text-[#0B192C] dark:text-white">
                  {[
                    { value: timeLeft.days, label: "DAYS" },
                    { value: timeLeft.hours, label: "HRS" },
                    { value: timeLeft.minutes, label: "MINS" },
                    { value: timeLeft.seconds, label: "SECS" },
                  ].map((unit, i) => (
                    <React.Fragment key={unit.label}>
                      {i > 0 && <span className="text-gray-300">:</span>}
                      <div className="text-center">
                        <span className="text-[#E58C28]">
                          {String(unit.value).padStart(2, "0")}
                        </span>
                        <span className="text-[10px] block font-sans font-bold text-gray-400">
                          {unit.label}
                        </span>
                      </div>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            )}
            {expiresAt && hasExpired && (
              <p className="inline-flex items-center gap-2 text-xs font-black text-rose-600 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-2xl px-4 py-3">
                <Clock size={14} /> This offer expired on{" "}
                {new Date(offer.validTill).toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-6 sm:p-8 space-y-6 shadow-sm">
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

          {primaryAshram && (
            <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-6 sm:p-8 space-y-4 shadow-sm">
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

          <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-6 sm:p-8 space-y-4 shadow-sm">
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

        <div className="space-y-6">
          <div className="bg-white dark:bg-[#0B192C] border border-gray-150 dark:border-slate-800 rounded-[28px] p-6 space-y-6 shadow-sm sticky top-24">
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
                    : `FLAT ${formatCurrency(offer.discountValue)} OFF`}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Min Booking Amount:</span>
                <span className="font-black text-[#0B192C] dark:text-white">
                  {offer.minimumBookingAmount > 0
                    ? formatCurrency(offer.minimumBookingAmount)
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
              disabled={hasExpired}
              className="w-full py-4 bg-[#0A4DA6] hover:bg-[#083b80] disabled:bg-gray-300 dark:disabled:bg-slate-700 disabled:shadow-none disabled:cursor-not-allowed text-white font-black text-sm rounded-full shadow-xl shadow-[#0A4DA6]/30 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 disabled:active:scale-100"
            >
              {hasExpired ? (
                "Offer Expired"
              ) : (
                <>
                  Book Offer Now <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>

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
            disabled={hasExpired}
            className="px-8 py-3 bg-[#0A4DA6] hover:bg-[#083b80] disabled:bg-gray-300 dark:disabled:bg-slate-700 disabled:shadow-none disabled:cursor-not-allowed text-white font-black text-xs sm:text-sm rounded-full shadow-lg shadow-[#0A4DA6]/30 flex items-center gap-2 cursor-pointer active:scale-95 disabled:active:scale-100 shrink-0"
          >
            {hasExpired ? (
              "Offer Expired"
            ) : (
              <>
                Book This Offer <ArrowRight size={16} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OfferDetailPage;
