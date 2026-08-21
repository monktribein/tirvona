import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { AlertCircle, Flame, Sparkles } from "lucide-react";
import { getErrorMessage } from "../../../lib/api";
import { aartiDiscoveryService } from "../services/aarti.service";
import type {
  AartiFacility,
  AartiKind,
  AartiSession,
} from "../types/aarti.types";
import { toDateInputValue } from "../utils/aartiFormat";
import AartiCard from "../components/AartiCard";
import AartiSearchBar from "../components/AartiSearchBar";
import AartiFilterPanel from "../components/AartiFilterPanel";

interface Option {
  value: string;
  label: string;
}

export const AartiHubPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const today = useMemo(() => toDateInputValue(new Date()), []);

  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [city, setCity] = useState(searchParams.get("city") ?? "");
  const [kind, setKind] = useState<AartiKind | "">(
    (searchParams.get("kind") as AartiKind) ?? "",
  );
  const [date, setDate] = useState(searchParams.get("date") ?? today);
  const [facilities, setFacilities] = useState<string[]>([]);
  const [sort, setSort] = useState(searchParams.get("sort") ?? "recommended");

  const [kindOptions, setKindOptions] = useState<Option[]>([]);
  const [facilityOptions, setFacilityOptions] = useState<Option[]>([]);
  const [sortOptions, setSortOptions] = useState<Option[]>([
    { value: "recommended", label: "Recommended" },
  ]);
  const [cityOptions, setCityOptions] = useState<
    { city: string; state?: string; count: number }[]
  >([]);

  const [results, setResults] = useState<AartiSession[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(Number(searchParams.get("page") ?? 1));
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      aartiDiscoveryService.getFilterOptions(),
      aartiDiscoveryService.getCities(),
    ])
      .then(([filters, cities]) => {
        if (cancelled) return;
        const data = filters.data?.data ?? {};
        setKindOptions(data.kinds ?? []);
        setFacilityOptions(data.facilities ?? []);
        if (data.sort?.length) setSortOptions(data.sort);
        setCityOptions(cities.data?.data ?? []);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const query = useMemo(
    () => ({
      q,
      city,
      kind,
      date,
      facilities: facilities as AartiFacility[],
      sort: sort as "recommended" | "price_low" | "price_high" | "rating",
      page,
      limit: 12,
    }),
    [q, city, kind, date, facilities, sort, page],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await aartiDiscoveryService.search(query);
      setResults(response.data?.data ?? []);
      setTotal(response.data?.total ?? 0);
      setTotalPages(response.data?.totalPages ?? 1);
    } catch (err) {
      setError(getErrorMessage(err, "We could not load aartis right now."));
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
    if (city) next.city = city;
    if (kind) next.kind = kind;
    if (date && date !== today) next.date = date;
    if (sort !== "recommended") next.sort = sort;
    if (page > 1) next.page = String(page);
    setSearchParams(next, { replace: true });
  }, [q, city, kind, date, sort, page, today, setSearchParams]);

  const handleSearchChange = (patch: {
    q?: string;
    city?: string;
    date?: string;
    kind?: string;
  }) => {
    setPage(1);
    if (patch.q !== undefined) setQ(patch.q);
    if (patch.city !== undefined) setCity(patch.city);
    if (patch.date !== undefined) setDate(patch.date);
    if (patch.kind !== undefined) setKind(patch.kind as AartiKind | "");
  };

  const handleFilterChange = (patch: {
    facilities?: string[];
    sort?: string;
  }) => {
    setPage(1);
    if (patch.facilities) setFacilities(patch.facilities);
    if (patch.sort) setSort(patch.sort);
  };

  const resetFilters = () => {
    setFacilities([]);
    setSort("recommended");
    setPage(1);
  };

  const detailQuery = date ? `?date=${date}` : "";

  return (
    <div className="pb-16 lg:pb-24 overflow-x-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6">
        <div className="text-center space-y-2 max-w-3xl mx-auto py-2">
          <p className="font-['Kalam'] text-base sm:text-4xl font-bold text-[#E58C28]">
            Sacred Aarti Booking
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
            Ganga Aarti, Bhasma Aarti, Mangala Aarti and more. Reserve a verified
            pass issued by the ashram and walk in with a single QR scan.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 relative z-20">
        <AartiSearchBar
          q={q}
          city={city}
          date={date}
          kind={kind}
          cityOptions={cityOptions}
          kindOptions={kindOptions}
          minDate={today}
          loading={loading}
          onChange={handleSearchChange}
          onSubmit={load}
        />
      </div>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="lg:w-64 xl:w-72 shrink-0">
            <AartiFilterPanel
              facilityOptions={facilityOptions}
              selectedFacilities={facilities}
              sort={sort}
              sortOptions={sortOptions}
              onChange={handleFilterChange}
              onReset={resetFilters}
            />
          </div>

          <div className="flex-1 min-w-0 space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h2 className="font-extrabold text-base sm:text-lg text-[#0B192C] dark:text-white">
                {loading
                  ? "Finding aartis…"
                  : `${total} aarti ${total === 1 ? "option" : "options"}`}
              </h2>
            </div>

            {error && (
              <div className="flex items-start gap-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 rounded-2xl px-4 py-3">
                <AlertCircle
                  size={15}
                  className="shrink-0 mt-0.5 stroke-[2.5]"
                />
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
                <Flame
                  size={36}
                  className="text-gray-300 dark:text-slate-700 mx-auto"
                />
                <h4 className="font-extrabold text-base text-[#0B192C] dark:text-white">
                  No aartis found
                </h4>
                <p className="text-xs text-gray-400 font-medium max-w-md mx-auto leading-relaxed">
                  Try a different city or date, or widen your filters. Ashrams
                  publish new aartis regularly.
                </p>
                {(facilities.length > 0 || sort !== "recommended") && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="inline-flex items-center gap-2 bg-[#0A4DA6] hover:bg-[#083D85] text-white text-xs font-extrabold px-5 py-2.5 rounded-full shadow-md transition-all active:scale-95 cursor-pointer"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {results.map((session, index) => (
                    <motion.div
                      key={session._id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: 0.3,
                        delay: Math.min(index * 0.04, 0.4),
                      }}
                    >
                      <AartiCard session={session} query={detailQuery} />
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

export default AartiHubPage;
