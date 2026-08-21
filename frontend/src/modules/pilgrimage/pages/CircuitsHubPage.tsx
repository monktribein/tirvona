import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  AlertCircle,
  Compass,
  Route,
  Search,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { getErrorMessage } from "../../../lib/api";
import { pilgrimageDiscoveryService } from "../services/pilgrimage.service";
import type {
  CircuitDifficulty,
  CircuitSeason,
  CircuitTypeCode,
  PilgrimageCircuit,
} from "../types/pilgrimage.types";
import CircuitCard from "../components/CircuitCard";

interface Option {
  value: string;
  label: string;
}

export const CircuitsHubPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [circuitType, setCircuitType] = useState<CircuitTypeCode | "">(
    (searchParams.get("circuitType") as CircuitTypeCode) ?? "",
  );
  const [difficulty, setDifficulty] = useState<CircuitDifficulty | "">("");
  const [season, setSeason] = useState<CircuitSeason | "">("");
  const [duration, setDuration] = useState(searchParams.get("duration") ?? "");
  const [sort, setSort] = useState(searchParams.get("sort") ?? "recommended");

  const [typeOptions, setTypeOptions] = useState<Option[]>([]);
  const [difficultyOptions, setDifficultyOptions] = useState<Option[]>([]);
  const [seasonOptions, setSeasonOptions] = useState<Option[]>([]);
  const [durationOptions, setDurationOptions] = useState<Option[]>([]);
  const [sortOptions, setSortOptions] = useState<Option[]>([
    { value: "recommended", label: "Recommended" },
  ]);

  const [results, setResults] = useState<PilgrimageCircuit[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(Number(searchParams.get("page") ?? 1));
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    pilgrimageDiscoveryService
      .getFilterOptions()
      .then((response) => {
        const data = response.data?.data ?? {};
        setTypeOptions(data.circuitTypes ?? []);
        setDifficultyOptions(data.difficulties ?? []);
        setSeasonOptions(data.seasons ?? []);
        setDurationOptions(data.durations ?? []);
        if (data.sort?.length) setSortOptions(data.sort);
      })
      .catch(() => undefined);
  }, []);

  const query = useMemo(
    () => ({
      q,
      circuitType,
      difficulty,
      season,
      duration,
      sort: sort as
        | "recommended"
        | "duration_short"
        | "duration_long"
        | "newest",
      page,
      limit: 12,
    }),
    [q, circuitType, difficulty, season, duration, sort, page],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await pilgrimageDiscoveryService.search(query);
      setResults(response.data?.data ?? []);
      setTotal(response.data?.total ?? 0);
      setTotalPages(response.data?.totalPages ?? 1);
    } catch (err) {
      setError(getErrorMessage(err, "We could not load circuits right now."));
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    const next: Record<string, string> = {};
    if (q) next.q = q;
    if (circuitType) next.circuitType = circuitType;
    if (duration) next.duration = duration;
    if (sort !== "recommended") next.sort = sort;
    if (page > 1) next.page = String(page);
    setSearchParams(next, { replace: true });
  }, [q, circuitType, duration, sort, page, setSearchParams]);

  const reset = () => {
    setQ("");
    setCircuitType("");
    setDifficulty("");
    setSeason("");
    setDuration("");
    setSort("recommended");
    setPage(1);
  };

  return (
    <div className="pb-16 lg:pb-24 overflow-x-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6">
        <div className="text-center space-y-2 max-w-3xl mx-auto py-2">
          <p className="font-['Kalam'] text-base sm:text-4xl font-bold text-[#E58C28]">
            Pilgrimage Circuits
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
            Day-by-day sacred routes mapped by the ashrams that walk them. Follow
            one as published, or turn it into your own itinerary.
          </p>
          <Link
            to="/destinations/planner"
            className="mt-2 inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#0A4DA6] hover:bg-[#083b80] text-white text-xs font-extrabold shadow-md transition-all cursor-pointer"
          >
            Open the Itinerary Planner <Route size={14} />
          </Link>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 relative z-20">
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800/80 rounded-[24px] p-3 sm:p-4 shadow-lg shadow-[#0B192C]/5">
          <div className="flex flex-col lg:flex-row lg:items-end gap-3">
            <div className="flex-1 min-w-0">
              <label
                htmlFor="circuit-search"
                className="block text-[10px] tracking-wider font-bold text-gray-400 mb-1.5 px-1"
              >
                Circuit, City or State
              </label>
              <div className="relative">
                <Search
                  size={15}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#0A4DA6] stroke-[2.5] pointer-events-none"
                />
                <input
                  id="circuit-search"
                  value={q}
                  onChange={(changeEvent) => {
                    setPage(1);
                    setQ(changeEvent.target.value);
                  }}
                  placeholder="Char Dham, Jyotirlinga, Braj…"
                  className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl pl-10 pr-3 py-2.5 text-xs font-semibold text-[#0B192C] dark:text-white placeholder:text-gray-400 placeholder:font-medium focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/30 focus:border-[#0A4DA6] transition-all"
                />
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <label
                htmlFor="circuit-type"
                className="block text-[10px] tracking-wider font-bold text-gray-400 mb-1.5 px-1"
              >
                Circuit Type
              </label>
              <div className="relative">
                <Compass
                  size={15}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#0A4DA6] stroke-[2.5] pointer-events-none"
                />
                <select
                  id="circuit-type"
                  value={circuitType}
                  onChange={(changeEvent) => {
                    setPage(1);
                    setCircuitType(
                      changeEvent.target.value as CircuitTypeCode | "",
                    );
                  }}
                  className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl pl-10 pr-3 py-2.5 text-xs font-semibold text-[#0B192C] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/30 cursor-pointer appearance-none"
                >
                  <option value="">All types</option>
                  {typeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <label
                htmlFor="circuit-duration"
                className="block text-[10px] tracking-wider font-bold text-gray-400 mb-1.5 px-1"
              >
                Trip Length
              </label>
              <div className="relative">
                <Route
                  size={15}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#0A4DA6] stroke-[2.5] pointer-events-none"
                />
                <select
                  id="circuit-duration"
                  value={duration}
                  onChange={(changeEvent) => {
                    setPage(1);
                    setDuration(changeEvent.target.value);
                  }}
                  className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl pl-10 pr-3 py-2.5 text-xs font-semibold text-[#0B192C] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/30 cursor-pointer appearance-none"
                >
                  <option value="">Any length</option>
                  {durationOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="lg:w-64 xl:w-72 shrink-0">
            <aside className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] p-4 space-y-5 shadow-sm">
              <h3 className="inline-flex items-center gap-2 font-extrabold text-sm text-[#0B192C] dark:text-white">
                <SlidersHorizontal
                  size={15}
                  className="text-[#0A4DA6] stroke-[2.5]"
                />
                Filters
              </h3>

              <div className="space-y-2">
                <label
                  htmlFor="circuit-sort"
                  className="block text-[10px] tracking-wider font-bold text-gray-400"
                >
                  Sort By
                </label>
                <select
                  id="circuit-sort"
                  value={sort}
                  onChange={(changeEvent) => {
                    setPage(1);
                    setSort(changeEvent.target.value);
                  }}
                  className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-[#0B192C] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/30 cursor-pointer"
                >
                  {sortOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2.5">
                <span className="block text-[10px] tracking-wider font-bold text-gray-400">
                  Difficulty
                </span>
                <div className="flex flex-wrap gap-2">
                  {difficultyOptions.map((option) => {
                    const active = difficulty === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          setPage(1);
                          setDifficulty(
                            active
                              ? ""
                              : (option.value as CircuitDifficulty),
                          );
                        }}
                        className={`text-[10px] font-bold px-3 py-1.5 rounded-full border transition-all cursor-pointer active:scale-95 ${
                          active
                            ? "bg-[#0A4DA6] border-[#0A4DA6] text-white shadow-sm"
                            : "bg-gray-50 dark:bg-slate-900 border-gray-100 dark:border-slate-800 text-gray-500 dark:text-gray-400 hover:border-[#0A4DA6] hover:text-[#0A4DA6]"
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2.5">
                <span className="block text-[10px] tracking-wider font-bold text-gray-400">
                  Best Season
                </span>
                <div className="flex flex-wrap gap-2">
                  {seasonOptions.map((option) => {
                    const active = season === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          setPage(1);
                          setSeason(
                            active ? "" : (option.value as CircuitSeason),
                          );
                        }}
                        className={`text-[10px] font-bold px-3 py-1.5 rounded-full border transition-all cursor-pointer active:scale-95 ${
                          active
                            ? "bg-[#0A4DA6] border-[#0A4DA6] text-white shadow-sm"
                            : "bg-gray-50 dark:bg-slate-900 border-gray-100 dark:border-slate-800 text-gray-500 dark:text-gray-400 hover:border-[#0A4DA6] hover:text-[#0A4DA6]"
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="button"
                onClick={reset}
                className="text-[10px] font-bold text-gray-400 hover:text-rose-600 transition-colors cursor-pointer"
              >
                Reset all filters
              </button>
            </aside>
          </div>

          <div className="flex-1 min-w-0 space-y-4">
            <h2 className="font-extrabold text-base sm:text-lg text-[#0B192C] dark:text-white">
              {loading
                ? "Finding circuits…"
                : `${total} circuit${total === 1 ? "" : "s"} found`}
            </h2>

            {error && (
              <div className="flex items-start gap-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 rounded-2xl px-4 py-3">
                <AlertCircle size={15} className="shrink-0 mt-0.5 stroke-[2.5]" />
                <p className="text-xs font-semibold">{error}</p>
              </div>
            )}

            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-80 bg-gray-100 dark:bg-slate-800 animate-pulse rounded-[24px]"
                  />
                ))}
              </div>
            ) : results.length === 0 ? (
              <div className="text-center py-16 px-6 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] space-y-3 shadow-sm">
                <Compass
                  size={36}
                  className="text-gray-300 dark:text-slate-700 mx-auto"
                />
                <h4 className="font-extrabold text-base text-[#0B192C] dark:text-white">
                  No circuits found
                </h4>
                <p className="text-xs text-gray-400 font-medium max-w-md mx-auto leading-relaxed">
                  Try a different type or trip length. Ashrams publish new routes
                  through the year.
                </p>
                <button
                  type="button"
                  onClick={reset}
                  className="inline-flex items-center gap-2 bg-[#0A4DA6] hover:bg-[#083D85] text-white text-xs font-extrabold px-5 py-2.5 rounded-full shadow-md transition-all active:scale-95 cursor-pointer"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {results.map((circuit, index) => (
                    <motion.div
                      key={circuit._id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: 0.3,
                        delay: Math.min(index * 0.04, 0.4),
                      }}
                    >
                      <CircuitCard circuit={circuit} />
                    </motion.div>
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-3 pt-4">
                    <button
                      type="button"
                      disabled={page <= 1}
                      onClick={() => setPage((value) => Math.max(1, value - 1))}
                      className="bg-white dark:bg-[#0B192C] border border-gray-200 dark:border-slate-700 text-[#0A4DA6] dark:text-blue-300 text-xs font-extrabold px-4 py-2 rounded-full shadow-sm transition-all active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <span className="text-[11px] font-bold text-gray-400">
                      Page {page} of {totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={page >= totalPages}
                      onClick={() => setPage((value) => value + 1)}
                      className="bg-white dark:bg-[#0B192C] border border-gray-200 dark:border-slate-700 text-[#0A4DA6] dark:text-blue-300 text-xs font-extrabold px-4 py-2 rounded-full shadow-sm transition-all active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default CircuitsHubPage;
