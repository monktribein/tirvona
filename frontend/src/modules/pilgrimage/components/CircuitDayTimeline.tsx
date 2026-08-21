import React from "react";
import { Clock, MapPin, Moon, Navigation } from "lucide-react";
import type { CircuitDay } from "../types/pilgrimage.types";
import {
  formatDate,
  formatDistance,
  formatMinutes,
  stopTypeLabel,
} from "../utils/pilgrimageFormat";

/**
 * The day-by-day route, rendered as a vertical timeline. Days with no stops are
 * kept and labelled as rest days rather than hidden, so a 7-day circuit always
 * reads as seven days.
 */
export const CircuitDayTimeline: React.FC<{ days: CircuitDay[] }> = ({
  days,
}) => (
  <div className="space-y-4">
    {days.map((day) => (
      <div
        key={day.dayNumber}
        className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] p-5 shadow-sm"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-gray-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 shrink-0 rounded-2xl bg-[#0A4DA6]/10 text-[#0A4DA6] text-xs font-black flex items-center justify-center border border-[#0A4DA6]/15">
              {day.dayNumber}
            </span>
            <div className="min-w-0">
              <p className="font-extrabold text-sm text-[#0B192C] dark:text-white">
                {day.title || `Day ${day.dayNumber}`}
              </p>
              {day.date ? (
                <p className="text-[10px] font-bold text-gray-400">
                  {formatDate(day.date)}
                </p>
              ) : null}
            </div>
          </div>
          {day.distanceKm ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-gray-400">
              <Navigation size={11} className="stroke-[2.5]" />
              {formatDistance(day.distanceKm)}
            </span>
          ) : null}
        </div>

        {day.stops.length === 0 ? (
          <p className="pt-4 text-[11px] font-medium text-gray-400">
            A rest day — no stops scheduled.
          </p>
        ) : (
          <ol className="pt-4 space-y-3">
            {day.stops.map((stop, index) => (
              <li key={stop._id ?? `${day.dayNumber}-${index}`} className="flex gap-3">
                <div className="flex flex-col items-center shrink-0">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#E58C28] mt-1.5" />
                  {index < day.stops.length - 1 ? (
                    <span className="w-px flex-1 bg-gray-200 dark:bg-slate-700 mt-1" />
                  ) : null}
                </div>

                <div className="min-w-0 pb-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold text-xs text-[#0B192C] dark:text-white">
                      {stop.name}
                    </p>
                    <span className="bg-gray-50 dark:bg-slate-800 text-gray-500 dark:text-gray-400 text-[9px] font-bold px-2 py-0.5 rounded-full">
                      {stopTypeLabel(stop.stopType)}
                    </span>
                    {stop.isOvernightStop ? (
                      <span className="inline-flex items-center gap-1 bg-blue-50 dark:bg-slate-800 text-[#0A4DA6] dark:text-blue-300 text-[9px] font-bold px-2 py-0.5 rounded-full">
                        <Moon size={9} className="stroke-[2.5]" /> Overnight
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-1 flex flex-wrap gap-3 text-[10px] font-bold text-gray-400">
                    {stop.city ? (
                      <span className="inline-flex items-center gap-1">
                        <MapPin size={10} className="stroke-[2.5]" />
                        {stop.city}
                      </span>
                    ) : null}
                    {stop.suggestedDurationMinutes ? (
                      <span className="inline-flex items-center gap-1">
                        <Clock size={10} className="stroke-[2.5]" />
                        {formatMinutes(stop.suggestedDurationMinutes)}
                      </span>
                    ) : null}
                    {stop.distanceFromPreviousKm ? (
                      <span className="inline-flex items-center gap-1">
                        <Navigation size={10} className="stroke-[2.5]" />
                        {formatDistance(stop.distanceFromPreviousKm)} from
                        previous
                      </span>
                    ) : null}
                  </div>

                  {stop.notes ? (
                    <p className="mt-1.5 text-[11px] font-medium text-gray-500 dark:text-gray-400 leading-relaxed">
                      {stop.notes}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    ))}
  </div>
);

export default CircuitDayTimeline;
