import React from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CalendarClock,
  Clock,
  Flame,
  MapPin,
  Star,
  Users,
} from "lucide-react";
import type { AartiSession } from "../types/aarti.types";
import {
  facilityLabel,
  formatClock,
  formatCurrency,
  formatSchedule,
} from "../utils/aartiFormat";

const FALLBACK_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100%25' height='100%25' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='1.5'%3E%3Crect width='100%25' height='100%25' fill='%23f1f5f9'/%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'/%3E%3Cpath d='m21 15-5-5-11 11'/%3E%3C/svg%3E";

interface AartiCardProps {
  session: AartiSession;
  query?: string;
  compact?: boolean;
}

export const AartiCard: React.FC<AartiCardProps> = ({
  session,
  query = "",
  compact = false,
}) => {
  const image = session.coverImage || session.images?.[0] || FALLBACK_IMAGE;
  const facilities = (session.facilities ?? []).slice(0, 3);
  const nextDate = session.nextOccurrence
    ? new Date(session.nextOccurrence).toLocaleDateString(undefined, {
        day: "2-digit",
        month: "short",
      })
    : null;

  if (compact) {
    return (
      <Link
        to={`/aarti/${session.slug}${query}`}
        aria-label={`View ${session.name}`}
        className="group block w-full bg-white dark:bg-[#0B192C] rounded-3xl overflow-hidden border border-gray-100 dark:border-slate-800 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
      >
        <div
          className="relative overflow-hidden bg-gray-100 dark:bg-slate-900"
          style={{ height: "clamp(170px, 40vw, 190px)" }}
        >
          <img
            src={image}
            alt={session.name}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={(event) => {
              event.currentTarget.onerror = null;
              event.currentTarget.src = FALLBACK_IMAGE;
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
          <span className="absolute top-3 left-3 inline-flex items-center gap-1 bg-[#0A4DA6] text-white text-[9px] font-black tracking-wider px-2.5 py-1 rounded-full">
            <Flame size={11} className="stroke-[2.5]" />
            {session.kindLabel ?? "Aarti"}
          </span>
          {nextDate ? (
            <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 bg-white/95 text-[#0B192C] text-[9px] font-bold px-2 py-1 rounded-full">
              <CalendarClock size={10} /> Next {nextDate}
            </span>
          ) : null}
        </div>

        <div className="p-4 text-center flex min-h-[72px] flex-col items-center justify-center">
          <h3 className="w-full truncate font-extrabold text-sm sm:text-base text-[#0B192C] dark:text-white leading-tight">
            {session.name}
          </h3>
          <p className="mt-1 flex max-w-full items-center justify-center gap-1 text-[11px] text-gray-400 font-bold">
            <MapPin size={10} className="shrink-0" />
            <span className="truncate">
              {[session.venue?.name, session.venue?.city]
                .filter(Boolean)
                .join(", ") || "India"}
            </span>
          </p>
        </div>
      </Link>
    );
  }

  return (
    <article className="group bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 flex flex-col h-full">
      <div className="relative h-44 sm:h-40 overflow-hidden shrink-0">
        <img
          src={image}
          alt={session.name}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={(event) => {
            event.currentTarget.onerror = null;
            event.currentTarget.src = FALLBACK_IMAGE;
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />

        <span className="absolute top-3 left-3 inline-flex items-center gap-1 bg-[#0A4DA6] text-white text-[9px] font-black tracking-wider px-2.5 py-1 rounded-full shadow-md">
          <Flame size={11} className="stroke-[2.5]" />
          {session.kindLabel ?? "Aarti"}
        </span>

        {session.rating?.count ? (
          <span className="absolute top-3 right-3 inline-flex items-center gap-1 bg-white/95 dark:bg-[#0B192C]/95 backdrop-blur-sm text-[#0B192C] dark:text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow-md">
            <Star size={11} className="fill-[#D4AF37] text-[#D4AF37]" />
            {session.rating.average.toFixed(1)}
          </span>
        ) : null}

        {nextDate ? (
          <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 bg-white/95 dark:bg-[#0B192C]/95 backdrop-blur-sm text-[#0B192C] dark:text-white text-[10px] font-bold px-2.5 py-1 rounded-full">
            <CalendarClock size={10} className="stroke-[2.5]" />
            Next {nextDate}
          </span>
        ) : null}
      </div>

      <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
        <div className="space-y-2.5">
          <div className="space-y-1">
            <h3 className="font-extrabold text-sm text-[#0B192C] dark:text-white leading-snug line-clamp-2 h-10 flex items-center">
              {session.name}
            </h3>
            <p className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400 font-medium truncate">
              <MapPin size={11} className="shrink-0 stroke-[2.5]" />
              <span className="truncate">
                {[session.venue?.name, session.venue?.city]
                  .filter(Boolean)
                  .join(", ") || "India"}
              </span>
            </p>
          </div>

          <div className="min-h-[26px] flex items-center">
            <p className="text-[10px] font-bold text-[#0A4DA6] dark:text-blue-300 bg-blue-50/70 dark:bg-slate-800 rounded-full px-2.5 py-1 inline-flex items-center gap-1 max-w-full">
              <Clock size={10} className="shrink-0 stroke-[2.5]" />
              <span className="truncate">
                {formatClock(session.startTime)} ·{" "}
                {formatSchedule(session.daysOfWeek)}
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
              {session.totalCapacity
                ? `${session.totalCapacity} seats`
                : "Limited seats"}
            </span>
            {session.isFeatured ? (
              <span className="inline-flex items-center gap-1 text-[#D4AF37]">
                <Star size={11} className="fill-[#D4AF37] stroke-[2.5]" />
                Featured
              </span>
            ) : null}
          </div>

          <div className="flex items-end justify-between gap-2 pt-2">
            <div className="pt-2.5">
              {session.fromPrice != null ? (
                <>
                  <span className="block text-[9px] tracking-wider font-bold text-gray-400">
                    From
                  </span>
                  <span className="text-base font-black text-[#0B192C] dark:text-white">
                    {formatCurrency(session.fromPrice)}
                  </span>
                </>
              ) : (
                <span className="text-[10px] font-bold text-gray-400">
                  Tap to see passes
                </span>
              )}
            </div>

            <Link
              to={`/aarti/${session.slug}${query}`}
              className="mt-2.5 bg-[#0A4DA6] hover:bg-[#083D85] text-white text-[11px] font-bold pl-4 pr-1.5 py-1.5 rounded-full inline-flex items-center gap-2 shadow-md transition-all active:scale-95 shrink-0"
            >
              <span>Book</span>
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

export default AartiCard;
