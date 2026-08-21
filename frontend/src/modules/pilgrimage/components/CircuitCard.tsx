import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CalendarDays, Compass, MapPin, Route } from "lucide-react";
import type { PilgrimageCircuit } from "../types/pilgrimage.types";
import {
  difficultyLabel,
  difficultyStyle,
  formatDistance,
  formatDuration,
} from "../utils/pilgrimageFormat";

const FALLBACK_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100%25' height='100%25' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='1.5'%3E%3Crect width='100%25' height='100%25' fill='%23f1f5f9'/%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'/%3E%3Cpath d='m21 15-5-5-11 11'/%3E%3C/svg%3E";

export const CircuitCard: React.FC<{ circuit: PilgrimageCircuit }> = ({
  circuit,
}) => {
  const image = circuit.coverImage || circuit.images?.[0] || FALLBACK_IMAGE;

  return (
    <article className="group bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 flex flex-col h-full">
      <div className="relative h-44 sm:h-40 overflow-hidden shrink-0">
        <img
          src={image}
          alt={circuit.name}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={(errorEvent) => {
            errorEvent.currentTarget.onerror = null;
            errorEvent.currentTarget.src = FALLBACK_IMAGE;
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />

        <span className="absolute top-3 left-3 inline-flex items-center gap-1 bg-[#0A4DA6] text-white text-[9px] font-black tracking-wider px-2.5 py-1 rounded-full shadow-md">
          <Compass size={11} className="stroke-[2.5]" />
          {circuit.circuitTypeLabel ?? "Circuit"}
        </span>

        <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 bg-white/95 dark:bg-[#0B192C]/95 backdrop-blur-sm text-[#0B192C] dark:text-white text-[10px] font-bold px-2.5 py-1 rounded-full">
          <CalendarDays size={10} className="stroke-[2.5]" />
          {formatDuration(circuit.durationDays)}
        </span>
      </div>

      <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
        <div className="space-y-2.5">
          <div className="space-y-1">
            <h3 className="font-extrabold text-sm text-[#0B192C] dark:text-white leading-snug line-clamp-2 h-10 flex items-center">
              {circuit.name}
            </h3>
            <p className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400 font-medium truncate">
              <MapPin size={11} className="shrink-0 stroke-[2.5]" />
              <span className="truncate">
                {[circuit.startCity, circuit.state].filter(Boolean).join(", ") ||
                  "India"}
              </span>
            </p>
          </div>

          <div className="min-h-[26px] flex items-center">
            <p className="text-[10px] font-bold text-[#0A4DA6] dark:text-blue-300 bg-blue-50/70 dark:bg-slate-800 rounded-full px-2.5 py-1 inline-flex items-center gap-1 max-w-full">
              <Route size={10} className="shrink-0 stroke-[2.5]" />
              <span className="truncate">
                {circuit.stopCount ?? 0} stops ·{" "}
                {formatDistance(circuit.totalDistanceKm)}
              </span>
            </p>
          </div>

          <div className="min-h-[26px] flex items-center">
            {circuit.summary ? (
              <p className="line-clamp-2 text-[11px] font-medium text-gray-400 leading-relaxed">
                {circuit.summary}
              </p>
            ) : (
              <div className="h-[26px]" />
            )}
          </div>
        </div>

        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between gap-2">
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[9px] font-black tracking-wider ${difficultyStyle(circuit.difficulty)}`}
            >
              {difficultyLabel(circuit.difficulty)}
            </span>
            {circuit.usableAsPlannerTemplate ? (
              <span className="text-[9px] font-bold text-gray-400">
                Planner ready
              </span>
            ) : null}
          </div>

          <div className="flex items-end justify-between gap-2 pt-2">
            <div className="pt-2.5">
              <span className="block text-[9px] tracking-wider font-bold text-gray-400">
                Route
              </span>
              <span className="text-xs font-black text-[#0B192C] dark:text-white truncate max-w-[130px] block">
                {circuit.startCity || "—"}
                {circuit.endCity && circuit.endCity !== circuit.startCity
                  ? ` → ${circuit.endCity}`
                  : ""}
              </span>
            </div>

            <Link
              to={`/pilgrimage-circuits/${circuit.slug}`}
              className="mt-2.5 bg-[#0A4DA6] hover:bg-[#083D85] text-white text-[11px] font-bold pl-4 pr-1.5 py-1.5 rounded-full inline-flex items-center gap-2 shadow-md transition-all active:scale-95 shrink-0"
            >
              <span>Explore</span>
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

export default CircuitCard;
