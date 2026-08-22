import React, { useCallback, useEffect, useState } from "react";
import { useNotifications } from "../../../contexts/NotificationContext";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  MapPin,
  RefreshCw,
  Users,
  XCircle,
} from "lucide-react";
import { getErrorMessage } from "../../../lib/api";
import { eventRegistrationService } from "../services/event.service";
import type {
  EventFestival,
  EventPass,
  EventRegistration,
} from "../types/event.types";
import {
  arriveByTime,
  formatDate,
  formatDateTime,
} from "../utils/eventFormat";
import EventStatusBadge from "../components/EventStatusBadge";

export const EventPassPage: React.FC = () => {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { promptAction } = useNotifications();

  const [registration, setRegistration] = useState<EventRegistration | null>(
    null,
  );
  const [pass, setPass] = useState<EventPass | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await eventRegistrationService.get(id);
      const data: EventRegistration = response.data?.data;
      setRegistration(data);
      setError("");
      if (data.status !== "cancelled") {
        const passResponse = await eventRegistrationService
          .getPass(id)
          .catch(() => null);
        setPass(passResponse?.data?.data ?? null);
      }
    } catch (err) {
      setError(getErrorMessage(err, "We could not load this registration."));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const reissue = async () => {
    setBusy(true);
    try {
      const response = await eventRegistrationService.reissuePass(id);
      setPass(response.data?.data ?? null);
    } catch {
      // The interceptor already surfaced the failure as a toast.
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    const reason = await promptAction({
      title: "Cancel Registration",
      message: "Tell us why you are cancelling this registration.",
      placeholder: "Cancellation reason",
      confirmLabel: "Cancel registration",
      required: true,
      tone: "danger",
    });
    if (reason === null) return;
    setBusy(true);
    try {
      await eventRegistrationService.cancel(id, reason || undefined);
      await load();
    } catch {
      // Handled by the toast interceptor.
    } finally {
      setBusy(false);
    }
  };

  if (loading)
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16 space-y-5">
        <div className="h-32 bg-gray-100 dark:bg-slate-800 animate-pulse rounded-[24px]" />
        <div className="h-80 bg-gray-100 dark:bg-slate-800 animate-pulse rounded-[24px]" />
      </div>
    );

  if (error || !registration)
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-12 shadow-sm space-y-3">
          <CalendarDays
            size={36}
            className="text-gray-300 dark:text-slate-700 mx-auto"
          />
          <h4 className="font-extrabold text-base text-[#0B192C] dark:text-white">
            {error || "Registration not found"}
          </h4>
          <button
            type="button"
            onClick={() => navigate("/profile/events")}
            className="inline-flex items-center gap-2 bg-[#0A4DA6] hover:bg-[#083D85] text-white text-xs font-extrabold px-5 py-2.5 rounded-full shadow-md transition-all active:scale-95 cursor-pointer"
          >
            My event passes
          </button>
        </div>
      </div>
    );

  const festival =
    typeof registration.eventId === "object"
      ? (registration.eventId as EventFestival)
      : null;
  const cancellable = registration.status === "confirmed";

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-16 space-y-5">
      <Link
        to="/profile/events"
        className="inline-flex items-center gap-1.5 text-[11px] font-extrabold text-gray-400 hover:text-[#0A4DA6] transition-colors"
      >
        <ArrowLeft size={13} className="stroke-[3]" />
        My Event Passes
      </Link>

      <section className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-extrabold text-xl sm:text-2xl text-[#0B192C] dark:text-white leading-tight">
              {festival?.name ?? "Event registration"}
            </h1>
            <p className="mt-1 font-mono text-[11px] font-bold text-gray-400 tracking-wider">
              {registration.registrationReference}
            </p>
          </div>
          <EventStatusBadge status={registration.status} size="lg" />
        </div>

        <div className="grid sm:grid-cols-2 gap-3 pt-1">
          <p className="flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
            <CalendarDays
              size={14}
              className="shrink-0 text-[#0A4DA6] stroke-[2.5]"
            />
            {formatDate(registration.attendDate)}
          </p>
          <p className="flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
            <Clock size={14} className="shrink-0 text-[#0A4DA6] stroke-[2.5]" />
            {formatDateTime(registration.startsAt)}
          </p>
          <p className="flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
            <Users size={14} className="shrink-0 text-[#0A4DA6] stroke-[2.5]" />
            {registration.seats} place{registration.seats === 1 ? "" : "s"}
            {registration.checkedInCount
              ? ` · ${registration.checkedInCount} admitted`
              : ""}
          </p>
          {festival?.venue?.city ? (
            <p className="flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
              <MapPin
                size={14}
                className="shrink-0 text-[#0A4DA6] stroke-[2.5]"
              />
              {[festival.venue.name, festival.venue.city]
                .filter(Boolean)
                .join(", ")}
            </p>
          ) : null}
        </div>
      </section>

      {pass ? (
        <section className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] p-6 shadow-sm text-center space-y-3">
          <h2 className="font-extrabold text-base text-[#0B192C] dark:text-white">
            Your Entry Pass
          </h2>
          <p className="text-[11px] text-gray-400 font-medium">
            Show this at the gate. Arrive by{" "}
            <span className="font-extrabold text-[#0B192C] dark:text-white">
              {arriveByTime(registration.startsAt)}
            </span>
            .
          </p>

          <img
            src={pass.image}
            alt="Event entry pass QR code"
            className="mx-auto mt-2 h-56 w-56 rounded-[24px] border border-gray-100 dark:border-slate-800 bg-white p-2"
          />

          <div className="pt-1">
            <p className="text-[9px] tracking-wider font-bold text-gray-400">
              GATE CODE
            </p>
            <p className="font-mono text-2xl font-black tracking-[0.2em] text-[#0B192C] dark:text-white">
              {pass.displayCode}
            </p>
          </div>

          <p className="text-[10px] font-medium text-gray-400">
            Valid {formatDateTime(pass.validFrom)} –{" "}
            {formatDateTime(pass.validUntil)}
          </p>

          <button
            type="button"
            onClick={reissue}
            disabled={busy}
            className="mx-auto inline-flex items-center gap-1.5 bg-white dark:bg-[#0B192C] border border-gray-200 dark:border-slate-700 hover:border-[#0A4DA6] text-[#0A4DA6] dark:text-blue-300 text-[11px] font-extrabold px-4 py-2 rounded-full shadow-sm transition-all active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw
              size={12}
              className={`stroke-[2.5] ${busy ? "animate-spin" : ""}`}
            />
            Reissue Pass
          </button>
          <p className="text-[10px] font-medium text-gray-400">
            Reissuing invalidates the old QR immediately.
          </p>
        </section>
      ) : null}

      {registration.attendees?.length ? (
        <section className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] p-5 sm:p-6 shadow-sm space-y-3">
          <h2 className="font-extrabold text-base text-[#0B192C] dark:text-white">
            Attendees
          </h2>
          <div className="flex flex-wrap gap-2">
            {registration.attendees.map((attendee, index) => (
              <span
                key={`${attendee.name}-${index}`}
                className="bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-full px-3 py-1.5 text-[11px] font-bold text-gray-600 dark:text-gray-300"
              >
                {attendee.name}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {cancellable ? (
        <section className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] p-5 sm:p-6 shadow-sm space-y-3">
          <h2 className="font-extrabold text-base text-[#0B192C] dark:text-white">
            Cancel this registration
          </h2>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 leading-relaxed">
            Entry is free, so nothing is refunded — but cancelling releases your
            place for another devotee.
          </p>
          <button
            type="button"
            onClick={cancel}
            disabled={busy}
            className="inline-flex items-center gap-1.5 bg-white dark:bg-[#0B192C] border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-extrabold px-4 py-2.5 rounded-full shadow-sm transition-all active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <XCircle size={14} className="stroke-[2.5]" />
            Cancel Registration
          </button>
        </section>
      ) : null}
    </div>
  );
};

export default EventPassPage;
