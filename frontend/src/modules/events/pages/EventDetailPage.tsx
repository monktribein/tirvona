import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  Check,
  Clock,
  Loader2,
  MapPin,
  Minus,
  Plus,
  ShieldCheck,
  Shirt,
  Sparkles,
  Users,
} from "lucide-react";
import { getErrorMessage } from "../../../lib/api";
import { useAuth } from "../../../contexts/AuthContext";
import { toast } from "../../../lib/toast";
import {
  eventDiscoveryService,
  eventRegistrationService,
} from "../services/event.service";
import type { EventDay, EventFestival } from "../types/event.types";
import {
  arriveByTime,
  facilityLabel,
  formatClock,
  formatDate,
  formatDateRange,
  seatsTone,
} from "../utils/eventFormat";

const FALLBACK_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100%25' height='100%25' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='1.5'%3E%3Crect width='100%25' height='100%25' fill='%23f1f5f9'/%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'/%3E%3Cpath d='m21 15-5-5-11 11'/%3E%3C/svg%3E";

export const EventDetailPage: React.FC = () => {
  const { idOrSlug = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [event, setEvent] = useState<EventFestival | null>(null);
  const [activeImage, setActiveImage] = useState(0);
  const [attendDate, setAttendDate] = useState("");
  const [seats, setSeats] = useState(1);
  const [attendees, setAttendees] = useState<string[]>([""]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await eventDiscoveryService.getDetail(idOrSlug);
      const data: EventFestival = response.data?.data;
      setEvent(data);
      const firstOpen = data.days?.find((day) => day.registrationOpen);
      setAttendDate(firstOpen?.date ?? data.days?.[0]?.date ?? "");
      setError("");
    } catch (err) {
      setError(getErrorMessage(err, "We could not load this event."));
    } finally {
      setLoading(false);
    }
  }, [idOrSlug]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setAttendees((current) =>
      Array.from({ length: seats }, (_, index) => current[index] ?? ""),
    );
  }, [seats]);

  const selectedDay = useMemo<EventDay | undefined>(
    () => event?.days?.find((day) => day.date === attendDate),
    [event, attendDate],
  );

  const maxSeats = Math.min(
    event?.policy?.maxSeatsPerRegistration ?? 10,
    selectedDay?.seatsRemaining ?? 10,
  );

  const register = async () => {
    if (!event) return;
    if (!user) {
      toast.info("Please sign in to reserve your place.");
      navigate(`/login?returnTo=/events/${event.slug}`);
      return;
    }
    setSubmitting(true);
    setFormError("");
    try {
      const response = await eventRegistrationService.register({
        eventId: event._id,
        attendDate,
        seats,
        attendees: attendees
          .map((name) => name.trim())
          .filter(Boolean)
          .map((name) => ({ name })),
      });
      const registrationId = response.data?.data?.registration?._id;
      if (!registrationId)
        throw new Error(
          "Your place was held but no reference came back. Check My Event Passes before registering again.",
        );
      navigate(`/events/pass/${registrationId}`, { replace: true });
    } catch (err) {
      setFormError(getErrorMessage(err, "We could not complete your registration."));
    } finally {
      setSubmitting(false);
    }
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

  if (error || !event)
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-12 shadow-sm space-y-3">
          <CalendarDays
            size={36}
            className="text-gray-300 dark:text-slate-700 mx-auto"
          />
          <h4 className="font-extrabold text-base text-[#0B192C] dark:text-white">
            {error || "Event not found"}
          </h4>
          <button
            type="button"
            onClick={() => navigate("/events")}
            className="inline-flex items-center gap-2 bg-[#0A4DA6] hover:bg-[#083D85] text-white text-xs font-extrabold px-5 py-2.5 rounded-full shadow-md transition-all active:scale-95 cursor-pointer"
          >
            Browse all events
          </button>
        </div>
      </div>
    );

  const gallery = [event.coverImage, ...(event.images ?? [])].filter(
    Boolean,
  ) as string[];
  const registrationAllowed = event.policy?.allowRegistration !== false;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-2 pb-16 space-y-10">
      <div className="flex flex-col items-center text-center gap-3 pb-4">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="px-3 py-1 bg-[#0A4DA6] text-white text-[9px] font-extrabold rounded-full flex items-center gap-1 shadow-sm tracking-wider">
            <Sparkles size={12} /> {event.eventTypeLabel ?? "Event"}
          </span>
          <span className="text-xs text-gray-400 font-extrabold tracking-wider">
            {[event.venue?.city, event.venue?.state].filter(Boolean).join(", ")}
          </span>
          {event.isOnNow ? (
            <span className="px-3 py-1 bg-emerald-600 text-white text-[9px] font-extrabold rounded-full tracking-wider">
              ON NOW
            </span>
          ) : null}
        </div>

        <h2 className="text-3xl md:text-5xl font-extrabold text-[#0B192C] dark:text-white leading-tight">
          {event.name}
        </h2>

        {event.tagline ? (
          <p className="text-sm font-bold text-[#E58C28]">{event.tagline}</p>
        ) : null}

        <p className="text-xs text-gray-500 flex items-center justify-center gap-1">
          <MapPin size={12} className="text-[#0A4DA6]" />
          {[event.venue?.name, event.venue?.line1, event.venue?.landmark]
            .filter(Boolean)
            .join(", ") || "India"}
        </p>

        <p className="text-xs font-bold text-[#0B192C] dark:text-gray-200 flex items-center justify-center gap-1.5">
          <CalendarDays size={12} className="text-[#E58C28]" />
          {formatDateRange(event.startDate, event.endDate)} ·{" "}
          {formatClock(event.startTime)}
        </p>
      </div>

      {gallery.length ? (
        <div className="space-y-3 -mt-4">
          <div className="relative w-full aspect-video rounded-[24px] overflow-hidden shadow-sm bg-gray-100 dark:bg-slate-900">
            <AnimatePresence mode="wait">
              <motion.img
                key={activeImage}
                src={gallery[activeImage] || FALLBACK_IMAGE}
                alt={event.name}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35, ease: "easeInOut" }}
                className="absolute inset-0 w-full h-full object-cover"
                onError={(errorEvent) => {
                  errorEvent.currentTarget.onerror = null;
                  errorEvent.currentTarget.src = FALLBACK_IMAGE;
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
          {event.description ? (
            <section className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] p-5 sm:p-6 shadow-sm space-y-3">
              <h3 className="font-extrabold text-base text-[#0B192C] dark:text-white">
                About this event
              </h3>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-medium leading-relaxed whitespace-pre-line">
                {event.description}
              </p>
              {event.highlights?.length ? (
                <div className="grid sm:grid-cols-2 gap-2.5 pt-1">
                  {event.highlights.map((highlight) => (
                    <span
                      key={highlight}
                      className="flex items-start gap-2 text-xs font-semibold text-gray-600 dark:text-gray-300"
                    >
                      <span className="w-5 h-5 mt-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center shrink-0">
                        <Check size={11} className="text-emerald-600 stroke-[3]" />
                      </span>
                      {highlight}
                    </span>
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}

          {event.dailySchedule?.length ? (
            <section className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] p-5 sm:p-6 shadow-sm space-y-3">
              <h3 className="font-extrabold text-base text-[#0B192C] dark:text-white">
                Daily programme
              </h3>
              <div className="space-y-2">
                {event.dailySchedule.map((item, index) => (
                  <div
                    key={`${item.label}-${index}`}
                    className="flex items-start gap-3 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl px-3 py-2.5"
                  >
                    <span className="shrink-0 font-mono text-[11px] font-bold text-[#0A4DA6] w-16">
                      {formatClock(item.startTime)}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-extrabold text-[#0B192C] dark:text-white">
                        {item.label}
                      </p>
                      {item.note ? (
                        <p className="text-[11px] font-medium text-gray-400">
                          {item.note}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {event.facilities?.length ? (
            <section className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] p-5 sm:p-6 shadow-sm space-y-3">
              <h3 className="font-extrabold text-base text-[#0B192C] dark:text-white">
                What is arranged
              </h3>
              <div className="grid sm:grid-cols-2 gap-2.5">
                {event.facilities.map((facility) => (
                  <span
                    key={facility}
                    className="flex items-center gap-2 text-xs font-semibold text-gray-600 dark:text-gray-300"
                  >
                    <span className="w-5 h-5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center shrink-0">
                      <Check size={11} className="text-emerald-600 stroke-[3]" />
                    </span>
                    {facilityLabel(facility)}
                  </span>
                ))}
              </div>
            </section>
          ) : null}

          {event.dressCode || event.instructions ? (
            <section className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] p-5 sm:p-6 shadow-sm space-y-3">
              <h3 className="inline-flex items-center gap-2 font-extrabold text-base text-[#0B192C] dark:text-white">
                <Shirt size={16} className="text-[#E58C28] stroke-[2.5]" />
                Before you go
              </h3>
              {event.dressCode ? (
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-medium leading-relaxed">
                  <span className="font-extrabold text-[#0B192C] dark:text-white">
                    Dress code:{" "}
                  </span>
                  {event.dressCode}
                </p>
              ) : null}
              {event.instructions ? (
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-medium leading-relaxed whitespace-pre-line">
                  {event.instructions}
                </p>
              ) : null}
            </section>
          ) : null}

          {event.termsAndConditions ? (
            <section className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] p-5 sm:p-6 shadow-sm space-y-3">
              <h3 className="font-extrabold text-base text-[#0B192C] dark:text-white">
                Terms
              </h3>
              <p className="text-[11px] text-gray-400 font-medium leading-relaxed whitespace-pre-line">
                {event.termsAndConditions}
              </p>
            </section>
          ) : null}
        </div>

        <aside className="lg:sticky lg:top-24 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] p-5 shadow-lg shadow-[#0B192C]/5 space-y-4">
          <div>
            <h3 className="font-extrabold text-base text-[#0B192C] dark:text-white">
              {registrationAllowed ? "Reserve your place" : "Open to all"}
            </h3>
            <p className="mt-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
              Entry is free
            </p>
          </div>

          {!registrationAllowed ? (
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 leading-relaxed bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl px-3 py-3">
              No registration is needed for this event — simply arrive at the
              venue. Do check the dress code and timings above.
            </p>
          ) : (
            <>
              <div className="space-y-2">
                <span className="block text-[10px] tracking-wider font-bold text-gray-400 px-1">
                  Choose a Day
                </span>
                {(event.days ?? []).length === 0 ? (
                  <p className="text-center text-[11px] text-gray-400 font-medium bg-gray-50 dark:bg-slate-900 border border-dashed border-gray-200 dark:border-slate-800 rounded-2xl py-6 px-4">
                    No days are open for registration yet.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {(event.days ?? []).map((day) => {
                      const active = attendDate === day.date;
                      const disabled = !day.registrationOpen;
                      return (
                        <button
                          key={day.date}
                          type="button"
                          disabled={disabled}
                          onClick={() => {
                            setAttendDate(day.date);
                            setSeats(1);
                          }}
                          className={`w-full text-left rounded-2xl border p-3 transition-all cursor-pointer active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 ${
                            active
                              ? "border-[#0A4DA6] bg-blue-50/60 dark:bg-slate-800 ring-2 ring-[#0A4DA6]/20"
                              : "border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-900 hover:border-[#0A4DA6]"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-extrabold text-xs text-[#0B192C] dark:text-white">
                              {formatDate(day.date)}
                            </p>
                            <span
                              className={`text-[10px] font-bold ${seatsTone(
                                day.seatsRemaining,
                                day.totalCapacity,
                              )}`}
                            >
                              {day.seatsRemaining === null
                                ? "Open"
                                : day.seatsRemaining > 0
                                  ? `${day.seatsRemaining} left`
                                  : "Full"}
                            </span>
                          </div>
                          {disabled ? (
                            <p className="mt-1 text-[10px] font-bold text-rose-600">
                              {day.isClosed
                                ? "Closed by the ashram"
                                : "Registration has closed"}
                            </p>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {selectedDay?.registrationOpen ? (
                <>
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="text-[10px] tracking-wider font-bold text-gray-400">
                      PEOPLE
                    </span>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        disabled={seats <= 1}
                        onClick={() => setSeats((value) => Math.max(1, value - 1))}
                        className="w-7 h-7 rounded-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 flex items-center justify-center text-[#0A4DA6] transition-all active:scale-90 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Minus size={13} className="stroke-[3]" />
                      </button>
                      <span className="w-6 text-center font-black text-sm text-[#0B192C] dark:text-white">
                        {seats}
                      </span>
                      <button
                        type="button"
                        disabled={seats >= maxSeats}
                        onClick={() =>
                          setSeats((value) => Math.min(maxSeats, value + 1))
                        }
                        className="w-7 h-7 rounded-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 flex items-center justify-center text-[#0A4DA6] transition-all active:scale-90 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Plus size={13} className="stroke-[3]" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="block text-[10px] tracking-wider font-bold text-gray-400 px-1">
                      Attendee Names (optional)
                    </span>
                    {attendees.map((name, index) => (
                      <input
                        key={`attendee-${index}`}
                        value={name}
                        onChange={(changeEvent) =>
                          setAttendees((current) =>
                            current.map((item, position) =>
                              position === index
                                ? changeEvent.target.value
                                : item,
                            ),
                          )
                        }
                        placeholder={`Attendee ${index + 1}`}
                        className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl px-3.5 py-2.5 text-xs font-semibold text-[#0B192C] dark:text-white placeholder:text-gray-400 placeholder:font-medium focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/30 focus:border-[#0A4DA6] transition-all"
                      />
                    ))}
                  </div>
                </>
              ) : null}

              {formError ? (
                <div className="flex items-start gap-2 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-2xl px-3 py-2.5">
                  <AlertCircle
                    size={13}
                    className="shrink-0 mt-0.5 text-rose-600 stroke-[2.5]"
                  />
                  <p className="text-[11px] font-semibold text-rose-700 dark:text-rose-300">
                    {formError}
                  </p>
                </div>
              ) : null}

              <button
                type="button"
                onClick={register}
                disabled={submitting || !selectedDay?.registrationOpen}
                className="group w-full bg-[#0A4DA6] hover:bg-[#083D85] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-extrabold pl-5 pr-1.5 py-2 rounded-full inline-flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer"
              >
                {submitting ? (
                  <Loader2 size={14} className="animate-spin stroke-[2.5]" />
                ) : null}
                <span>{submitting ? "Reserving…" : "Confirm Free Place"}</span>
                <span className="w-6 h-6 rounded-full bg-white text-[#0A4DA6] flex items-center justify-center transition-transform group-hover:translate-x-0.5">
                  <ArrowRight size={12} className="stroke-[3]" />
                </span>
              </button>
            </>
          )}

          <div className="space-y-2 pt-1 border-t border-gray-100 dark:border-slate-800">
            {selectedDay ? (
              <p className="flex items-center gap-1.5 pt-3 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                <Clock size={12} className="text-[#0A4DA6] stroke-[2.5]" />
                Arrive by{" "}
                {arriveByTime(
                  selectedDay.startsAt,
                  event.policy?.gateOpensBeforeMinutes ?? 90,
                )}
              </p>
            ) : null}
            {event.dailyCapacity ? (
              <p className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                <Users size={12} className="text-[#0A4DA6] stroke-[2.5]" />
                {event.dailyCapacity} places each day
              </p>
            ) : null}
            <p className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400">
              <ShieldCheck size={11} className="stroke-[2.5]" />
              Verified by Tirvona
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default EventDetailPage;
