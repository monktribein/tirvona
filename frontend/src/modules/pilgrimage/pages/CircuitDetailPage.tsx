import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Compass,
  MapPin,
  Mountain,
  Route,
  Sun,
} from "lucide-react";
import { getErrorMessage } from "../../../lib/api";
import { pilgrimageDiscoveryService } from "../services/pilgrimage.service";
import type { PilgrimageCircuit } from "../types/pilgrimage.types";
import {
  difficultyLabel,
  difficultyStyle,
  formatDistance,
  formatDuration,
  seasonLabel,
} from "../utils/pilgrimageFormat";
import CircuitDayTimeline from "../components/CircuitDayTimeline";

const FALLBACK_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100%25' height='100%25' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='1.5'%3E%3Crect width='100%25' height='100%25' fill='%23f1f5f9'/%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'/%3E%3Cpath d='m21 15-5-5-11 11'/%3E%3C/svg%3E";

const Stat: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
}> = ({ icon, label, value }) => (
  <div className="bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl px-3 py-3 text-center">
    <span className="text-[#0A4DA6] flex justify-center">{icon}</span>
    <p className="mt-1.5 text-sm font-black text-[#0B192C] dark:text-white">
      {value}
    </p>
    <p className="text-[9px] tracking-wider font-bold text-gray-400">{label}</p>
  </div>
);

export const CircuitDetailPage: React.FC = () => {
  // Destinations are addressed by city; the legacy :slug param maps straight on.
  const { city, slug: legacySlug } = useParams();
  const slug = city || legacySlug || "";
  const navigate = useNavigate();

  const [circuit, setCircuit] = useState<PilgrimageCircuit | null>(null);
  const [activeImage, setActiveImage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await pilgrimageDiscoveryService.getDetail(slug);
      setCircuit(response.data?.data ?? null);
      setError("");
    } catch (err) {
      setError(getErrorMessage(err, "We could not load this circuit."));
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading)
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16 space-y-6">
        <div className="h-10 w-2/3 mx-auto bg-gray-100 dark:bg-slate-800 animate-pulse rounded-full" />
        <div className="aspect-video w-full bg-gray-100 dark:bg-slate-800 animate-pulse rounded-[24px]" />
        <div className="h-72 bg-gray-100 dark:bg-slate-800 animate-pulse rounded-[24px]" />
      </div>
    );

  if (error || !circuit)
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-12 shadow-sm space-y-3">
          <Compass size={36} className="text-gray-300 dark:text-slate-700 mx-auto" />
          <h4 className="font-extrabold text-base text-[#0B192C] dark:text-white">
            {error || "Circuit not found"}
          </h4>
          <button
            type="button"
            onClick={() => navigate("/pilgrimage-circuits")}
            className="inline-flex items-center gap-2 bg-[#0A4DA6] hover:bg-[#083D85] text-white text-xs font-extrabold px-5 py-2.5 rounded-full shadow-md transition-all active:scale-95 cursor-pointer"
          >
            Browse all circuits
          </button>
        </div>
      </div>
    );

  const gallery = [circuit.coverImage, ...(circuit.images ?? [])].filter(
    Boolean,
  ) as string[];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-2 pb-16 space-y-10">
      <div className="flex flex-col items-center text-center gap-3 pb-4">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="px-3 py-1 bg-[#0A4DA6] text-white text-[9px] font-extrabold rounded-full flex items-center gap-1 shadow-sm tracking-wider">
            <Compass size={12} /> {circuit.circuitTypeLabel ?? "Circuit"}
          </span>
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[9px] font-black tracking-wider ${difficultyStyle(circuit.difficulty)}`}
          >
            {difficultyLabel(circuit.difficulty)}
          </span>
        </div>

        <h2 className="text-3xl md:text-5xl font-extrabold text-[#0B192C] dark:text-white leading-tight">
          {circuit.name}
        </h2>

        {circuit.summary ? (
          <p className="max-w-2xl text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 leading-relaxed">
            {circuit.summary}
          </p>
        ) : null}

        <p className="text-xs text-gray-500 flex items-center justify-center gap-1">
          <MapPin size={12} className="text-[#0A4DA6]" />
          {circuit.startCity || "—"}
          {circuit.endCity && circuit.endCity !== circuit.startCity
            ? ` → ${circuit.endCity}`
            : ""}
          {circuit.state ? `, ${circuit.state}` : ""}
        </p>
      </div>

      {gallery.length ? (
        <div className="space-y-3 -mt-4">
          <div className="relative w-full aspect-video rounded-[24px] overflow-hidden shadow-sm bg-gray-100 dark:bg-slate-900">
            <AnimatePresence mode="wait">
              <motion.img
                key={activeImage}
                src={gallery[activeImage] || FALLBACK_IMAGE}
                alt={circuit.name}
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
          {circuit.description ? (
            <section className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] p-5 sm:p-6 shadow-sm space-y-3">
              <h3 className="font-extrabold text-base text-[#0B192C] dark:text-white">
                About this circuit
              </h3>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-medium leading-relaxed whitespace-pre-line">
                {circuit.description}
              </p>
              {circuit.highlights?.length ? (
                <div className="grid sm:grid-cols-2 gap-2.5 pt-1">
                  {circuit.highlights.map((highlight) => (
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

          <section className="space-y-4">
            <h3 className="font-extrabold text-base sm:text-lg text-[#0B192C] dark:text-white inline-flex items-center gap-2">
              <Route size={18} className="text-[#E58C28] stroke-[2.5]" />
              The route, day by day
            </h3>
            {circuit.days?.length ? (
              <CircuitDayTimeline days={circuit.days} />
            ) : (
              <div className="bg-white dark:bg-[#0B192C] border border-dashed border-gray-200 dark:border-slate-800 rounded-[24px] p-10 text-center">
                <p className="text-xs font-medium text-gray-400">
                  The stops for this circuit have not been published yet.
                </p>
              </div>
            )}
          </section>

          {circuit.travelTips ? (
            <section className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] p-5 sm:p-6 shadow-sm space-y-3">
              <h3 className="font-extrabold text-base text-[#0B192C] dark:text-white">
                Travel tips
              </h3>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-medium leading-relaxed whitespace-pre-line">
                {circuit.travelTips}
              </p>
            </section>
          ) : null}
        </div>

        <aside className="lg:sticky lg:top-24 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] p-5 shadow-lg shadow-[#0B192C]/5 space-y-4">
          <h3 className="font-extrabold text-base text-[#0B192C] dark:text-white">
            At a glance
          </h3>

          <div className="grid grid-cols-3 gap-2">
            <Stat
              icon={<CalendarDays size={15} className="stroke-[2.5]" />}
              label="DURATION"
              value={formatDuration(circuit.durationDays)}
            />
            <Stat
              icon={<MapPin size={15} className="stroke-[2.5]" />}
              label="STOPS"
              value={String(circuit.stopCount ?? 0)}
            />
            <Stat
              icon={<Mountain size={15} className="stroke-[2.5]" />}
              label="DISTANCE"
              value={formatDistance(circuit.totalDistanceKm)}
            />
          </div>

          {circuit.bestSeasons?.length ? (
            <div className="space-y-2">
              <span className="block text-[10px] tracking-wider font-bold text-gray-400 px-1">
                Best Season
              </span>
              <div className="flex flex-wrap gap-2">
                {circuit.bestSeasons.map((value) => (
                  <span
                    key={value}
                    className="inline-flex items-center gap-1 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-full px-2.5 py-1 text-[10px] font-bold text-gray-500 dark:text-gray-400"
                  >
                    <Sun size={10} className="stroke-[2.5]" />
                    {seasonLabel(value)}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {circuit.idealFor?.length ? (
            <div className="space-y-2">
              <span className="block text-[10px] tracking-wider font-bold text-gray-400 px-1">
                Ideal For
              </span>
              <div className="flex flex-wrap gap-2">
                {circuit.idealFor.map((value) => (
                  <span
                    key={value}
                    className="bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-full px-2.5 py-1 text-[10px] font-bold text-gray-500 dark:text-gray-400"
                  >
                    {value}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {circuit.usableAsPlannerTemplate ? (
            <Link
              to={`/destinations/planner?circuit=${circuit.slug}`}
              className="group w-full bg-[#0A4DA6] hover:bg-[#083D85] text-white text-xs font-extrabold pl-5 pr-1.5 py-2 rounded-full inline-flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <span>Plan My Trip</span>
              <span className="w-6 h-6 rounded-full bg-white text-[#0A4DA6] flex items-center justify-center transition-transform group-hover:translate-x-0.5">
                <ArrowRight size={12} className="stroke-[3]" />
              </span>
            </Link>
          ) : (
            <p className="text-center text-[10px] font-bold text-gray-400 leading-relaxed">
              This circuit is published for reference and is not available in the
              planner.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
};

export default CircuitDetailPage;
