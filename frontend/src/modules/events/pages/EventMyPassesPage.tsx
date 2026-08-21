import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  Clock,
  Sparkles,
  Users,
} from "lucide-react";
import { getErrorMessage } from "../../../lib/api";
import { eventRegistrationService } from "../services/event.service";
import type { EventFestival, EventRegistration } from "../types/event.types";
import { formatDate, formatDateTime } from "../utils/eventFormat";
import EventStatusBadge from "../components/EventStatusBadge";

const TABS = [
  { value: "", label: "All" },
  { value: "confirmed", label: "Confirmed" },
  { value: "checked_in", label: "Admitted" },
  { value: "attended", label: "Attended" },
  { value: "cancelled", label: "Cancelled" },
];

export const EventMyPassesPage: React.FC = () => {
  const [status, setStatus] = useState("");
  const [registrations, setRegistrations] = useState<EventRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await eventRegistrationService.list({
        status: status || undefined,
        limit: 50,
      });
      setRegistrations(response.data?.data ?? []);
    } catch (err) {
      setError(getErrorMessage(err, "We could not load your event passes."));
      setRegistrations([]);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="pb-16 lg:pb-24 overflow-x-hidden">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6">
        <div className="text-center space-y-2 max-w-3xl mx-auto py-2">
          <p className="font-['Kalam'] text-base sm:text-4xl font-bold text-[#E58C28]">
            My Event Passes
          </p>
          <div className="flex items-center justify-center gap-2.5 my-1.5">
            <div className="h-[1.5px] w-12 sm:w-24 bg-[#E58C28] rounded-full" />
            <Sparkles
              size={14}
              className="text-[#E58C28] fill-[#E58C28] shrink-0"
            />
            <div className="h-[1.5px] w-12 sm:w-24 bg-[#E58C28] rounded-full" />
          </div>
          <p className="text-xs sm:text-sm font-bold text-[#0B192C] dark:text-gray-200 max-w-xl mx-auto leading-relaxed">
            Your festival registrations and gate codes in one place.
          </p>
        </div>
      </div>

      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 space-y-5">
        <div className="flex flex-wrap gap-2">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setStatus(tab.value)}
              className={`text-[11px] font-extrabold px-4 py-2 rounded-full border transition-all cursor-pointer active:scale-95 ${
                status === tab.value
                  ? "bg-[#0A4DA6] border-[#0A4DA6] text-white shadow-md"
                  : "bg-white dark:bg-[#0B192C] border-gray-200 dark:border-slate-700 text-gray-500 dark:text-gray-400 hover:border-[#0A4DA6] hover:text-[#0A4DA6]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {error ? (
          <div className="flex items-start gap-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 rounded-2xl px-4 py-3">
            <AlertCircle size={15} className="shrink-0 mt-0.5 stroke-[2.5]" />
            <p className="text-xs font-semibold">{error}</p>
          </div>
        ) : loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="h-28 bg-gray-100 dark:bg-slate-800 animate-pulse rounded-[24px]"
              />
            ))}
          </div>
        ) : registrations.length === 0 ? (
          <div className="text-center py-16 px-6 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] space-y-3 shadow-sm">
            <CalendarDays
              size={36}
              className="text-gray-300 dark:text-slate-700 mx-auto"
            />
            <h4 className="font-extrabold text-base text-[#0B192C] dark:text-white">
              No event passes yet
            </h4>
            <p className="text-xs text-gray-400 font-medium max-w-md mx-auto leading-relaxed">
              Register for a festival and your QR pass will appear here.
            </p>
            <Link
              to="/events"
              className="inline-flex items-center gap-2 bg-[#0A4DA6] hover:bg-[#083D85] text-white text-xs font-extrabold px-5 py-2.5 rounded-full shadow-md transition-all active:scale-95"
            >
              Browse Events
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {registrations.map((registration) => {
              const festival =
                typeof registration.eventId === "object"
                  ? (registration.eventId as EventFestival)
                  : null;
              return (
                <Link
                  key={registration._id}
                  to={`/events/pass/${registration._id}`}
                  className="group flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] p-4 sm:p-5 shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300"
                >
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-extrabold text-sm text-[#0B192C] dark:text-white truncate">
                        {festival?.name ?? "Event"}
                      </h3>
                      <EventStatusBadge status={registration.status} size="sm" />
                    </div>
                    <p className="font-mono text-[10px] font-bold text-gray-400 tracking-wider">
                      {registration.registrationReference}
                    </p>
                    <div className="flex flex-wrap gap-4 text-[11px] font-medium text-gray-500 dark:text-gray-400 pt-0.5">
                      <span className="inline-flex items-center gap-1.5">
                        <Clock size={11} className="stroke-[2.5]" />
                        {formatDateTime(registration.startsAt)}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Users size={11} className="stroke-[2.5]" />
                        {registration.seats} place
                        {registration.seats === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      <span className="block text-[9px] tracking-wider font-bold text-gray-400">
                        Attending
                      </span>
                      <span className="text-sm font-black text-[#0B192C] dark:text-white">
                        {formatDate(registration.attendDate)}
                      </span>
                    </div>
                    <span className="w-8 h-8 rounded-full bg-[#0A4DA6] text-white flex items-center justify-center shadow-md transition-transform group-hover:translate-x-0.5">
                      <ArrowRight size={13} className="stroke-[3]" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export default EventMyPassesPage;
