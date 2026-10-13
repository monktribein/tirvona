import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate, useLocation } from "react-router-dom";
import {
  Award,
  Bed,
  Bus,
  Car,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  Clock,
  Loader2,
  Flame,
  Home,
  MapPin,
  MessageSquare,
  Radio,
  Share2,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { providerPublicService, pujaBookingService, consultationService } from "../services/provider.service";
import { ConsultationChatModal } from "../components/ConsultationChatModal";
import { PujaProcessButton, PujaProcessGuide } from "../components/PujaProcessGuide";
import { WatchLiveButton } from "../components/YouTubeLive";
import { PujaSamagriSection } from "./PujaSamagriSection";
import { getErrorMessage } from "../../../lib/api";
import { useAuth } from "../../../contexts/AuthContext";
import { toast } from "../../../lib/toast";
import { openRazorpayCheckout, type RazorpayResult } from "../../../lib/razorpay";
import type { ProviderProfile, Offering, ProviderBooking } from "../types/provider.types";
import { PROVIDER_TYPE_LABELS, STAY_ARRANGEMENT_LABELS, TRAVEL_MODE_LABELS, VERIFICATION_LEVEL_LABELS } from "../types/provider.types";
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  ErrorNotice,
  Field,
  LinkButton,
  Modal,
  Notice,
  SectionCard,
  Skeleton,
  StatusBadge,
  Toggle,
  cx,
  formatMinor,
  inputClass,
} from "../ui";

const FULFILMENT_LABELS: Record<string, string> = {
  LOCAL_HOME: "At your home",
  DESTINATION_PROVIDER_HOME: "At your home (the provider travels to you)",
  AT_DESTINATION: "At the sacred destination",
  ON_BEHALF: "Performed on your behalf",
  INSTITUTION_AUTHORIZED: "Institution authorized",
  CORPORATE: "Corporate / group event",
};

const IST_OFFSET_MS = 5.5 * 3600 * 1000;
/** The calendar date in India for a given instant, as YYYY-MM-DD. */
const istDate = (at: number) => new Date(at + IST_OFFSET_MS).toISOString().slice(0, 10);
const formatWhen = (iso?: string) =>
  iso ? new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }) : null;

/** One bookable start: the exact instant sent to the server, and how it reads to the devotee. */
type BookingSlot = { iso: string; label: string };
/** Start times are offered every 30 minutes inside the provider's free windows. */
const SLOT_STEP_MS = 30 * 60_000;
/** How far ahead the dialog looks for the first open day (the API allows up to 62). */
const LOOKAHEAD_DAYS = 28;
/** "9:30 am" in the provider's own timezone (the server's windows are in that zone). */
const slotLabel = (at: number, timeZone = "Asia/Kolkata") =>
  new Date(at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone });
/** "13 Oct 2026, 11:30 am" (or just the date) in India time. */
const whenIst = (at: number, part: "datetime" | "date" = "datetime") =>
  new Date(at).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(part === "datetime" ? { hour: "numeric", minute: "2-digit", hour12: true } : { weekday: "short" }),
  });

/** Fields the public API sends that the shared ProviderProfile type does not model. */
type PublicProvider = ProviderProfile & {
  serviceCities?: Array<{ city: string; state?: string | null }>;
  consultation?: { enabled: boolean; feeMinor?: number | null; currency?: string; slotMinutes?: number | null; channels?: string[] };
  offerings?: { count: number; minFeeMinor: number | null; currency?: string };
  acceptingBookings?: boolean;
  travel?: {
    willingToTravel?: boolean;
    overnightOk?: boolean;
    modes?: string[];
    maxDistanceKm?: number | null;
    stayArrangement?: string | null;
    notes?: string | null;
  };
  /** The pandit has switched on live online katha / puja. */
  liveOnline?: boolean;
  /** Their YouTube live page while live online is on. */
  liveYoutubeUrl?: string | null;
  /** Real numbers from Tirvona bookings. */
  stats?: { completedBookings?: number };
};

type OfferingView = Offering & {
  ritual?: { titles?: Record<string, string> } | null;
  variant?: { titles?: Record<string, string> } | null;
  indicativeFee?: { amountMinor: number; currency?: string };
  /** Tirvona's fee the devotee pays on top of the professional fee (from the server). */
  platformFee?: { rateBps: number; percent: number; amountMinor: number; label?: string };
  devoteePriceMinor?: number;
  teamSize?: number;
};

const offeringTitle = (o: OfferingView) =>
  o.title || o.ritual?.titles?.en || Object.values(o.ritual?.titles ?? {})[0] || "Vedic puja";
const offeringFeeMinor = (o: OfferingView) => o.indicativeFee?.amountMinor ?? o.baseProfessionalFeeMinor ?? null;
const offeringCurrency = (o: OfferingView) => o.indicativeFee?.currency || o.currency || "INR";
/** The flat travel charge a booking adds, when the offering has one. */
const offeringTravelMinor = (o: OfferingView) => {
  const charge = (o as any).travelCharge;
  return charge?.policy === "FLAT" ? Number(charge.flatMinor ?? 0) : 0;
};

export const PublicProviderDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const [provider, setProvider] = useState<PublicProvider | null>(null);
  const [offerings, setOfferings] = useState<OfferingView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Booking dialog
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [selectedOffering, setSelectedOffering] = useState<OfferingView | null>(null);
  const [bookingDate, setBookingDate] = useState("");
  /** The chosen start, as the exact instant the server will book (ISO). */
  const [bookingStartIso, setBookingStartIso] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState(user?.name || "");
  const [customerPhone, setCustomerPhone] = useState(user?.phone || "");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerCity, setCustomerCity] = useState("");
  const [customerState, setCustomerState] = useState("");
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const [bookingResult, setBookingResult] = useState<ProviderBooking | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);
  /** Bookable start times per local date, built from the provider's real free windows. */
  const [slotsByDate, setSlotsByDate] = useState<Record<string, BookingSlot[]>>({});
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [scheduleConfigured, setScheduleConfigured] = useState(true);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [paymentBlocker, setPaymentBlocker] = useState<string | null>(null);
  const [useWallet, setUseWallet] = useState(true);
  /** In person (home / temple), or live online on video when the pandit is live. */
  const [deliveryMode, setDeliveryMode] = useState<"IN_PERSON" | "LIVE_ONLINE">("IN_PERSON");
  const [showSteps, setShowSteps] = useState(false);

  // Consultation dialog
  const [consultModalOpen, setConsultModalOpen] = useState(false);
  const [consultTopic, setConsultTopic] = useState("");
  const [consultSlot, setConsultSlot] = useState(() => istDate(Date.now() + 86400000));
  const [consultSubmitting, setConsultSubmitting] = useState(false);
  const [consultSuccess, setConsultSuccess] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [activeConsultationId, setActiveConsultationId] = useState<string | null>(null);

  const minNoticeHours = selectedOffering?.minNoticeHours ?? 0;
  /** The earliest start the server will accept, so the form can say so before submitting. */
  const earliestStart = useMemo(() => Date.now() + minNoticeHours * 3600 * 1000, [minNoticeHours, bookingModalOpen]); // eslint-disable-line react-hooks/exhaustive-deps
  const earliestDate = istDate(earliestStart);
  // The server needs the devotee's address for home services, keeps it for "on behalf" services and ignores it otherwise.
  const liveOnline = deliveryMode === "LIVE_ONLINE";
  // A live online katha happens on video: no address and nobody travels.
  const needsAddress = !liveOnline && (selectedOffering?.fulfilmentType === "LOCAL_HOME" || selectedOffering?.fulfilmentType === "DESTINATION_PROVIDER_HOME");
  const allowsAddress = needsAddress || (!liveOnline && selectedOffering?.fulfilmentType === "ON_BEHALF");
  const notTravelling = !liveOnline && selectedOffering?.fulfilmentType === "DESTINATION_PROVIDER_HOME" && provider?.travel?.willingToTravel === false;

  useEffect(() => {
    if (!user || !provider?.id) return;
    consultationService
      .mine()
      .then((res: any) => {
        if (res.data?.success && Array.isArray(res.data.data)) {
          const match = res.data.data.find(
            (c: any) => (c.expertProviderId === provider.id || c.expertProvider?.id === provider.id) && c.status !== "CANCELLED",
          );
          if (match) setActiveConsultationId(match.id || match._id);
        }
      })
      .catch(() => undefined);
  }, [user, provider?.id]);

  /**
   * Loads the provider's free windows for a range of days and turns them into
   * bookable start times: every SLOT_STEP inside a window, never before the
   * notice period, and only where the whole service fits before the window
   * ends. These are exactly the starts the server accepts.
   */
  const loadSlots = useCallback(
    async (from: string, to: string) => {
      if (!provider?.id || !selectedOffering) return {} as Record<string, BookingSlot[]>;
      const res = await providerPublicService.availabilityOf(provider.id, {
        from,
        to,
        durationMinutes: selectedOffering.durationMinutes || 60,
      });
      const data = res.data?.data ?? {};
      setScheduleConfigured(data.scheduleConfigured !== false);
      const durationMs = (selectedOffering.durationMinutes || 60) * 60_000;
      const notBefore = Date.now() + (selectedOffering.minNoticeHours ?? 0) * 3_600_000;
      const out: Record<string, BookingSlot[]> = {};
      for (const day of data.days ?? []) {
        const slots: BookingSlot[] = [];
        for (const w of day.windows ?? []) {
          const end = new Date(w.endAt).getTime();
          let t = Math.ceil(Math.max(new Date(w.startAt).getTime(), notBefore) / SLOT_STEP_MS) * SLOT_STEP_MS;
          for (; t + durationMs <= end; t += SLOT_STEP_MS) {
            slots.push({ iso: new Date(t).toISOString(), label: slotLabel(t, data.timezone) });
          }
        }
        out[day.date] = slots;
      }
      return out;
    },
    [provider?.id, selectedOffering],
  );

  // When the dialog opens: load the next few weeks and preselect the first time that can actually be booked.
  useEffect(() => {
    if (!bookingModalOpen || !provider?.id || !selectedOffering) return;
    let active = true;
    (async () => {
      setSlotsLoading(true);
      setSlotsError(null);
      setBookingStartIso(null);
      try {
        const from = istDate(Date.now() + (selectedOffering.minNoticeHours ?? 0) * 3_600_000);
        const loaded = await loadSlots(from, istDate(Date.parse(from) + (LOOKAHEAD_DAYS - 1) * 86_400_000));
        if (!active) return;
        setSlotsByDate(loaded);
        const first = Object.keys(loaded).sort().find((date) => loaded[date].length > 0);
        if (first) {
          setBookingDate(first);
          setBookingStartIso(loaded[first][0].iso);
        } else setBookingDate(from);
      } catch (err) {
        if (active) setSlotsError(getErrorMessage(err, "Could not load the provider's calendar."));
      } finally {
        if (active) setSlotsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [bookingModalOpen, provider?.id, selectedOffering, loadSlots]);

  // A date beyond the preloaded weeks is fetched on demand.
  useEffect(() => {
    if (!bookingModalOpen || !bookingDate || slotsLoading || slotsByDate[bookingDate]) return;
    let active = true;
    loadSlots(bookingDate, bookingDate)
      .then((loaded) => active && setSlotsByDate((prev) => ({ ...prev, ...loaded })))
      .catch(() => active && setSlotsByDate((prev) => ({ ...prev, [bookingDate]: [] })));
    return () => {
      active = false;
    };
  }, [bookingModalOpen, bookingDate, slotsLoading, slotsByDate, loadSlots]);

  const daySlots = slotsByDate[bookingDate];
  const nextAvailableDate = Object.keys(slotsByDate)
    .sort()
    .find((date) => date > bookingDate && slotsByDate[date].length > 0);
  const canSubmitBooking = !!bookingStartIso && !notTravelling;

  const changeBookingDate = (date: string) => {
    setBookingDate(date);
    setBookingError(null);
    setBookingStartIso(slotsByDate[date]?.[0]?.iso ?? null);
  };


  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [profileRes, offeringsRes] = await Promise.allSettled([providerPublicService.getById(id), providerPublicService.offeringsOf(id)]);
      if (profileRes.status === "fulfilled" && profileRes.value.data?.success) {
        setProvider(profileRes.value.data.data);
      } else {
        setError(profileRes.status === "rejected" ? getErrorMessage(profileRes.reason) : "Provider not found.");
        return;
      }
      if (offeringsRes.status === "fulfilled" && offeringsRes.value.data?.success) {
        setOfferings(offeringsRes.value.data.data || []);
      }
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load provider profile."));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // "Book puja" on the directory links to #services.
  useEffect(() => {
    if (!loading && location.hash === "#services") {
      document.getElementById("services")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [loading, location.hash]);

  useEffect(() => {
    if (!bookingStartIso && daySlots && daySlots.length > 0) setBookingStartIso(daySlots[0].iso);
  }, [daySlots, bookingStartIso]);

  const handleStartBooking = (offering: OfferingView) => {
    // The pandit's calendar and the booking itself need an account: sign in first, then come back here.
    if (!user) {
      navigate(`/login?redirect=${encodeURIComponent(`${location.pathname}#services`)}`);
      return;
    }
    setSelectedOffering(offering);
    setDeliveryMode("IN_PERSON");
    setShowSteps(false);
    setSlotsByDate({});
    setBookingStartIso(null);
    setBookingDate(istDate(Date.now() + (offering.minNoticeHours ?? 0) * 3600 * 1000));
    setBookingResult(null);
    setBookingError(null);
    setPaymentBlocker(null);
    setBookingModalOpen(true);
  };

  const handleSubmitBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOffering) return;

    if (!customerName.trim() || !customerPhone.trim()) {
      setBookingError("Name and contact phone are required.");
      return;
    }
    if (needsAddress && (!customerAddress.trim() || !customerCity.trim() || !customerState.trim())) {
      setBookingError("This service is performed at your address. Please enter the address, city and state.");
      return;
    }
    if (!needsAddress && allowsAddress && customerAddress.trim() && (!customerCity.trim() || !customerState.trim())) {
      setBookingError("Add the city and state for this address, or clear the address.");
      return;
    }
    if (!bookingStartIso) {
      setBookingError("Please choose one of the available start times.");
      return;
    }
    const start = new Date(bookingStartIso);
    if (start.getTime() < Date.now() + minNoticeHours * 3600 * 1000) {
      setBookingError(
        minNoticeHours > 0
          ? `This service needs at least ${minNoticeHours} hours' notice. Please choose a later date or time.`
          : "Please choose a start time in the future.",
      );
      return;
    }

    setBookingSubmitting(true);
    setBookingError(null);
    try {
      const payload: any = {
        offeringId: selectedOffering.id,
        scheduledStartAt: start.toISOString(),
        deliveryMode,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
      };
      if (needsAddress || (allowsAddress && customerAddress.trim())) {
        payload.serviceLocation = {
          line1: customerAddress.trim() || undefined,
          city: customerCity.trim(),
          state: customerState.trim(),
        };
      }
      if (specialInstructions.trim()) payload.notes = specialInstructions.trim();

      const res = await pujaBookingService.create(payload);
      if (res.data?.success) {
        setBookingResult(res.data.data);
        toast.success("Your slot is on hold. Complete payment to confirm the booking.");
      } else {
        setBookingError((res.data as any)?.message || "Failed to create booking.");
      }
    } catch (err: any) {
      setBookingError(getErrorMessage(err, "Booking could not be created."));
    } finally {
      setBookingSubmitting(false);
    }
  };

  const handlePayBooking = async () => {
    if (!bookingResult) return;
    setPaymentProcessing(true);
    setPaymentBlocker(null);
    try {
      const res = await pujaBookingService.createPaymentOrder(bookingResult.id, { useWallet });
      if (res.data?.walletPaid || res.data?.free) {
        setBookingResult({ ...bookingResult, status: "CONFIRMED" });
        toast.success("Payment completed. Booking confirmed.");
      } else if (res.data?.blocker) {
        setPaymentBlocker(res.data.message || "Online payment is not available right now. Please try again later.");
      } else if (res.data?.configured && res.data?.data?.orderId) {
        // The shared helper loads Razorpay's script on demand (nothing else on this page does), opens
        // checkout, and itself tells the devotee if it was cancelled, failed or could not load.
        let paid: RazorpayResult;
        try {
          paid = await openRazorpayCheckout(
            {
              orderId: res.data.data.orderId,
              amount: res.data.data.amount,
              currency: res.data.data.currency,
              keyId: res.data.data.keyId,
            },
            { name: customerName.trim() || user?.name, email: user?.email, contact: customerPhone.trim() || user?.phone },
            { name: "Tirvona", description: `Puja booking ${bookingResult.bookingNumber || ""}` },
          );
        } catch (err: any) {
          if (/load the payment gateway/i.test(String(err?.message)))
            setPaymentBlocker("The payment window could not be loaded. Check your internet connection and try again.");
          return;
        }
        try {
          const confirmRes = await pujaBookingService.confirmPayment(bookingResult.id, {
            razorpay_order_id: paid.razorpay_order_id,
            razorpay_payment_id: paid.razorpay_payment_id,
            razorpay_signature: paid.razorpay_signature,
          });
          if (confirmRes.data?.success) {
            setBookingResult({ ...bookingResult, status: "CONFIRMED" });
            toast.success("Payment verified. Booking confirmed.");
          }
        } catch (err) {
          // The money was taken; the gateway webhook still confirms the booking, so say that rather than "failed".
          toast.error(getErrorMessage(err, "We received your payment but could not confirm it yet. It will update shortly; check My bookings."));
        }
      }
    } catch (err: any) {
      toast.error(getErrorMessage(err, "Could not initiate payment."));
    } finally {
      setPaymentProcessing(false);
    }
  };

  const handleSubmitConsultation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!provider || !consultTopic.trim()) return;
    setConsultSubmitting(true);
    try {
      const scheduledStartAt = new Date(`${consultSlot}T10:00:00+05:30`).toISOString();
      const res = await consultationService.create({
        consultationType: provider.providerType === "JYOTISHI" ? "JYOTISHI" : "PANDIT",
        expertProviderId: provider.id,
        channel: "CHAT",
        scheduledStartAt,
        questionSummary: consultTopic.trim(),
      });
      if (res.data?.success) {
        setConsultSuccess(true);
        const cid = res.data.data?.id || res.data.data?._id;
        if (cid) setActiveConsultationId(cid);
        toast.success("Consultation request sent to the provider.");
      }
    } catch (err: any) {
      toast.error(getErrorMessage(err, "Failed to request consultation."));
    } finally {
      setConsultSubmitting(false);
    }
  };

  const handleShare = () => {
    if (!provider) return;
    if (navigator.share) {
      navigator.share({ title: `${provider.displayName} on Tirvona`, url: window.location.href }).catch(() => undefined);
    } else {
      navigator.clipboard?.writeText(window.location.href);
      toast.info("Profile link copied.");
    }
  };

  const closeConsult = () => {
    setConsultModalOpen(false);
    setConsultSuccess(false);
  };

  // ── Loading and error states ─────────────────────────────────────────
  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-10" aria-busy="true">
        <Skeleton className="h-48 w-full rounded-3xl" />
        <div className="grid gap-6 lg:grid-cols-[1fr,22rem]">
          <Skeleton className="h-96 rounded-3xl" />
          <Skeleton className="h-64 rounded-3xl" />
        </div>
      </div>
    );
  }

  if (error || !provider) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24">
        <Card>
          <EmptyState
            title="Provider profile unavailable"
            description={error || "This provider does not exist or is not currently listed."}
            action={
              <LinkButton to="/pandits" variant="secondary">
                <ChevronLeft size={16} aria-hidden="true" />
                Back to the directory
              </LinkButton>
            }
          />
        </Card>
      </div>
    );
  }

  const verified = provider.verificationLevel && provider.verificationLevel !== "UNVERIFIED";
  /** Side-panel points, each true for this pandit (nothing is claimed that the data does not show). */
  const feePercent = offerings.find((o) => o.platformFee && o.platformFee.amountMinor > 0)?.platformFee?.percent;
  const highlights = [
    verified ? `${VERIFICATION_LEVEL_LABELS[provider.verificationLevel]} by Tirvona` : null,
    (provider.stats?.completedBookings ?? 0) > 0 ? `${provider.stats!.completedBookings} puja${provider.stats!.completedBookings === 1 ? "" : "s"} completed on Tirvona` : null,
    feePercent ? `Upfront price: pandit's fee + ${feePercent}% platform fee, nothing hidden` : "Upfront price shown before you pay",
    offerings.some((o: any) => o.samagriIncluded) ? "Puja samagri included in some services" : null,
    provider.travel?.willingToTravel ? "Comes to your home" : null,
    provider.liveOnline ? "Live online katha on YouTube" : null,
  ].filter(Boolean) as string[];
  const startingFee = formatMinor(provider.offerings?.minFeeMinor, provider.offerings?.currency || "INR");
  const consultFee = formatMinor(provider.consultation?.feeMinor ?? null, provider.consultation?.currency || "INR");
  const place = [provider.homeCity, provider.homeState].filter(Boolean).join(", ");
  const openChatOrAsk = () => (activeConsultationId ? setChatOpen(true) : setConsultModalOpen(true));
  const slotsId = "booking-slots-label";

  const facts: Array<{ label: string; icon: React.ReactNode; value: string }> = [
    ...(provider.experienceYears != null ? [{ label: "Experience", icon: <Award size={14} className="text-[#F28C28]" />, value: `${provider.experienceYears}+ years` }] : []),
    ...(provider.languages?.length ? [{ label: "Languages", icon: <BookOpen size={14} className="text-[#B45309]" />, value: provider.languages.join(", ") }] : []),
    ...(provider.traditions?.length ? [{ label: "Tradition", icon: <Flame size={14} className="text-[#F28C28]" />, value: provider.traditions.join(", ") }] : []),
  ];

  return (
    <div className="min-h-screen bg-white pb-28 dark:bg-[#071322] lg:pb-16 font-['Inter',sans-serif]">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 pb-3 pt-5 sm:px-6">
        <Link to="/pandits" className="inline-flex min-h-[38px] items-center gap-1.5 rounded-full text-xs sm:text-sm font-semibold text-[#B45309] transition-colors hover:text-[#D97706] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F28C28] dark:text-[#FFA44D]">
          <ChevronLeft size={16} aria-hidden="true" />
          All pandits &amp; acharyas
        </Link>
        <Button variant="outline" className="!min-h-[36px] !px-4 !text-xs !font-bold rounded-full" onClick={handleShare}>
          <Share2 size={13} aria-hidden="true" />
          Share
        </Button>
      </div>

      <div className="mx-auto max-w-6xl space-y-6 px-4 sm:px-6">
        {/* ── Identity ─────────────────────────────────────────────────── */}
        <Card as="section" className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs dark:border-slate-800 dark:bg-[#0B192C]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4 sm:gap-5">
              <Avatar name={provider.displayName} src={provider.avatarUrl} size={62} className="!rounded-2xl ring-1 ring-slate-200 dark:ring-slate-700 shadow-xs shrink-0" />
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full border border-amber-200/70 bg-amber-50/90 px-2.5 py-0.5 text-[11px] font-semibold text-amber-900 dark:border-[#F28C28]/40 dark:bg-[#F28C28]/15 dark:text-[#FFA44D]">
                    {PROVIDER_TYPE_LABELS[provider.providerType] || provider.providerType}
                  </span>
                  {verified ? (
                    <StatusBadge status={provider.verificationLevel} label={VERIFICATION_LEVEL_LABELS[provider.verificationLevel]} tone="success" className="!text-[11px] !py-0.5 !px-2.5 !font-semibold" />
                  ) : null}
                  {provider.liveOnline && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-600 px-2.5 py-0.5 text-[10px] font-semibold text-white">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white motion-reduce:animate-none" aria-hidden="true" />
                      Live online available
                    </span>
                  )}
                  {(provider.stats?.completedBookings ?? 0) > 0 && (
                    <span className="rounded-full border border-emerald-200/60 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                      {provider.stats!.completedBookings} puja{provider.stats!.completedBookings === 1 ? "" : "s"} completed
                    </span>
                  )}
                </div>
                <h1 className="break-words text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{provider.displayName}</h1>
                {provider.liveOnline && provider.liveYoutubeUrl && (
                  <WatchLiveButton stream={{ youtubeUrl: provider.liveYoutubeUrl }} title={provider.displayName} label="Watch live on YouTube" className="!min-h-[32px] !px-3 !text-xs rounded-full" />
                )}
                {place && (
                  <p className="flex items-center gap-1 text-xs font-normal text-slate-500 dark:text-slate-400">
                    <MapPin size={13} className="shrink-0 text-[#F28C28]" aria-hidden="true" />
                    {place}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-center pt-1 sm:pt-0">
              {offerings.length > 0 && (
                <a href="#services" className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-[#F28C28] to-[#E07B1A] px-5 text-xs font-semibold text-white shadow-xs hover:shadow hover:brightness-105 transition-all">
                  <CalendarDays size={14} aria-hidden="true" />
                  View services
                </a>
              )}
              {provider.consultation?.enabled && (
                <Button variant="outline" onClick={openChatOrAsk} className="!h-9 !px-4 !text-xs !font-semibold rounded-full border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200">
                  <MessageSquare size={14} className="text-[#F28C28]" aria-hidden="true" />
                  {activeConsultationId ? "Open chat" : "Ask for guidance"}
                </Button>
              )}
            </div>
          </div>

          {facts.length > 0 && (
            <div className="mt-5 grid grid-cols-1 gap-2.5 border-t border-slate-100 pt-4 sm:grid-cols-3 dark:border-slate-800">
              {facts.map((f) => (
                <div key={f.label} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/70 px-3.5 py-2.5 shadow-xs dark:border-slate-800 dark:bg-slate-900/50">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-[#F28C28] dark:bg-amber-950/40">
                    {f.icon}
                  </div>
                  <div className="min-w-0">
                    <span className="block text-[10px] font-medium uppercase tracking-wider text-slate-400">{f.label}</span>
                    <span className="truncate text-xs sm:text-sm font-semibold text-slate-800 dark:text-white">{f.value}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* ── Main Content Container (Wider layout with no sidebar) ── */}
        <div className="w-full space-y-6">
          {/* ── About ──────────────────────────────────────────────── */}
          {(provider.bio || provider.specializations?.length > 0 || (provider.serviceCities?.length ?? 0) > 0) && (
            <SectionCard title="About Pandit Ji">
              {provider.bio && <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600 dark:text-slate-300">{provider.bio}</p>}
              {provider.specializations?.length > 0 && (
                <div className="mt-3.5">
                  <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Specialties</h3>
                  <ul className="flex flex-wrap gap-1.5">
                    {provider.specializations.map((s) => (
                      <li key={s} className="rounded-md border border-amber-200/60 bg-amber-50/70 px-2.5 py-0.5 text-xs font-medium text-amber-900 dark:border-slate-700 dark:bg-slate-900 dark:text-gray-300">
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {(provider.serviceCities?.length ?? 0) > 0 && (
                <div className="mt-3.5">
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Service areas</h3>
                  <p className="text-xs sm:text-sm font-medium text-slate-700 dark:text-gray-300">{provider.serviceCities!.map((c) => c.city).join(", ")}</p>
                </div>
              )}
            </SectionCard>
          )}

          {/* ── Services (Wider 2-to-3 column compact cards layout) ─────────── */}
          <section id="services" aria-labelledby="services-heading" className="scroll-mt-24 space-y-3.5">
            <div>
              <p className="mb-0.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#B45309] dark:text-[#FFA44D]">
                <Flame size={13} className="text-[#F28C28]" aria-hidden="true" />
                Ceremonies
              </p>
              <h2 id="services-heading" className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                Pujas &amp; services offered
              </h2>
            </div>

            {offerings.length === 0 ? (
              <Card className="p-6">
                <EmptyState
                  icon={<Flame size={24} />}
                  title="No services listed yet"
                  description={provider.consultation?.enabled ? "You can still send this provider a question." : "Check back later, or browse other providers."}
                />
              </Card>
            ) : (
              <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {offerings.map((off) => {
                  const fee = formatMinor(offeringFeeMinor(off), off.indicativeFee?.currency || off.currency || "INR");
                  return (
                    <li key={off.id} className="flex">
                      <Card as="article" className="flex w-full flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs transition-all duration-200 hover:shadow-md hover:border-[#F28C28]/40 dark:border-slate-800 dark:bg-[#0B192C]">
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="rounded-full border border-amber-200/70 bg-amber-50/80 px-2.5 py-0.5 text-[10px] font-semibold text-amber-900 dark:border-[#F28C28]/25 dark:bg-[#F28C28]/15 dark:text-[#FFC88A]">
                              {FULFILMENT_LABELS[off.fulfilmentType] || off.fulfilmentType}
                            </span>
                            {off.samagriIncluded && (
                              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                                Puja samagri included
                              </span>
                            )}
                          </div>
                          <div>
                            <h3 className="break-words text-base font-semibold tracking-tight text-slate-900 dark:text-white">{offeringTitle(off)}</h3>
                            {off.variant?.titles?.en && <p className="text-xs font-normal text-slate-500">{off.variant.titles.en}</p>}
                          </div>
                          {off.description && <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300 line-clamp-2">{off.description}</p>}
                          <ul className="flex flex-wrap gap-x-3 gap-y-1 rounded-lg border border-slate-100 bg-slate-50/80 px-2.5 py-1.5 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900/40 dark:text-gray-400">
                            {off.durationMinutes != null && (
                              <li className="flex items-center gap-1 font-semibold text-slate-800 dark:text-white">
                                <Clock size={12} className="text-[#F28C28]" aria-hidden="true" />
                                {off.durationMinutes} min
                              </li>
                            )}
                            {off.teamSize != null && (
                              <li className="flex items-center gap-1">
                                <Users size={12} className="text-slate-400" aria-hidden="true" />
                                {off.teamSize} priest{off.teamSize === 1 ? "" : "s"}
                              </li>
                            )}
                            {off.minNoticeHours ? (
                              <li className="flex items-center gap-1">
                                <CalendarDays size={12} className="text-slate-400" aria-hidden="true" />
                                Book {off.minNoticeHours}h ahead
                              </li>
                            ) : null}
                          </ul>
                          {off.inclusions && off.inclusions.length > 0 && (
                            <div className="pt-0.5">
                              <h4 className="mb-1 text-[10px] font-medium uppercase tracking-wider text-slate-400">Includes</h4>
                              <ul className="space-y-1 text-xs text-slate-600 dark:text-gray-300">
                                {off.inclusions.slice(0, 2).map((inc, i) => (
                                  <li key={i} className="flex items-center gap-1.5 text-[11px] truncate">
                                    <Check size={12} className="shrink-0 text-emerald-600" aria-hidden="true" />
                                    <span className="truncate">{inc}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                        <div className="mt-3.5 flex items-center justify-between gap-3 border-t border-slate-100 pt-3 dark:border-slate-800">
                          <div>
                            <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Dakshina</p>
                            <p className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white">{fee ?? "On request"}</p>
                            {off.platformFee && off.platformFee.amountMinor > 0 && (
                              <p className="text-[10px] text-slate-400">
                                + {formatMinor(off.platformFee.amountMinor, offeringCurrency(off))} fee
                              </p>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <PujaProcessButton ritualId={(off as any).ritualId} title={offeringTitle(off)} viewer="DEVOTEE" />
                            <Button onClick={() => handleStartBooking(off)} className="shrink-0 !h-8 !px-4 !text-xs !font-semibold rounded-full bg-gradient-to-r from-[#F28C28] to-[#E07B1A] text-white shadow-xs hover:shadow hover:brightness-105 transition-all">
                              Book now
                            </Button>
                          </div>
                        </div>
                      </Card>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* ── Home visits & travel ───────────────────────────────── */}
          {(provider.travel?.willingToTravel || provider.liveOnline) && (
            <SectionCard title="Home visits & online">
              <ul className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
                {provider.travel?.willingToTravel && (
                  <li className="flex items-start gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F28C28]/10 text-[#F28C28]" aria-hidden="true">
                      <Home size={15} />
                    </span>
                    <div>
                      <p className="text-xs sm:text-sm font-bold text-[#0B192C] dark:text-white">Comes to your home</p>
                      <p className="text-xs text-gray-500">
                        {(provider.travel.modes ?? []).length
                          ? `Travels by ${(provider.travel.modes ?? []).map((m) => TRAVEL_MODE_LABELS[m] ?? m).join(", ")}`
                          : "Travels to devotees"}
                        {provider.travel.maxDistanceKm ? ` · up to ${provider.travel.maxDistanceKm} km` : ""}
                      </p>
                      {(provider.travel.modes ?? []).length > 0 && (
                        <p className="mt-1 flex flex-wrap gap-1.5">
                          {(provider.travel.modes ?? []).map((m) => (
                            <span key={m} className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-700 dark:bg-slate-800 dark:text-gray-300">
                              {m === "ROAD" ? <Car size={11} aria-hidden="true" /> : m === "TRAIN" ? <Bus size={11} aria-hidden="true" /> : <span aria-hidden="true">✈</span>}
                              {TRAVEL_MODE_LABELS[m] ?? m}
                            </span>
                          ))}
                        </p>
                      )}
                    </div>
                  </li>
                )}
                {provider.travel?.willingToTravel && provider.travel.overnightOk && (
                  <li className="flex items-start gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F28C28]/10 text-[#F28C28]" aria-hidden="true">
                      <Bed size={15} />
                    </span>
                    <div>
                      <p className="text-xs sm:text-sm font-bold text-[#0B192C] dark:text-white">Can stay overnight</p>
                      <p className="text-xs text-gray-500">
                        {provider.travel.stayArrangement ? STAY_ARRANGEMENT_LABELS[provider.travel.stayArrangement] ?? "" : "For multi-day kathas and pujas"}
                      </p>
                    </div>
                  </li>
                )}
                {provider.liveOnline && (
                  <li className="flex items-start gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-950/40" aria-hidden="true">
                      <Radio size={15} />
                    </span>
                    <div>
                      <p className="text-xs sm:text-sm font-bold text-[#0B192C] dark:text-white">Live online katha &amp; puja</p>
                      <p className="text-xs text-gray-500">Join from anywhere on video. Choose "Live online" when you book.</p>
                    </div>
                  </li>
                )}
                {provider.travel?.willingToTravel && provider.travel.notes && (
                  <li className="rounded-lg bg-gray-50 p-2.5 text-xs text-gray-600 dark:bg-slate-900/60 dark:text-gray-400">{provider.travel.notes}</li>
                )}
              </ul>
            </SectionCard>
          )}

          {/* ── Puja samagri from the Tirvona Marketplace ── */}
          <PujaSamagriSection />
        </div>
      </div>

      {/* ── Compact action bar (mobile and tablet) ───────────────────── */}
      {(offerings.length > 0 || provider.consultation?.enabled) && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 px-4 pt-3 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] backdrop-blur lg:hidden dark:border-slate-800 dark:bg-[#0B192C]/95" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
          <div className="mx-auto flex max-w-xl items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-gray-500">{startingFee ? "Services from" : "Guidance"}</p>
              <p className="truncate text-lg font-bold text-slate-900 dark:text-white">{startingFee ?? consultFee ?? "Ask a question"}</p>
            </div>
            {offerings.length > 0 ? (
              <a href="#services" className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-full bg-[#F28C28] px-6 text-sm font-bold text-white hover:bg-[#D97706] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F28C28] focus-visible:ring-offset-2">
                Book puja
              </a>
            ) : (
              <Button onClick={openChatOrAsk}>{activeConsultationId ? "Open chat" : "Ask"}</Button>
            )}
          </div>
        </div>
      )}

      {/* ── Booking dialog ───────────────────────────────────────────── */}
      <Modal
        open={bookingModalOpen && !!selectedOffering}
        onClose={() => setBookingModalOpen(false)}
        title={bookingResult ? (bookingResult.status === "CONFIRMED" ? "Booking confirmed" : "Slot held for you") : `Book with ${provider.displayName}`}
        description={selectedOffering ? offeringTitle(selectedOffering) : undefined}
        footer={
          bookingResult ? (
            <>
              <Button variant="outline" onClick={() => setBookingModalOpen(false)}>
                Close
              </Button>
              <Button
                onClick={() => {
                  setBookingModalOpen(false);
                  navigate("/profile/bookings");
                }}
              >
                View my bookings
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setBookingModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" form="booking-form" loading={bookingSubmitting} disabled={!canSubmitBooking}>
                {bookingSubmitting ? "Holding your slot…" : "Confirm & hold slot"}
              </Button>
            </>
          )
        }
      >
        {selectedOffering && bookingResult ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40" aria-hidden="true">
                <CheckCircle2 size={26} />
              </span>
              <div className="min-w-0">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Booking reference <strong className="text-[#0B192C] dark:text-white">{bookingResult.bookingNumber || bookingResult.bookingReference}</strong>
                </p>
                <StatusBadge status={bookingResult.status} />
              </div>
            </div>

            <dl className="divide-y divide-gray-100 rounded-xl border border-gray-200 text-sm dark:divide-slate-800 dark:border-slate-700">
              <div className="flex justify-between gap-4 p-3">
                <dt className="text-gray-500">Scheduled for</dt>
                <dd className="text-right font-semibold text-[#0B192C] dark:text-white">{formatWhen(bookingResult.scheduledStartAt) ?? "—"}</dd>
              </div>
              {((bookingResult as any).pricing?.lines ?? []).map((line: any) => (
                <div key={line.code} className="flex justify-between gap-4 p-3">
                  <dt className="text-gray-500">{line.label}</dt>
                  <dd className="text-right font-semibold text-[#0B192C] dark:text-white">{formatMinor(line.amountMinor, (bookingResult as any).pricing?.currency || "INR")}</dd>
                </div>
              ))}
              <div className="flex justify-between gap-4 p-3">
                <dt className="font-bold text-[#0B192C] dark:text-white">Total payable</dt>
                <dd className="text-right text-base font-bold text-slate-900 dark:text-white">
                  {formatMinor((bookingResult as any).pricing?.totalMinor, (bookingResult as any).pricing?.currency || "INR") ?? "—"}
                </dd>
              </div>
            </dl>
            {(bookingResult as any).pricing?.travelPending && <p className="text-xs text-gray-500">Travel is charged at actual cost and added by the provider.</p>}

            {bookingResult.status === "PAYMENT_PENDING" && (
              <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/30">
                {(bookingResult as any).holdExpiresAt && (
                  <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">Your slot is held until {formatWhen((bookingResult as any).holdExpiresAt)}.</p>
                )}
                <Toggle checked={useWallet} onChange={setUseWallet} label="Use Tirvona wallet balance" description="Any remaining amount is paid online." />
                {paymentBlocker && <Notice tone="warning">{paymentBlocker}</Notice>}
                <Button className="w-full" onClick={handlePayBooking} loading={paymentProcessing}>
                  {paymentProcessing ? "Processing…" : "Pay now"}
                </Button>
              </div>
            )}
          </div>
        ) : selectedOffering ? (
          <form id="booking-form" onSubmit={handleSubmitBooking} className="space-y-4" noValidate>
            {bookingError && <ErrorNotice message={bookingError} />}
            {notTravelling && <Notice tone="warning">This provider is not accepting travel bookings at the moment, so this service cannot be booked.</Notice>}

            {provider.liveOnline && (
              <div role="radiogroup" aria-label="How would you like it?">
                <p className="mb-1.5 text-sm font-semibold text-gray-800 dark:text-gray-200">How would you like it?</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {[
                    { value: "IN_PERSON" as const, title: "In person", sub: selectedOffering.fulfilmentType === "LOCAL_HOME" || selectedOffering.fulfilmentType === "DESTINATION_PROVIDER_HOME" ? "Pandit ji comes to your home" : "As described for this service", icon: <Home size={16} aria-hidden="true" /> },
                    { value: "LIVE_ONLINE" as const, title: "Live online", sub: "Watch live on YouTube from anywhere · no travel charge", icon: <Radio size={16} aria-hidden="true" /> },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      role="radio"
                      aria-checked={deliveryMode === opt.value}
                      onClick={() => setDeliveryMode(opt.value)}
                      className={cx(
                        "flex min-h-[56px] items-start gap-2.5 rounded-xl border p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F28C28]",
                        deliveryMode === opt.value
                          ? "border-[#F28C28] bg-[#FFF4E5] dark:bg-[#F28C28]/15"
                          : "border-gray-300 hover:border-[#F28C28] dark:border-slate-600",
                      )}
                    >
                      <span className={cx("mt-0.5", opt.value === "LIVE_ONLINE" ? "text-rose-600" : "text-[#F28C28]")}>{opt.icon}</span>
                      <span>
                        <span className="block text-sm font-bold text-[#0B192C] dark:text-white">{opt.title}</span>
                        <span className="block text-xs text-gray-500">{opt.sub}</span>
                      </span>
                    </button>
                  ))}
                </div>
                {liveOnline && <p className="mt-1.5 text-xs text-gray-500">Watch it live on YouTube from My bookings; pandit ji's stream link appears there.</p>}
              </div>
            )}
            {selectedOffering.fulfilmentType === "LOCAL_HOME" && (provider.serviceCities?.length ?? 0) > 0 && (
              <p className="text-sm text-gray-600 dark:text-gray-400">Serves: {provider.serviceCities!.map((c) => c.city).join(", ")}</p>
            )}
            {minNoticeHours > 0 && (
              <Notice tone="info">
                This service needs at least <strong>{minNoticeHours} hours' notice</strong>. The earliest possible start is{" "}
                <strong>{whenIst(earliestStart)}</strong>.
              </Notice>
            )}

            <Field label="Date" required>
              <input type="date" className={inputClass} min={earliestDate} value={bookingDate} onChange={(e) => changeBookingDate(e.target.value)} />
            </Field>

            {slotsLoading || (bookingDate && daySlots === undefined && !slotsError) ? (
              <p className="flex items-center gap-2 text-sm text-gray-500" role="status">
                <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                Checking the pandit's calendar…
              </p>
            ) : slotsError ? (
              <ErrorNotice message={slotsError} />
            ) : !scheduleConfigured ? (
              <Notice tone="warning">This pandit has not published their available hours yet, so this service cannot be booked online right now. Please check back soon.</Notice>
            ) : daySlots && daySlots.length > 0 ? (
              <div role="radiogroup" aria-labelledby={slotsId}>
                <p id={slotsId} className="mb-1.5 text-sm font-semibold text-gray-800 dark:text-gray-200">
                  Available start times <span className="font-normal text-gray-500">({daySlots.length})</span>
                </p>
                <div className="grid max-h-44 grid-cols-3 gap-2 overflow-y-auto p-0.5 sm:grid-cols-4">
                  {daySlots.map((slot) => (
                    <button
                      key={slot.iso}
                      type="button"
                      role="radio"
                      aria-checked={bookingStartIso === slot.iso}
                      onClick={() => {
                        setBookingStartIso(slot.iso);
                        setBookingError(null);
                      }}
                      className={cx(
                        "min-h-[44px] rounded-xl border px-2 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F28C28]",
                        bookingStartIso === slot.iso
                          ? "border-[#F28C28] bg-[#F28C28] text-white"
                          : "border-gray-300 bg-white text-gray-800 hover:border-[#F28C28] dark:border-slate-600 dark:bg-slate-900 dark:text-gray-200",
                      )}
                    >
                      {slot.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <Notice tone="warning">
                The pandit is not available on {bookingDate ? whenIst(Date.parse(`${bookingDate}T12:00:00+05:30`), "date") : "this day"}.
                {nextAvailableDate ? (
                  <>
                    {" "}
                    <button type="button" className="font-bold text-[#B45309] underline" onClick={() => changeBookingDate(nextAvailableDate)}>
                      Next available: {whenIst(Date.parse(`${nextAvailableDate}T12:00:00+05:30`), "date")}
                    </button>
                  </>
                ) : (
                  " Please choose another date."
                )}
              </Notice>
            )}

            <Field label="Yajaman / devotee name" required hint="The name used for the sankalp.">
              <input type="text" autoComplete="name" className={inputClass} value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
            </Field>
            <Field label="Contact phone" required hint="The provider uses this to coordinate the puja.">
              <input type="tel" autoComplete="tel" inputMode="tel" className={inputClass} value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
            </Field>

            {allowsAddress && (
              <fieldset className="space-y-3">
                <legend className="mb-1 text-sm font-semibold text-gray-800 dark:text-gray-200">
                  {needsAddress ? "Ceremony address (required)" : "Address for the sankalp (optional)"}
                </legend>
                <Field label="Address">
                  <textarea rows={2} required={needsAddress} className={inputClass} value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} placeholder="House / temple / ghat" />
                </Field>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="City">
                    <input type="text" autoComplete="address-level2" required={needsAddress || !!customerAddress.trim()} className={inputClass} value={customerCity} onChange={(e) => setCustomerCity(e.target.value)} />
                  </Field>
                  <Field label="State">
                    <input type="text" autoComplete="address-level1" required={needsAddress || !!customerAddress.trim()} className={inputClass} value={customerState} onChange={(e) => setCustomerState(e.target.value)} />
                  </Field>
                </div>
              </fieldset>
            )}

            <Field label="Gotra, sankalp notes or requests" hint="Optional.">
              <input type="text" className={inputClass} value={specialInstructions} onChange={(e) => setSpecialInstructions(e.target.value)} placeholder="e.g. Kashyap gotra, English explanation requested" />
            </Field>

            {(() => {
              const currency = offeringCurrency(selectedOffering);
              const professional = offeringFeeMinor(selectedOffering);
              const travel = liveOnline ? 0 : offeringTravelMinor(selectedOffering);
              const platform = selectedOffering.platformFee?.amountMinor ?? 0;
              const total = professional == null ? null : professional + travel + platform;
              const row = (label: string, minor: number) => (
                <div className="flex justify-between gap-4">
                  <span className="text-gray-600 dark:text-gray-400">{label}</span>
                  <span className="font-semibold text-[#0B192C] dark:text-white">{formatMinor(minor, currency)}</span>
                </div>
              );
              return (
                <div className="space-y-1.5 rounded-xl bg-gray-50 p-3 text-sm dark:bg-slate-900/60">
                  {professional == null ? (
                    <p className="text-gray-600 dark:text-gray-400">Fee on request</p>
                  ) : (
                    <>
                      {row("Professional fee", professional)}
                      {travel > 0 && row("Travel charge", travel)}
                      {platform > 0 && row(`Tirvona platform fee (${selectedOffering.platformFee!.percent}%)`, platform)}
                      <div className="flex justify-between gap-4 border-t border-gray-200 pt-1.5 dark:border-slate-700">
                        <strong className="text-[#0B192C] dark:text-white">You pay</strong>
                        <strong className="text-[#0B192C] dark:text-white">{formatMinor(total, currency)}</strong>
                      </div>
                    </>
                  )}
                  {!liveOnline && (selectedOffering as any).travelCharge?.policy === "ACTUALS_AT_COST" && (
                    <p className="text-xs text-gray-500">Travel is charged at actual cost and settled separately.</p>
                  )}
                </div>
              );
            })()}
            <div className="rounded-xl border border-gray-200 dark:border-slate-800">
              <button
                type="button"
                aria-expanded={showSteps}
                onClick={() => setShowSteps((v) => !v)}
                className="flex w-full items-center justify-between gap-2 p-3 text-left text-sm font-bold text-[#0B192C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F28C28] rounded-xl dark:text-white"
              >
                How this puja works, step by step
                <span className="text-xs font-semibold text-[#B45309] dark:text-[#FFA44D]">{showSteps ? "Hide" : "Show"}</span>
              </button>
              {showSteps && (
                <div className="border-t border-gray-100 p-3 dark:border-slate-800">
                  <PujaProcessGuide ritualId={(selectedOffering as any).ritualId} viewer="DEVOTEE" />
                  <p className="mt-2 text-[11px] text-gray-400">If no steps appear, pandit ji explains the process after accepting your booking.</p>
                </div>
              )}
            </div>
          </form>
        ) : null}
      </Modal>

      {/* ── Consultation dialog ──────────────────────────────────────── */}
      <Modal
        open={consultModalOpen}
        onClose={closeConsult}
        title={consultSuccess ? "Question sent" : "Ask a question"}
        description={consultSuccess ? undefined : `Chat with ${provider.displayName}`}
        size="sm"
        footer={
          consultSuccess ? (
            <>
              <Button variant="outline" onClick={closeConsult}>
                Close
              </Button>
              {activeConsultationId && (
                <Button
                  onClick={() => {
                    closeConsult();
                    setChatOpen(true);
                  }}
                >
                  <MessageSquare size={16} aria-hidden="true" />
                  Open chat
                </Button>
              )}
            </>
          ) : (
            <>
              <Button variant="outline" onClick={closeConsult}>
                Cancel
              </Button>
              <Button type="submit" form="consult-form" loading={consultSubmitting}>
                Send request
              </Button>
            </>
          )
        }
      >
        {consultSuccess ? (
          <Notice tone="success">{provider.displayName} has received your question. You can now exchange messages in the chat.</Notice>
        ) : (
          <form id="consult-form" onSubmit={handleSubmitConsultation} className="space-y-4">
            {consultFee && <p className="text-sm text-gray-600 dark:text-gray-400">Consultation fee: <strong>{consultFee}</strong></p>}
            <Field label="Your question or topic" required>
              <textarea rows={4} className={inputClass} value={consultTopic} onChange={(e) => setConsultTopic(e.target.value)} placeholder="e.g. Kundali matching, muhurat guidance or remedies" />
            </Field>
            <Field label="Preferred date">
              <input type="date" className={inputClass} min={istDate(Date.now())} value={consultSlot} onChange={(e) => setConsultSlot(e.target.value)} />
            </Field>
          </form>
        )}
      </Modal>

      {chatOpen && activeConsultationId && (
        <ConsultationChatModal
          isOpen={chatOpen}
          onClose={() => setChatOpen(false)}
          consultationId={activeConsultationId}
          recipientName={provider.displayName}
          recipientSubtitle={PROVIDER_TYPE_LABELS[provider.providerType] || "Vedic Acharya"}
        />
      )}
    </div>
  );
};

export default PublicProviderDetailPage;
