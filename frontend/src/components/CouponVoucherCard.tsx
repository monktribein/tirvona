import React, { useState } from "react";
import { MapPin, Clock, Copy, CheckCircle2, ArrowRight } from "lucide-react";

interface CouponVoucherCardProps {
  offer: any;
  onBookNow?: (offer: any) => void;
  onCopyCode?: (code: string) => void;
  copiedCode?: string | null;
  className?: string;
  isCarouselItem?: boolean;
  adminToolbar?: React.ReactNode;
}

export const CouponVoucherCard: React.FC<CouponVoucherCardProps> = ({
  offer,
  onBookNow,
  onCopyCode,
  copiedCode,
  className = "",
  isCarouselItem = false,
  adminToolbar,
}) => {
  const [internalCopied, setInternalCopied] = useState(false);
  const offerTitle = offer.offerTitle || offer.title || "Untitled offer";
  const description = offer.description || offer.bannerText || "";
  const offerType = offer.offerType || offer.category || "OFFER";
  const promoCode = offer.promoCode || "";

  // Dynamic image
  const imageSrc =
    offer.bannerImage ||
    offer.thumbnailImage ||
    offer.image ||
    "";

  // Location & ashram, shown only when the offer is actually tied to one.
  const targetAshram =
    offer.ashramId || (offer.applicableAshrams && offer.applicableAshrams[0]);
  const city =
    offer.ashramId?.address?.city || targetAshram?.address?.city || "";
  const ashramName = targetAshram?.name || "";

  // Validity text & Expiry check
  const rawValid =
    offer.validUntil || offer.validity || offer.expiryDate || offer.validTill;
  const validityText = rawValid
    ? typeof rawValid === "string"
      ? rawValid
      : new Date(rawValid).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
    : "";

  const checkIsExpired = (): boolean => {
    if (offer.status === "expired" || offer.status === "disabled") return true;

    if (!rawValid) return false;

    if (rawValid instanceof Date) {
      return rawValid.getTime() < Date.now();
    }

    if (typeof rawValid === "string") {
      const parsed = new Date(rawValid);
      if (!isNaN(parsed.getTime())) {
        parsed.setHours(23, 59, 59, 999);
        return parsed.getTime() < Date.now();
      }

      // Format like "30 Jun 2026" or "31 Dec 2026"
      const parts = rawValid.trim().split(/\s+/);
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const monthStr = parts[1];
        const year = parseInt(parts[2], 10);
        const dateObj = new Date(`${monthStr} ${day}, ${year}`);
        if (!isNaN(dateObj.getTime())) {
          dateObj.setHours(23, 59, 59, 999);
          return dateObj.getTime() < Date.now();
        }
      }
    }

    return false;
  };

  const isExpired = checkIsExpired();

  // Determine theme: Green for Weekend/Retreat/FixedAmount, Orange for Mahakumbh/Percentage
  const lowerType = offerType.toLowerCase();
  // "FixedAmount" is the retired spelling; the API's value is "Flat Amount".
  // Both are matched so legacy rows keep the theme they have always rendered.
  const isFlatDiscount =
    offer.discountType === "Flat Amount" || offer.discountType === "FixedAmount";
  const isGreenTheme =
    lowerType.includes("weekend") ||
    lowerType.includes("retreat") ||
    isFlatDiscount ||
    promoCode.toLowerCase().includes("weekend");

  const theme = isExpired
    ? {
        stubBg: "bg-gradient-to-br from-slate-600 via-gray-600 to-slate-700",
        stubPillBorder: "border-white/20 bg-white/10",
        badgeBg: "bg-red-600 dark:bg-red-700",
        badgeText: "EXPIRED",
        pinColor: "text-gray-500 dark:text-gray-400",
        codeBoxBg: "bg-gray-100 dark:bg-slate-800/60",
        codeBoxBorder: "border-dashed border-gray-300 dark:border-slate-700",
        codeLabel: "text-gray-400",
        btnBg: "bg-gray-400 dark:bg-slate-700 cursor-not-allowed",
        btnShadow: "shadow-none",
        subtext: "OFFER EXPIRED",
      }
    : isGreenTheme
      ? {
          stubBg: "bg-gradient-to-br from-[#2D7A3E] via-[#236832] to-[#185026]",
          stubPillBorder: "border-white/40 bg-white/10",
          badgeBg: "bg-[#236832]",
          badgeText: "HURRY UP!",
          pinColor: "text-[#236832] dark:text-[#4ADE80]",
          codeBoxBg: "bg-[#F0FDF4] dark:bg-[#14381C]/40",
          codeBoxBorder:
            "border-dashed border-[#236832]/40 dark:border-[#4ADE80]/40",
          codeLabel: "text-[#236832] dark:text-[#4ADE80]",
          btnBg: "bg-[#236832] hover:bg-[#1B5226]",
          btnShadow: "shadow-[#236832]/25",
          subtext: "ON RETREAT PACKAGES",
        }
      : {
          stubBg: "bg-gradient-to-br from-[#F95400] via-[#E65100] to-[#C2410C]",
          stubPillBorder: "border-white/40 bg-white/10",
          badgeBg: "bg-[#E65100]",
          badgeText: "LIMITED TIME",
          pinColor: "text-[#E65100] dark:text-[#FB923C]",
          codeBoxBg: "bg-[#FFF5ED] dark:bg-[#3D1D0F]/40",
          codeBoxBorder:
            "border-dashed border-[#E65100]/40 dark:border-[#FB923C]/40",
          codeLabel: "text-[#E65100] dark:text-[#FB923C]",
          btnBg: "bg-[#E65100] hover:bg-[#C2410C]",
          btnShadow: "shadow-[#E65100]/25",
          subtext: "ON ALL PACKAGES",
        };

  // Discount formatting. No value means no discount is claimed — the stub
  // renders its badge without a figure rather than defaulting to "20% OFF".
  const rawDiscount = offer.discountValue ?? offer.discountPercentage;
  const hasDiscount = rawDiscount !== undefined && rawDiscount !== null && rawDiscount !== "";
  const discountValue = rawDiscount;
  const isPercentage = !isFlatDiscount;

  const isCopied = copiedCode ? copiedCode === promoCode : internalCopied;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isExpired) return;
    if (onCopyCode) {
      onCopyCode(promoCode);
    } else {
      navigator.clipboard.writeText(promoCode);
      setInternalCopied(true);
      setTimeout(() => setInternalCopied(false), 2500);
    }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if (isExpired) return;
    if (onBookNow) {
      onBookNow(offer);
    }
  };

  return (
    <div
      onClick={handleCardClick}
      className={`relative group ${isExpired ? "cursor-not-allowed opacity-85" : "cursor-pointer hover:-translate-y-1"} transition-all duration-300 flex flex-row bg-[#FAF9F6] dark:bg-[#0B192C] rounded-2xl sm:rounded-3xl border border-gray-200/80 dark:border-slate-800 shadow-md ${isExpired ? "" : "hover:shadow-xl"} overflow-hidden ${
        isCarouselItem
          ? "w-[290px] xs:w-[330px] sm:w-[450px] md:w-[560px] lg:w-[590px] shrink-0"
          : "w-full max-w-[640px]"
      } ${className}`}
    >
      {/* 🎟️ LEFT TICKET STUB - ALWAYS ON LEFT IN BOTH MOBILE AND DESKTOP */}
      <div
        className={`relative shrink-0 w-24 xs:w-28 sm:w-32 md:w-36 max-w-[145px] ${theme.stubBg} text-white p-2 sm:p-4 flex flex-col items-center justify-between text-center overflow-hidden border-r-2 border-dashed border-white/30`}
      >
        {/* Top Pill Badge */}
        <div
          className={`relative z-10 border ${theme.stubPillBorder} px-1.5 sm:px-3 py-0.5 rounded-full text-[8px] sm:text-[10px] md:text-xs font-extrabold text-white tracking-wider backdrop-blur-sm shadow-sm whitespace-nowrap`}
        >
          {offerType}
        </div>

        {/* Big Discount Section */}
        <div className="relative z-10 my-auto space-y-0.5 w-full">
          {hasDiscount ? (
            <>
              {!isPercentage && (
                <div className="text-[8px] sm:text-[10px] font-bold text-white/90 tracking-widest">
                  &mdash; FLAT &mdash;
                </div>
              )}

              <div className="flex items-baseline justify-center font-sans whitespace-nowrap leading-none drop-shadow-md my-0.5 sm:my-1">
                {isPercentage ? (
                  <>
                    <span className="text-2xl sm:text-4xl md:text-5xl font-black text-white tracking-tight">
                      {discountValue}
                    </span>
                    <span className="text-base sm:text-2xl font-black text-white ml-0.5">
                      %
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-base sm:text-2xl font-black text-white mr-0.5">
                      ₹
                    </span>
                    <span className="text-2xl sm:text-4xl md:text-5xl font-black text-white tracking-tight">
                      {discountValue}
                    </span>
                  </>
                )}
              </div>

              <div className="text-[9px] sm:text-xs md:text-sm font-black text-white/95 tracking-widest flex items-center justify-center gap-1 mt-0.5">
                <span className="text-white/70">&rarr;</span> OFF{" "}
                <span className="text-white/70">&larr;</span>
              </div>

              <div className="text-[7px] sm:text-[9px] font-extrabold text-white/80 tracking-wider pt-0.5 sm:pt-1">
                {theme.subtext}
              </div>
            </>
          ) : (
            <div className="text-[9px] sm:text-xs font-black text-white/80 tracking-widest leading-snug">
              NO DISCOUNT
              <br />
              CONFIGURED
            </div>
          )}
        </div>

        {/* Spiritual Watermark Silhouette at bottom of stub */}
        <div className="relative z-10 opacity-75 mt-0.5 pointer-events-none">
          {isGreenTheme ? (
            <svg
              className="w-6 h-6 sm:w-8 sm:h-8 md:w-9 md:h-9 text-white/80 mx-auto"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M12 21c-4.5 0-8-3.5-8-8 0-4 3.5-7.5 8-11 4.5 3.5 8 7 8 11 0 4.5-3.5 8-8 8z" />
              <path d="M12 21c-2.5-2.5-4-5.5-4-8 0-2.5 1.5-5 4-7.5 2.5 2.5 4 5 4 7.5 0 2.5-1.5 5.5-4 8z" />
              <path d="M4 13c3 0 5.5.5 8 3 2.5-2.5 5-3 8-3" />
            </svg>
          ) : (
            <svg
              className="w-6 h-6 sm:w-8 sm:h-8 md:w-9 md:h-9 text-white/80 mx-auto"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M12 2L4 9h16L12 2zM5 9v11h14V9M9 20v-6h6v6" />
              <path d="M12 2v7" />
            </svg>
          )}
        </div>

        {/* ✂️ Circular Ticket Cut-out Notches - strictly at top & bottom of vertical junction */}
        <div className="absolute -top-3 right-0 translate-x-1/2 w-5 sm:w-6 h-5 sm:h-6 rounded-full bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-800 z-20" />
        <div className="absolute -bottom-3 right-0 translate-x-1/2 w-5 sm:w-6 h-5 sm:h-6 rounded-full bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-800 z-20" />
      </div>

      {/* 🎟️ RIGHT MAIN TICKET BODY */}
      <div className="relative flex-1 p-3 sm:p-5 md:p-6 flex flex-col justify-between space-y-1.5 sm:space-y-3 bg-[#FAF9F6] dark:bg-[#0B192C] overflow-hidden">
        {/* Faded Background Image Overlay */}
        {imageSrc ? (
          <div className="absolute right-0 top-0 bottom-0 w-1/2 sm:w-5/12 overflow-hidden pointer-events-none opacity-25 dark:opacity-20">
            <img
              src={imageSrc}
              alt=""
              className="w-full h-full object-cover object-right"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#FAF9F6] via-[#FAF9F6]/85 to-transparent dark:from-[#0B192C] dark:via-[#0B192C]/85" />
          </div>
        ) : null}

        {/* Floating Top Right Badge */}
        <div
          className={`absolute top-0 right-2 sm:right-5 ${theme.badgeBg} text-white px-2 sm:px-3 py-0.5 sm:py-1 rounded-b-lg sm:rounded-b-xl text-[8px] sm:text-[10px] md:text-xs font-extrabold tracking-wider shadow-sm flex items-center gap-1 z-10`}
        >
          <Clock size={10} className="sm:w-3 sm:h-3" />
          <span>{theme.badgeText}</span>
        </div>

        {/* Content Container */}
        <div className="relative z-10 space-y-1 sm:space-y-1.5 pr-2 sm:pr-16 pt-0.5 sm:pt-1">
          {/* Location & Ashram. Omitted entirely for a platform-wide offer that
            names no ashram — inventing one would misstate where it applies. */}
          {(city || ashramName) && (
            <div className="flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs md:text-sm font-bold text-gray-700 dark:text-gray-300">
              <MapPin
                size={12}
                className={`${theme.pinColor} shrink-0 fill-current sm:w-3.5 sm:h-3.5`}
              />
              {city && (
                <span className={`${theme.pinColor} font-extrabold`}>{city}</span>
              )}
              {city && ashramName && <span className="text-gray-400">&bull;</span>}
              {ashramName && (
                <span className="truncate text-gray-600 dark:text-gray-300 font-semibold">
                  {ashramName}
                </span>
              )}
            </div>
          )}

          {/* Offer Title */}
          <h3 className="font-black text-xs sm:text-base md:text-xl text-[#0B192C] dark:text-white leading-tight tracking-tight group-hover:text-[#E65100] transition-colors line-clamp-1">
            {offerTitle}
          </h3>

          {/* Description */}
          <p className="text-[10px] sm:text-xs md:text-sm text-gray-600 dark:text-gray-300 leading-relaxed font-medium line-clamp-2">
            {description}
          </p>
        </div>

        {/* Bottom Row: Coupon Code Box (Left) & Book Now CTA with Validity (Right) */}
        <div className="relative z-10 flex flex-wrap sm:flex-nowrap items-center justify-between gap-1.5 sm:gap-3 pt-1.5 sm:pt-2">
          {/* Coupon Code Box. Never rendered without a real code — offering a
            fabricated one to copy would fail at checkout. */}
          {promoCode ? (
            <div
              onClick={handleCopy}
              className={`flex items-center justify-between gap-1.5 sm:gap-3 px-2 sm:px-4 py-1 sm:py-2 rounded-xl sm:rounded-2xl ${theme.codeBoxBg} ${theme.codeBoxBorder} hover:scale-[1.02] transition-all cursor-pointer group/code shadow-sm`}
              title="Click to copy coupon code"
            >
              <div className="flex flex-col">
                <span
                  className={`text-[7px] sm:text-[9px] md:text-[10px] font-black tracking-wider ${theme.codeLabel}`}
                >
                  COUPON CODE
                </span>
                <span className="font-mono font-black text-xs sm:text-base md:text-lg text-[#0B192C] dark:text-white tracking-wider">
                  {promoCode}
                </span>
              </div>

              <div
                className={`p-1 sm:p-1.5 rounded-lg ${theme.codeLabel} hover:bg-black/5 dark:hover:bg-white/10 transition-colors`}
              >
                {isCopied ? (
                  <CheckCircle2
                    size={14}
                    className="text-emerald-600 dark:text-emerald-400 sm:w-4 sm:h-4"
                  />
                ) : (
                  <Copy size={14} className="sm:w-4 sm:h-4" />
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2 sm:px-4 py-1 sm:py-2 rounded-xl sm:rounded-2xl bg-gray-100 dark:bg-slate-800/60 border border-dashed border-gray-300 dark:border-slate-700">
              <span className="text-[9px] sm:text-[11px] font-black tracking-wider text-gray-400">
                NO COUPON CODE
              </span>
            </div>
          )}

          {/* Right Action: Book Button & Valid Till Subtext */}
          <div className="flex flex-col items-end gap-0.5 sm:gap-1 shrink-0">
            {isExpired ? (
              <button
                type="button"
                disabled
                className="px-3 sm:px-6 py-1.5 sm:py-2.5 rounded-xl sm:rounded-2xl bg-gray-400 dark:bg-slate-700 text-white font-extrabold text-[10px] sm:text-xs md:text-sm shadow-none cursor-not-allowed flex items-center justify-center gap-1 sm:gap-2 opacity-80"
              >
                <span>Expired</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCardClick(e);
                }}
                className={`px-3 sm:px-6 py-1.5 sm:py-2.5 rounded-xl sm:rounded-2xl ${theme.btnBg} text-white font-extrabold text-[10px] sm:text-xs md:text-sm shadow-md ${theme.btnShadow} hover:shadow-lg transition-all flex items-center justify-center gap-1 sm:gap-2 cursor-pointer active:scale-95`}
              >
                <span>Book Now</span>
                <ArrowRight
                  size={12}
                  className="group-hover:translate-x-1 transition-transform sm:w-3.5 sm:h-3.5"
                />
              </button>
            )}

            {/* An offer with no expiry on record says so, rather than
              borrowing a date from another campaign. */}
            <div
              className={`flex items-center gap-0.5 sm:gap-1 text-[8px] sm:text-[10px] md:text-[11px] font-semibold ${
                isExpired
                  ? "text-red-500 dark:text-red-400"
                  : "text-gray-500 dark:text-gray-400"
              }`}
            >
              <Clock
                size={9}
                className={`shrink-0 sm:w-3 sm:h-3 ${
                  isExpired
                    ? "text-red-500 dark:text-red-400"
                    : "text-gray-400"
                }`}
              />
              <span>
                {!validityText
                  ? "No expiry set"
                  : isExpired
                    ? `Expired on ${validityText}`
                    : `Valid till ${validityText}`}
              </span>
            </div>
          </div>
        </div>

        {adminToolbar && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative z-10 pt-2.5 mt-1 border-t border-gray-200/70 dark:border-slate-800 flex items-center justify-between gap-2"
          >
            {adminToolbar}
          </div>
        )}
      </div>
    </div>
  );
};

export default CouponVoucherCard;
