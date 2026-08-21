import React, { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  CalendarDays,
  Check,
  Compass,
  Loader2,
  Route,
  Save,
  Sparkles,
  Users,
} from "lucide-react";
import { getErrorMessage } from "../../../lib/api";
import { useAuth } from "../../../contexts/AuthContext";
import { toast } from "../../../lib/toast";
import {
  pilgrimageDiscoveryService,
  plannerService,
} from "../services/pilgrimage.service";
import type {
  GeneratedItinerary,
  PilgrimageCircuit,
  SavedItinerary,
} from "../types/pilgrimage.types";
import {
  formatDistance,
  formatDuration,
  toDateInputValue,
} from "../utils/pilgrimageFormat";
import CircuitDayTimeline from "../components/CircuitDayTimeline";

const PACES = [
  { value: "relaxed", label: "Relaxed" },
  { value: "balanced", label: "Balanced" },
  { value: "packed", label: "Packed" },
];

const INPUT =
  "w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl px-3.5 py-2.5 text-xs font-semibold text-[#0B192C] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/30 focus:border-[#0A4DA6] transition-all";
const LABEL =
  "mb-1.5 block px-1 text-[10px] tracking-wider font-bold text-gray-400";

export const ItineraryPlannerPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const [templates, setTemplates] = useState<PilgrimageCircuit[]>([]);
  const [circuitId, setCircuitId] = useState(searchParams.get("circuit") ?? "");
  const [startDate, setStartDate] = useState(toDateInputValue(new Date()));
  const [durationDays, setDurationDays] = useState<number | "">("");
  const [travellers, setTravellers] = useState(2);
  const [pace, setPace] = useState("balanced");

  const [itinerary, setItinerary] = useState<GeneratedItinerary | null>(null);
  const [saved, setSaved] = useState<SavedItinerary[]>([]);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    pilgrimageDiscoveryService
      .templates()
      .then((response) => {
        const rows: PilgrimageCircuit[] = response.data?.data ?? [];
        setTemplates(rows);
        if (!circuitId && rows.length) setCircuitId(rows[0].slug);
      })
      .catch(() => undefined);
    // Only seeds the picker once; the circuit query param wins if present.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSaved = useCallback(async () => {
    if (!user) return;
    try {
      const response = await plannerService.listMine(1, 10);
      setSaved(response.data?.data ?? []);
    } catch {
      setSaved([]);
    }
  }, [user]);

  useEffect(() => {
    void loadSaved();
  }, [loadSaved]);

  const generate = async () => {
    if (!circuitId) return;
    setGenerating(true);
    setError("");
    try {
      const response = await plannerService.generate({
        circuitId,
        startDate: startDate || undefined,
        durationDays: durationDays === "" ? undefined : Number(durationDays),
        travellers,
        pace,
      });
      setItinerary(response.data?.data ?? null);
    } catch (err) {
      setItinerary(null);
      setError(getErrorMessage(err, "We could not build that itinerary."));
    } finally {
      setGenerating(false);
    }
  };

  const save = async () => {
    if (!itinerary) return;
    if (!user) {
      toast.info("Please sign in to save your itinerary.");
      return;
    }
    setSaving(true);
    try {
      await plannerService.save({
        title: `${itinerary.circuit.name} — ${itinerary.durationDays} days`,
        circuitId: itinerary.circuit._id,
        startDate: startDate || undefined,
        travellers,
        pace,
        days: itinerary.days.map((day) => ({
          dayNumber: day.dayNumber,
          date: day.date ?? undefined,
          title: day.title,
          stops: day.stops.map((stop) => ({
            name: stop.name,
            stopType: stop.stopType,
            city: stop.city,
            notes: stop.notes,
            suggestedDurationMinutes: stop.suggestedDurationMinutes,
          })),
        })),
      });
      await loadSaved();
    } catch {
      // Reported by the toast interceptor.
    } finally {
      setSaving(false);
    }
  };

  const removeSaved = async (id: string) => {
    await plannerService.remove(id).catch(() => undefined);
    await loadSaved();
  };

  return (
    <div className="pb-16 lg:pb-24 overflow-x-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6">
        <div className="text-center space-y-2 max-w-3xl mx-auto py-2">
          <p className="font-['Kalam'] text-base sm:text-4xl font-bold text-[#E58C28]">
            Pilgrimage Itinerary Planner
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
            Pick a circuit published by an ashram, set your dates and pace, and
            get a day-by-day plan you can save.
          </p>
        </div>
      </div>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <div className="grid lg:grid-cols-[380px_minmax(0,1fr)] gap-6 items-start">
          <div className="space-y-4 lg:sticky lg:top-24">
            <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] p-5 shadow-lg shadow-[#0B192C]/5 space-y-4">
              <h2 className="font-extrabold text-base text-[#0B192C] dark:text-white">
                Plan your yatra
              </h2>

              <div>
                <label htmlFor="planner-circuit" className={LABEL}>
                  Circuit
                </label>
                <select
                  id="planner-circuit"
                  value={circuitId}
                  onChange={(changeEvent) =>
                    setCircuitId(changeEvent.target.value)
                  }
                  className={INPUT}
                >
                  <option value="">Choose a circuit</option>
                  {templates.map((template) => (
                    <option key={template._id} value={template.slug}>
                      {template.name} · {formatDuration(template.durationDays)}
                    </option>
                  ))}
                </select>
                {templates.length === 0 ? (
                  <p className="mt-1.5 px-1 text-[10px] font-bold text-gray-400">
                    No circuits are published yet. Once an ashram publishes one,
                    it appears here.
                  </p>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="planner-start" className={LABEL}>
                    Start date
                  </label>
                  <input
                    id="planner-start"
                    type="date"
                    value={startDate}
                    min={toDateInputValue(new Date())}
                    onChange={(changeEvent) =>
                      setStartDate(changeEvent.target.value)
                    }
                    className={INPUT}
                  />
                </div>
                <div>
                  <label htmlFor="planner-days" className={LABEL}>
                    Days available
                  </label>
                  <input
                    id="planner-days"
                    type="number"
                    min={1}
                    max={60}
                    value={durationDays}
                    placeholder="As published"
                    onChange={(changeEvent) =>
                      setDurationDays(
                        changeEvent.target.value === ""
                          ? ""
                          : Number(changeEvent.target.value),
                      )
                    }
                    className={INPUT}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="planner-travellers" className={LABEL}>
                  Travellers
                </label>
                <input
                  id="planner-travellers"
                  type="number"
                  min={1}
                  max={50}
                  value={travellers}
                  onChange={(changeEvent) =>
                    setTravellers(Number(changeEvent.target.value) || 1)
                  }
                  className={INPUT}
                />
              </div>

              <div>
                <span className={LABEL}>Pace</span>
                <div className="flex gap-2">
                  {PACES.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setPace(option.value)}
                      className={`flex-1 text-[10px] font-bold px-3 py-2 rounded-full border transition-all cursor-pointer active:scale-95 ${
                        pace === option.value
                          ? "bg-[#0A4DA6] border-[#0A4DA6] text-white shadow-sm"
                          : "bg-gray-50 dark:bg-slate-900 border-gray-100 dark:border-slate-800 text-gray-500 dark:text-gray-400 hover:border-[#0A4DA6] hover:text-[#0A4DA6]"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {error ? (
                <div className="flex items-start gap-2 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-2xl px-3 py-2.5">
                  <AlertCircle
                    size={13}
                    className="shrink-0 mt-0.5 text-rose-600 stroke-[2.5]"
                  />
                  <p className="text-[11px] font-semibold text-rose-700 dark:text-rose-300">
                    {error}
                  </p>
                </div>
              ) : null}

              <button
                type="button"
                onClick={generate}
                disabled={generating || !circuitId}
                className="w-full inline-flex items-center justify-center gap-2 bg-[#0A4DA6] hover:bg-[#083D85] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-extrabold px-5 py-3 rounded-full shadow-md transition-all active:scale-95 cursor-pointer"
              >
                {generating ? (
                  <Loader2 size={14} className="animate-spin stroke-[2.5]" />
                ) : (
                  <Route size={14} className="stroke-[2.5]" />
                )}
                {generating ? "Building…" : "Build My Itinerary"}
              </button>
            </div>

            {saved.length ? (
              <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] p-5 shadow-sm space-y-3">
                <h3 className="font-extrabold text-sm text-[#0B192C] dark:text-white">
                  Saved itineraries
                </h3>
                <div className="space-y-2">
                  {saved.map((item) => (
                    <div
                      key={item._id}
                      className="flex items-center justify-between gap-2 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-[#0B192C] dark:text-white">
                          {item.title}
                        </p>
                        <p className="text-[10px] font-bold text-gray-400">
                          {item.travellers ?? 1} traveller
                          {(item.travellers ?? 1) === 1 ? "" : "s"} · {item.pace}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeSaved(item._id)}
                        className="shrink-0 text-[10px] font-bold text-gray-400 hover:text-rose-600 transition-colors cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="min-w-0 space-y-4">
            {!itinerary ? (
              <div className="text-center py-20 px-6 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] space-y-3 shadow-sm">
                <Compass
                  size={36}
                  className="text-gray-300 dark:text-slate-700 mx-auto"
                />
                <h4 className="font-extrabold text-base text-[#0B192C] dark:text-white">
                  Your itinerary appears here
                </h4>
                <p className="text-xs text-gray-400 font-medium max-w-md mx-auto leading-relaxed">
                  Choose a circuit on the left and build a plan. You can shorten
                  it to the days you actually have.
                </p>
                <Link
                  to="/pilgrimage-circuits"
                  className="inline-flex items-center gap-2 bg-[#0A4DA6] hover:bg-[#083D85] text-white text-xs font-extrabold px-5 py-2.5 rounded-full shadow-md transition-all active:scale-95"
                >
                  Browse circuits
                </Link>
              </div>
            ) : (
              <>
                <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="font-extrabold text-lg text-[#0B192C] dark:text-white">
                        {itinerary.circuit.name}
                      </h2>
                      <div className="mt-1.5 flex flex-wrap gap-4 text-[11px] font-bold text-gray-400">
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarDays size={12} className="stroke-[2.5]" />
                          {formatDuration(itinerary.durationDays)}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <Users size={12} className="stroke-[2.5]" />
                          {itinerary.travellers} traveller
                          {itinerary.travellers === 1 ? "" : "s"}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <Route size={12} className="stroke-[2.5]" />
                          {formatDistance(itinerary.circuit.totalDistanceKm)}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={save}
                      disabled={saving}
                      className="inline-flex items-center gap-1.5 bg-[#0A4DA6] hover:bg-[#083D85] text-white text-xs font-extrabold px-4 py-2.5 rounded-full shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                    >
                      {saving ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Save size={14} />
                      )}
                      Save itinerary
                    </button>
                  </div>

                  {itinerary.shortened ? (
                    <p className="mt-3 flex items-start gap-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 rounded-2xl px-3 py-2.5 text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                      <AlertCircle
                        size={13}
                        className="mt-0.5 shrink-0 stroke-[2.5]"
                      />
                      This circuit is published as{" "}
                      {formatDuration(itinerary.circuit.durationDays)}. We have
                      compressed it into your {itinerary.durationDays} days, so
                      some stops sit closer together than the ashram intended.
                    </p>
                  ) : (
                    <p className="mt-3 flex items-center gap-2 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                      <Check size={13} className="stroke-[3]" />
                      Following the ashram&apos;s published routing
                    </p>
                  )}
                </div>

                <CircuitDayTimeline days={itinerary.days} />
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default ItineraryPlannerPage;
