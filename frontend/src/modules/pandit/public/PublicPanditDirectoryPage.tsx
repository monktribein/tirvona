import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Award,
  BookOpen,
  CalendarDays,
  Check,
  Filter,
  Flame,
  MapPin,
  MessageSquare,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { providerPublicService, pujaBookingService, ritualCatalogService } from "../services/provider.service";
import { toast } from "../../../lib/toast";
import type { ProviderSearchParams } from "../types/provider.types";
import { PROVIDER_TYPE_LABELS, VERIFICATION_LEVEL_LABELS } from "../types/provider.types";
import { getErrorMessage } from "../../../lib/api";
import { PujaSamagriSection } from "./PujaSamagriSection";
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

const filterInputClass =
  "w-full h-8 rounded-lg border border-gray-200 bg-white px-2.5 py-0.5 text-xs font-medium text-gray-800 " +
  "focus:border-[#F28C28] focus:outline-none focus:ring-1 focus:ring-[#F28C28]/25 transition-colors " +
  "dark:border-slate-700 dark:bg-slate-900 dark:text-white";

/** The filter controls, rendered once in the sidebar (desktop) and once in the drawer (mobile). */
const FilterFields: React.FC<{
  filters: Filters;
  rituals: RitualOption[];
  onChange: (patch: Partial<Filters>) => void;
}> = ({ filters, rituals, onChange }) => (
  <div className="space-y-2">
    <div>
      <label className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-400">
        Role
      </label>
      <select className={filterInputClass} value={filters.providerType} onChange={(e) => onChange({ providerType: e.target.value })}>
        <option value="">All Vedic roles</option>
        <option value="PANDIT">Pandit (priest)</option>
        <option value="PUROHIT">Purohit (family)</option>
        <option value="ACHARYA">Acharya (scholar)</option>
        <option value="JYOTISHI">Jyotishi (astrologer)</option>
      </select>
    </div>
    {rituals.length > 0 && (
      <div>
        <label className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-400">
          Puja / ritual
        </label>
        <select className={filterInputClass} value={filters.ritual} onChange={(e) => onChange({ ritual: e.target.value })}>
          <option value="">All rituals &amp; pujas</option>
          {rituals.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>
    )}
    <div>
      <label className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-400">
        Location
      </label>
      <select className={filterInputClass} value={filters.city} onChange={(e) => onChange({ city: e.target.value })}>
        <option value="">All sacred cities</option>
        {SACRED_CITIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
    </div>
    <div>
      <label className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-400">
        Chanting language
      </label>
      <select className={filterInputClass} value={filters.language} onChange={(e) => onChange({ language: e.target.value })}>
        <option value="">Any language</option>
        {LANGUAGES.map((l) => (
          <option key={l} value={l}>
            {l}
          </option>
        ))}
      </select>
    </div>
    <div>
      <label className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-400">
        Verification
      </label>
      <select className={filterInputClass} value={filters.minVerification} onChange={(e) => onChange({ minVerification: e.target.value })}>
        <option value="">Any status</option>
        <option value="IDENTITY_VERIFIED">Identity verified</option>
        <option value="PROFESSIONAL_VERIFIED">Lineage verified</option>
        <option value="INSTITUTION_VERIFIED">Institution authorized</option>
        <option value="TIRVONA_TRUSTED">Tirvona trusted</option>
      </select>
    </div>
    <div>
      <label className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-400">
        Available date
      </label>
      <input type="date" min={todayIso()} className={filterInputClass} value={filters.date} onChange={(e) => onChange({ date: e.target.value })} />
    </div>
  </div>
);

const ProviderCardSkeleton: React.FC = () => (
  <Card className="p-4 space-y-3 rounded-2xl">
    <div className="flex gap-3">
      <Skeleton className="h-11 w-11 rounded-xl" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
    <Skeleton className="h-8 w-full" />
    <Skeleton className="h-8 w-full" />
  </Card>
);

export const PublicPanditDirectoryPage: React.FC = () => {
  const navigate = useNavigate();
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

  // Multi-Pandit booking request state (maximum 5 Pandits per Tirvona policy)
  const [selectedPandits, setSelectedPandits] = useState<Array<{ id: string; name: string; avatarUrl?: string; city?: string }>>([]);
  const [multiModalOpen, setMultiModalOpen] = useState(false);
  const [serviceTypeTab, setServiceTypeTab] = useState<"ALL" | "INDIVIDUAL" | "GROUP" | "KATHA">("ALL");

  // Multi-request modal form state
  const [multiServiceType, setMultiServiceType] = useState<"INDIVIDUAL" | "GROUP" | "KATHA">("INDIVIDUAL");
  const [multiRitualName, setMultiRitualName] = useState("");
  const [multiDate, setMultiDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [multiShift, setMultiShift] = useState<"MORNING" | "EVENING" | "ANY">("MORNING");
  const [multiCustomerName, setMultiCustomerName] = useState("");
  const [multiCustomerPhone, setMultiCustomerPhone] = useState("");
  const [multiCustomerCity, setMultiCustomerCity] = useState("Vrindavan");
  const [multiCustomerAddress, setMultiCustomerAddress] = useState("");
  const [multiNotes, setMultiNotes] = useState("");
  const [submittingMulti, setSubmittingMulti] = useState(false);

  const toggleSelectPandit = (p: any) => {
    const exists = selectedPandits.some((x) => x.id === p.id);
    if (exists) {
      setSelectedPandits((prev) => prev.filter((x) => x.id !== p.id));
    } else {
      if (selectedPandits.length >= 5) {
        toast.error("You can select a maximum of 5 Pandits for a booking request.");
        return;
      }
      setSelectedPandits((prev) => [
        ...prev,
        {
          id: p.id,
          name: p.displayName,
          avatarUrl: p.avatarUrl,
          city: p.homeCity,
        },
      ]);
      toast.success(`${p.displayName} added to request list (${selectedPandits.length + 1}/5)`);
    }
  };

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
    <div className="min-h-screen bg-white dark:bg-[#071322] pb-20 font-['Inter',sans-serif]">
      {/* ── Page header: same look as the other storefront pages ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8">
        <div className="text-center space-y-2.5 max-w-3xl mx-auto py-2">
          <h1 className="font-['Kalam'] text-3xl sm:text-5xl font-bold text-[#E58C28]">
            Verified Vedic Pandits &amp; Acharyas
          </h1>
          <div className="flex items-center justify-center gap-2.5 my-1.5">
            <div className="h-[1.5px] w-12 sm:w-24 bg-[#E58C28] rounded-full" />
            <Sparkles
              size={14}
              className="text-[#E58C28] fill-[#E58C28] shrink-0"
              aria-hidden="true"
            />
            <div className="h-[1.5px] w-12 sm:w-24 bg-[#E58C28] rounded-full" />
          </div>
          <p className="text-xs sm:text-sm font-bold text-[#0B192C] dark:text-gray-200 max-w-2xl mx-auto leading-relaxed">
            Book authentic temple &amp; home pujas, havans, and Vedic sanskaras with certified purohits. Every listed provider's identity is verified by Tirvona; lineage and institution checks show as extra badges.
          </p>
        </div>

        {/* Search */}
        <div className="w-full max-w-2xl sm:max-w-3xl mx-auto mt-5">
              <form
                role="search"
                onSubmit={(e) => {
                  e.preventDefault();
                  updateFilters({ q: queryInput });
                }}
                className="relative isolate bg-white dark:bg-[#0B192C] rounded-full tv-soft-surface border border-gray-100 dark:border-slate-800 p-1 sm:p-1.5 flex items-center gap-1 sm:gap-2 mx-auto w-full transition-all focus-within:ring-2 focus-within:ring-[#E58C28]/40"
              >
                {/* Pandit / Ritual input */}
                <div className="flex-1 flex items-center gap-2.5 min-w-0 pl-3 sm:pl-4 pr-1 py-1">
                  <Search size={16} className="shrink-0 text-[#E58C28]" aria-hidden="true" />
                  <input
                    id="pandit-search"
                    type="search"
                    value={queryInput}
                    onChange={(e) => setQueryInput(e.target.value)}
                    placeholder="Search by Pandit name, puja, or specialty…"
                    className="w-full bg-transparent border-none p-0 text-xs sm:text-sm font-normal text-gray-800 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none truncate"
                  />
                </div>

                {/* Vertical Divider */}
                <div className="hidden sm:block h-6 w-[1px] bg-gray-200 dark:bg-slate-700 shrink-0" aria-hidden="true" />

                {/* City selector */}
                <div className="hidden sm:flex items-center gap-1.5 px-2 min-w-0 w-44 shrink-0">
                  <MapPin size={15} className="shrink-0 text-[#E58C28]" aria-hidden="true" />
                  <select
                    id="pandit-city"
                    value={filters.city}
                    onChange={(e) => updateFilters({ city: e.target.value })}
                    className="w-full cursor-pointer bg-transparent border-none p-0 text-xs sm:text-sm font-normal text-gray-700 dark:text-gray-200 focus:outline-none truncate"
                  >
                    <option value="" className="bg-white text-gray-900 dark:bg-[#0B192C] dark:text-white">
                      All sacred cities
                    </option>
                    {SACRED_CITIES.map((c) => (
                      <option key={c} value={c} className="bg-white text-gray-900 dark:bg-[#0B192C] dark:text-white">
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Mobile Filter Button */}
                <Button
                  variant="secondary"
                  className="sm:hidden !h-9 !w-9 !rounded-full !p-0 flex items-center justify-center shrink-0 border border-gray-200 dark:border-slate-700"
                  onClick={() => setFiltersOpen(true)}
                  aria-label="Open filters"
                >
                  <Filter size={15} aria-hidden="true" />
                </Button>

                {/* Circular Search Button (Slim & Refined) */}
                <button
                  type="submit"
                  aria-label="Search"
                  className="w-9 h-9 sm:w-10 sm:h-10 bg-[#E58C28] hover:bg-[#D97706] text-white rounded-full flex items-center justify-center shadow-md shadow-[#E58C28]/25 hover:shadow-[#E58C28]/40 transition-all cursor-pointer shrink-0 active:scale-95"
                >
                  <Search size={15} className="stroke-[2.5]" />
                </button>
              </form>
        </div>
      </div>

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

        {/* Service Type Discovery Tabs: All, Individual Puja, Group Puja, Bhagwat Katha */}
        <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-gray-100 dark:border-slate-800 pb-3">
          <span className="text-xs font-bold text-gray-500 mr-1 flex items-center gap-1">
            <Sparkles size={13} className="text-[#F28C28]" /> Offering Type:
          </span>
          {[
            { id: "ALL", label: "All Rituals & Pujas", icon: <Flame size={12} /> },
            { id: "INDIVIDUAL", label: "Individual / Home Puja", icon: <Award size={12} /> },
            { id: "GROUP", label: "Group Puja (Samuhik)", icon: <Users size={12} /> },
            { id: "KATHA", label: "Bhagwat Katha & Katha", icon: <BookOpen size={12} /> },
          ].map((tab) => {
            const active = serviceTypeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setServiceTypeTab(tab.id as any)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                  active
                    ? "bg-[#F28C28] text-white shadow-xs"
                    : "bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700"
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Results Counter Above Grid (ensuring left filter & cards align at the exact same top baseline) */}
        <div className="mb-3.5 flex items-center justify-between">
          <p role="status" aria-live="polite" className="text-xs sm:text-sm font-semibold text-gray-500 dark:text-gray-400">
            {loading ? (
              "Searching providers…"
            ) : (
              <>
                <strong className="font-extrabold text-[#0B192C] dark:text-white">{total}</strong> {total === 1 ? "verified provider" : "verified providers"} found
              </>
            )}
          </p>
        </div>

        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[15.5rem,1fr]">
          {/* ── Desktop filters (compact & aligned) ───────── */}
          <aside aria-label="Directory filters" className="hidden lg:block">
            <Card className="sticky top-24 p-3 sm:p-3.5 shadow-xs rounded-2xl border border-gray-100 dark:border-slate-800">
              <div className="mb-2 flex items-center justify-between border-b border-gray-100 pb-1.5 dark:border-slate-800">
                <h2 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#0B192C] dark:text-white">
                  <Filter size={13} className="text-[#F28C28]" aria-hidden="true" />
                  Refine
                </h2>
                {activeFilterCount > 0 && (
                  <button type="button" onClick={resetFilters} className="flex items-center gap-1 rounded text-[11px] font-bold text-[#B45309] hover:underline focus-visible:outline-none">
                    <RotateCcw size={11} aria-hidden="true" />
                    Reset
                  </button>
                )}
              </div>
              <FilterFields filters={filters} rituals={rituals} onChange={updateFilters} />
            </Card>
          </aside>

          {/* ── Results (Aligned at exact top baseline) ─────── */}
          <main className="min-w-0">
            {error && <ErrorNotice message={error} onRetry={fetchProviders} />}

            {loading ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2" aria-busy="true">
                {Array.from({ length: 4 }).map((_, i) => (
                  <ProviderCardSkeleton key={i} />
                ))}
              </div>
            ) : providers.length === 0 && !error ? (
              <Card className="p-6">
                <EmptyState
                  icon={<Search size={24} />}
                  title="No providers match your search"
                  description="Try removing a filter or searching another holy city or ritual."
                  action={
                    activeFilterCount > 0 ? (
                      <Button variant="secondary" onClick={resetFilters}>
                        <RotateCcw size={14} aria-hidden="true" />
                        Clear all filters
                      </Button>
                    ) : undefined
                  }
                />
              </Card>
            ) : (
              <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {providers.map((p) => {
                  const verified = p.verificationLevel && p.verificationLevel !== "UNVERIFIED";
                  const fee = formatMinor(p.offerings?.minFeeMinor, p.offerings?.currency || "INR");
                  const profilePath = `/pandit/${p.slug || p.id}`;
                  const places = [p.homeCity, p.homeState].filter(Boolean).join(", ");
                  const experienceText = p.experienceYears != null && p.experienceYears > 0 ? `${p.experienceYears}+ yrs` : "Vedic Lineage";
                  const languagesList = p.languages?.length > 0 ? p.languages.slice(0, 2).join(", ") : "Sanskrit, Hindi";
                  const bioSnippet = p.bio?.trim() || "Authentic Vedic rituals and pujas performed according to scriptural Vidhi and traditional Shastras.";
                  const specs = p.specializations?.length > 0 ? p.specializations : ["Vedic Puja", "Havan & Yagya", "Griha Shanti"];
                  const isPanditSelected = selectedPandits.some((x) => x.id === p.id);

                  return (
                    <li key={p.id} className="flex">
                      <Card
                        as="article"
                        className={cx(
                          "group relative flex w-full flex-col justify-between overflow-hidden rounded-2xl border bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg dark:bg-[#0B192C]",
                          isPanditSelected
                            ? "border-[#F28C28] ring-2 ring-[#F28C28]/35 shadow-md"
                            : "border-amber-100/90 hover:border-[#F28C28]/40 dark:border-slate-800",
                        )}
                      >
                        <div className="space-y-3">
                          <div className="flex items-start gap-3">
                            <Avatar name={p.displayName} src={p.avatarUrl} size={46} className="ring-2 ring-[#F28C28]/20 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <div className="mb-1 flex flex-wrap items-center justify-between gap-1">
                                <div className="flex flex-wrap items-center gap-1">
                                  <span className="rounded-full border border-[#FFE4C4] bg-[#FFF4E5] px-2 py-0.5 text-[10px] font-bold text-[#92400E] dark:border-[#F28C28]/40 dark:bg-[#F28C28]/15 dark:text-[#FFA44D]">
                                    {PROVIDER_TYPE_LABELS[p.providerType] || p.providerType}
                                  </span>
                                  {verified && <StatusBadge status={p.verificationLevel} label={VERIFICATION_LEVEL_LABELS[p.verificationLevel]} tone="success" />}
                                </div>
                                <div className="flex items-center gap-1.5">
                                  {(p as any).liveOnline && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white motion-reduce:animate-none" aria-hidden="true" />
                                      Live
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => toggleSelectPandit(p)}
                                    title={isPanditSelected ? "Remove from multi-request" : "Select for multi-request (up to 5 Pandits)"}
                                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold transition-all cursor-pointer ${
                                      isPanditSelected
                                        ? "bg-[#F28C28] text-white shadow-xs"
                                        : "bg-gray-100 hover:bg-amber-100 text-gray-700 dark:bg-slate-800 dark:text-gray-300 dark:hover:bg-slate-700"
                                    }`}
                                  >
                                    {isPanditSelected ? <Check size={10} className="stroke-[3]" /> : <Send size={9} />}
                                    <span>{isPanditSelected ? "Selected" : "+ Request"}</span>
                                  </button>
                                </div>
                              </div>
                              <h3 className="break-words text-base font-bold leading-tight text-[#0B192C] transition-colors group-hover:text-[#B45309] dark:text-white dark:group-hover:text-[#FFA44D]">
                                <Link to={profilePath} className="focus-visible:outline-none focus-visible:underline">
                                  {p.displayName}
                                </Link>
                              </h3>
                              {places && (
                                <p className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-gray-500 dark:text-gray-400">
                                  <MapPin size={11} className="shrink-0 text-[#F28C28]" aria-hidden="true" />
                                  <span className="truncate">{places}</span>
                                </p>
                              )}
                            </div>
                          </div>

                          <p className="line-clamp-2 text-xs leading-relaxed text-gray-600 dark:text-gray-300">
                            {bioSnippet}
                          </p>

                          <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-gray-100 bg-gray-50/80 px-2.5 py-1.5 text-[11px] font-medium text-gray-600 dark:border-slate-800 dark:bg-slate-900/40 dark:text-gray-300">
                            <li className="flex items-center gap-1 font-bold text-[#0B192C] dark:text-white">
                              <Award size={12} className="text-[#F28C28]" aria-hidden="true" />
                              {experienceText}
                            </li>
                            <li className="flex items-center gap-1">
                              <BookOpen size={12} className="text-[#B45309]" aria-hidden="true" />
                              {languagesList}
                            </li>
                            {p.consultation?.enabled && (
                              <li className="flex items-center gap-1 text-[#B45309] dark:text-[#FFA44D]">
                                <MessageSquare size={12} aria-hidden="true" />
                                Consultation
                              </li>
                            )}
                          </ul>

                          <ul className="flex flex-wrap gap-1">
                            {specs.slice(0, 3).map((s: string) => (
                              <li key={s} className="rounded-md border border-[#F28C28]/15 bg-[#FFF9F0] px-2 py-0.5 text-[10px] font-semibold text-[#92400E] dark:border-slate-700 dark:bg-slate-900 dark:text-gray-300">
                                {s}
                              </li>
                            ))}
                            {specs.length > 3 && <li className="self-center text-[10px] font-medium text-gray-400">+{specs.length - 3}</li>}
                          </ul>
                        </div>

                        <div className="mt-3.5 border-t border-gray-100 pt-3 dark:border-slate-800">
                          <div className="mb-2.5 flex items-baseline justify-between">
                            <div>
                              <span className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">
                                Starting Dakshina
                              </span>
                              <span className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
                                {fee || "On request"}
                              </span>
                            </div>
                            <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                              <ShieldCheck size={12} /> {verified ? VERIFICATION_LEVEL_LABELS[p.verificationLevel] : "Pending"}
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <Link to={profilePath} className={buttonClass("outline", "flex-1 !min-h-[36px] !py-1.5 !px-3 !text-xs !font-bold rounded-full")}>
                              View profile
                            </Link>
                            <Link to={`${profilePath}#services`} className={buttonClass("primary", "flex-1 !min-h-[36px] !py-1.5 !px-3 !text-xs !font-bold rounded-full")}>
                              <CalendarDays size={13} aria-hidden="true" />
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

            <p className="mt-2.5 flex items-start gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
              <ShieldCheck size={13} className="mt-0.5 shrink-0 text-[#F28C28]" aria-hidden="true" />
              Listings show only providers whose identity Tirvona has verified. Fees shown are the provider's starting fee; the payable total is shown before you pay.
            </p>
          </main>
        </div>

        {/* ── Puja samagri from the Tirvona Marketplace (chosen by Tirvona) ── */}
        <div className="mt-4 sm:mt-5 empty:hidden">
          <PujaSamagriSection limit={5} variant="band" />
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
      {/* ── Multi-Pandit Request Floating Action Dock ── */}
      {selectedPandits.length > 0 && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 w-11/12 max-w-2xl bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-md text-white rounded-2xl px-4 py-3 shadow-2xl border border-amber-500/40 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-5">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#F28C28] font-bold text-xs text-white">
              {selectedPandits.length}
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold truncate">
                {selectedPandits.length} of 5 Pandits Selected
              </p>
              <p className="text-[10px] text-slate-300 truncate">
                Dispatches request to up to 5 verified Pandits. First to accept gets 1-hr payment lock.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setSelectedPandits([])}
              className="text-[11px] font-bold text-slate-400 hover:text-white px-2 py-1 cursor-pointer"
            >
              Clear
            </button>
            <Button
              variant="primary"
              className="!h-9 !px-4 !text-xs !font-bold rounded-full !bg-[#F28C28] hover:!bg-[#D97706]"
              onClick={() => setMultiModalOpen(true)}
            >
              <Send size={13} className="mr-1" />
              Request Pandits
            </Button>
          </div>
        </div>
      )}

      {/* ── Multi-Pandit Request Submission Modal ── */}
      <Modal
        open={multiModalOpen}
        onClose={() => setMultiModalOpen(false)}
        title="Request Up to 5 Pandits"
        description="Your puja request will be dispatched simultaneously to the selected verified Pandits. As soon as the first Pandit accepts, you will have exactly 1 hour to complete the 50% advance payment."
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (selectedPandits.length === 0) {
              toast.error("Please select at least 1 Pandit.");
              return;
            }
            if (selectedPandits.length > 5) {
              toast.error("You can select at most 5 Pandits.");
              return;
            }
            if (!multiCustomerPhone.trim()) {
              toast.error("Please provide your phone number.");
              return;
            }
            setSubmittingMulti(true);
            try {
              const res = await pujaBookingService.createMultiRequest({
                candidateProviderIds: selectedPandits.map((p) => p.id),
                serviceType: multiServiceType,
                scheduledDate: multiDate,
                shift: multiShift,
                serviceLocation: {
                  city: multiCustomerCity,
                  line1: multiCustomerAddress,
                  notes: multiNotes,
                },
                customerContact: {
                  fullName: multiCustomerName,
                  phone: multiCustomerPhone,
                },
              });
              if (res.data?.success) {
                toast.success(
                  `Booking request sent to ${selectedPandits.length} Pandits! Track incoming responses in your bookings.`,
                );
                setSelectedPandits([]);
                setMultiModalOpen(false);
                navigate("/profile/bookings");
              } else {
                toast.error(res.data?.message || "Failed to create multi-pandit request.");
              }
            } catch (err: any) {
              toast.error(getErrorMessage(err, "Failed to submit booking requests."));
            } finally {
              setSubmittingMulti(false);
            }
          }}
          className="space-y-4"
        >
          {/* Selected Pandits list */}
          <div>
            <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">
              Selected Pandits ({selectedPandits.length}/5)
            </label>
            <div className="flex flex-wrap gap-2">
              {selectedPandits.map((p) => (
                <span
                  key={p.id}
                  className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 px-2.5 py-1 text-xs font-bold text-amber-900 dark:text-amber-300"
                >
                  <Avatar name={p.name} src={p.avatarUrl} size={18} />
                  <span>{p.name}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedPandits((prev) => prev.filter((x) => x.id !== p.id))}
                    className="ml-0.5 text-amber-600 hover:text-rose-600"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Service Type" required>
              <select
                className={inputClass}
                value={multiServiceType}
                onChange={(e) => setMultiServiceType(e.target.value as any)}
              >
                <option value="INDIVIDUAL">Individual / Home Puja</option>
                <option value="GROUP">Group Puja (Samuhik)</option>
                <option value="KATHA">Katha (Bhagwat Katha / Shiv Katha)</option>
              </select>
            </Field>

            <Field label="Ritual / Puja Name" hint="e.g. Satyanarayan Puja, Bhagwat Katha">
              <input
                className={inputClass}
                value={multiRitualName}
                onChange={(e) => setMultiRitualName(e.target.value)}
                placeholder="e.g. Rudrabhishek, Satyanarayan Katha"
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Preferred Date" required>
              <input
                type="date"
                className={inputClass}
                required
                min={new Date().toISOString().slice(0, 10)}
                value={multiDate}
                onChange={(e) => setMultiDate(e.target.value)}
              />
            </Field>

            <Field label="Preferred Shift" required>
              <select
                className={inputClass}
                value={multiShift}
                onChange={(e) => setMultiShift(e.target.value as any)}
              >
                <option value="MORNING">Morning Shift (06:00 - 14:00)</option>
                <option value="EVENING">Evening Shift (14:00 - 22:00)</option>
                <option value="ANY">Any Shift / Flexible</option>
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Your Full Name" required>
              <input
                className={inputClass}
                required
                value={multiCustomerName}
                onChange={(e) => setMultiCustomerName(e.target.value)}
                placeholder="Devotee name for sankalp"
              />
            </Field>

            <Field label="Phone Number" required hint="Stored securely. Private until payment.">
              <input
                type="tel"
                className={inputClass}
                required
                value={multiCustomerPhone}
                onChange={(e) => setMultiCustomerPhone(e.target.value)}
                placeholder="10-digit mobile number"
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Puja City" required>
              <input
                className={inputClass}
                required
                value={multiCustomerCity}
                onChange={(e) => setMultiCustomerCity(e.target.value)}
                placeholder="e.g. Vrindavan, Varanasi, Noida"
              />
            </Field>

            <Field label="Puja Address / Venue">
              <input
                className={inputClass}
                value={multiCustomerAddress}
                onChange={(e) => setMultiCustomerAddress(e.target.value)}
                placeholder="House / Apartment / Ashram address"
              />
            </Field>
          </div>

          <Field label="Special Sankalp Notes / Gotra / Requirements">
            <textarea
              className={inputClass}
              rows={2}
              value={multiNotes}
              onChange={(e) => setMultiNotes(e.target.value)}
              placeholder="Provide Gotra, family member names, or samagri preferences"
            />
          </Field>

          {/* Privacy & Payment Policy Notice */}
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-[11px] space-y-1 text-amber-900 dark:text-amber-200">
            <p className="font-extrabold flex items-center gap-1">
              <ShieldCheck size={14} className="text-[#F28C28]" />
              Mandatory Booking Security &amp; Privacy Rules:
            </p>
            <ul className="list-disc pl-4 space-y-0.5 text-[10px] text-amber-800 dark:text-amber-300">
              <li>Your phone number &amp; Pandit contact details remain <strong>strictly masked</strong> until 50% advance payment is completed.</li>
              <li>Once any Pandit accepts, a <strong>1-hour payment deadline countdown</strong> begins.</li>
              <li>Only one Pandit can be confirmed; competing holds are cancelled automatically upon verified payment.</li>
            </ul>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" type="button" onClick={() => setMultiModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={submittingMulti || selectedPandits.length === 0}>
              <Send size={13} className="mr-1" />
              {submittingMulti ? "Sending Requests…" : `Send Requests to ${selectedPandits.length} Pandits`}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default PublicPanditDirectoryPage;
