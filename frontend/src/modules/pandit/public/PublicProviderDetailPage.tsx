import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate, useLocation } from "react-router-dom";
import {
  Award,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  Clock,
  Flame,
  MapPin,
  MessageSquare,
  Share2,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { providerPublicService, pujaBookingService, consultationService } from "../services/provider.service";
import { ConsultationChatModal } from "../components/ConsultationChatModal";
import { getErrorMessage } from "../../../lib/api";
import { useAuth } from "../../../contexts/AuthContext";
import { toast } from "../../../lib/toast";
import type { ProviderProfile, Offering, ProviderBooking } from "../types/provider.types";
import { PROVIDER_TYPE_LABELS, VERIFICATION_LEVEL_LABELS } from "../types/provider.types";
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

/** Fields the public API sends that the shared ProviderProfile type does not model. */
type PublicProvider = ProviderProfile & {
  serviceCities?: Array<{ city: string; state?: string | null }>;
  consultation?: { enabled: boolean; feeMinor?: number | null; currency?: string; slotMinutes?: number | null; channels?: string[] };
  offerings?: { count: number; minFeeMinor: number | null; currency?: string };
  acceptingBookings?: boolean;
  travel?: { willingToTravel?: boolean; overnightOk?: boolean };
};

type OfferingView = Offering & {
  ritual?: { titles?: Record<string, string> } | null;
  variant?: { titles?: Record<string, string> } | null;
  indicativeFee?: { amountMinor: number; currency?: string };
  teamSize?: number;
};

const offeringTitle = (o: OfferingView) =>
  o.title || o.ritual?.titles?.en || Object.values(o.ritual?.titles ?? {})[0] || "Vedic puja";
const offeringFeeMinor = (o: OfferingView) => o.indicativeFee?.amountMinor ?? o.baseProfessionalFeeMinor ?? null;

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
  const [bookingTime, setBookingTime] = useState("09:00");
  const [customerName, setCustomerName] = useState(user?.name || "");
  const [customerPhone, setCustomerPhone] = useState(user?.phone || "");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerCity, setCustomerCity] = useState("");
  const [customerState, setCustomerState] = useState("");
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const [bookingResult, setBookingResult] = useState<ProviderBooking | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [paymentBlocker, setPaymentBlocker] = useState<string | null>(null);
  const [useWallet, setUseWallet] = useState(true);

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
  const needsAddress = selectedOffering?.fulfilmentType === "LOCAL_HOME" || selectedOffering?.fulfilmentType === "DESTINATION_PROVIDER_HOME";
  const allowsAddress = needsAddress || selectedOffering?.fulfilmentType === "ON_BEHALF";
  const notTravelling = selectedOffering?.fulfilmentType === "DESTINATION_PROVIDER_HOME" && provider?.travel?.willingToTravel === false;

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

  // Open slots for the chosen day, from the provider's real calendar.
  useEffect(() => {
    if (!bookingModalOpen || !provider?.id || !bookingDate) return;
    let active = true;
    (async () => {
      setSlotsLoading(true);
      try {
        const res = await providerPublicService.availabilityOf(provider.id, {
          from: bookingDate,
          to: bookingDate,
          durationMinutes: selectedOffering?.durationMinutes || 60,
        });
        if (active && res.data?.success) {
          const windows = res.data.data?.days?.[0]?.windows || [];
          const times = windows.map((w: any) => w.startTime);
          setAvailableSlots(times);
          if (times.length > 0 && !times.includes(bookingTime)) setBookingTime(times[0]);
        }
      } catch {
        if (active) setAvailableSlots([]);
      } finally {
        if (active) setSlotsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [bookingModalOpen, provider?.id, bookingDate, selectedOffering?.durationMinutes]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const handleStartBooking = (offering: OfferingView) => {
    setSelectedOffering(offering);
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
    const start = new Date(`${bookingDate}T${bookingTime}:00+05:30`);
    if (start.getTime() < earliestStart) {
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
        const rzpOptions = {
          key: res.data.data.keyId,
          amount: res.data.data.amount,
          currency: res.data.data.currency,
          name: "Tirvona",
          description: `Puja Booking ${bookingResult.bookingNumber || ""}`,
          order_id: res.data.data.orderId,
          handler: async (response: any) => {
            try {
              const confirmRes = await pujaBookingService.confirmPayment(bookingResult.id, {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              });
              if (confirmRes.data?.success) {
                setBookingResult({ ...bookingResult, status: "CONFIRMED" });
                toast.success("Payment verified. Booking confirmed.");
              }
            } catch (err) {
              toast.error(getErrorMessage(err, "Payment confirmation failed."));
            }
          },
        };
        if ((window as any).Razorpay) {
          new (window as any).Razorpay(rzpOptions).open();
        } else {
          setPaymentBlocker("The payment window could not be loaded. Please refresh the page and try again.");
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
    <div className="min-h-screen bg-[#FBF8F3] pb-28 dark:bg-[#071322] lg:pb-16">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 pb-3 pt-5 sm:px-6">
        <Link to="/pandits" className="inline-flex min-h-[44px] items-center gap-1 rounded text-sm font-bold text-[#B45309] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F28C28] dark:text-[#FFA44D]">
          <ChevronLeft size={18} aria-hidden="true" />
          All pandits &amp; acharyas
        </Link>
        <Button variant="outline" className="!min-h-[40px] !px-4" onClick={handleShare}>
          <Share2 size={15} aria-hidden="true" />
          Share
        </Button>
      </div>

      <div className="mx-auto max-w-6xl space-y-6 px-4 sm:px-6">
        {/* ── Identity ─────────────────────────────────────────────────── */}
        <Card as="section" className="p-5 sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <Avatar name={provider.displayName} src={provider.avatarUrl} size={112} className="!rounded-3xl" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-[#FFE4C4] bg-[#FFF4E5] px-3 py-1 text-xs font-bold text-[#92400E] dark:border-[#F28C28]/40 dark:bg-[#F28C28]/15 dark:text-[#FFA44D]">
                  {PROVIDER_TYPE_LABELS[provider.providerType] || provider.providerType}
                </span>
                {verified ? (
                  <StatusBadge status={provider.verificationLevel} label={VERIFICATION_LEVEL_LABELS[provider.verificationLevel]} tone="success" />
                ) : null}
              </div>
              <h1 className="break-words font-serif text-2xl font-black text-[#0B192C] sm:text-4xl dark:text-white">{provider.displayName}</h1>
              {place && (
                <p className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
                  <MapPin size={15} className="shrink-0 text-[#B45309]" aria-hidden="true" />
                  {place}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2 sm:w-56">
              {provider.consultation?.enabled && (
                <Button variant="secondary" onClick={openChatOrAsk}>
                  <MessageSquare size={16} aria-hidden="true" />
                  {activeConsultationId ? "Open chat" : "Ask a question"}
                </Button>
              )}
              {offerings.length > 0 && (
                <a href="#services" className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-[#F28C28] px-5 text-sm font-bold text-white shadow-sm shadow-[#F28C28]/20 hover:bg-[#D97706] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F28C28] focus-visible:ring-offset-2">
                  <CalendarDays size={16} aria-hidden="true" />
                  View services
                </a>
              )}
            </div>
          </div>

          {facts.length > 0 && (
            <dl className="mt-6 grid grid-cols-1 gap-3 border-t border-gray-100 pt-6 sm:grid-cols-3 dark:border-slate-800">
              {facts.map((f) => (
                <div key={f.label} className="rounded-xl border border-gray-100 bg-gray-50 p-3.5 dark:border-slate-800 dark:bg-slate-900/60">
                  <dt className="mb-0.5 text-xs font-bold uppercase tracking-wide text-gray-500">{f.label}</dt>
                  <dd className="flex items-start gap-1.5 break-words text-sm font-bold text-[#0B192C] dark:text-white">
                    <span className="mt-0.5 shrink-0" aria-hidden="true">{f.icon}</span>
                    {f.value}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </Card>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr,22rem] lg:items-start">
          <div className="min-w-0 space-y-6">
            {/* ── About ──────────────────────────────────────────────── */}
            {(provider.bio || provider.specializations?.length > 0 || (provider.serviceCities?.length ?? 0) > 0) && (
              <SectionCard title="About">
                {provider.bio && <p className="whitespace-pre-line text-sm leading-relaxed text-gray-700 dark:text-gray-300">{provider.bio}</p>}
                {provider.specializations?.length > 0 && (
                  <div className="mt-4">
                    <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">Specialties</h3>
                    <ul className="flex flex-wrap gap-2">
                      {provider.specializations.map((s) => (
                        <li key={s} className="rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-700 dark:border-slate-700 dark:bg-slate-900 dark:text-gray-300">
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {(provider.serviceCities?.length ?? 0) > 0 && (
                  <div className="mt-4">
                    <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">Service areas</h3>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{provider.serviceCities!.map((c) => c.city).join(", ")}</p>
                  </div>
                )}
              </SectionCard>
            )}

            {/* ── Services ───────────────────────────────────────────── */}
            <section id="services" aria-labelledby="services-heading" className="scroll-mt-24 space-y-4">
              <div>
                <p className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#B45309] dark:text-[#FFA44D]">
                  <Flame size={14} className="text-[#F28C28]" aria-hidden="true" />
                  Ceremonies
                </p>
                <h2 id="services-heading" className="text-xl font-black text-[#0B192C] sm:text-2xl dark:text-white">
                  Pujas &amp; services offered
                </h2>
              </div>

              {offerings.length === 0 ? (
                <Card>
                  <EmptyState
                    icon={<Flame size={24} />}
                    title="No services listed yet"
                    description={provider.consultation?.enabled ? "You can still send this provider a question." : "Check back later, or browse other providers."}
                  />
                </Card>
              ) : (
                <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {offerings.map((off) => {
                    const fee = formatMinor(offeringFeeMinor(off), off.indicativeFee?.currency || off.currency || "INR");
                    return (
                      <li key={off.id} className="flex">
                        <Card as="article" className="flex w-full flex-col justify-between p-5">
                          <div className="space-y-3">
                            <div>
                              <span className="rounded-full border border-[#FFC88A] bg-[#FFF4E5] px-2.5 py-0.5 text-[11px] font-bold text-[#92400E] dark:border-[#F28C28]/25 dark:bg-[#F28C28]/15 dark:text-[#FFC88A]">
                                {FULFILMENT_LABELS[off.fulfilmentType] || off.fulfilmentType}
                              </span>
                              <h3 className="mt-2 break-words text-base font-extrabold text-[#0B192C] dark:text-white">{offeringTitle(off)}</h3>
                              {off.variant?.titles?.en && <p className="text-xs text-gray-500">{off.variant.titles.en}</p>}
                            </div>
                            {off.description && <p className="line-clamp-3 text-sm leading-relaxed text-gray-600 dark:text-gray-300">{off.description}</p>}
                            <ul className="flex flex-wrap gap-x-4 gap-y-1.5 border-t border-gray-100 pt-3 text-xs text-gray-600 dark:border-slate-800 dark:text-gray-400">
                              {off.durationMinutes != null && (
                                <li className="flex items-center gap-1">
                                  <Clock size={13} className="text-[#B45309]" aria-hidden="true" />
                                  {off.durationMinutes} min
                                </li>
                              )}
                              {off.teamSize != null && (
                                <li className="flex items-center gap-1">
                                  <Users size={13} className="text-[#F28C28]" aria-hidden="true" />
                                  {off.teamSize} priest{off.teamSize === 1 ? "" : "s"}
                                </li>
                              )}
                              {off.minNoticeHours ? (
                                <li className="flex items-center gap-1">
                                  <CalendarDays size={13} className="text-[#B45309]" aria-hidden="true" />
                                  Book {off.minNoticeHours}h ahead
                                </li>
                              ) : null}
                            </ul>
                            {off.inclusions && off.inclusions.length > 0 && (
                              <div>
                                <h4 className="mb-1 text-xs font-bold uppercase tracking-wide text-gray-500">Includes</h4>
                                <ul className="space-y-1 text-xs text-gray-700 dark:text-gray-300">
                                  {off.inclusions.slice(0, 4).map((inc, i) => (
                                    <li key={i} className="flex items-start gap-1.5">
                                      <Check size={12} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden="true" />
                                      <span className="break-words">{inc}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {off.samagriIncluded && <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Puja samagri included</p>}
                          </div>
                          <div className="mt-5 flex items-center justify-between gap-3 border-t border-gray-100 pt-4 dark:border-slate-800">
                            <div className="min-w-0">
                              <p className="text-xs text-gray-500">Provider's fee</p>
                              <p className="text-lg font-black text-[#0B192C] dark:text-white">{fee ?? "On request"}</p>
                            </div>
                            <Button onClick={() => handleStartBooking(off)} className="shrink-0">
                              Book
                            </Button>
                          </div>
                        </Card>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>

          {/* ── Side panel (desktop) ─────────────────────────────────── */}
          <aside aria-label="Booking and consultation" className="hidden space-y-4 lg:sticky lg:top-24 lg:block">
            <Card className="space-y-3 p-5">
              <h2 className="text-base font-extrabold text-[#0B192C] dark:text-white">Book a puja</h2>
              {startingFee ? (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Services from <strong className="text-xl font-black text-[#0B192C] dark:text-white">{startingFee}</strong>
                </p>
              ) : (
                <p className="text-sm text-gray-600 dark:text-gray-400">No services are bookable yet.</p>
              )}
              <p className="text-xs text-gray-500">The payable total, including any travel charge, is shown before you pay.</p>
              {offerings.length > 0 && (
                <a href="#services" className="inline-flex min-h-[44px] w-full items-center justify-center rounded-full bg-[#F28C28] px-5 text-sm font-bold text-white shadow-sm shadow-[#F28C28]/20 hover:bg-[#D97706] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F28C28] focus-visible:ring-offset-2">
                  Choose a service
                </a>
              )}
            </Card>
            {provider.consultation?.enabled && (
              <Card className="space-y-3 p-5">
                <h2 className="flex items-center gap-2 text-base font-extrabold text-[#0B192C] dark:text-white">
                  <Sparkles size={16} className="text-[#F28C28]" aria-hidden="true" />
                  Ask for guidance
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Send a question and chat with {provider.displayName}.{consultFee ? <> Consultation fee: <strong>{consultFee}</strong>.</> : null}
                </p>
                <Button variant="secondary" className="w-full" onClick={openChatOrAsk}>
                  <MessageSquare size={16} aria-hidden="true" />
                  {activeConsultationId ? "Open chat" : "Ask a question"}
                </Button>
              </Card>
            )}
            <p className="flex items-start gap-2 px-1 text-xs text-gray-500">
              <ShieldCheck size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
              {verified ? `${VERIFICATION_LEVEL_LABELS[provider.verificationLevel]} by Tirvona.` : "Verification pending."}
            </p>
          </aside>
        </div>
      </div>

      {/* ── Compact action bar (mobile and tablet) ───────────────────── */}
      {(offerings.length > 0 || provider.consultation?.enabled) && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 px-4 pt-3 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] backdrop-blur lg:hidden dark:border-slate-800 dark:bg-[#0B192C]/95" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
          <div className="mx-auto flex max-w-xl items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-gray-500">{startingFee ? "Services from" : "Guidance"}</p>
              <p className="truncate text-lg font-black text-[#0B192C] dark:text-white">{startingFee ?? consultFee ?? "Ask a question"}</p>
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
              <Button type="submit" form="booking-form" loading={bookingSubmitting} disabled={notTravelling}>
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
                <dd className="text-right text-base font-black text-[#0B192C] dark:text-white">
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
            {selectedOffering.fulfilmentType === "LOCAL_HOME" && (provider.serviceCities?.length ?? 0) > 0 && (
              <p className="text-sm text-gray-600 dark:text-gray-400">Serves: {provider.serviceCities!.map((c) => c.city).join(", ")}</p>
            )}
            {minNoticeHours > 0 && <Notice tone="info">This service needs at least <strong>{minNoticeHours} hours' notice</strong>. The earliest date is {earliestDate}.</Notice>}

            <Field label="Date" required>
              <input type="date" className={inputClass} min={earliestDate} value={bookingDate} onChange={(e) => setBookingDate(e.target.value)} />
            </Field>

            {availableSlots.length > 0 ? (
              <div role="radiogroup" aria-labelledby={slotsId}>
                <p id={slotsId} className="mb-1.5 text-sm font-semibold text-gray-800 dark:text-gray-200">
                  Available start times
                </p>
                <div className="flex max-h-36 flex-wrap gap-2 overflow-y-auto p-0.5">
                  {availableSlots.map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      role="radio"
                      aria-checked={bookingTime === slot}
                      onClick={() => setBookingTime(slot)}
                      className={cx(
                        "min-h-[40px] rounded-xl border px-3.5 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F28C28]",
                        bookingTime === slot ? "border-[#0B192C] bg-[#0B192C] text-white" : "border-gray-300 bg-white text-gray-800 hover:border-[#F28C28] dark:border-slate-600 dark:bg-slate-900 dark:text-gray-200",
                      )}
                    >
                      {bookingTime === slot && <Check size={13} className="mr-1 inline" aria-hidden="true" />}
                      {slot}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <Field label="Start time" required hint={slotsLoading ? "Checking the provider's calendar…" : "No open windows were found for this day. You can still request a time and the provider's calendar will be checked."}>
                <input type="time" className={inputClass} value={bookingTime} onChange={(e) => setBookingTime(e.target.value)} />
              </Field>
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

            <div className="rounded-xl bg-gray-50 p-3 text-sm dark:bg-slate-900/60">
              <div className="flex justify-between gap-4">
                <span className="text-gray-600 dark:text-gray-400">Provider's fee</span>
                <strong className="text-[#0B192C] dark:text-white">{formatMinor(offeringFeeMinor(selectedOffering), selectedOffering.indicativeFee?.currency || selectedOffering.currency || "INR") ?? "On request"}</strong>
              </div>
              <p className="mt-1 text-xs text-gray-500">The final payable total is confirmed by the server after you hold the slot.</p>
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
