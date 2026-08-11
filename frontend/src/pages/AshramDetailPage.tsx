import React, { useState, useEffect, useRef } from "react";
import {
  useParams,
  useNavigate,
  Link,
  useSearchParams,
} from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../contexts/AuthContext";
import { useNotifications } from "../contexts/NotificationContext";
import {
  ashramService,
  reviewService,
  roomService,
  bookingService,
  offerService,
  platformSettingsService,
} from "../services";
import { getErrorMessage } from "../lib/api";
import { openRazorpayCheckout } from "../lib/razorpay";
import {
  saveBookingDraft,
  getBookingDraft,
  clearBookingDraft,
  type BookingDraftPayload,
} from "../utils/bookingDraft";
import { setGuestPendingIntent } from "../utils/guestGate";
import { roundMoney } from "../utils/format";
import { GuestRoomSelector } from "../components/shared/GuestRoomSelector";
import { GuestReviewsCarousel } from "../components/shared/GuestReviewsCarousel";
import WriteReviewCard from "../components/shared/WriteReviewCard";
import { VerifiedBadge } from "../components/shared/VerifiedBadge";
import {
  useBookingSearch,
  getTodayYMD,
  getTomorrowYMD,
  normalizeBookingDates,
} from "../contexts/BookingSearchContext";
import TirvonaMap from "../components/TirvonaMap";
import { DateRangePicker } from "../components/DateRangePicker";
import { RoomAvailabilityCalendar } from "../components/RoomAvailabilityCalendar";
import { hasValidCoordinates } from "../utils/geo";
import { useAutoScroll } from "../hooks/useAutoScroll";
import {
  ShieldCheck,
  MapPin,
  Star,
  Calendar as CalendarIcon,
  ParkingCircle,
  Lock,
  Heart,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  Map,
  Sparkles,
  Phone,
  Mail,
  Globe,
  Bed,
  CheckCircle,
  Award,
  X,
  Maximize2,
  Trash2,
  Edit3,
} from "lucide-react";

import {
  volunteerService,
  type VolunteerJobItem,
} from "../services/volunteer.service";
import { useProfileAutoFill } from "../hooks/useProfileAutoFill";

export const AshramDetailPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { addNotification } = useNotifications();
  const { searchState, updateBookingSearch } = useBookingSearch();

  const qCheckIn = searchParams.get("checkIn");
  const qCheckOut = searchParams.get("checkOut");
  const qRooms = searchParams.get("rooms");
  const qAdults = searchParams.get("adults");
  const qChildren = searchParams.get("children");

  const initialDates = normalizeBookingDates(
    qCheckIn || searchState.checkIn,
    qCheckOut || searchState.checkOut,
  );
  const initialCheckIn = initialDates.checkIn;
  const initialCheckOut = initialDates.checkOut;
  const initialRooms = qRooms ? parseInt(qRooms) : searchState.rooms || 1;
  const initialAdults = qAdults ? parseInt(qAdults) : searchState.adults || 2;
  const initialChildren =
    qChildren !== null && qChildren !== undefined
      ? parseInt(qChildren)
      : searchState.children || 0;

  const todayYMD = getTodayYMD();
  const validInitialCheckIn =
    initialCheckIn && initialCheckIn >= todayYMD ? initialCheckIn : todayYMD;
  const validInitialCheckOut =
    initialCheckOut && initialCheckOut > validInitialCheckIn
      ? initialCheckOut
      : getTomorrowYMD(validInitialCheckIn);

  const [ashram, setAshram] = useState<any>(null);
  const [rooms, setRooms] = useState<any[]>([]);
  const [volunteerJobs, setVolunteerJobs] = useState<VolunteerJobItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailError, setDetailError] = useState("");

  // Booking Flow parameters
  const [checkIn, setCheckIn] = useState(validInitialCheckIn);
  const [checkOut, setCheckOut] = useState(validInitialCheckOut);
  const [selectedRoom, setSelectedRoom] = useState<any>(null);
  const [roomsCount, setRoomsCount] = useState(initialRooms);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [id]);

  useEffect(() => {
    const qCheckIn = searchParams.get("checkIn");
    const qCheckOut = searchParams.get("checkOut");
    const qPromo = searchParams.get("promoCode");
    const dates = normalizeBookingDates(qCheckIn || "", qCheckOut || "");
    if (qCheckIn) setCheckIn(dates.checkIn || todayYMD);
    if (qCheckOut)
      setCheckOut(dates.checkOut || getTomorrowYMD(dates.checkIn || todayYMD));
    if (qPromo) {
      setCouponCode(qPromo);
      handleValidatePromo(qPromo);
    }
  }, [searchParams]);

  const [appliedOfferData, setAppliedOfferData] = useState<any>(null);
  /** The code currently applied, so the saving can be recomputed on change. */
  const [appliedPromo, setAppliedPromo] = useState<string | null>(null);
  /** A code that arrived before the rooms did, applied once a total exists. */
  const [pendingPromo, setPendingPromo] = useState<string | null>(null);
  /** Latest full payable amount, readable from callbacks declared above it. */
  const subtotalRef = useRef(0);
  /** Whether a priced stay exists yet, so a coupon has something real to cut. */
  const stayReadyRef = useRef(false);
  /** The server's authoritative pricing for the current selection. */
  const [serverQuote, setServerQuote] = useState<any>(null);
  const [quoting, setQuoting] = useState(false);

  const handleValidatePromo = async (codeToTest?: string) => {
    const code = (codeToTest || couponCode).trim().toUpperCase();
    if (!code) return;
    // The full payable figure — stay, add-ons, donation, extra guests, the
    // platform fee and its GST — which is exactly what the server discounts.
    // This used to send only the room rate, falling back to a literal 350 when
    // no room was selected yet, so the saving was calculated against a number
    // the guest was never charged. The ref carries the current render's figure
    // without depending on where this function sits in the file.
    const bookingAmount = subtotalRef.current;
    if (!stayReadyRef.current) {
      // Rooms have not loaded yet. Remember the code; the effect below applies
      // it as soon as there is a real total to discount.
      setPendingPromo(code);
      return;
    }
    try {
      const res = await offerService.validatePromo({
        promoCode: code,
        bookingAmount,
        ashramId: id,
      });
      // `valid` sits inside the envelope's `data`, alongside the offer and the
      // computed discount. Reading it from the top level made every code —
      // including a valid one arriving via ?promoCode= — report as invalid.
      const offerData = res.data?.data;
      if (res.data?.success && offerData?.valid) {
        // Flattened to the shape this page renders and submits: the API nests
        // the coupon under `offer` and returns the computed saving alongside.
        const offer = offerData.offer ?? {};
        setAppliedOfferData({
          offerId: offer._id,
          offerName: offer.offerTitle || offer.shortTitle || "",
          promoCode: offer.promoCode || code,
          offerCategory: offer.offerType || "",
          description: offer.description || "",
          remainingRedemptions: offer.remainingRedemptions,
          discountAmount: offerData.discountAmount,
        });
        setAppliedDiscount(offerData.discountAmount);
        setAppliedPromo(code);
        setPendingPromo(null);
        setCouponMsg(
          res.data.message ||
            `Promo code ${code} applied! Saved ₹${offerData.discountAmount}`,
        );
      } else {
        setAppliedOfferData(null);
        setAppliedDiscount(0);
        setAppliedPromo(null);
        setPendingPromo(null);
        setCouponMsg(res.data?.message || "Invalid promo code");
      }
    } catch (err: any) {
      console.error("Validate promo error:", err);
      setAppliedOfferData(null);
      setAppliedDiscount(0);
      setAppliedPromo(null);
      setPendingPromo(null);
      setCouponMsg(
        err.response?.data?.message || "Invalid or expired promo code",
      );
    }
  };

  // Optional Services
  const [prasad, setPrasad] = useState(false);
  const [meals, setMeals] = useState(false);
  const [parking, setParking] = useState(false);
  const [locker, setLocker] = useState(false);
  const [donation, setDonation] = useState("");

  // Extended Booking Fields
  const [adults, setAdults] = useState(initialAdults);
  const [children, setChildren] = useState(initialChildren);
  const guestsCount = adults + children;

  useEffect(() => {
    if (searchState.rooms) setRoomsCount(searchState.rooms);
    if (searchState.adults) setAdults(searchState.adults);
    if (searchState.children !== undefined) setChildren(searchState.children);
  }, [searchState.rooms, searchState.adults, searchState.children]);

  useEffect(() => {
    updateBookingSearch({
      checkIn,
      checkOut,
      rooms: roomsCount,
      adults,
      children,
    });
  }, [checkIn, checkOut]);
  const [couponCode, setCouponCode] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState(0);
  const [couponMsg, setCouponMsg] = useState("");
  const [specialRequests, setSpecialRequests] = useState("");
  const [restoredNotice, setRestoredNotice] = useState(false);

  // Live Availability Calendar
  const [availabilityCalendar, setAvailabilityCalendar] = useState<any[]>([]);
  const [loadingCalendar, setLoadingCalendar] = useState(false);

  // Reviews
  const [reviews, setReviews] = useState<any[]>([]);

  // Related stays
  const [relatedStays, setRelatedStays] = useState<any[]>([]);

  const setRelatedRow = useAutoScroll<HTMLDivElement>({ speed: 30 });

  const [bookingError, setBookingError] = useState("");
  const [bookingSuccess, setBookingSuccess] = useState<any>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const touchStartX = useRef(0);

  useEffect(() => {
    fetchDetails();
  }, [id]);

  useEffect(() => {
    if (selectedRoom) {
      fetchAvailability();
    }
  }, [selectedRoom]);

  useEffect(() => {
    const draft = getBookingDraft();
    const pendingRaw = localStorage.getItem("pending_booking");
    let pb: any = draft;
    if (!pb && pendingRaw) {
      try {
        pb = JSON.parse(pendingRaw);
      } catch {}
    }

    if (pb && id && (pb.ashramId === id || !pb.ashramId)) {
      try {
        const draftDates = normalizeBookingDates(
          pb.checkIn || pb.checkInDate || "",
          pb.checkOut || pb.checkOutDate || "",
        );
        if (pb.checkIn || pb.checkInDate)
          setCheckIn(draftDates.checkIn || todayYMD);
        if (pb.checkOut || pb.checkOutDate)
          setCheckOut(
            draftDates.checkOut ||
              getTomorrowYMD(draftDates.checkIn || todayYMD),
          );
        if (pb.adults !== undefined) setAdults(pb.adults);
        if (pb.children !== undefined) setChildren(pb.children);
        if (pb.roomsBookedCount) setRoomsCount(pb.roomsBookedCount);
        if (pb.addOnQuantities)
          setAddOnQuantities(pb.addOnQuantities as Record<string, number>);

        const s = pb.services || {};
        if (s.prasad || s.prasad?.ordered) setPrasad(true);
        if (s.meals || s.meals?.ordered) setMeals(true);
        if (s.parking || s.parking?.ordered) setParking(true);
        if (s.locker || s.locker?.ordered) setLocker(true);
        if (s.donation) {
          const donVal =
            typeof s.donation === "object" ? s.donation.amount : s.donation;
          setDonation(donVal ? donVal.toString() : "");
        }

        if (pb.couponCode) {
          setCouponCode(pb.couponCode);
          handleValidatePromo(pb.couponCode);
        }
        if (pb.appliedDiscount) setAppliedDiscount(pb.appliedDiscount);
        if (pb.specialRequests) setSpecialRequests(pb.specialRequests);

        if (rooms.length > 0 && pb.roomId) {
          const match = rooms.find((r) => r._id === pb.roomId);
          if (match) setSelectedRoom(match);
        }

        setRestoredNotice(true);
      } catch (e) {
        console.error("Error restoring pending booking:", e);
      }
    }
  }, [id, rooms]);

  const handleClearDraft = () => {
    localStorage.removeItem("pending_booking");
    setRestoredNotice(false);
    setPrasad(false);
    setMeals(false);
    setParking(false);
    setLocker(false);
    setDonation("");
    setCouponCode("");
    setAppliedDiscount(0);
    setAppliedOfferData(null);
    setAppliedPromo(null);
    setPendingPromo(null);
    setSpecialRequests("");
  };

  const handleAdultsChange = (val: number) => {
    const a = Math.max(1, val);
    setAdults(a);
  };

  const handleChildrenChange = (val: number) => {
    const c = Math.max(0, val);
    setChildren(c);
  };

  const handleApplyCoupon = (e: React.MouseEvent) => {
    e.preventDefault();
    if (couponCode.trim()) {
      handleValidatePromo(couponCode);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedOfferData(null);
    setAppliedDiscount(0);
    // Clear both tracked codes, otherwise the re-validation effect would
    // re-apply the coupon the moment anything changed the total.
    setAppliedPromo(null);
    setPendingPromo(null);
    setCouponCode("");
    setCouponMsg("");
    setTimerActive(false);
    setReservationSeconds(600);
    addNotification(
      "Coupon Removed",
      "Coupon removed successfully. Original stay amount restored.",
      "info",
    );
  };

  const handleChangeCoupon = () => {
    setAppliedOfferData(null);
    setAppliedDiscount(0);
    setCouponMsg("");
    setTimerActive(false);
  };

  const nextImage = () => {
    const n = (ashram?.images || []).length;
    if (n > 0) setActiveImageIndex((i) => (i + 1) % n);
  };
  const prevImage = () => {
    const n = (ashram?.images || []).length;
    if (n > 0) setActiveImageIndex((i) => (i - 1 + n) % n);
  };
  const onHeroTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 40) {
      if (dx < 0) nextImage();
      else prevImage();
    }
  };

  // Keyboard navigation while the lightbox is open.
  useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxOpen(false);
      else if (e.key === "ArrowRight") nextImage();
      else if (e.key === "ArrowLeft") prevImage();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [lightboxOpen, ashram]);

  // Add-On Services Dynamic Pricing State
  const [addOnQuantities, setAddOnQuantities] = useState<
    Record<string, number>
  >({});

  const handleUpdateAddOnQty = (
    serviceId: string,
    delta: number,
    maxQty: number = 10,
  ) => {
    setAddOnQuantities((prev) => {
      const current = prev[serviceId] || 0;
      const next = Math.max(0, Math.min(maxQty, current + delta));
      return { ...prev, [serviceId]: next };
    });
  };

  const calculateDays = () => {
    if (!checkIn || !checkOut) return 1;
    const start = new Date(checkIn).getTime();
    const end = new Date(checkOut).getTime();
    const diff = Math.ceil((end - start) / (1000 * 3600 * 24));
    return diff > 0 ? diff : 1;
  };

  const daysCount = calculateDays();
  const basePriceCalc = (selectedRoom?.basePrice || 0) * roomsCount * daysCount;

  // Dynamic Database-Driven Add-On Services Calculation
  let dynamicAddOnsCalc = 0;
  const activeAddOnsList: any[] = [];
  const availableAddOns = ashram?.addOnServices || [];

  availableAddOns.forEach((item: any) => {
    if (!item.enabled) return;
    const qty = addOnQuantities[item._id] || 0;
    if (qty > 0) {
      let itemTotal = item.price * qty;
      if (item.unit === "per_day") {
        itemTotal = item.price * qty * daysCount;
      } else if (item.unit === "per_person") {
        itemTotal = item.price * qty * (adults + children);
      }
      dynamicAddOnsCalc += itemTotal;
      activeAddOnsList.push({
        serviceId: item._id,
        name: item.name,
        price: item.price,
        unit: item.unit,
        unitLabel: item.unitLabel,
        quantity: qty,
        totalPrice: itemTotal,
      });
    }
  });

  const prasadCalc = prasad ? 100 * (adults + children) : 0;
  const mealsCalc = meals ? 150 * (adults + children) * daysCount : 0;
  const parkingCalc = parking ? 100 * daysCount : 0;
  const lockerCalc = locker ? 50 * daysCount : 0;
  const legacyServicesCalc = prasadCalc + mealsCalc + parkingCalc + lockerCalc;
  const servicesCalc = dynamicAddOnsCalc + legacyServicesCalc;
  const donationCalc = parseFloat(donation) || 0;
  const subtotalCalc = basePriceCalc + servicesCalc + donationCalc;

  // Reservation Timer (10 Minutes) & Loyalty Rewards State
  const [reservationSeconds, setReservationSeconds] = useState<number>(600);
  const [timerActive, setTimerActive] = useState<boolean>(false);
  const [useLoyalty, setUseLoyalty] = useState<boolean>(false);

  useEffect(() => {
    if (appliedDiscount > 0 && !timerActive) {
      setReservationSeconds(600);
      setTimerActive(true);
    } else if (appliedDiscount === 0) {
      setTimerActive(false);
    }
  }, [appliedDiscount]);

  useEffect(() => {
    if (!timerActive) return;
    const interval = setInterval(() => {
      setReservationSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setTimerActive(false);
          setAppliedDiscount(0);
          setAppliedOfferData(null);
          setCouponMsg(
            "Reservation Expired. Your offer has expired. Please reapply the coupon.",
          );
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timerActive]);

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Platform Fee Settings State
  const [platformSettings, setPlatformSettings] = useState<{
    enabled: boolean;
    type: "flat" | "percentage";
    value: number;
    label: string;
  }>({
    enabled: true,
    type: "flat",
    value: 49,
    label: "Tirvona Platform Fee",
  });

  // GST rate applied to the platform fee. Defaults to the same 18% the server
  // falls back to, so a failed settings fetch cannot quietly change the price.
  const [platformGstRate, setPlatformGstRate] = useState(18);

  useEffect(() => {
    platformSettingsService
      .getSettings()
      .then((res) => {
        if (res.data?.success && res.data.data?.platformFee) {
          setPlatformSettings(res.data.data.platformFee);
        }
        if (res.data?.success && res.data.data?.platformFeeGstRate != null) {
          setPlatformGstRate(Number(res.data.data.platformFeeGstRate));
        }
      })
      .catch(() => {});
  }, []);

  const extraGuestCalc = adults > 2 ? (adults - 2) * 200 * daysCount : 0;
  const loyaltyCalc = useLoyalty ? 100 : 0;
  const platformFeeCalc = !platformSettings.enabled
    ? 0
    : platformSettings.type === "percentage"
      ? Math.round((subtotalCalc * platformSettings.value) / 100)
      : Math.round(platformSettings.value || 49);

  // GST is charged on the platform fee alone — the stay, add-ons, extra-guest
  // charge and donation are supplied by the ashram and are not taxed here.
  // Mirrors BookingPricingService.quote exactly; if the two ever disagree the
  // price shown is not the price charged.
  const gstRateCalc = platformGstRate;
  const gstCalc = roundMoney((platformFeeCalc * gstRateCalc) / 100);

  /**
   * Everything owed before a coupon, and the figure a discount comes off.
   *
   * Includes the platform fee and its GST: a coupon reduces the whole bill,
   * not just the ashram's share. It also includes the extra-guest charge,
   * which the server has always billed but this page used to leave out of the
   * payable total — quoting less than checkout would take.
   */
  const grossPayableCalc = roundMoney(
    subtotalCalc + extraGuestCalc + platformFeeCalc + gstCalc,
  );
  subtotalRef.current = grossPayableCalc;
  // The platform fee applies from the first render, so `grossPayable` is
  // non-zero even before a room exists. Readiness is judged on the stay itself,
  // otherwise a coupon would be validated against the bare fee.
  stayReadyRef.current = subtotalCalc > 0;

  /**
   * `appliedDiscount` is a rupee amount, always.
   *
   * It used to be reinterpreted by size — treated as a percentage when it was
   * 100 or less and as rupees above that — so a ₹50 flat coupon silently took
   * 50% off. The server returns the saving already computed against the amount
   * we sent, so it is used verbatim and only capped at what is actually owed.
   */
  const localDiscountCalc = Math.min(
    Math.max(0, appliedDiscount),
    grossPayableCalc,
  );

  /**
   * Prefer the server's quote for every figure it supplies.
   *
   * The local arithmetic above is a first-paint estimate only. Peak-season
   * multipliers, per-ashram platform-fee policies and coupon rounding all live
   * on the server, so a total computed here can differ from the one the
   * payment order is built from — which is how the summary came to read ₹2.82
   * while the gateway asked for ₹59.82. Whenever a quote has arrived it wins.
   */
  const q = serverQuote?.pricing;
  const stayCostCalc = q ? q.basePrice : basePriceCalc;
  const servicesShownCalc = q ? q.servicesPrice : servicesCalc;
  const extraGuestShownCalc = q ? q.extraGuestAmount : extraGuestCalc;
  const platformFeeShownCalc = q ? q.platformFee : platformFeeCalc;
  const gstShownCalc = q ? q.gstAmount : gstCalc;
  const discountCalc = q ? q.discountAmount : localDiscountCalc;
  const totalSavingsCalc = roundMoney(discountCalc + loyaltyCalc);
  const finalPayableCalc = Math.max(
    0,
    roundMoney(
      q ? q.totalAmount - loyaltyCalc : grossPayableCalc - discountCalc - loyaltyCalc,
    ),
  );

  /**
   * Recompute the saving whenever the payable total moves.
   *
   * A percentage coupon is worth more once a guest adds meals, nights or
   * guests, so a figure calculated at apply-time goes stale the moment
   * anything changes. Re-validating also re-checks expiry and remaining
   * redemptions, so the quote on screen keeps matching what checkout charges.
   */
  useEffect(() => {
    const code = appliedPromo || pendingPromo;
    if (!code || subtotalCalc <= 0) return;
    const timer = setTimeout(() => handleValidatePromo(code), 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grossPayableCalc, appliedPromo, pendingPromo]);

  /**
   * Re-price against the server whenever the selection changes.
   *
   * Debounced so dragging a quantity stepper issues one request, and guarded
   * on having a room and dates because the endpoint needs both. A failure
   * leaves the previous quote in place rather than flashing a wrong total; the
   * server re-prices authoritatively at booking regardless.
   */
  useEffect(() => {
    if (!id || !selectedRoom?._id || !checkIn || !checkOut) {
      setServerQuote(null);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setQuoting(true);
      try {
        const res = await bookingService.quote({
          ashramId: id,
          roomId: selectedRoom._id,
          checkInDate: checkIn,
          checkOutDate: checkOut,
          guestsCount: Math.max(1, adults + children),
          roomsBookedCount: Math.max(1, roomsCount),
          services: {
            prasad: { ordered: prasad },
            meals: { ordered: meals },
            parking: { ordered: parking },
            locker: { ordered: locker },
            donation: { amount: parseFloat(donation) || 0 },
            selectedAddOns: activeAddOnsList,
          },
          ...(appliedPromo ? { promoCode: appliedPromo } : {}),
        });
        setServerQuote(res.data?.data ?? null);
      } catch {
        // Keep the last good quote; the estimate below it stays visible.
      } finally {
        setQuoting(false);
      }
    }, 450);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    id,
    selectedRoom?._id,
    checkIn,
    checkOut,
    adults,
    children,
    roomsCount,
    prasad,
    meals,
    parking,
    locker,
    donation,
    appliedPromo,
    JSON.stringify(addOnQuantities),
  ]);

  const fetchDetails = async () => {
    setLoading(true);
    setDetailError("");
    try {
      const res = await ashramService.getById(id!);
      if (res.data.success) {
        const payload = res.data.data;
        const detailAshram = payload?.ashram ?? payload;
        const detailRooms = Array.isArray(payload?.rooms) ? payload.rooms : [];
        if (!detailAshram?._id)
          throw new Error("Ashram details are unavailable.");

        setAshram(detailAshram);
        setRooms(detailRooms);
        if (detailRooms.length > 0) {
          setSelectedRoom(detailRooms[0]);
        }

        if (id) {
          fetchReviews(id);
          fetchRelated(detailAshram.address?.city, id);
          fetchVolunteerJobs(detailAshram.address?.city);
        }
      }
    } catch (err) {
      console.error("Fetch details error:", err);
      setAshram(null);
      setDetailError(getErrorMessage(err, "Unable to load this ashram."));
    } finally {
      setLoading(false);
    }
  };

  const fetchReviews = async (ashramId: string) => {
    try {
      const res = await reviewService.forAshram(ashramId);
      if (res.data.success) {
        setReviews(res.data.data);
      }
    } catch (err) {
      console.error("Reviews load error:", err);
    }
  };

  const fetchRelated = async (city: string, currentId: string) => {
    try {
      const res = await ashramService.search({
        verified: "true",
        destination: city,
      });
      if (res.data.success) {
        setRelatedStays(
          res.data.data.filter((a: any) => a._id !== currentId).slice(0, 3),
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchVolunteerJobs = async (city: string) => {
    try {
      const res = await volunteerService.getJobs({ city });
      if (res.data.success) {
        setVolunteerJobs(res.data.data);
      }
    } catch (err) {
      console.error("Volunteer jobs load error:", err);
    }
  };

  const fetchAvailability = async () => {
    if (!selectedRoom) {
      generateSimulatedCalendar();
      return;
    }
    setLoadingCalendar(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];

      const res = await roomService.availabilityCalendar(
        selectedRoom._id,
        today,
        end,
      );
      if (res.data.success) {
        setAvailabilityCalendar(res.data.data);
      }
    } catch (err) {
      console.error("Error fetching public room availability:", err);
      generateSimulatedCalendar();
    } finally {
      setLoadingCalendar(false);
    }
  };

  const generateSimulatedCalendar = () => {
    const simulated = [];
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const rand = Math.random();
      let available = selectedRoom
        ? Math.floor(selectedRoom.totalInventory * 0.4)
        : 10;
      if (rand > 0.8) available = 0;
      else if (rand > 0.6) available = 2;
      simulated.push({
        date: d.toISOString().split("T")[0],
        price: selectedRoom?.basePrice || 150,
        available,
      });
    }
    setAvailabilityCalendar(simulated);
  };

  useEffect(() => {
    const preserveBookingOnSessionExpiry = () => {
      if (!ashram?._id) return;
      const returnUrl = window.location.pathname + window.location.search;
      saveBookingDraft({
        ashramId: ashram._id,
        roomId: selectedRoom?._id,
        roomType: selectedRoom?.name,
        checkIn,
        checkOut,
        guestsCount: adults + children,
        roomsBookedCount: roomsCount,
        adults,
        children,
        addOnQuantities,
        services: {
          prasad,
          meals,
          parking,
          locker,
          donation: parseFloat(donation) || 0,
        },
        couponCode,
        appliedDiscount,
        specialRequests,
        returnUrl,
        timestamp: Date.now(),
      });
      setGuestPendingIntent({ type: "ashram_booking", returnUrl });
    };
    window.addEventListener(
      "tirvona:unauthorized",
      preserveBookingOnSessionExpiry,
    );
    return () =>
      window.removeEventListener(
        "tirvona:unauthorized",
        preserveBookingOnSessionExpiry,
      );
  }, [
    adults,
    addOnQuantities,
    appliedDiscount,
    ashram,
    checkIn,
    checkOut,
    children,
    couponCode,
    donation,
    locker,
    meals,
    parking,
    prasad,
    roomsCount,
    selectedRoom,
    specialRequests,
  ]);

  const [paying, setPaying] = useState(false);

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBookingError("");
    setBookingSuccess(null);

    if (!user) {
      const currentUrl = window.location.pathname + window.location.search;
      const draftPayload: BookingDraftPayload = {
        ashramId: ashram._id,
        roomId: selectedRoom?._id,
        roomType: selectedRoom?.name,
        checkIn,
        checkOut,
        guestsCount: adults + children,
        roomsBookedCount: roomsCount,
        adults,
        children,
        addOnQuantities,
        services: {
          prasad,
          meals,
          parking,
          locker,
          donation: parseFloat(donation) || 0,
        },
        couponCode,
        appliedDiscount,
        specialRequests,
        returnUrl: currentUrl,
        timestamp: Date.now(),
      };
      saveBookingDraft(draftPayload);
      setGuestPendingIntent({
        type: "ashram_booking",
        returnUrl: currentUrl,
      });
      navigate(`/login?redirect=${encodeURIComponent(currentUrl)}`);
      return;
    }

    if (user.role !== "customer") {
      setBookingError(
        "Only registered Guests can book rooms. Please log in with a Customer profile.",
      );
      return;
    }

    if (!checkIn || !checkOut) {
      setBookingError("Please choose check-in and check-out dates.");
      return;
    }

    const payload = {
      ashramId: ashram._id,
      roomId: selectedRoom._id,
      checkInDate: checkIn,
      checkOutDate: checkOut,
      guestsCount,
      roomsBookedCount: roomsCount,
      services: {
        selectedAddOns: activeAddOnsList,
        prasad: { ordered: prasad },
        meals: { ordered: meals },
        parking: { ordered: parking },
        locker: { ordered: locker },
        donation: { amount: parseFloat(donation) || 0 },
      },
      promoCode: couponCode ? couponCode.trim().toUpperCase() : undefined,
      appliedOfferId: appliedOfferData?.offerId || undefined,
    };

    setPaying(true);
    try {
      const res = await bookingService.create(payload);
      if (!res.data.success || !res.data.data?._id)
        throw new Error("Could not create a secure reservation hold.");

      const heldBooking = res.data.data;
      const orderRes = await bookingService.createPaymentOrder(heldBooking._id);
      if (orderRes.data.demo)
        throw new Error("Razorpay is not configured. Real payment is required.");

      const paymentResult = await openRazorpayCheckout(orderRes.data.data, {
        name: user.name,
        email: user.email,
        contact: user.phone,
      });
      const paymentRes = await bookingService.pay(heldBooking._id, paymentResult);
      if (!paymentRes.data.success) throw new Error("Payment verification failed.");

      clearBookingDraft();
      setBookingSuccess(paymentRes.data.data);
    } catch (err) {
      setBookingError(
        getErrorMessage(err, "Payment could not be completed. Your booking was not confirmed."),
      );
    } finally {
      setPaying(false);
    }
  };

  const handleConfirmPayment = async () => {
    if (!bookingSuccess) return;
    setBookingError("");
    setPaying(true);
    try {
      // 1. Ask the backend to create a payment order (or signal demo mode).
      const orderRes = await bookingService.createPaymentOrder(
        bookingSuccess._id,
      );

      if (orderRes.data.demo) {
        throw new Error("Razorpay is not configured. Real payment is required.");
        // No gateway configured → demo confirmation path.
      }

      // 2. Open Razorpay checkout with the real order.
      const result = await openRazorpayCheckout(orderRes.data.data, {
        name: user?.name,
        email: user?.email,
        contact: user?.phone,
      });

      // 3. Verify the signature server-side and confirm the booking.
      await bookingService.pay(bookingSuccess._id, result);
      navigate("/dashboard");
    } catch (err) {
      setBookingError(
        getErrorMessage(
          err,
          "Payment could not be completed. Please try again.",
        ),
      );
    } finally {
      setPaying(false);
    }
  };

  const getAmenityIcon = (amName: string) => {
    const name = amName.toLowerCase();
    if (name.includes("wifi"))
      return (
        <span className="font-bold text-[9px] bg-primary/10 text-primary px-2.5 py-1 rounded-full">
          WiFi
        </span>
      );
    if (name.includes("food") || name.includes("meal"))
      return (
        <span className="font-bold text-[9px] bg-success/10 text-success px-2.5 py-1 rounded-full">
          Satvik Food
        </span>
      );
    if (name.includes("meditation"))
      return (
        <span className="font-bold text-[9px] bg-amber-500/10 text-amber-700 px-2.5 py-1 rounded-full">
          Dhyan Hall
        </span>
      );
    if (name.includes("yoga"))
      return (
        <span className="font-bold text-[9px] bg-purple-500/10 text-purple-600 px-2.5 py-1 rounded-full">
          Yoga
        </span>
      );
    if (name.includes("cow") || name.includes("shelter"))
      return (
        <span className="font-bold text-[9px] bg-yellow-500/10 text-yellow-700 px-2.5 py-1 rounded-full">
          Goshala
        </span>
      );
    if (name.includes("river") || name.includes("view"))
      return (
        <span className="font-bold text-[9px] bg-blue-500/10 text-blue-600 px-2.5 py-1 rounded-full">
          Ganga View
        </span>
      );
    return (
      <span className="font-bold text-[9px] bg-gray-50 text-gray-500 px-2.5 py-1 rounded-full">
        {amName}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-20 animate-pulse bg-white rounded-[28px] h-80 border border-gray-100" />
    );
  }

  if (!ashram) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-20 text-center space-y-4">
        <h2 className="text-2xl font-extrabold text-[#0B192C] dark:text-white">
          Ashram unavailable
        </h2>
        <p className="text-sm text-gray-500">
          {detailError || "The requested ashram could not be found."}
        </p>
        <Link
          to="/search"
          className="inline-flex px-5 py-2.5 rounded-full bg-[#0A4DA6] text-white text-xs font-bold"
        >
          Browse available stays
        </Link>
      </div>
    );
  }

  const galleryImages = ashram?.images || [];
  const SCHEMA_DEFAULT_LNG_LAT = [77.209, 28.613];
  const ashramLatLng: [number, number] | null = (() => {
    const pair = ashram?.address?.coordinates?.coordinates;
    if (!Array.isArray(pair) || pair.length !== 2) return null;

    const [lng, lat] = pair.map(Number);
    if (!hasValidCoordinates(lat, lng)) return null;
    if (lng === SCHEMA_DEFAULT_LNG_LAT[0] && lat === SCHEMA_DEFAULT_LNG_LAT[1])
      return null;

    return [lat, lng];
  })();

  return (
    <div className="max-w-7xl mx-auto px-6 pt-2 pb-16 space-y-10">
      {/* Title Header — Equalized Visual Width Container */}
      <div className="border-b border-gray-100 dark:border-slate-800 pb-5">
        <div className="max-w-3xl md:max-w-4xl mx-auto flex flex-col items-center text-center space-y-3.5 px-2">
          {/* Badge & City/State */}
          <div className="flex items-center justify-center gap-2">
            <VerifiedBadge
              isVerified={ashram.isVerified ?? ashram.status === "approved"}
              text="Verified Stay"
              size="md"
            />
            <span className="text-xs text-gray-400 font-extrabold tracking-wider">
              {[ashram.address?.city, ashram.address?.state]
                .filter(Boolean)
                .join(", ")}
            </span>
          </div>

          {/* Row 1: Ashram Name */}
          <h2 className="text-3xl md:text-5xl font-extrabold text-[#0B192C] dark:text-white leading-tight">
            {ashram.name}
          </h2>
          <div className="text-xs font-bold text-gray-600 dark:text-gray-300 flex flex-col sm:flex-row sm:flex-wrap items-center justify-center gap-y-2 sm:gap-x-2.5 leading-relaxed">
            {/* items-start + a nudge, so the pin sits on the FIRST line of a
                wrapped address rather than centred against the whole block. */}
            <span className="flex items-start gap-1.5">
              <MapPin size={14} className="text-[#0A4DA6] shrink-0 mt-[3px]" />
              <span>
                {[
                  ashram.address?.street,
                  ashram.address?.city,
                  ashram.address?.state,
                  ashram.address?.pincode
                    ? `PIN Code: ${ashram.address.pincode}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(", ")}
              </span>
            </span>

            <span className="hidden sm:inline text-gray-300 dark:text-slate-700 font-black">
              •
            </span>

            {(() => {
              const rawPhone =
                ashram.contact?.phone ||
                ashram.phone ||
                ashram.ownerId?.phone ||
                "+91 135 244 0001";
              const digits = rawPhone.replace(/\D/g, "");
              const formatted =
                digits.length === 10
                  ? `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`
                  : rawPhone;
              return (
                <a
                  href={`tel:${rawPhone}`}
                  className="flex items-center gap-1.5 hover:text-[#0A4DA6] transition-colors shrink-0"
                >
                  <Phone size={13} className="text-[#0A4DA6] shrink-0" />
                  <span>{formatted}</span>
                </a>
              );
            })()}

            <span className="hidden sm:inline text-gray-300 dark:text-slate-700 font-black">
              •
            </span>

            <a
              href={`mailto:${ashram.contact?.email || ashram.email || ashram.ownerId?.email || "stay@trust.in"}`}
              className="flex items-center gap-1.5 hover:text-[#0A4DA6] transition-colors shrink-0"
            >
              <Mail size={13} className="text-[#0A4DA6] shrink-0" />
              <span>
                {ashram.contact?.email ||
                  ashram.email ||
                  ashram.ownerId?.email ||
                  "stay@trust.in"}
              </span>
            </a>

            {ashram.website && (
              <>
                <span className="hidden sm:inline text-gray-300 dark:text-slate-700 font-black">
                  •
                </span>
                <a
                  href={
                    ashram.website.startsWith("http")
                      ? ashram.website
                      : `https://${ashram.website}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 hover:text-[#0A4DA6] transition-colors shrink-0"
                >
                  <Globe size={13} className="text-[#0A4DA6] shrink-0" />
                  <span>{ashram.website}</span>
                </a>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Premium Hero + Thumbnail Gallery */}
      <div className="space-y-3 -mt-4">
        {/* Hero image (16:9) — click to open lightbox, swipe to change on mobile */}
        <div
          className="relative w-full aspect-video rounded-[24px] overflow-hidden shadow-sm cursor-zoom-in group bg-gray-100 dark:bg-slate-900"
          onClick={() => galleryImages.length > 0 && setLightboxOpen(true)}
          onTouchStart={(e) => {
            touchStartX.current = e.touches[0].clientX;
          }}
          onTouchEnd={onHeroTouchEnd}
        >
          <AnimatePresence mode="wait">
            <motion.img
              key={activeImageIndex}
              src={galleryImages[activeImageIndex] || galleryImages[0]}
              alt="Ashram view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35, ease: "easeInOut" }}
              className="absolute inset-0 w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src =
                  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100%25' height='100%25' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='1.5'%3E%3Crect width='100%25' height='100%25' fill='%23f1f5f9'/%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'/%3E%3Cpath d='m21 15-5-5-11 11'/%3E%3C/svg%3E";
              }}
            />
          </AnimatePresence>

          {galleryImages.length > 1 && (
            <div className="absolute top-4 left-4 px-2.5 py-1 rounded-full bg-black/45 text-white text-[10px] font-bold backdrop-blur-sm">
              {activeImageIndex + 1} / {galleryImages.length}
            </div>
          )}
          <div className="absolute bottom-4 right-4 px-3 py-1.5 rounded-full bg-black/50 text-white text-[11px] font-bold flex items-center gap-1.5 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity">
            <Maximize2 size={13} /> View Gallery
          </div>
        </div>

        {/* Thumbnail carousel — swipeable, hover zoom, active highlight */}
        {galleryImages.length > 1 && (
          <div
            className="flex gap-3 overflow-x-auto pb-1 scrollbar-none snap-x"
            style={{ scrollbarWidth: "none" }}
          >
            {galleryImages.map((img: string, idx: number) => (
              <button
                key={idx}
                onClick={() => setActiveImageIndex(idx)}
                aria-label={`Show image ${idx + 1}`}
                className={`relative shrink-0 w-24 h-16 sm:w-28 sm:h-20 rounded-2xl overflow-hidden cursor-pointer border-2 transition-all snap-start group ${
                  idx === activeImageIndex
                    ? "border-[#0A4DA6] ring-2 ring-[#0A4DA6]/20"
                    : "border-transparent opacity-70 hover:opacity-100"
                }`}
              >
                <img
                  src={img}
                  alt={`Gallery ${idx + 1}`}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src =
                      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100%25' height='100%25' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='1.5'%3E%3Crect width='100%25' height='100%25' fill='%23f1f5f9'/%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'/%3E%3Cpath d='m21 15-5-5-11 11'/%3E%3C/svg%3E";
                  }}
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxOpen && galleryImages.length > 0 && (
        <div
          className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X size={20} />
          </button>

          {galleryImages.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  prevImage();
                }}
                className="absolute left-4 sm:left-8 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Previous image"
              >
                <ChevronLeft size={22} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  nextImage();
                }}
                className="absolute right-4 sm:right-8 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Next image"
              >
                <ChevronRight size={22} />
              </button>
            </>
          )}

          <AnimatePresence mode="wait">
            <motion.img
              key={activeImageIndex}
              src={galleryImages[activeImageIndex]}
              alt="Ashram full view"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="max-h-[85vh] max-w-[92vw] object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </AnimatePresence>

          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-white/10 text-white text-xs font-bold">
            {activeImageIndex + 1} / {galleryImages.length}
          </div>
        </div>
      )}

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Ashram Details */}
        <div className="lg:col-span-2 space-y-8">
          {/* About description & History */}
          <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-6 space-y-5 shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-gray-50 dark:border-slate-850 pb-3">
              <h3 className="text-base font-extrabold text-[#0B192C] dark:text-white border-b border-gray-50 dark:border-slate-850 pb-3">
                About the Retreat
              </h3>
              <div className="flex items-center gap-1 bg-gray-50 dark:bg-slate-900 px-3 py-1 border border-gray-150 dark:border-slate-800 rounded-full shrink-0">
                <Star className="text-[#D4AF37] fill-[#D4AF37]" size={12} />
                <span className="text-[11px] font-extrabold text-[#0B192C] dark:text-white">
                  {ashram.rating?.average} / 5
                </span>
              </div>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed font-medium">
              {ashram.description}
            </p>

            {ashram.history && (
              <div className="pt-4 border-t border-gray-100 dark:border-slate-800 space-y-2">
                <h4 className="text-xs font-bold text-[#0A4DA6] tracking-wider">
                  Historical Significance
                </h4>
                <p className="text-xs text-gray-500 leading-relaxed italic bg-gray-50/50 dark:bg-slate-900/10 p-4 rounded-2xl border border-dashed border-gray-100 dark:border-slate-850">
                  "{ashram.history}"
                </p>
              </div>
            )}
          </div>

          {/* Amenities & Facilities */}
          <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-6 space-y-5 shadow-sm">
            <h3 className="text-base font-extrabold text-[#0B192C] dark:text-white border-b border-gray-50 dark:border-slate-850 pb-3">
              Facilities & Spiritual Activities
            </h3>
            <div className="flex flex-wrap gap-2.5">
              {ashram.amenities?.map((am: string, i: number) => (
                <div key={i} className="flex items-center gap-1">
                  {getAmenityIcon(am)}
                </div>
              ))}
            </div>
          </div>

          {/* Rooms Categories List */}
          <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-6 space-y-5 shadow-sm">
            <h3 className="text-base font-extrabold text-[#0B192C] dark:text-white border-b border-gray-50 dark:border-slate-850 pb-3">
              Available Room Categories
            </h3>
            <div className="space-y-4">
              {rooms.map((r) => (
                <div
                  key={r._id}
                  onClick={() => setSelectedRoom(r)}
                  className={`p-4 border rounded-[20px] cursor-pointer flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-all ${selectedRoom?._id === r._id ? "border-[#0A4DA6] bg-[#0A4DA6]/5 shadow-sm" : "border-gray-100 dark:border-slate-800 hover:bg-gray-50/50 dark:hover:bg-slate-800/10"}`}
                >
                  <div className="space-y-1">
                    <span className="text-xs font-extrabold text-[#0B192C] dark:text-white">
                      {r.name}
                    </span>
                    <span className="text-[10px] text-gray-400 block font-bold capitalize tracking-wide">
                      {r.type.replace("_", " ")} • {r.acType} • Capacity:{" "}
                      {r.capacity} Guests
                    </span>
                    <p className="text-[10px] text-gray-500 max-w-md">
                      {r.description ||
                        "Simple clean room with standard Vedic facilities."}
                    </p>
                  </div>
                  <div className="flex flex-col sm:items-end text-left sm:text-right shrink-0">
                    <span className="text-xs text-gray-400 font-bold tracking-wider">
                      Bed Rate
                    </span>
                    <span className="text-sm font-extrabold text-[#0B192C] dark:text-white">
                      ₹{r.basePrice} / night
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Room Availability Calendar — weekday-aligned month view */}
          {false && (
          <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-4 sm:p-6 space-y-4 sm:space-y-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-50 dark:border-slate-850 pb-3">
              <h3 className="min-w-0 text-base font-extrabold text-[#0B192C] dark:text-white flex items-center gap-1.5">
                <CalendarIcon size={18} className="text-[#0A4DA6] shrink-0" />{" "}
                Room Availability
              </h3>
              <span className="shrink-0 text-[10px] text-gray-400 font-bold tracking-wider">
                Next 30 days
              </span>
            </div>
            <p className="text-[10px] text-gray-400 font-bold">
              Room Category:{" "}
              <span className="text-[#0B192C] dark:text-white font-extrabold">
                {selectedRoom?.name || "Selected Room"}
              </span>
            </p>

            {loadingCalendar ? (
              <div className="h-64 bg-gray-50 dark:bg-slate-900 rounded-2xl animate-pulse" />
            ) : (
              (() => {
                // Bucket a day by remaining inventory. Thresholds are unchanged
                // from the previous flat grid, so booking guidance stays the same.
                const statusOf = (available: number) =>
                  available <= 0
                    ? "sold_out"
                    : available <= 2
                      ? "almost_full"
                      : available <= 5
                        ? "limited"
                        : "available";

                const swatch: Record<string, string> = {
                  sold_out: "bg-danger/10 border-danger/20 text-danger",
                  almost_full:
                    "bg-amber-500/10 border-amber-500/20 text-amber-700",
                  limited:
                    "bg-yellow-500/10 border-yellow-500/20 text-yellow-600",
                  available: "bg-success/10 border-success/20 text-success",
                };

                const days = availabilityCalendar;
                if (days.length === 0) {
                  return (
                    <p className="text-xs text-gray-400 font-semibold py-6 text-center">
                      Availability for this room category is not published yet.
                    </p>
                  );
                }

                const firstDate = new Date(days[0].date);
                const lastDate = new Date(days[days.length - 1].date);

                // The weekday of the first day decides how many blank cells the
                // grid needs before it, so every date lands under its real
                // weekday column instead of just flowing left-to-right.
                const leadingBlanks = firstDate.getDay();
                const trailingBlanks =
                  (7 - ((leadingBlanks + days.length) % 7)) % 7;

                const monthLabel =
                  firstDate.getMonth() === lastDate.getMonth()
                    ? firstDate.toLocaleString("en-US", {
                        month: "long",
                        year: "numeric",
                      })
                    : firstDate.toLocaleString("en-US", { month: "long" }) +
                      " – " +
                      lastDate.toLocaleString("en-US", {
                        month: "long",
                        year: "numeric",
                      });

                const openDays = days.filter(
                  (d: any) => d.available > 0,
                ).length;

                return (
                  <div className="space-y-4">
                    {/* Legend first, so the colours are decoded before they are read */}
                    <div className="grid grid-cols-3 gap-2 text-[9px] sm:text-[10px] font-bold">
                      {[
                        {
                          cls: "bg-success/20 border-success/40",
                          title: "Available",
                          sub: "6+ left",
                        },
                        {
                          cls: "bg-yellow-500/20 border-yellow-500/40",
                          title: "Limited",
                          sub: "1-5 left",
                        },
                        {
                          cls: "bg-danger/20 border-danger/40",
                          title: "Sold Out",
                          sub: "Fully booked",
                        },
                      ].map((l) => (
                        <div
                          key={l.title}
                          className="flex items-start gap-1.5 min-w-0"
                        >
                          <span
                            className={
                              "w-3 h-3 rounded border shrink-0 mt-0.5 " + l.cls
                            }
                          />
                          <span className="min-w-0">
                            <span className="block text-gray-600 dark:text-gray-300 leading-tight">
                              {l.title}
                            </span>
                            <span className="block text-gray-400 font-semibold leading-tight">
                              {l.sub}
                            </span>
                          </span>
                        </div>
                      ))}
                    </div>

                    <p className="text-center text-sm font-extrabold text-[#0B192C] dark:text-white">
                      {monthLabel}
                    </p>

                    {/* Weekday header */}
                    <div className="grid grid-cols-7 gap-1 sm:gap-1.5 text-center text-[9px] sm:text-[10px] font-extrabold text-gray-400 tracking-wider">
                      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                        (d) => (
                          <span key={d}>{d}</span>
                        ),
                      )}
                    </div>

                    <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
                      {Array.from({ length: leadingBlanks }).map((_, i) => (
                        <div
                          key={"lead-" + i}
                          aria-hidden
                          className="h-14 sm:h-16 rounded-xl border border-dashed border-gray-100 dark:border-slate-850"
                        />
                      ))}

                      {days.map((day: any, i: number) => {
                        const status = statusOf(day.available);
                        const dateObj = new Date(day.date);
                        const label =
                          dateObj.toLocaleDateString("en-US", {
                            weekday: "long",
                            day: "numeric",
                            month: "long",
                          }) +
                          " - " +
                          (day.available > 0
                            ? day.available + " left"
                            : "sold out");
                        return (
                          <div
                            key={i}
                            title={label}
                            className={
                              "h-14 sm:h-16 px-0.5 rounded-xl border flex flex-col items-center justify-center select-none " +
                              swatch[status]
                            }
                          >
                            <span className="text-[11px] sm:text-xs font-extrabold leading-none">
                              {dateObj.getDate()}
                            </span>
                            <span className="text-[8px] sm:text-[9px] font-semibold leading-tight mt-0.5">
                              ₹{day.price}
                            </span>
                            <span className="text-[7px] sm:text-[8px] font-extrabold leading-tight">
                              {status === "sold_out"
                                ? "Full"
                                : day.available + " left"}
                            </span>
                          </div>
                        );
                      })}

                      {Array.from({ length: trailingBlanks }).map((_, i) => (
                        <div
                          key={"trail-" + i}
                          aria-hidden
                          className="h-14 sm:h-16 rounded-xl border border-dashed border-gray-100 dark:border-slate-850"
                        />
                      ))}
                    </div>

                    {/* Availability overview */}
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 p-3">
                      <div className="min-w-0">
                        <p className="text-xs font-extrabold text-[#0B192C] dark:text-white">
                          Availability Overview
                        </p>
                        <p className="text-[10px] text-gray-400 font-bold">
                          {firstDate.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}{" "}
                          &ndash;{" "}
                          {lastDate.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                      </div>
                      <span className="shrink-0 px-3 py-1 rounded-full bg-[#0A4DA6]/10 text-[#0A4DA6] dark:text-amber-400 text-[10px] font-black">
                        {openDays} Available {openDays === 1 ? "Day" : "Days"}
                      </span>
                    </div>
                  </div>
                );
              })()
            )}
          </div>
          )}

          {/* Rules & Policies */}
          <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-6 space-y-5 shadow-sm">
            <h3 className="text-base font-extrabold text-[#0B192C] dark:text-white border-b border-gray-50 dark:border-slate-850 pb-3">
              Rules & Policies
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
              <div className="space-y-3">
                <h4 className="font-bold text-[#0A4DA6] tracking-wider text-[10px]">
                  Guidelines for Guests
                </h4>
                <ul className="text-gray-500 space-y-2 list-disc pl-5">
                  {ashram.rules?.map((rule: string, i: number) => (
                    <li key={i}>{rule}</li>
                  ))}
                </ul>
              </div>
              <div className="space-y-3">
                <h4 className="font-bold text-[#0A4DA6] tracking-wider text-[10px]">
                  Check-in Policies
                </h4>
                <div className="space-y-1.5 text-gray-500">
                  <p>
                    <strong>Check-in Time:</strong> 12:00 PM
                  </p>
                  <p>
                    <strong>Check-out Time:</strong> 11:00 AM
                  </p>
                  <p>
                    <strong>Nearby Attractions:</strong>{" "}
                    {ashram.nearbyAttractions?.join(", ") || "Temples & Ghats"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Current Opportunities / Volunteer Seva Section */}
          {volunteerJobs.length > 0 && (
            <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-6 space-y-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-gray-50 dark:border-slate-850 pb-3">
                <h3 className="text-base font-extrabold text-[#0B192C] dark:text-white">
                  Current Volunteer & Career Opportunities (
                  {volunteerJobs.length})
                </h3>
                <Link
                  to="/volunteer"
                  className="text-xs font-black text-[#0A4DA6] hover:underline"
                >
                  View All Directory →
                </Link>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {volunteerJobs.map((j) => (
                  <div
                    key={j._id}
                    className="p-4 bg-gray-50/70 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-800 rounded-2xl space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-[#0A4DA6] bg-blue-50 dark:bg-slate-850 px-2 py-0.5 rounded-full">
                        {j.department}
                      </span>
                      <span className="text-[10px] font-bold text-gray-400">
                        {j.openingsCount} Openings
                      </span>
                    </div>

                    <Link
                      to={`/volunteer/${j._id}`}
                      className="block hover:underline"
                    >
                      <h4 className="text-xs font-black text-[#0B192C] dark:text-white">
                        {j.title}
                      </h4>
                    </Link>
                    <p className="text-[11px] font-extrabold text-[#E58C28]">
                      {j.stipend}
                    </p>

                    <Link
                      to={`/volunteer/${j._id}`}
                      className="inline-block mt-2 px-3 py-1 bg-[#0A4DA6] hover:bg-[#083b80] text-white text-[10px] font-extrabold rounded-full transition-colors"
                    >
                      Apply for Seva
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-5">
            <GuestReviewsCarousel
              compact
              reviews={reviews}
              ashramName={ashram?.name}
              onReviewDeleted={() => id && fetchReviews(id)}
            />
            {id && (
              <WriteReviewCard
                ashramId={id}
                ashramName={ashram?.name}
                onSubmitted={() => fetchReviews(id)}
              />
            )}
          </div>
        </div>

        {/* Right Column: Booking Sidecard & Contact Trust */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-6 shadow-sm space-y-6 relative overflow-visible z-40">
            <div className="absolute top-0 inset-x-0 h-1 bg-[#0A4DA6]" />
            <h3 className="font-extrabold text-sm text-[#0B192C] dark:text-white">
              Stay Booking Engine
            </h3>

            {restoredNotice && (
              <div className="p-3 bg-[#0A4DA6]/10 border border-[#0A4DA6]/20 rounded-xl flex items-center justify-between text-xs font-semibold text-[#0A4DA6] space-x-2">
                <div className="flex items-center gap-1.5">
                  <Sparkles size={14} className="text-[#0A4DA6] shrink-0" />
                  <span>
                    Your previous booking selections have been restored.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleClearDraft}
                  className="text-[10px] font-bold text-gray-500 hover:text-danger underline cursor-pointer shrink-0"
                >
                  Clear
                </button>
              </div>
            )}

            {bookingError && (
              <div className="p-3 bg-danger/10 text-danger border border-danger/20 text-xs rounded-xl font-bold">
                {bookingError}
              </div>
            )}

            {!bookingSuccess ? (
              <form onSubmit={handleBookingSubmit} className="space-y-4">
                <div className="relative z-50 p-3 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl">
                  <DateRangePicker
                    checkIn={checkIn}
                    checkOut={checkOut}
                    align="right"
                    onChange={(nextIn, nextOut) => {
                      setCheckIn(nextIn);
                      setCheckOut(nextOut);
                      updateBookingSearch({
                        checkIn: nextIn,
                        checkOut: nextOut,
                      });
                    }}
                  />
                </div>

                <RoomAvailabilityCalendar
                  days={availabilityCalendar}
                  loading={loadingCalendar}
                  roomName={selectedRoom?.name}
                  selectedDate={checkIn}
                  onSelect={(date) => {
                    const nextOut = getTomorrowYMD(date);
                    setCheckIn(date);
                    setCheckOut(nextOut);
                    updateBookingSearch({ checkIn: date, checkOut: nextOut });
                    setBookingError("");
                  }}
                />

                <div className="p-3.5 bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-800 rounded-[20px] space-y-1 select-none">
                  <span className="text-[9px] text-gray-400 font-bold tracking-wider">
                    Active Category
                  </span>
                  <span className="text-xs font-extrabold text-secondary dark:text-white block leading-tight">
                    {selectedRoom?.name}
                  </span>
                  <span className="text-[10px] font-bold text-[#0A4DA6]">
                    ₹{selectedRoom?.basePrice} / bed per night
                  </span>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold tracking-wider text-gray-400">
                    Guests & Rooms
                  </label>
                  <GuestRoomSelector compact />
                </div>

                {/* Add ons - 4 distinct options */}
                {/* Dynamic Database-Driven Add-on Services */}
                <div className="pt-3 border-t border-gray-100 dark:border-slate-800 space-y-3">
                  <span className="text-[10px] font-extrabold tracking-wider text-gray-400 block">
                    Add-on Services (Dynamic Pricing)
                  </span>

                  {availableAddOns.filter((a: any) => a.enabled !== false)
                    .length === 0 ? (
                    <p className="text-[11px] text-gray-400 italic">
                      No add-on services available for this ashram.
                    </p>
                  ) : (
                    <div className="space-y-2.5">
                      {availableAddOns
                        .filter((item: any) => item.enabled !== false)
                        .map((item: any) => {
                          const qty = addOnQuantities[item._id] || 0;
                          return (
                            <div
                              key={item._id}
                              className={`p-3 rounded-2xl border transition-all text-xs font-semibold flex items-center justify-between gap-2 ${
                                qty > 0
                                  ? "bg-[#0A4DA6]/5 border-[#0A4DA6]/30"
                                  : "bg-gray-50/70 dark:bg-slate-900/60 border-gray-100 dark:border-slate-800"
                              }`}
                            >
                              <div className="space-y-0.5 flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <Sparkles
                                    size={13}
                                    className="text-[#0A4DA6] shrink-0"
                                  />
                                  <span className="font-extrabold text-[#0B192C] dark:text-white truncate">
                                    {item.name}
                                  </span>
                                </div>
                                <span className="text-[10px] font-bold text-[#0A4DA6] block">
                                  ₹{item.price}{" "}
                                  <span className="text-gray-400 font-medium">
                                    / {item.unitLabel || "Unit"}
                                  </span>
                                </span>
                              </div>

                              {/* Quantity Stepper */}
                              <div className="flex items-center gap-1.5 shrink-0 select-none">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleUpdateAddOnQty(
                                      item._id,
                                      -1,
                                      item.maxQuantity,
                                    )
                                  }
                                  disabled={qty <= 0}
                                  className={`w-6 h-6 rounded-full border flex items-center justify-center text-xs font-bold transition-all ${
                                    qty <= 0
                                      ? "border-gray-200 text-gray-300 dark:border-slate-800 dark:text-slate-700 cursor-not-allowed"
                                      : "border-[#0A4DA6] text-[#0A4DA6] hover:bg-[#0A4DA6] hover:text-white cursor-pointer"
                                  }`}
                                >
                                  -
                                </button>
                                <span className="w-5 text-center text-xs font-extrabold text-[#0B192C] dark:text-white tabular-nums">
                                  {qty}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleUpdateAddOnQty(
                                      item._id,
                                      1,
                                      item.maxQuantity,
                                    )
                                  }
                                  disabled={qty >= (item.maxQuantity || 10)}
                                  className={`w-6 h-6 rounded-full border flex items-center justify-center text-xs font-bold transition-all ${
                                    qty >= (item.maxQuantity || 10)
                                      ? "border-gray-200 text-gray-300 dark:border-slate-800 dark:text-slate-700 cursor-not-allowed"
                                      : "border-[#0A4DA6] text-[#0A4DA6] hover:bg-[#0A4DA6] hover:text-white cursor-pointer"
                                  }`}
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>

                {/* Donation */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 flex items-center gap-1">
                    Ashram Donation (₹){" "}
                    <Heart size={10} className="text-danger fill-danger" />
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 500"
                    value={donation}
                    onChange={(e) => setDonation(e.target.value)}
                    className="w-full p-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl text-xs font-semibold"
                  />
                </div>

                {/* SECTION 1: Premium Savings Card (Framer Motion) */}
                {appliedOfferData && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="p-4 bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-emerald-500/15 border border-emerald-500/30 rounded-[22px] space-y-3 text-left relative overflow-hidden shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="p-2 bg-emerald-500 text-white rounded-full shadow-md text-xs">
                          🎉
                        </span>
                        <div>
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-black tracking-wider block">
                            Offer Applied Successfully
                          </span>
                          <h4 className="text-xs font-black text-[#0B192C] dark:text-white">
                            {appliedOfferData.offerName ||
                              "Exclusive Pilgrim Discount"}
                          </h4>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 bg-emerald-500 text-white rounded-full text-[10px] font-black shadow-sm">
                        {appliedOfferData.promoCode}
                      </span>
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t border-emerald-500/20 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                      <span>
                        {appliedOfferData.offerCategory || "Festival Special"}
                      </span>
                      <span className="font-extrabold text-sm text-emerald-600 dark:text-emerald-400">
                        {/* The quoted saving, so this panel cannot disagree
                          with the breakdown directly beneath it. */}
                        You Saved ₹{discountCalc}
                      </span>
                    </div>

                    {/* Action Triggers: [ Change Coupon ] [ Remove Coupon ] */}
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={handleChangeCoupon}
                        className="flex-1 py-1.5 px-3 bg-[#0A4DA6] hover:bg-[#083b80] text-white text-[10px] font-black rounded-xl flex items-center justify-center gap-1 transition-all cursor-pointer shadow-sm"
                      >
                        <Edit3 size={12} /> Change Coupon
                      </button>
                      <button
                        type="button"
                        onClick={handleRemoveCoupon}
                        className="flex-1 py-1.5 px-3 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50 text-[10px] font-black rounded-xl flex items-center justify-center gap-1 transition-all cursor-pointer"
                      >
                        <Trash2 size={12} /> Remove Coupon
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* SECTION 4: 10-Minute Reservation Timer */}
                {timerActive && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 rounded-2xl flex items-center justify-between text-xs font-bold text-amber-800 dark:text-amber-300 animate-pulse">
                    <div className="flex items-center gap-2">
                      <span className="text-base">⏳</span>
                      <span>
                        This discounted price has been reserved for you.
                      </span>
                    </div>
                    <span className="font-mono font-black text-sm bg-amber-200 dark:bg-amber-900 px-2.5 py-0.5 rounded-lg">
                      {formatTimer(reservationSeconds)}
                    </span>
                  </div>
                )}

                {/* Promo Coupon Code Entry */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400">
                    Promo / Coupon Code
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. KUMBH2026"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value)}
                      className="flex-1 p-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl text-xs font-semibold"
                    />
                    <button
                      type="button"
                      onClick={handleApplyCoupon}
                      className="px-4 py-2.5 bg-[#0A4DA6] text-white text-xs font-extrabold rounded-xl cursor-pointer hover:bg-[#083b80] transition-all shadow-sm"
                    >
                      Apply
                    </button>
                  </div>
                  {couponMsg && (
                    <p
                      className={`text-[10px] font-bold ${appliedDiscount > 0 ? "text-emerald-600" : "text-rose-500"}`}
                    >
                      {couponMsg}
                    </p>
                  )}
                </div>

                {/* SECTION 5: Loyalty Rewards System */}
                <div className="p-3.5 bg-blue-50/70 dark:bg-slate-900/80 border border-blue-100 dark:border-slate-800 rounded-2xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Award size={16} className="text-[#E58C28]" />
                    <div>
                      <span className="font-extrabold text-[#0B192C] dark:text-white block">
                        Tirvona Loyalty Rewards
                      </span>
                      <span className="text-[10px] text-gray-500">
                        {useLoyalty
                          ? "Applied 100 points (-₹100)"
                          : `Earn ${Math.round(subtotalCalc * 0.05)} reward points after stay`}
                      </span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={useLoyalty}
                    onChange={() => setUseLoyalty(!useLoyalty)}
                    className="w-4 h-4 text-[#0A4DA6] rounded border-gray-300 cursor-pointer"
                  />
                </div>

                {/* SECTION 7: Offer Information & Scarcity.
                  The remaining count is printed only when the coupon actually
                  reports one — it used to fall back to a literal 12, which
                  told every visitor a scarcity figure that was made up. */}
                {appliedOfferData && (
                  <div className="p-3 bg-gray-50 dark:bg-slate-900/60 rounded-2xl border border-gray-150 dark:border-slate-800 text-[10px] space-y-1 text-gray-500">
                    {Number.isFinite(
                      Number(appliedOfferData.remainingRedemptions),
                    ) && (
                      <div className="flex justify-between font-bold text-gray-700 dark:text-gray-300">
                        <span>🔥 Scarcity Alert:</span>
                        <span className="text-rose-600 font-extrabold">
                          Only {appliedOfferData.remainingRedemptions} offers
                          left
                        </span>
                      </div>
                    )}
                    {appliedOfferData.description && (
                      <p>• {appliedOfferData.description}</p>
                    )}
                  </div>
                )}

                {/* Special Requests / Notes */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400">
                    Special Requests / Notes
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Ground floor room preferred..."
                    value={specialRequests}
                    onChange={(e) => setSpecialRequests(e.target.value)}
                    className="w-full p-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl text-xs font-medium focus:outline-none resize-none"
                  />
                </div>

                {/* SECTION 2: Detailed Enterprise Savings Breakdown */}
                <div className="p-4 bg-gray-50 dark:bg-slate-900/90 border border-gray-200 dark:border-slate-800 rounded-[24px] space-y-2.5 text-xs font-semibold shadow-inner">
                  {/* 1. Original Stay Cost */}
                  <div className="flex justify-between text-gray-600 dark:text-gray-300">
                    <span>
                      Original Stay Cost ({daysCount} night
                      {daysCount > 1 ? "s" : ""}):
                    </span>
                    <span>₹{stayCostCalc}</span>
                  </div>

                  {extraGuestShownCalc > 0 && (
                    <div className="flex justify-between text-gray-600 dark:text-gray-300">
                      <span>Extra Guest Charges:</span>
                      <span>₹{extraGuestShownCalc}</span>
                    </div>
                  )}

                  {servicesShownCalc > 0 && (
                    <div className="flex justify-between text-gray-600 dark:text-gray-300">
                      <span>Add-on Services:</span>
                      <span>₹{servicesShownCalc}</span>
                    </div>
                  )}

                  {donationCalc > 0 && (
                    <div className="flex justify-between text-gray-600 dark:text-gray-300">
                      <span>Ashram Donation:</span>
                      <span>₹{donationCalc}</span>
                    </div>
                  )}

                  {/* 2. Tirvona Platform Fee (the only taxed line) */}
                  {platformSettings.enabled && (
                    <div className="flex justify-between text-[#0A4DA6] font-extrabold text-[11px]">
                      <span>
                        {platformSettings.label || "Tirvona Platform Fee"}:
                      </span>
                      <span>
                        ₹{platformFeeShownCalc}
                        {platformSettings.type === "percentage" && (
                          <span className="text-[10px] text-gray-400 font-normal ml-1">
                            ({platformSettings.value}%)
                          </span>
                        )}
                      </span>
                    </div>
                  )}

                  {/* 3. GST — on the platform fee only, never on the stay */}
                  {gstShownCalc > 0 && (
                    <div className="flex justify-between text-gray-500 text-[11px]">
                      <span>
                        GST ({gstRateCalc}% on platform fee):
                      </span>
                      <span>₹{gstShownCalc}</span>
                    </div>
                  )}

                  {/* 4. Coupon Discount (if applicable) */}
                  {discountCalc > 0 && (
                    <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-extrabold">
                      <span>Coupon Discount ({couponCode}):</span>
                      <span>-₹{discountCalc}</span>
                    </div>
                  )}

                  {/* 5. Loyalty Discount (if applicable) */}
                  {useLoyalty && (
                    <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-extrabold">
                      <span>Loyalty Discount:</span>
                      <span>-₹100</span>
                    </div>
                  )}

                  {/* 6. Final Payable Amount */}
                  <div className="pt-2 border-t border-gray-200 dark:border-slate-800 flex justify-between text-base font-black text-[#0B192C] dark:text-white">
                    <span>Final Payable Amount:</span>
                    <span className="text-[#0A4DA6] dark:text-blue-400">
                      ₹{finalPayableCalc}
                    </span>
                  </div>
                </div>

                {/* SECTION 3 & 6: Savings Highlight & Circular Badge */}
                {totalSavingsCalc > 0 && (
                  <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-between text-xs font-black text-emerald-700 dark:text-emerald-300"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">💰</span>
                      <div>
                        <span>Total Savings ₹{totalSavingsCalc}</span>
                        <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                          You saved ₹{totalSavingsCalc} on this booking stay.
                        </p>
                      </div>
                    </div>
                    {/* SECTION 6: Circular Savings Badge */}
                    <div className="w-11 h-11 rounded-full bg-emerald-500 text-white flex flex-col items-center justify-center font-black text-[9px] shadow-md shrink-0">
                      <span>SAVED</span>
                      <span className="text-[10px]">₹{totalSavingsCalc}</span>
                    </div>
                  </motion.div>
                )}

                {/* SECTION 8: Payment Confidence Badges */}
                <div className="grid grid-cols-2 gap-2 text-[10px] font-bold text-gray-500 dark:text-gray-400 pt-1">
                  <span className="flex items-center gap-1">
                    <ShieldCheck size={12} className="text-emerald-500" /> Tirvona
                    Verified
                  </span>
                  <span className="flex items-center gap-1">
                    <Lock size={12} className="text-blue-500" /> Secure Payment
                  </span>
                  <span className="flex items-center gap-1">
                    <CheckCircle size={12} className="text-teal-500" /> Free
                    Cancellation
                  </span>
                  <span className="flex items-center gap-1">
                    <Sparkles size={12} className="text-purple-500" /> Instant
                    Confirm
                  </span>
                </div>

                {/* Held while a fresh quote is in flight, so nobody can commit
                  against a total that is about to change. */}
                <button
                  type="submit"
                  disabled={paying || quoting}
                  className="w-full py-3.5 bg-[#0A4DA6] hover:bg-[#083b80] disabled:opacity-60 disabled:cursor-not-allowed text-white font-black rounded-full text-xs shadow-lg shadow-[#0A4DA6]/25 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
                >
                  {paying
                    ? "Opening Secure Payment..."
                    : quoting
                      ? "Updating price..."
                      : "Book & Pay"}
                  {!paying && <ArrowRight size={14} />}
                </button>
              </form>
            ) : (
              /* Instant Reservation Confirmed Card */
              <div className="space-y-5 animate-in fade-in duration-200 text-left">
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-800 dark:text-emerald-300 space-y-1">
                  <div className="flex items-center gap-2 font-black text-sm text-emerald-700 dark:text-emerald-400">
                    <span className="text-lg">🎉</span>
                    <span>Payment Successful — Booking Confirmed!</span>
                  </div>
                  <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                    Razorpay verified your payment and your room is confirmed.
                  </p>
                </div>

                <div className="bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-[22px] p-4.5 space-y-2.5 text-xs font-semibold">
                  <div className="flex justify-between items-center pb-2 border-b border-gray-200 dark:border-slate-800">
                    <span className="text-gray-400 text-[10px] font-extrabold">
                      Booking ID:
                    </span>
                    <span className="font-mono font-extrabold text-[#0B192C] dark:text-white">
                      {bookingSuccess.bookingId}
                    </span>
                  </div>

                  {bookingSuccess.reservationNumber && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Reservation No:</span>
                      <span className="font-mono font-bold text-[#0A4DA6]">
                        {bookingSuccess.reservationNumber}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">
                      Counter Check-In Code:
                    </span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {bookingSuccess.checkInCode}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Payment Status:</span>
                    <span className="px-2 py-0.5 bg-amber-500/10 text-amber-700 dark:text-amber-300 rounded text-[10px] font-bold">
                      Fully Paid
                    </span>
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-dashed border-gray-200 dark:border-slate-800 font-extrabold text-sm text-[#0B192C] dark:text-white">
                    <span>Total Amount Payable:</span>
                    <span className="text-[#0A4DA6]">
                      ₹{bookingSuccess.pricing?.totalAmount}
                    </span>
                  </div>
                </div>

                <div className="space-y-2 pt-1">
                  <Link
                    to="/profile/bookings"
                    className="w-full py-3 bg-[#0A4DA6] hover:bg-[#083b80] text-white font-extrabold rounded-full text-xs shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all"
                  >
                    Go to My Bookings <ArrowRight size={14} />
                  </Link>

                  <button
                    type="button"
                    onClick={() => setBookingSuccess(null)}
                    className="w-full py-2 bg-gray-100 dark:bg-slate-850 hover:bg-gray-200 text-gray-600 dark:text-gray-300 font-bold rounded-full text-xs transition-all cursor-pointer"
                  >
                    Make Another Booking
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Location map.
              Previously this panel printed the raw "Lat: … , Lon: …" pair as
              text. It now renders the position on an OpenStreetMap/Leaflet map;
              the Google Maps link is kept because it is what hands a phone over
              to turn-by-turn navigation. */}
          <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 p-6 rounded-[28px] shadow-sm space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h4 className="inline-flex items-center gap-2 text-xs font-extrabold text-[#0B192C] dark:text-white">
                <Map className="text-[#0A4DA6]" size={16} /> Location
              </h4>
              {ashramLatLng && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${ashramLatLng[0]},${ashramLatLng[1]}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-1.5 bg-[#0A4DA6]/10 text-[#0A4DA6] border border-[#0A4DA6]/20 rounded-full text-[9px] font-bold hover:bg-[#0A4DA6]/15 transition-all inline-block cursor-pointer"
                >
                  Get Directions
                </a>
              )}
            </div>

            {ashramLatLng ? (
              <>
                <TirvonaMap
                  height="260px"
                  zoom={15}
                  center={ashramLatLng}
                  ariaLabel={`Map showing ${ashram.name}`}
                  markers={[
                    {
                      id: ashram._id || "ashram",
                      latitude: ashramLatLng[0],
                      longitude: ashramLatLng[1],
                      title: ashram.name,
                      subtitle: [ashram.address?.street, ashram.address?.city]
                        .filter(Boolean)
                        .join(", "),
                    },
                  ]}
                />
                <p className="text-[9px] text-gray-400 text-center">
                  {ashram.address?.street}, {ashram.address?.city} —{" "}
                  {ashram.address?.pincode}
                </p>
              </>
            ) : (
              <p className="text-[10px] text-gray-400 font-medium text-center py-6">
                No map location has been set for this stay yet.
              </p>
            )}
          </div>
        </div>
      </div>
      {/* The full-width reviews block that used to sit here was disabled with
        `{false && …}`. Reviews render in the left column above, so this was a
        dead duplicate — and being unreachable, TypeScript stopped narrowing
        `id` inside it and failed the build. */}

      {/* Related stays */}
      {relatedStays.length > 0 && (
        <div className="space-y-6 pt-10 border-t border-gray-100 dark:border-slate-800">
          <div className="space-y-1">
            <span className="text-xs font-extrabold text-[#0A4DA6] tracking-widest">
              More Places
            </span>
            <h3 className="text-lg md:text-2xl font-extrabold text-[#0B192C] dark:text-white">
              Related Stays in {ashram.address?.city}
            </h3>
          </div>
          {/* Horizontal auto-scrolling row. The negative margin + padding lets
              cards bleed to the screen edge on phones while staying aligned
              with the page gutter from sm up. */}
          <div
            ref={setRelatedRow}
            className="flex gap-4 sm:gap-6 overflow-x-auto pb-2 scrollbar-none -mx-6 px-6 sm:mx-0 sm:px-0 justify-start"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {relatedStays.map((rel) => (
              <Link
                key={rel._id}
                to={`/ashram/${rel._id}`}
                className="shrink-0 w-[260px] sm:w-[300px] bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] overflow-hidden shadow-sm premium-card-hover flex flex-col justify-between"
              >
                <div className="h-40 overflow-hidden relative bg-gray-50 dark:bg-slate-900">
                  <img
                    src={
                      rel.images?.[0] ||
                      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100%25' height='100%25' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='1.5'%3E%3Crect width='100%25' height='100%25' fill='%23f1f5f9'/%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'/%3E%3Cpath d='m21 15-5-5-11 11'/%3E%3C/svg%3E"
                    }
                    alt={rel.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src =
                        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100%25' height='100%25' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='1.5'%3E%3Crect width='100%25' height='100%25' fill='%23f1f5f9'/%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'/%3E%3Cpath d='m21 15-5-5-11 11'/%3E%3C/svg%3E";
                    }}
                  />
                  <span className="absolute bottom-3 right-3 bg-white/95 text-secondary px-2 py-0.5 rounded shadow text-[9px] font-extrabold flex items-center gap-0.5">
                    <Star className="text-[#D4AF37] fill-[#D4AF37]" size={10} />{" "}
                    {rel.rating?.average}
                  </span>
                </div>
                <div className="p-4 flex-grow">
                  <h4 className="font-extrabold text-xs text-[#0B192C] dark:text-white line-clamp-1">
                    {rel.name}
                  </h4>
                  <span className="text-[9px] text-[#0A4DA6] font-bold block">
                    {rel.address?.city}
                  </span>
                </div>
                <div className="px-4 py-3 border-t border-gray-100 dark:border-slate-800 flex justify-between items-center bg-gray-50/50 dark:bg-slate-900/10">
                  <span className="text-[10px] font-extrabold text-[#0B192C] dark:text-white">
                    ₹{rel.lowestNightPrice ?? 150} / night
                  </span>
                  <span className="text-[9px] font-bold text-[#0A4DA6] flex items-center gap-0.5">
                    View <ChevronRight size={10} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AshramDetailPage;
