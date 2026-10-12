import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Award,
  BookOpen,
  CalendarDays,
  Filter,
  Flame,
  MapPin,
  MessageSquare,
  RotateCcw,
  Search,
  ShieldCheck,
} from "lucide-react";
import { providerPublicService, ritualCatalogService } from "../services/provider.service";
import type { ProviderSearchParams } from "../types/provider.types";
import { PROVIDER_TYPE_LABELS, VERIFICATION_LEVEL_LABELS } from "../types/provider.types";
import { getErrorMessage } from "../../../lib/api";
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  ErrorNotice,
  Field,
  Modal,
  Pagination,
  Skeleton,
  StatusBadge,
  buttonClass,
  cx,
  formatMinor,
  inputClass,
} from "../ui";

const SACRED_CITIES = [
  "Varanasi",
  "Haridwar",
  "Rishikesh",
  "Ayodhya",
  "Ujjain",
  "Mathura",
  "Vrindavan",
  "Prayagraj",
  "Delhi NCR",
  "Mumbai",
  "Bengaluru",
];

const LANGUAGES = ["Sanskrit", "Hindi", "English", "Bengali", "Gujarati", "Marathi", "Tamil", "Telugu"];

const PAGE_SIZE = 12;

interface RitualOption {
  id: string;
  name: string;
}

interface Filters {
  q: string;
  ritual: string;
  city: string;
  language: string;
  providerType: string;
  minVerification: string;
  date: string;
  sort: string;
}

const readFilters = (params: URLSearchParams): Filters => ({
  q: params.get("q") || "",
  ritual: params.get("ritual") || "",
  city: params.get("city") || "",
  language: params.get("language") || "",
  providerType: params.get("providerType") || "",
  minVerification: params.get("minVerification") || "",
  date: params.get("date") || "",
  sort: params.get("sort") || "relevance",
});

const todayIso = () => new Date().toISOString().slice(0, 10);

/** The filter controls, rendered once in the sidebar (desktop) and once in the drawer (mobile). */
const FilterFields: React.FC<{
  filters: Filters;
  rituals: RitualOption[];
  onChange: (patch: Partial<Filters>) => void;
}> = ({ filters, rituals, onChange }) => (
  <div className="space-y-4">
    <Field label="Provider type">
      <select className={inputClass} value={filters.providerType} onChange={(e) => onChange({ providerType: e.target.value })}>
        <option value="">All Vedic roles</option>
        <option value="PANDIT">Pandit (general Vedic priest)</option>
        <option value="PUROHIT">Purohit (family / Sanskara priest)</option>
        <option value="ACHARYA">Acharya (senior Vedic scholar)</option>
        <option value="JYOTISHI">Jyotishi (Vedic astrologer)</option>
      </select>
    </Field>
    {rituals.length > 0 && (
      <Field label="Puja / ritual">
        <select className={inputClass} value={filters.ritual} onChange={(e) => onChange({ ritual: e.target.value })}>
          <option value="">All rituals and pujas</option>
          {rituals.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </Field>
    )}
    <Field label="Location">
      <select className={inputClass} value={filters.city} onChange={(e) => onChange({ city: e.target.value })}>
        <option value="">All sacred cities</option>
        {SACRED_CITIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
    </Field>
    <Field label="Chanting language">
      <select className={inputClass} value={filters.language} onChange={(e) => onChange({ language: e.target.value })}>
        <option value="">Any language</option>
        {LANGUAGES.map((l) => (
          <option key={l} value={l}>
            {l}
          </option>
        ))}
      </select>
    </Field>
    <Field label="Minimum verification">
      <select className={inputClass} value={filters.minVerification} onChange={(e) => onChange({ minVerification: e.target.value })}>
        <option value="">Any verified status</option>
        <option value="IDENTITY_VERIFIED">Identity verified</option>
        <option value="PROFESSIONAL_VERIFIED">Vedic lineage verified</option>
        <option value="INSTITUTION_VERIFIED">Institution authorized</option>
        <option value="TIRVONA_TRUSTED">Tirvona trusted</option>
      </select>
    </Field>
    <Field label="Available on" hint="Show providers with an open slot on this date.">
      <input type="date" min={todayIso()} className={inputClass} value={filters.date} onChange={(e) => onChange({ date: e.target.value })} />
    </Field>
  </div>
);

const ProviderCardSkeleton: React.FC = () => (
  <Card className="p-5 space-y-4">
    <div className="flex gap-4">
      <Skeleton className="h-16 w-16 rounded-2xl" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
    <Skeleton className="h-10 w-full" />
    <Skeleton className="h-9 w-full" />
  </Card>
);

export const PublicPanditDirectoryPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState<Filters>(() => readFilters(searchParams));
  // The text box updates immediately; the request waits until typing pauses.
  const [queryInput, setQueryInput] = useState(filters.q);
  const [page, setPage] = useState(Number(searchParams.get("page")) || 1);

  const [providers, setProviders] = useState<any[]>([]);
  const [rituals, setRituals] = useState<RitualOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const requestId = useRef(0);

  // Published rituals for the filter. The list carries locale-keyed titles.
  useEffect(() => {
    let active = true;
    ritualCatalogService
      .list({ page: 1 })
      .then((res) => {
        if (!active || !res.data?.success) return;
        const list: any[] = res.data.data || [];
        setRituals(
          list.map((r) => ({
            id: r.id,
            name: r.titles?.en || Object.values(r.titles ?? {})[0] || r.name || r.slug,
          })),
        );
      })
      .catch(() => {
        /* The ritual filter is optional. */
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFilters((prev) => (prev.q === queryInput.trim() ? prev : { ...prev, q: queryInput.trim() }));
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [queryInput]);

  const updateFilters = useCallback((patch: Partial<Filters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
  }, []);

  const fetchProviders = useCallback(async () => {
    const current = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const params: ProviderSearchParams = {
        q: filters.q || undefined,
        ritual: filters.ritual || undefined,
        city: filters.city || undefined,
        language: filters.language || undefined,
        providerType: filters.providerType || undefined,
        minVerification: filters.minVerification || undefined,
        date: filters.date || undefined,
        sort: filters.sort || undefined,
        page,
        limit: PAGE_SIZE,
      };
      const res = await providerPublicService.search(params);
      if (current !== requestId.current) return; // a newer search is already running
      if (res.data?.success) {
        setProviders(res.data.data || []);
        setTotal(res.data.meta?.total ?? res.data.data?.length ?? 0);
      } else {
        setError(res.data?.message || "Unable to load the directory right now.");
        setProviders([]);
      }
    } catch (err) {
      if (current !== requestId.current) return;
      setError(getErrorMessage(err, "Failed to load the Pandit directory."));
      setProviders([]);
    } finally {
      if (current === requestId.current) setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    const next = new URLSearchParams();
    (Object.entries(filters) as Array<[keyof Filters, string]>).forEach(([key, value]) => {
      if (value && !(key === "sort" && value === "relevance")) next.set(key, value);
    });
    if (page > 1) next.set("page", String(page));
    setSearchParams(next, { replace: true });
    fetchProviders();
  }, [filters, page, fetchProviders, setSearchParams]);

  const resetFilters = () => {
    setQueryInput("");
    setFilters({ q: "", ritual: "", city: "", language: "", providerType: "", minVerification: "", date: "", sort: "relevance" });
    setPage(1);
  };

  const activeFilterCount = [filters.q, filters.ritual, filters.city, filters.language, filters.providerType, filters.minVerification, filters.date].filter(Boolean).length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="min-h-screen bg-[#FBF8F3] dark:bg-[#071322] pb-20">
      {/* ── Intro and search ───────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-slate-800 bg-[#0B192C] px-4 py-10 text-white sm:px-8 sm:py-14">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-15 [background-image:radial-gradient(#F28C28_1px,transparent_1px)] [background-size:24px_24px]" />
        <div className="relative mx-auto max-w-6xl space-y-5">
          <p className="inline-flex items-center gap-2 rounded-full border border-[#F28C28]/40 bg-[#F28C28]/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#FFA44D]">
            <Flame size={14} aria-hidden="true" />
            Puja &amp; Jyotish
          </p>
          <div className="max-w-3xl">
            <h1 className="font-serif text-3xl font-black leading-tight tracking-tight sm:text-4xl">
              Verified Vedic <span className="text-[#FFA44D]">Pandits &amp; Acharyas</span>
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-base">
              Book authentic pujas, havans and sanskaras, or ask for guidance. Every provider listed here has had their identity verified by Tirvona.
            </p>
          </div>

          <form
            role="search"
            onSubmit={(e) => e.preventDefault()}
            className="flex max-w-4xl flex-col gap-2 rounded-2xl bg-white p-2 text-gray-900 shadow-xl sm:flex-row sm:items-center dark:bg-[#0F2038] dark:text-white"
          >
            <div className="flex min-h-[48px] flex-1 items-center gap-2.5 rounded-xl bg-gray-50 px-3 dark:bg-slate-900/60">
              <Search size={18} className="shrink-0 text-gray-400" aria-hidden="true" />
              <label htmlFor="pandit-search" className="sr-only">
                Search by name, ritual or specialty
              </label>
              <input
                id="pandit-search"
                type="search"
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                placeholder="Search by name, ritual or specialty"
                className="w-full bg-transparent py-2 text-sm text-[#0B192C] outline-none placeholder:text-gray-400 dark:text-white"
              />
            </div>
            <div className="flex items-center gap-2">
              <div className="flex min-h-[48px] flex-1 items-center gap-1.5 rounded-xl bg-gray-50 px-3 sm:flex-none dark:bg-slate-900/60">
                <MapPin size={16} className="shrink-0 text-[#B45309]" aria-hidden="true" />
                <label htmlFor="pandit-city" className="sr-only">
                  City
                </label>
                <select
                  id="pandit-city"
                  value={filters.city}
                  onChange={(e) => updateFilters({ city: e.target.value })}
                  className="w-full cursor-pointer bg-transparent py-2 text-sm font-semibold text-[#0B192C] outline-none dark:text-white"
                >
                  <option value="">All sacred cities</option>
                  {SACRED_CITIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <Button variant="secondary" className="lg:hidden" onClick={() => setFiltersOpen(true)} aria-haspopup="dialog">
                <Filter size={16} aria-hidden="true" />
                Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
              </Button>
            </div>
          </form>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
        {/* ── Provider invitation ──────────────────────────────────────── */}
        <Card className="mb-6 flex flex-col gap-3 border-[#FFC88A]/70 bg-[#FFF4E5]/60 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-[#F28C28]/25 dark:bg-[#F28C28]/10">
          <div className="min-w-0">
            <h2 className="text-sm font-extrabold text-[#0B192C] dark:text-white">Are you a Pandit, Acharya or Jyotishi?</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">Join Tirvona to receive puja bookings and consultation requests.</p>
          </div>
          <Link to="/provider/profile" className={buttonClass("secondary", "shrink-0")}>
            Register as a provider
          </Link>
        </Card>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[18rem,1fr]">
          {/* ── Desktop filters ──────────────────────────────────────── */}
          <aside aria-label="Directory filters" className="hidden lg:block">
            <Card className="sticky top-24 p-5">
              <div className="mb-4 flex items-center justify-between border-b border-gray-100 pb-3 dark:border-slate-800">
                <h2 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-[#0B192C] dark:text-white">
                  <Filter size={14} className="text-[#B45309]" aria-hidden="true" />
                  Refine
                </h2>
                {activeFilterCount > 0 && (
                  <button type="button" onClick={resetFilters} className="flex items-center gap-1 rounded text-xs font-bold text-[#B45309] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F28C28]">
                    <RotateCcw size={12} aria-hidden="true" />
                    Reset
                  </button>
                )}
              </div>
              <FilterFields filters={filters} rituals={rituals} onChange={updateFilters} />
            </Card>
          </aside>

          {/* ── Results ──────────────────────────────────────────────── */}
          <main className="min-w-0 space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p role="status" aria-live="polite" className="text-sm text-gray-600 dark:text-gray-400">
                {loading ? (
                  "Searching…"
                ) : (
                  <>
                    <strong className="text-[#0B192C] dark:text-white">{total}</strong> {total === 1 ? "provider" : "providers"} found
                  </>
                )}
              </p>
              <div className="flex items-center gap-2">
                <label htmlFor="pandit-sort" className="text-sm font-semibold text-gray-600 dark:text-gray-400">
                  Sort by
                </label>
                <select id="pandit-sort" value={filters.sort} onChange={(e) => updateFilters({ sort: e.target.value })} className={cx(inputClass, "!w-auto")}>
                  <option value="relevance">Relevance</option>
                  <option value="verification">Verification level</option>
                  <option value="price_asc">Fee: low to high</option>
                  <option value="price_desc">Fee: high to low</option>
                  <option value="experience">Experience</option>
                </select>
              </div>
            </div>

            {error && <ErrorNotice message={error} onRetry={fetchProviders} />}

            {loading ? (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 2xl:grid-cols-3" aria-busy="true">
                {Array.from({ length: 6 }).map((_, i) => (
                  <ProviderCardSkeleton key={i} />
                ))}
              </div>
            ) : providers.length === 0 && !error ? (
              <Card>
                <EmptyState
                  icon={<Search size={26} />}
                  title="No providers match your search"
                  description="Try removing a filter or searching another holy city or ritual."
                  action={
                    activeFilterCount > 0 ? (
                      <Button variant="secondary" onClick={resetFilters}>
                        <RotateCcw size={16} aria-hidden="true" />
                        Clear all filters
                      </Button>
                    ) : undefined
                  }
                />
              </Card>
            ) : (
              <ul className="grid grid-cols-1 gap-5 md:grid-cols-2 2xl:grid-cols-3">
                {providers.map((p) => {
                  const verified = p.verificationLevel && p.verificationLevel !== "UNVERIFIED";
                  const fee = formatMinor(p.offerings?.minFeeMinor, p.offerings?.currency || "INR");
                  const profilePath = `/pandit/${p.slug || p.id}`;
                  const places = [p.homeCity, p.homeState].filter(Boolean).join(", ");
                  return (
                    <li key={p.id} className="flex">
                      <Card as="article" className="flex w-full flex-col justify-between p-5 transition-shadow hover:shadow-md motion-reduce:transition-none">
                        <div className="space-y-4">
                          <div className="flex items-start gap-4">
                            <Avatar name={p.displayName} src={p.avatarUrl} size={64} />
                            <div className="min-w-0 flex-1">
                              <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                                <span className="rounded-full border border-[#FFE4C4] bg-[#FFF4E5] px-2.5 py-0.5 text-[11px] font-bold text-[#92400E] dark:border-[#F28C28]/40 dark:bg-[#F28C28]/15 dark:text-[#FFA44D]">
                                  {PROVIDER_TYPE_LABELS[p.providerType] || p.providerType}
                                </span>
                                {verified && <StatusBadge status={p.verificationLevel} label={VERIFICATION_LEVEL_LABELS[p.verificationLevel]} tone="success" />}
                              </div>
                              <h3 className="break-words text-base font-extrabold leading-snug text-[#0B192C] dark:text-white">
                                <Link to={profilePath} className="hover:text-[#B45309] focus-visible:outline-none focus-visible:underline">
                                  {p.displayName}
                                </Link>
                              </h3>
                              {places && (
                                <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                                  <MapPin size={12} className="shrink-0" aria-hidden="true" />
                                  <span className="truncate">{places}</span>
                                </p>
                              )}
                            </div>
                          </div>

                          {p.bio && <p className="line-clamp-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300">{p.bio}</p>}

                          <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-gray-100 pt-3 text-xs text-gray-600 dark:border-slate-800 dark:text-gray-400">
                            {p.experienceYears != null && (
                              <li className="flex items-center gap-1">
                                <Award size={13} className="text-[#F28C28]" aria-hidden="true" />
                                {p.experienceYears}+ years
                              </li>
                            )}
                            {p.languages?.length > 0 && (
                              <li className="flex items-center gap-1">
                                <BookOpen size={13} className="text-[#B45309]" aria-hidden="true" />
                                {p.languages.slice(0, 3).join(", ")}
                              </li>
                            )}
                            {p.consultation?.enabled && (
                              <li className="flex items-center gap-1">
                                <MessageSquare size={13} className="text-[#B45309]" aria-hidden="true" />
                                Consultations
                              </li>
                            )}
                          </ul>

                          {p.specializations?.length > 0 && (
                            <ul className="flex flex-wrap gap-1.5">
                              {p.specializations.slice(0, 3).map((s: string) => (
                                <li key={s} className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs text-gray-700 dark:border-slate-700 dark:bg-slate-900 dark:text-gray-300">
                                  {s}
                                </li>
                              ))}
                              {p.specializations.length > 3 && <li className="self-center text-xs text-gray-500">+{p.specializations.length - 3} more</li>}
                            </ul>
                          )}
                        </div>

                        <div className="mt-5 border-t border-gray-100 pt-4 dark:border-slate-800">
                          <div className="mb-3">
                            {fee ? (
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                Services from <strong className="text-lg font-black text-[#0B192C] dark:text-white">{fee}</strong>
                              </p>
                            ) : (
                              <p className="text-sm text-gray-500 dark:text-gray-400">{p.consultation?.enabled ? "Consultation available" : "Fee shown on profile"}</p>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Link to={profilePath} className={buttonClass("outline", "flex-1 !min-h-[44px]")}>
                              View profile
                            </Link>
                            {p.acceptingBookings && (
                              <Link to={`${profilePath}#services`} className={buttonClass("primary", "flex-1 !min-h-[44px]")}>
                                <CalendarDays size={15} aria-hidden="true" />
                                Book puja
                              </Link>
                            )}
                          </div>
                        </div>
                      </Card>
                    </li>
                  );
                })}
              </ul>
            )}

            {!loading && !error && <Pagination page={page} pageCount={pageCount} onChange={(next) => { setPage(next); window.scrollTo({ top: 0, behavior: "smooth" }); }} />}

            <p className="flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400">
              <ShieldCheck size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
              Listings show only providers whose identity Tirvona has verified. Fees shown are the provider's starting fee; the payable total is shown before you pay.
            </p>
          </main>
        </div>
      </div>

      {/* ── Mobile filter drawer ───────────────────────────────────────── */}
      <Modal
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filters"
        variant="drawer"
        footer={
          <>
            <Button variant="outline" onClick={resetFilters}>
              Reset
            </Button>
            <Button onClick={() => setFiltersOpen(false)}>Show {loading ? "results" : `${total} result${total === 1 ? "" : "s"}`}</Button>
          </>
        }
      >
        <FilterFields filters={filters} rituals={rituals} onChange={updateFilters} />
      </Modal>
    </div>
  );
};

export default PublicPanditDirectoryPage;
