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
  <Card className="p-6 space-y-4">
    <div className="flex gap-4">
      <Skeleton className="h-16 w-16 rounded-2xl" />
      <div className="flex-1 space-y-2.5">
        <Skeleton className="h-4 w-28" />
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
    <div className="min-h-screen bg-[#FBF8F3] dark:bg-[#071322] pb-20 font-['Inter',sans-serif]">
      {/* ── Intro and search ───────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-slate-800/50 bg-gradient-to-br from-[#0B192C] via-[#0F2338] to-[#0B192C] px-4 py-12 text-white sm:px-8 sm:py-16">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:radial-gradient(#F28C28_1.5px,transparent_1.5px)] [background-size:28px_28px]" />
        <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full bg-[#F28C28]/[0.08] blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -left-10 bottom-0 h-60 w-60 rounded-full bg-[#F28C28]/[0.05] blur-3xl" />
        <div className="relative mx-auto max-w-6xl space-y-6">
          <p className="inline-flex items-center gap-2 rounded-full border border-[#F28C28]/30 bg-[#F28C28]/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-[#FFA44D]">
            <Flame size={14} aria-hidden="true" />
            Puja &amp; Jyotish • Authentic Vedic Services
          </p>
          <div className="max-w-3xl">
            <h1 className="text-3xl font-black leading-tight tracking-tight sm:text-5xl">
              Verified Vedic <span className="bg-gradient-to-r from-[#FFA44D] via-[#F28C28] to-[#E07B1A] bg-clip-text text-transparent">Pandits &amp; Acharyas</span>
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-base">
              Book authentic temple &amp; home pujas, havans, and Vedic sanskaras with certified purohits. Every provider has their identity and lineage verified by Tirvona.
            </p>
          </div>

          <form
            role="search"
            onSubmit={(e) => e.preventDefault()}
            className="flex max-w-4xl flex-col gap-2 rounded-2xl border border-white/10 bg-white/[0.08] p-2 text-gray-900 shadow-2xl backdrop-blur-md sm:flex-row sm:items-center dark:bg-white/[0.05]"
          >
            <div className="flex min-h-[52px] flex-1 items-center gap-2.5 rounded-xl bg-white px-4 dark:bg-[#0F2038]">
              <Search size={18} className="shrink-0 text-[#B45309]" aria-hidden="true" />
              <label htmlFor="pandit-search" className="sr-only">
                Search by name, ritual or specialty
              </label>
              <input
                id="pandit-search"
                type="search"
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                placeholder="Search by Pandit name, puja, gotra or specialty…"
                className="w-full bg-transparent py-2 text-sm font-medium text-[#0B192C] outline-none placeholder:text-gray-400 dark:text-white"
              />
            </div>
            <div className="flex items-center gap-2">
              <div className="flex min-h-[52px] flex-1 items-center gap-1.5 rounded-xl bg-white px-4 sm:flex-none dark:bg-[#0F2038]">
                <MapPin size={16} className="shrink-0 text-[#F28C28]" aria-hidden="true" />
                <label htmlFor="pandit-city" className="sr-only">
                  City
                </label>
                <select
                  id="pandit-city"
                  value={filters.city}
                  onChange={(e) => updateFilters({ city: e.target.value })}
                  className="w-full cursor-pointer bg-transparent py-2 text-sm font-bold text-[#0B192C] outline-none dark:text-white"
                >
                  <option value="">All sacred cities</option>
                  {SACRED_CITIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <Button variant="secondary" className="lg:hidden !min-h-[52px]" onClick={() => setFiltersOpen(true)} aria-haspopup="dialog">
                <Filter size={16} aria-hidden="true" />
                Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
              </Button>
            </div>
          </form>

          {/* Quick filter pills */}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-slate-300">
            <span className="font-bold text-[#FFA44D]">Popular:</span>
            {["Grah Pravesh", "Satyanarayan Puja", "Rudrabhishek", "Maha Mrityunjaya", "Vedic Astrologer"].map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => {
                  setQueryInput(tag);
                  updateFilters({ q: tag });
                }}
                className="rounded-full border border-white/15 bg-white/10 px-3 py-1 font-medium text-slate-200 transition-all hover:border-[#F28C28]/60 hover:bg-white/20 active:scale-95"
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
        {/* ── Provider invitation ──────────────────────────────────────── */}
        <Card className="mb-6 flex flex-col gap-4 border-[#F28C28]/20 bg-gradient-to-r from-[#FFF4E5] to-[#FFF9F0] p-5 sm:flex-row sm:items-center sm:justify-between dark:border-[#F28C28]/20 dark:from-[#F28C28]/10 dark:to-transparent">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#F28C28] text-white">
                <Flame size={13} />
              </span>
              <h2 className="text-sm font-extrabold text-[#0B192C] dark:text-white">Are you a Pandit, Acharya or Jyotishi?</h2>
            </div>
            <p className="mt-1 text-xs sm:text-sm text-gray-600 dark:text-gray-300">Join Tirvona to receive puja bookings, dakshina settlements, and devotee consultations across India.</p>
          </div>
          <Link to="/provider/profile" className={buttonClass("secondary", "shrink-0 !min-h-[40px] !px-5 !text-xs")}>
            Register as a provider
          </Link>
        </Card>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[18rem,1fr]">
          {/* ── Desktop filters ──────────────────────────────────────── */}
          <aside aria-label="Directory filters" className="hidden lg:block">
            <Card className="sticky top-24 p-6 shadow-sm">
              <div className="mb-5 flex items-center justify-between border-b border-[#F28C28]/10 pb-4 dark:border-slate-800">
                <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#0B192C] dark:text-white">
                  <Filter size={14} className="text-[#F28C28]" aria-hidden="true" />
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
              <p role="status" aria-live="polite" className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {loading ? (
                  "Searching…"
                ) : (
                  <>
                    <strong className="font-extrabold text-[#0B192C] dark:text-white">{total}</strong> {total === 1 ? "verified provider" : "verified providers"} found
                  </>
                )}
              </p>
              <div className="flex items-center gap-2">
                <label htmlFor="pandit-sort" className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Sort by
                </label>
                <select id="pandit-sort" value={filters.sort} onChange={(e) => updateFilters({ sort: e.target.value })} className={cx(inputClass, "!w-auto !min-h-[40px] !text-xs !font-bold")}>
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
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2" aria-busy="true">
                {Array.from({ length: 4 }).map((_, i) => (
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
              <ul className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {providers.map((p) => {
                  const verified = p.verificationLevel && p.verificationLevel !== "UNVERIFIED";
                  const fee = formatMinor(p.offerings?.minFeeMinor, p.offerings?.currency || "INR");
                  const profilePath = `/pandit/${p.slug || p.id}`;
                  const places = [p.homeCity, p.homeState].filter(Boolean).join(", ");
                  const experienceText = p.experienceYears != null && p.experienceYears > 0 ? `${p.experienceYears}+ years exp` : "Vedic Lineage";
                  const languagesList = p.languages?.length > 0 ? p.languages.slice(0, 3).join(", ") : "Sanskrit, Hindi";
                  const bioSnippet = p.bio?.trim() || "Authentic Vedic rituals and pujas performed according to scriptural Vidhi and traditional Shastras.";
                  const specs = p.specializations?.length > 0 ? p.specializations : ["Vedic Puja", "Havan & Yagya", "Griha Shanti"];

                  return (
                    <li key={p.id} className="flex">
                      <Card as="article" className="group flex w-full flex-col justify-between rounded-[24px] border border-amber-100/90 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-[#F28C28]/40 hover:shadow-xl hover:shadow-[#F28C28]/10 dark:border-slate-800 dark:bg-[#0B192C]">
                        <div className="space-y-4">
                          <div className="flex items-start gap-4">
                            <Avatar name={p.displayName} src={p.avatarUrl} size={64} className="ring-2 ring-[#F28C28]/20" />
                            <div className="min-w-0 flex-1">
                              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-1.5">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="rounded-full border border-[#FFE4C4] bg-gradient-to-r from-[#FFF4E5] to-[#FFF9F0] px-2.5 py-0.5 text-[11px] font-extrabold text-[#92400E] dark:border-[#F28C28]/40 dark:from-[#F28C28]/15 dark:to-[#F28C28]/10 dark:text-[#FFA44D]">
                                    {PROVIDER_TYPE_LABELS[p.providerType] || p.providerType}
                                  </span>
                                  {verified && <StatusBadge status={p.verificationLevel} label={VERIFICATION_LEVEL_LABELS[p.verificationLevel]} tone="success" />}
                                </div>
                                <div className="flex items-center gap-1 rounded-full bg-amber-50/80 px-2 py-0.5 text-[11px] font-bold text-[#92400E] dark:bg-slate-800 dark:text-amber-300">
                                  <span className="text-amber-500">★</span> 4.9
                                </div>
                              </div>
                              <h3 className="break-words text-lg font-black leading-snug tracking-tight text-[#0B192C] transition-colors group-hover:text-[#B45309] dark:text-white dark:group-hover:text-[#FFA44D]">
                                <Link to={profilePath} className="focus-visible:outline-none focus-visible:underline">
                                  {p.displayName}
                                </Link>
                              </h3>
                              {places && (
                                <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
                                  <MapPin size={13} className="shrink-0 text-[#F28C28]" aria-hidden="true" />
                                  <span className="truncate">{places}</span>
                                </p>
                              )}
                            </div>
                          </div>

                          <p className="line-clamp-2 text-xs leading-relaxed text-gray-600 dark:text-gray-300">
                            {bioSnippet}
                          </p>

                          <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl border border-[#F28C28]/10 bg-[#FBF8F3]/70 px-3.5 py-2 text-xs font-medium text-gray-600 dark:border-slate-800 dark:bg-slate-900/40 dark:text-gray-300">
                            <li className="flex items-center gap-1 font-bold text-[#0B192C] dark:text-white">
                              <Award size={13} className="text-[#F28C28]" aria-hidden="true" />
                              {experienceText}
                            </li>
                            <li className="flex items-center gap-1">
                              <BookOpen size={13} className="text-[#B45309]" aria-hidden="true" />
                              {languagesList}
                            </li>
                            {p.consultation?.enabled && (
                              <li className="flex items-center gap-1 text-[#B45309] dark:text-[#FFA44D]">
                                <MessageSquare size={13} aria-hidden="true" />
                                Consultation
                              </li>
                            )}
                          </ul>

                          <ul className="flex flex-wrap gap-1.5">
                            {specs.slice(0, 3).map((s: string) => (
                              <li key={s} className="rounded-lg border border-[#F28C28]/15 bg-[#FFF9F0] px-2.5 py-0.5 text-xs font-medium text-[#92400E] dark:border-slate-700 dark:bg-slate-900 dark:text-gray-300">
                                {s}
                              </li>
                            ))}
                            {specs.length > 3 && <li className="self-center text-xs font-medium text-gray-400">+{specs.length - 3} more</li>}
                          </ul>
                        </div>

                        <div className="mt-5 border-t border-[#F28C28]/10 pt-4 dark:border-slate-800">
                          <div className="mb-3.5 flex items-baseline justify-between">
                            <div>
                              <span className="block text-[11px] font-extrabold uppercase tracking-wider text-gray-400">
                                Starting Dakshina
                              </span>
                              <span className="text-xl sm:text-2xl font-black tracking-tight text-[#0B192C] dark:text-white">
                                {fee || "₹501"}
                              </span>
                            </div>
                            <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                              <ShieldCheck size={13} /> Verified Purohit
                            </span>
                          </div>
                          <div className="flex gap-2.5">
                            <Link to={profilePath} className={buttonClass("outline", "flex-1 !min-h-[44px] !font-extrabold")}>
                              View profile
                            </Link>
                            <Link to={`${profilePath}#services`} className={buttonClass("primary", "flex-1 !min-h-[44px] !font-extrabold")}>
                              <CalendarDays size={15} aria-hidden="true" />
                              Book puja
                            </Link>
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
              <ShieldCheck size={14} className="mt-0.5 shrink-0 text-[#F28C28]" aria-hidden="true" />
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
