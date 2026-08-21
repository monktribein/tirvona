import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  Check,
  Clock,
  Flame,
  Loader2,
  MapPin,
  Minus,
  Plus,
  ShieldCheck,
  Shirt,
  Star,
  Users,
} from "lucide-react";
import { getErrorMessage } from "../../../lib/api";
import { useAuth } from "../../../contexts/AuthContext";
import { toast } from "../../../lib/toast";
import { aartiDiscoveryService } from "../services/aarti.service";
import type { AartiPassType, AartiQuote, AartiSession } from "../types/aarti.types";
import {
  facilityLabel,
  formatClock,
  formatCurrency,
  formatSchedule,
  seatsTone,
  toDateInputValue,
} from "../utils/aartiFormat";

const FALLBACK_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100%25' height='100%25' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='1.5'%3E%3Crect width='100%25' height='100%25' fill='%23f1f5f9'/%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'/%3E%3Cpath d='m21 15-5-5-11 11'/%3E%3C/svg%3E";

export const AartiDetailPage: React.FC = () => {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [session, setSession] = useState<AartiSession | null>(null);
  const [passes, setPasses] = useState<AartiPassType[]>([]);
  const [activeImage, setActiveImage] = useState(0);
  const [date, setDate] = useState(searchParams.get("date") ?? "");
  const [passTypeId, setPassTypeId] = useState("");
  const [passCount, setPassCount] = useState(1);
  const [donationAmount, setDonationAmount] = useState(0);
  const [quote, setQuote] = useState<AartiQuote | null>(null);
  const [quoteError, setQuoteError] = useState("");
  const [loading, setLoading] = useState(true);
  const [quoting, setQuoting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    aartiDiscoveryService
      .getDetail(id, date || undefined)
      .then((response) => {
        if (cancelled) return;
        const data: AartiSession = response.data?.data;
        setSession(data);
        setPasses(data.passTypes ?? []);
        if (!date && data.upcomingDates?.length) setDate(data.upcomingDates[0]);
        setError("");
      })
      .catch((err) => {
        if (!cancelled)
          setError(getErrorMessage(err, "We could not load this aarti."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // `date` is deliberately excluded — changing it refreshes passes only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!session || !date) return;
    let cancelled = false;
    aartiDiscoveryService
      .getPasses(session._id, date)
      .then((response) => {
        if (!cancelled) setPasses(response.data?.data?.passTypes ?? []);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [session, date]);

  useEffect(() => {
    if (date) setSearchParams({ date }, { replace: true });
  }, [date, setSearchParams]);

  useEffect(() => {
    const currentPassIsAvailable = passes.some(
      (pass) => pass._id === passTypeId && pass.available !== false,
    );
    if (currentPassIsAvailable) return;

    setPassTypeId(passes.find((pass) => pass.available !== false)?._id ?? "");
    setPassCount(1);
  }, [passes, passTypeId]);

  const selectedPass = useMemo(
    () => passes.find((pass) => pass._id === passTypeId) ?? null,
    [passes, passTypeId],
  );

  const refreshQuote = useCallback(async () => {
    if (!session || !date || !passTypeId) {
      setQuote(null);
      return;
    }
    setQuoting(true);
    setQuoteError("");
    try {
      const response = await aartiDiscoveryService.getQuote({
        sessionId: session._id,
        passTypeId,
        sessionDate: date,
        passCount,
        donationAmount,
      });
      if (response.data?.success) {
        setQuote(response.data.data);
      } else {
        setQuote(null);
        setQuoteError(response.data?.message ?? "This pass is not available.");
      }
    } catch (err) {
      setQuote(null);
      setQuoteError(getErrorMessage(err, "We could not price this pass."));
    } finally {
      setQuoting(false);
    }
  }, [session, date, passTypeId, passCount, donationAmount]);

  useEffect(() => {
    const timer = setTimeout(refreshQuote, 200);
    return () => clearTimeout(timer);
  }, [refreshQuote]);

  const proceed = () => {
    if (!session || !quote) return;
    if (!user) {
      toast.info("Please sign in to reserve your aarti pass.");
      navigate(`/login?returnTo=/aarti/${session.slug}?date=${date}`);
      return;
    }
    navigate("/aarti/checkout", {
      state: {
        sessionId: session._id,
        sessionName: session.name,
        sessionSlug: session.slug,
        passTypeId,
        passTypeName: selectedPass?.name,
        sessionDate: date,
        passCount,
        donationAmount,
        quote,
        coverImage: session.coverImage || session.images?.[0] || "",
        venueLabel: [session.venue?.name, session.venue?.city]
          .filter(Boolean)
          .join(", "),
        kindLabel: session.kindLabel,
        policy: session.policy,
      },
    });
  };

  if (loading)
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16 space-y-6">
        <div className="h-10 w-2/3 mx-auto bg-gray-100 dark:bg-slate-800 animate-pulse rounded-full" />
        <div className="aspect-video w-full bg-gray-100 dark:bg-slate-800 animate-pulse rounded-[24px]" />
        <div className="grid lg:grid-cols-[1.6fr_1fr] gap-6">
          <div className="h-72 bg-gray-100 dark:bg-slate-800 animate-pulse rounded-[24px]" />
          <div className="h-96 bg-gray-100 dark:bg-slate-800 animate-pulse rounded-[24px]" />
        </div>
      </div>
    );

  if (error || !session)
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-12 shadow-sm space-y-3">
          <Flame size={36} className="text-gray-300 dark:text-slate-700 mx-auto" />
          <h4 className="font-extrabold text-base text-[#0B192C] dark:text-white">
            {error || "Aarti not found"}
          </h4>
          <button
            type="button"
            onClick={() => navigate("/aarti")}
            className="inline-flex items-center gap-2 bg-[#0A4DA6] hover:bg-[#083D85] text-white text-xs font-extrabold px-5 py-2.5 rounded-full shadow-md transition-all active:scale-95 cursor-pointer"
          >
            Browse all aartis
          </button>
        </div>
      </div>
    );

  const gallery = [session.coverImage, ...(session.images ?? [])].filter(
    Boolean,
  ) as string[];
  const maxPasses = Math.min(
    selectedPass?.maxPerBooking ?? 10,
    session.policy?.maxPassesPerBooking ?? 10,
    Math.max(1, selectedPass?.seatsRemaining ?? 10),
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-2 pb-16 space-y-10">
      <div className="flex flex-col items-center text-center gap-3 pb-4">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="px-3 py-1 bg-[#0A4DA6] text-white text-[9px] font-extrabold rounded-full flex items-center gap-1 shadow-sm tracking-wider">
            <ShieldCheck size={12} /> {session.kindLabel ?? "Aarti"}
          </span>
          <span className="text-xs text-gray-400 font-extrabold tracking-wider">
            {[session.venue?.city, session.venue?.state]
              .filter(Boolean)
              .join(", ")}
          </span>
          {session.rating?.count ? (
            <span className="inline-flex items-center gap-1 text-xs font-extrabold text-[#0B192C] dark:text-white">
              <Star size={12} className="fill-[#D4AF37] text-[#D4AF37]" />
              {session.rating.average.toFixed(1)}
              <span className="text-gray-400 font-bold">
                ({session.rating.count})
              </span>
            </span>
          ) : null}
        </div>

        <h2 className="text-3xl md:text-5xl font-extrabold text-[#0B192C] dark:text-white leading-tight">
          {session.name}
        </h2>

        <p className="text-xs text-gray-500 flex items-center justify-center gap-1">
          <MapPin size={12} className="text-[#0A4DA6]" />
          {[session.venue?.name, session.venue?.line1, session.venue?.landmark]
            .filter(Boolean)
            .join(", ") || "India"}
        </p>

        <p className="text-xs font-bold text-[#0B192C] dark:text-gray-200 flex items-center justify-center gap-1.5">
          <Clock size={12} className="text-[#E58C28]" />
          {formatClock(session.startTime)} · {formatSchedule(session.daysOfWeek)}
          {session.durationMinutes ? ` · ${session.durationMinutes} min` : ""}
        </p>
      </div>

      {gallery.length ? (
        <div className="space-y-3 -mt-4">
          <div className="relative w-full aspect-video rounded-[24px] overflow-hidden shadow-sm bg-gray-100 dark:bg-slate-900">
            <AnimatePresence mode="wait">
              <motion.img
                key={activeImage}
                src={gallery[activeImage] || FALLBACK_IMAGE}
                alt={session.name}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35, ease: "easeInOut" }}
                className="absolute inset-0 w-full h-full object-cover"
                onError={(event) => {
                  event.currentTarget.onerror = null;
                  event.currentTarget.src = FALLBACK_IMAGE;
                }}
              />
            </AnimatePresence>
            {gallery.length > 1 && (
              <div className="absolute top-4 left-4 px-2.5 py-1 rounded-full bg-black/45 text-white text-[10px] font-bold backdrop-blur-sm">
                {activeImage + 1} / {gallery.length}
              </div>
            )}
          </div>

          {gallery.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {gallery.map((image, index) => (
                <button
                  key={image}
                  type="button"
                  onClick={() => setActiveImage(index)}
                  className={`h-16 w-24 shrink-0 rounded-2xl overflow-hidden border-2 transition-all cursor-pointer ${
                    activeImage === index
                      ? "border-[#0A4DA6]"
                      : "border-transparent opacity-70 hover:opacity-100"
                  }`}
                >
                  <img
                    src={image}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}

      <div className="grid lg:grid-cols-[1.6fr_1fr] gap-6 items-start">
        <div className="space-y-6 min-w-0">
          {session.description || session.ritualNotes ? (
            <section className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] p-5 sm:p-6 shadow-sm space-y-3">
              <h3 className="font-extrabold text-base text-[#0B192C] dark:text-white">
                About this aarti
              </h3>
              {session.description ? (
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-medium leading-relaxed whitespace-pre-line">
                  {session.description}
                </p>
              ) : null}
              {session.ritualNotes ? (
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-medium leading-relaxed whitespace-pre-line">
                  {session.ritualNotes}
                </p>
              ) : null}
            </section>
          ) : null}

          {session.facilities?.length ? (
            <section className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] p-5 sm:p-6 shadow-sm space-y-3">
              <h3 className="font-extrabold text-base text-[#0B192C] dark:text-white">
                What is arranged
              </h3>
              <div className="grid sm:grid-cols-2 gap-2.5">
                {session.facilities.map((facility) => (
                  <span
                    key={facility}
                    className="flex items-center gap-2 text-xs font-semibold text-gray-600 dark:text-gray-300"
                  >
                    <span className="w-5 h-5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center shrink-0">
                      <Check
                        size={11}
                        className="text-emerald-600 stroke-[3]"
                      />
                    </span>
                    {facilityLabel(facility)}
                  </span>
                ))}
              </div>
            </section>
          ) : null}

          {session.dressCode || session.instructions ? (
            <section className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] p-5 sm:p-6 shadow-sm space-y-3">
              <h3 className="inline-flex items-center gap-2 font-extrabold text-base text-[#0B192C] dark:text-white">
                <Shirt size={16} className="text-[#E58C28] stroke-[2.5]" />
                Before you go
              </h3>
              {session.dressCode ? (
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-medium leading-relaxed">
                  <span className="font-extrabold text-[#0B192C] dark:text-white">
                    Dress code:{" "}
                  </span>
                  {session.dressCode}
                </p>
              ) : null}
              {session.instructions ? (
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-medium leading-relaxed whitespace-pre-line">
                  {session.instructions}
                </p>
              ) : null}
            </section>
          ) : null}

          {session.termsAndConditions ? (
            <section className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] p-5 sm:p-6 shadow-sm space-y-3">
              <h3 className="font-extrabold text-base text-[#0B192C] dark:text-white">
                Terms
              </h3>
              <p className="text-[11px] text-gray-400 font-medium leading-relaxed whitespace-pre-line">
                {session.termsAndConditions}
              </p>
            </section>
          ) : null}
        </div>

        <aside className="lg:sticky lg:top-24 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] p-5 shadow-lg shadow-[#0B192C]/5 space-y-4">
          <h3 className="font-extrabold text-base text-[#0B192C] dark:text-white">
            Reserve your pass
          </h3>

          <div>
            <label
              htmlFor="aarti-detail-date"
              className="block text-[10px] tracking-wider font-bold text-gray-400 mb-1.5 px-1"
            >
              Aarti Date
            </label>
            <div className="relative">
              <CalendarDays
                size={15}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#0A4DA6] stroke-[2.5] pointer-events-none"
              />
              {session.upcomingDates?.length ? (
                <select
                  id="aarti-detail-date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl pl-10 pr-3 py-2.5 text-xs font-semibold text-[#0B192C] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/30 cursor-pointer appearance-none"
                >
                  {session.upcomingDates.map((option) => (
                    <option key={option} value={option}>
                      {new Date(`${option}T00:00:00`).toLocaleDateString(
                        undefined,
                        {
                          weekday: "short",
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        },
                      )}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id="aarti-detail-date"
                  type="date"
                  value={date}
                  min={toDateInputValue(new Date())}
                  onChange={(event) => setDate(event.target.value)}
                  className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl pl-10 pr-3 py-2.5 text-xs font-semibold text-[#0B192C] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/30"
                />
              )}
            </div>
          </div>

          <div className="space-y-2">
            <span className="block text-[10px] tracking-wider font-bold text-gray-400 px-1">
              {passes.length > 1 ? "Choose a Pass" : "Pass Amount"}
            </span>
            {passes.length === 0 ? (
              <p className="text-center text-[11px] text-gray-400 font-medium bg-gray-50 dark:bg-slate-900 border border-dashed border-gray-200 dark:border-slate-800 rounded-2xl py-6 px-4">
                No passes are published for this aarti yet.
              </p>
            ) : passes.length === 1 ? (
              <div className="rounded-2xl border border-orange-200 bg-gray-50/70 p-3 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-extrabold text-[#0B192C] dark:text-white">
                      {passes[0].name}
                    </p>
                    {passes[0].zoneLabel ? (
                      <p className="truncate text-[10px] font-bold text-gray-400">
                        {passes[0].zoneLabel}
                      </p>
                    ) : null}
                  </div>
                  <p className="shrink-0 text-base font-black text-[#0B192C] dark:text-white">
                    {formatCurrency(
                      passes[0].unitPrice ?? passes[0].basePrice,
                    )}
                  </p>
                </div>

                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] font-bold">
                  {passes[0].seatsRemaining != null ? (
                    <span
                      className={`inline-flex items-center gap-1 ${seatsTone(
                        passes[0].seatsRemaining,
                        passes[0].totalCapacity,
                      )}`}
                    >
                      <Users size={10} className="stroke-[2.5]" />
                      {passes[0].seatsRemaining > 0
                        ? `${passes[0].seatsRemaining} left`
                        : "Full"}
                    </span>
                  ) : null}
                  {passes[0].includesPrasad ? (
                    <span className="text-gray-400">· Prasad</span>
                  ) : null}
                  {passes[0].includesSankalp ? (
                    <span className="text-gray-400">· Sankalp</span>
                  ) : null}
                  {passes[0].isPeak ? (
                    <span className="text-[#E58C28]">· Festival rate</span>
                  ) : null}
                </div>

                {passes[0].available === false &&
                passes[0].unavailableReason ? (
                  <p className="mt-1 text-[10px] font-bold text-rose-600">
                    {passes[0].unavailableReason}
                  </p>
                ) : null}
              </div>
            ) : (
              passes.map((pass) => {
                const disabled = pass.available === false;
                const active = passTypeId === pass._id;
                return (
                  <button
                    key={pass._id}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      setPassTypeId(pass._id);
                      setPassCount(1);
                    }}
                    className={`w-full text-left rounded-2xl border p-3 transition-all cursor-pointer active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 ${
                      active
                        ? "border-[#0A4DA6] bg-blue-50/60 dark:bg-slate-800 ring-2 ring-[#0A4DA6]/20"
                        : "border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-900 hover:border-[#0A4DA6]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-extrabold text-xs text-[#0B192C] dark:text-white truncate">
                          {pass.name}
                        </p>
                        {pass.zoneLabel ? (
                          <p className="text-[10px] font-bold text-gray-400 truncate">
                            {pass.zoneLabel}
                          </p>
                        ) : null}
                      </div>
                      <p className="shrink-0 font-black text-sm text-[#0B192C] dark:text-white">
                        {formatCurrency(pass.unitPrice ?? pass.basePrice)}
                      </p>
                    </div>

                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] font-bold">
                      {pass.seatsRemaining != null ? (
                        <span
                          className={`inline-flex items-center gap-1 ${seatsTone(
                            pass.seatsRemaining,
                            pass.totalCapacity,
                          )}`}
                        >
                          <Users size={10} className="stroke-[2.5]" />
                          {pass.seatsRemaining > 0
                            ? `${pass.seatsRemaining} left`
                            : "Full"}
                        </span>
                      ) : null}
                      {pass.includesPrasad ? (
                        <span className="text-gray-400">· Prasad</span>
                      ) : null}
                      {pass.includesSankalp ? (
                        <span className="text-gray-400">· Sankalp</span>
                      ) : null}
                      {pass.isPeak ? (
                        <span className="text-[#E58C28]">· Festival rate</span>
                      ) : null}
                    </div>

                    {disabled && pass.unavailableReason ? (
                      <p className="mt-1 text-[10px] font-bold text-rose-600">
                        {pass.unavailableReason}
                      </p>
                    ) : null}
                  </button>
                );
              })
            )}
          </div>

          {selectedPass ? (
            <>
              <div className="flex items-center justify-between gap-2 pt-1">
                <span className="text-[10px] tracking-wider font-bold text-gray-400">
                  PASSES
                </span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    disabled={passCount <= 1}
                    onClick={() => setPassCount((value) => Math.max(1, value - 1))}
                    className="w-7 h-7 rounded-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 flex items-center justify-center text-[#0A4DA6] transition-all active:scale-90 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Minus size={13} className="stroke-[3]" />
                  </button>
                  <span className="w-6 text-center font-black text-sm text-[#0B192C] dark:text-white">
                    {passCount}
                  </span>
                  <button
                    type="button"
                    disabled={passCount >= maxPasses}
                    onClick={() =>
                      setPassCount((value) => Math.min(maxPasses, value + 1))
                    }
                    className="w-7 h-7 rounded-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 flex items-center justify-center text-[#0A4DA6] transition-all active:scale-90 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Plus size={13} className="stroke-[3]" />
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="aarti-donation"
                  className="block text-[10px] tracking-wider font-bold text-gray-400 mb-1.5 px-1"
                >
                  Sankalp Donation (optional)
                </label>
                <input
                  id="aarti-donation"
                  type="number"
                  min={0}
                  step={51}
                  value={donationAmount || ""}
                  onChange={(event) =>
                    setDonationAmount(Math.max(0, Number(event.target.value) || 0))
                  }
                  placeholder="0"
                  className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl px-3.5 py-2.5 text-xs font-semibold text-[#0B192C] dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/30"
                />
              </div>
            </>
          ) : null}

          {quoteError ? (
            <div className="flex items-start gap-2 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-2xl px-3 py-2.5">
              <AlertCircle
                size={13}
                className="shrink-0 mt-0.5 text-rose-600 stroke-[2.5]"
              />
              <p className="text-[11px] font-semibold text-rose-700 dark:text-rose-300">
                {quoteError}
              </p>
            </div>
          ) : null}

          {quote ? (
            <div className="space-y-1.5 pt-3 border-t border-gray-100 dark:border-slate-800">
              <div className="flex justify-between text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                <span>
                  {formatCurrency(quote.unitPrice)} × {quote.passCount}
                </span>
                <span>{formatCurrency(quote.subtotal)}</span>
              </div>
              {quote.taxAmount ? (
                <div className="flex justify-between text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                  <span>Tax ({quote.taxPercent}%)</span>
                  <span>{formatCurrency(quote.taxAmount)}</span>
                </div>
              ) : null}
              {quote.donationAmount ? (
                <div className="flex justify-between text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                  <span>Sankalp donation</span>
                  <span>{formatCurrency(quote.donationAmount)}</span>
                </div>
              ) : null}
              {quote.isPeak ? (
                <p className="text-[10px] font-bold text-[#E58C28]">
                  Festival pricing applies
                  {quote.peakReasons?.length
                    ? ` — ${quote.peakReasons.map((reason) => reason.name).join(", ")}`
                    : ""}
                </p>
              ) : null}
              <div className="flex justify-between items-center pt-2 mt-1 border-t border-gray-100 dark:border-slate-800">
                <span className="text-[10px] tracking-wider font-bold text-gray-400">
                  TOTAL
                </span>
                <span className="text-lg font-black text-[#0B192C] dark:text-white">
                  {formatCurrency(quote.totalAmount)}
                </span>
              </div>
            </div>
          ) : null}

          <button
            type="button"
            onClick={proceed}
            disabled={!quote || quoting}
            className="group w-full bg-[#0A4DA6] hover:bg-[#083D85] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-extrabold pl-5 pr-1.5 py-2 rounded-full inline-flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer"
          >
            {quoting ? (
              <Loader2 size={14} className="animate-spin stroke-[2.5]" />
            ) : null}
            <span>Continue to Payment</span>
            <span className="w-6 h-6 rounded-full bg-white text-[#0A4DA6] flex items-center justify-center transition-transform group-hover:translate-x-0.5">
              <ArrowRight size={12} className="stroke-[3]" />
            </span>
          </button>

          {session.policy ? (
            <p className="text-center text-[10px] font-bold text-gray-400 leading-relaxed">
              Free cancellation up to {session.policy.freeCancellationHours}h
              before · Gate opens {session.policy.gateOpensBeforeMinutes} min early
            </p>
          ) : null}
        </aside>
      </div>
    </div>
  );
};

export default AartiDetailPage;
