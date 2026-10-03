import React, { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { X, ArrowRight, Sparkles, Tag, Copy, Check } from "lucide-react";
import api from "../../lib/api";

interface OfferItem {
  _id?: string;
  offerTitle?: string;
  title?: string;
  description?: string;
  bannerText?: string;
  promoCode?: string;
  discountType?: "percentage" | "Percentage" | "flat" | "Flat Amount" | string;
  discountValue?: number;
  bannerImage?: string;
  imageUrl?: string;
  applicableAshrams?: any[];
  ashramId?: any;
  status?: string;
  validTill?: string | Date;
  remainingRedemptions?: number;
}

export const FloatingDealBox: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [activeOffer, setActiveOffer] = useState<OfferItem | null>(null);
  const [hasChecked, setHasChecked] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [copied, setCopied] = useState(false);
  const prevPathRef = useRef(location.pathname);

  // Check if current page is the landing page
  const isLandingPage =
    location.pathname === "/" || location.pathname === "/public";

  // When user navigates away and comes back to the landing page, reset dismissal so it shows fresh again
  useEffect(() => {
    if (isLandingPage && prevPathRef.current !== location.pathname) {
      setIsDismissed(false);
    }
    prevPathRef.current = location.pathname;
  }, [location.pathname, isLandingPage]);

  // Fetch active offers directly from backend (real active offers only)
  const fetchActiveOffers = useCallback(async () => {
    try {
      const res = await api.get("/offers?status=active");
      const offerList: OfferItem[] =
        res.data?.success && Array.isArray(res.data.data)
          ? res.data.data
          : Array.isArray(res.data)
            ? res.data
            : [];

      const now = new Date();
      // Filter for strictly active, valid offers from super admin / stay owner
      const validOffers = offerList.filter((o) => {
        if (o.status !== "active") return false;
        if (o.validTill && new Date(o.validTill) < now) return false;
        if (o.remainingRedemptions != null && o.remainingRedemptions <= 0) return false;
        return true;
      });

      if (validOffers.length > 0) {
        // Pick top active offer
        const sorted = [...validOffers].sort(
          (a, b) => (Number(b.discountValue) || 0) - (Number(a.discountValue) || 0),
        );
        setActiveOffer(sorted[0]);
      } else {
        // No active deals in system: do not show
        setActiveOffer(null);
      }
    } catch (err) {
      console.error("Fetch active offers error in deal box:", err);
      setActiveOffer(null);
    } finally {
      setHasChecked(true);
    }
  }, []);

  useEffect(() => {
    if (isLandingPage) {
      fetchActiveOffers();
    }
  }, [isLandingPage, fetchActiveOffers]);

  // ONLY SHOW ON LANDING PAGE:
  // If not landing page, or if dismissed, or no active offer: completely hide
  if (!isLandingPage || isDismissed || !hasChecked || !activeOffer) {
    return null;
  }

  // Dismiss when user clicks the close 'X' button
  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDismissed(true);
  };

  // When user clicks the offer card or button: navigate to deal and hide on the landing page
  const handleCardClick = () => {
    setIsDismissed(true);
    if (activeOffer._id) {
      navigate(`/offers/${activeOffer._id}`);
    } else if (activeOffer.promoCode) {
      navigate(`/search?promoCode=${encodeURIComponent(activeOffer.promoCode)}`);
    } else {
      navigate("/offers");
    }
  };

  const handleCopyCode = (e: React.MouseEvent, code: string) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const discountTypeLower = (activeOffer.discountType || "").toLowerCase();
  const isFlat = discountTypeLower.includes("flat");
  const discountBadgeText = isFlat
    ? `FLAT ₹${activeOffer.discountValue || 100} OFF`
    : `UPTO ${activeOffer.discountValue || 50}% OFF`;

  const displayTitle =
    activeOffer.offerTitle || activeOffer.title || "Special Deal";

  const displayDesc =
    activeOffer.description ||
    activeOffer.bannerText ||
    "Special festive offer on sacred stays & ashrams";

  // GOIBIBO-STYLE COMPACT CORNER OFFER STICKER (Landing Page Only)
  return (
    <div
      aria-label="Exclusive Offers & Deals"
      className="fixed bottom-3 left-3 sm:bottom-4 sm:left-4 z-40 w-[150px] sm:w-[165px] h-[165px] sm:h-[180px] select-none group/card transition-all duration-300 animate-in fade-in zoom-in-95 cursor-pointer"
      style={{ position: "fixed" }}
      onClick={handleCardClick}
    >
      {/* Top-Right Circular Close Button (Perched on the corner border just like Goibibo) */}
      <button
        onClick={handleClose}
        className="absolute -top-2 -right-2 z-50 w-6 h-6 rounded-full bg-slate-900/90 hover:bg-slate-950 text-white flex items-center justify-center border-2 border-white shadow-lg cursor-pointer transition-transform hover:scale-110 active:scale-95"
        title="Hide offer"
        aria-label="Close"
      >
        <X size={12} className="stroke-[3]" />
      </button>

      {/* Main Card Container */}
      <div className="relative w-full h-full rounded-2xl overflow-hidden shadow-[0_12px_35px_rgba(0,0,0,0.5),0_0_20px_rgba(242,140,40,0.3)] border-2 border-amber-500/60 group-hover/card:border-amber-400 group-hover/card:scale-[1.02] group-hover/card:shadow-[0_16px_40px_rgba(0,0,0,0.6),0_0_25px_rgba(242,140,40,0.4)] transition-all duration-300 flex flex-col justify-between p-2.5 text-center">
        {/* Sacred Puja Visual Banner Background */}
        <img
          src="/assets/deals/puja-offer-banner.jpg"
          alt="Festive Sacred Offer Banner"
          className="absolute inset-0 w-full h-full object-cover object-center group-hover/card:scale-108 transition-transform duration-700 ease-out"
        />

        {/* Ambient Warm Crimson/Saffron Gradients for Pristine Text Legibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/60 to-black/35 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#2E0B04]/75 via-transparent to-[#160401]/95 pointer-events-none" />

        {/* Top: Vibrant Pill Tag (like Goibibo's Travel Sale badge) */}
        <div className="relative z-10 pt-0.5">
          <div className="inline-flex items-center justify-center gap-1 mx-auto bg-gradient-to-r from-[#E60067] via-[#FF1493] to-[#E60067] text-white text-[9px] sm:text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full shadow-md tracking-wide leading-none border border-pink-300/30">
            <Sparkles size={10} className="text-yellow-200 fill-yellow-200 shrink-0" />
            <span className="truncate max-w-[115px]">{discountBadgeText}</span>
          </div>
        </div>

        {/* Center: Deal Title & Promo Code */}
        <div className="relative z-10 my-auto py-1 space-y-1">
          <h4 className="text-[14px] sm:text-[15px] font-black text-white leading-tight tracking-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] line-clamp-2 px-1">
            {displayTitle}
          </h4>

          {/* Promo code badge if configured */}
          {activeOffer.promoCode ? (
            <div className="inline-flex items-center gap-1 bg-black/60 backdrop-blur-sm border border-dashed border-amber-400/60 rounded px-1.5 py-0.5 text-[9px] text-amber-200 mx-auto shadow-sm">
              <span className="text-[8px] text-amber-400 font-bold">CODE:</span>
              <span className="font-mono font-black text-amber-300 tracking-wider">
                {activeOffer.promoCode}
              </span>
              <button
                onClick={(e) => handleCopyCode(e, activeOffer.promoCode!)}
                className="text-white hover:text-amber-300 transition-colors cursor-pointer p-0.5 ml-0.5 shrink-0"
                title="Copy code"
              >
                {copied ? (
                  <Check size={10} className="text-emerald-400" />
                ) : (
                  <Copy size={10} />
                )}
              </button>
            </div>
          ) : (
            <p className="text-[9.5px] text-amber-100/90 font-medium leading-snug line-clamp-1 drop-shadow px-1">
              {displayDesc}
            </p>
          )}
        </div>

        {/* Bottom: White CTA Button & Sacred Brand Mark */}
        <div className="relative z-10 space-y-1">
          <div className="w-full py-1.5 px-2 rounded-xl bg-white group-hover/card:bg-amber-50 text-[#0B192C] font-black text-[10.5px] sm:text-[11px] shadow-md flex items-center justify-center gap-1 transition-all">
            <span>Explore Deals</span>
            <ArrowRight
              size={12}
              className="text-[#E60067] transition-transform group-hover/card:translate-x-1"
            />
          </div>

          <p className="text-[7px] sm:text-[7.5px] font-black tracking-widest text-[#F28C28] uppercase drop-shadow leading-none">
            TIRVONA • SACRED DEALS
          </p>
        </div>
      </div>
    </div>
  );
};

export default FloatingDealBox;
