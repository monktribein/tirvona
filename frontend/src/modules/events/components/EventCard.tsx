import React from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CalendarDays,
  Clock,
  MapPin,
  Sparkles,
  Users,
} from "lucide-react";
import type { EventFestival } from "../types/event.types";
import {
  facilityLabel,
  formatClock,
  formatDateRange,
} from "../utils/eventFormat";

const FALLBACK_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100%25' height='100%25' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='1.5'%3E%3Crect width='100%25' height='100%25' fill='%23f1f5f9'/%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'/%3E%3Cpath d='m21 15-5-5-11 11'/%3E%3C/svg%3E";

export const EventCard: React.FC<{ event: EventFestival }> = ({ event }) => {
  const image = event.coverImage || event.images?.[0] || FALLBACK_IMAGE;
  const facilities = (event.facilities ?? []).slice(0, 3);

  return (
    <article className="group bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 flex flex-col h-full">
      <div className="relative h-44 sm:h-40 overflow-hidden shrink-0">
        <img
          src={image}
          alt={event.name}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={(errorEvent) => {
            errorEvent.currentTarget.onerror = null;
            errorEvent.currentTarget.src = FALLBACK_IMAGE;
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />

        <span className="absolute top-3 left-3 inline-flex items-center gap-1 bg-[#0A4DA6] text-white text-[9px] font-black tracking-wider px-2.5 py-1 rounded-full shadow-md">
          <Sparkles size={11} className="stroke-[2.5]" />
          {event.eventTypeLabel ?? "Event"}
        </span>

        {event.isOnNow ? (
          <span className="absolute top-3 right-3 inline-flex items-center gap-1 bg-emerald-600 text-white text-[9px] font-black tracking-wider px-2.5 py-1 rounded-full shadow-md">
            ON NOW
          </span>
        ) : null}

        <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 bg-white/95 dark:bg-[#0B192C]/95 backdrop-blur-sm text-[#0B192C] dark:text-white text-[10px] font-bold px-2.5 py-1 rounded-full">
          <CalendarDays size={10} className="stroke-[2.5]" />
          {formatDateRange(event.startDate, event.endDate)}
        </span>
      </div>

      <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
        <div className="space-y-2.5">
          <div className="space-y-1">
            <h3 className="font-extrabold text-sm text-[#0B192C] dark:text-white leading-snug line-clamp-2 h-10 flex items-center">
              {event.name}
            </h3>
            <p className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400 font-medium truncate">
              <MapPin size={11} className="shrink-0 stroke-[2.5]" />
              <span className="truncate">
                {[event.venue?.name, event.venue?.city]
                  .filter(Boolean)
                  .join(", ") || "India"}
              </span>
            </p>
          </div>

          <div className="min-h-[26px] flex items-center">
            <p className="text-[10px] font-bold text-[#0A4DA6] dark:text-blue-300 bg-blue-50/70 dark:bg-slate-800 rounded-full px-2.5 py-1 inline-flex items-center gap-1 max-w-full">
              <Clock size={10} className="shrink-0 stroke-[2.5]" />
              <span className="truncate">
                {formatClock(event.startTime)}
                {event.dayCount && event.dayCount > 1
                  ? ` · ${event.dayCount} days`
                  : ""}
              </span>
            </p>
          </div>

          <div className="min-h-[26px] flex items-center">
            {facilities.length ? (
              <div className="flex flex-wrap gap-1.5">
                {facilities.map((facility) => (
                  <span
                    key={facility}
                    className="text-[9px] font-bold text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-slate-800 rounded-full px-2 py-0.5"
                  >
                    {facilityLabel(facility)}
                  </span>
                ))}
              </div>
            ) : (
              <div className="h-[26px]" />
            )}
          </div>
        </div>

        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between gap-2 text-[10px] font-bold">
            <span className="inline-flex items-center gap-1 text-gray-500 dark:text-gray-400">
              <Users size={11} className="stroke-[2.5]" />
              {event.requiresRegistration === false
                ? "Open to all"
                : event.dailyCapacity
                  ? `${event.dailyCapacity} places a day`
                  : "Registration open"}
            </span>
          </div>

          <div className="flex items-end justify-between gap-2 pt-2">
            <div className="pt-2.5">
              <span className="block text-[9px] tracking-wider font-bold text-gray-400">
                Entry
              </span>
              <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
                Free
              </span>
            </div>

            <Link
              to={`/events/${event.slug}`}
              className="mt-2.5 bg-[#0A4DA6] hover:bg-[#083D85] text-white text-[11px] font-bold pl-4 pr-1.5 py-1.5 rounded-full inline-flex items-center gap-2 shadow-md transition-all active:scale-95 shrink-0"
            >
              <span>
                {event.requiresRegistration === false ? "View" : "Register"}
              </span>
              <span className="w-5 h-5 rounded-full bg-white text-[#0A4DA6] flex items-center justify-center transition-transform group-hover:translate-x-0.5">
                <ArrowRight size={11} className="stroke-[3]" />
              </span>
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
};

export default EventCard;
