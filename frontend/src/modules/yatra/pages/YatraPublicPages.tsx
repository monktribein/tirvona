import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Bus,
  CalendarDays,
  CheckCircle2,
  Clock,
  FileText,
  IndianRupee,
  Link2,
  MapPin,
  Route,
  Search,
  ShieldCheck,
  Sparkles,
  Ticket,
  Users,
  Wallet,
} from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";
import { getErrorMessage } from "../../../lib/api";
import { toast } from "../../../lib/toast";
import { EnterpriseButton } from "../../../admin/shared/components/EnterpriseButton";
import { Empty, Field, inputClass, Panel, PanelState, useRemote } from "../../marketplace/ui";
import { BusResults } from "./YatraSearchResults";
import { SAMPLE_DESTINATIONS, SAMPLE_ORIGINS, isSampleCode, sampleBuses, sampleDeparture } from "./yatraSampleBuses";
import { yatraCustomer, yatraOperator, yatraPublic, yatraRidePartner } from "../services/yatra.service";
import {
  dateLong,
  IST,
  RatingBadge,
  RatingStars,
  dateTimeIst,
  InfoRow,
  mmss,
  paymentError,
  rupees,
  runPayment,
  SeatMap,
  StatusPill,
  timeOnly,
  useCountdown,
  YatraGate,
  ItineraryList,
} from "../yatraUi";

const LINK_KEY = "tirvona:yatra:link";
/** The partner link a visitor arrived through, kept for 24 hours. */
const rememberedLink = (): string | undefined => {
  try {
    const raw = JSON.parse(sessionStorage.getItem(LINK_KEY) ?? "null");
    return raw && Date.now() - raw.at < 86_400_000 ? raw.code : undefined;
  } catch {
    return undefined;
  }
};

const PageTitle: React.FC<{ title: string; subtitle?: string }> = ({ title, subtitle }) => (
  <div className="text-center space-y-2 max-w-3xl mx-auto py-2">
    <h1 className="font-['Kalam'] text-2xl sm:text-4xl font-bold text-[#E58C28]">{title}</h1>
    <div className="flex items-center justify-center gap-2.5 my-1.5" aria-hidden="true">
      <div className="h-[1.5px] w-12 sm:w-24 bg-[#E58C28] rounded-full" />
      <Sparkles size={14} className="text-[#E58C28] fill-[#E58C28] shrink-0" />
      <div className="h-[1.5px] w-12 sm:w-24 bg-[#E58C28] rounded-full" />
    </div>
    {subtitle && <p className="text-xs sm:text-sm font-bold text-[#0B192C] dark:text-gray-200 max-w-xl mx-auto leading-relaxed">{subtitle}</p>}
  </div>
);

const ErrorNote: React.FC<{ message: string }> = ({ message }) => (
  <div role="alert" className="flex items-start gap-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 rounded-2xl px-4 py-3">
    <AlertCircle size={15} className="shrink-0 mt-0.5" />
    <p className="text-xs font-semibold">{message}</p>
  </div>
);

// ===================================================================== search
export const YatraHomePage: React.FC = () => (
  <YatraGate>
    <YatraSearch />
  </YatraGate>
);

/**
 * Shown to signed-in people who have a Yatra workspace: Super Admin, Finance, Destination Ops (HR and
 * Executive), partners and ride partners. Everyone else just sees the Yatra search below.
 */
const YatraWorkspaceLinks: React.FC = () => {
  const { user } = useAuth();
  const role = String(user?.role ?? "");
  const signedIn = Boolean(user);
  const staffLinks: Array<{ to: string; label: string }> =
    role === "super_admin"
      ? [{ to: "/admin/yatra", label: "Yatra management (Super Admin)" }, { to: "/admin/yatra/finance", label: "Finance Center" }, { to: "/ops/yatra", label: "Destination Ops" }]
      : role === "finance_manager"
        ? [{ to: "/admin/yatra/finance", label: "Finance Center" }]
        : role === "hr" || role === "executive"
          ? [{ to: "/ops/yatra", label: "Destination Ops (your area)" }]
          : [];
  const organiser = useRemote<any>(() => (signedIn ? yatraOperator.me() : Promise.resolve({ data: { data: null } })), [signedIn]);
  const partner = useRemote<any>(() => (signedIn ? yatraRidePartner.me() : Promise.resolve({ data: { data: null } })), [signedIn]);
  const links = [...staffLinks];
  if (organiser.data?.registered) links.push({ to: "/operator/dashboard", label: "My partner dashboard" });
  if (partner.data?.registered) links.push({ to: "/ride-partner/dashboard", label: "My ride partner dashboard" });
  if (!links.length) return null;
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mt-4" aria-label="Your Yatra workspace">
      <div className="rounded-2xl border border-[#F28C28]/30 bg-[#FFF4E5]/60 dark:bg-slate-900 p-3 sm:p-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-black text-[#0B192C] dark:text-white mr-1">Your Yatra workspace</span>
        {links.map((l) => (
          <Link key={l.to} to={l.to} className="text-xs font-extrabold px-3 py-1.5 rounded-full bg-[#F28C28] text-white hover:bg-[#E57C18] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F28C28]/50">
            {l.label}
          </Link>
        ))}
      </div>
    </div>
  );
};

const YatraSearch: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const [form, setForm] = useState({
    origin: params.get("origin") ?? "",
    destination: params.get("destination") ?? "",
    date: params.get("date") ?? "",
    seats: params.get("seats") ?? "1",
  });
  const filters = useRemote<{ origins: string[]; destinations: string[] }>(() => yatraPublic.filters(), []);
  const query = useMemo(() => Object.fromEntries(params.entries()), [params]);
  const results = useRemote<any[]>(() => yatraPublic.search({ ...query, limit: 100 }), [JSON.stringify(query)]);
  // Until the first real departure exists, show labelled sample buses (page-only, not bookable) so the page is not bare.
  const platformEmpty = filters.state === "ready" && !(filters.data?.origins?.length ?? 0) && !(filters.data?.destinations?.length ?? 0);
  const samples = useMemo(() => sampleBuses(), []);
  const wantedFrom = (params.get("origin") ?? "").toLowerCase();
  const wantedTo = (params.get("destination") ?? "").toLowerCase();
  const sampleItems = samples.filter((d) => (!wantedFrom || d.tour.originCity.toLowerCase() === wantedFrom) && (!wantedTo || d.tour.destinationCity.toLowerCase() === wantedTo));
  const sampleMode = platformEmpty && results.state === "ready" && !results.data?.length && sampleItems.length > 0;
  const originOptions = platformEmpty ? SAMPLE_ORIGINS : filters.data?.origins ?? [];
  const destinationOptions = platformEmpty ? SAMPLE_DESTINATIONS : filters.data?.destinations ?? [];
  const today = new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setParams(Object.fromEntries(Object.entries(form).filter(([, v]) => v)) as Record<string, string>);
  };

  return (
    <div className="pb-16 lg:pb-24 overflow-x-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6">
        {params.get("origin") || params.get("destination") ? (
          <div>
            <h1 className="font-black text-base sm:text-lg text-[#0B192C] dark:text-white">{params.get("origin") || "Any city"} <span aria-hidden="true">→</span> {params.get("destination") || "Any destination"}</h1>
            <p className="text-xs text-gray-500 mt-0.5">{results.state !== "ready" ? "Finding buses…" : sampleMode ? `${sampleItems.length} sample bus${sampleItems.length === 1 ? "" : "es"}, not available yet` : `${results.meta.total} bus${results.meta.total === 1 ? "" : "es"}`}</p>
          </div>
        ) : (
          <PageTitle title="Tirvona Yatra" subtitle="Bus and group pilgrimages run by verified partners. Choose your seat, pay Tirvona securely and keep the whole journey in one place." />
        )}
      </div>

      <YatraWorkspaceLinks />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
        <form onSubmit={submit} className="bg-white dark:bg-[#0B192C] border border-gray-200 dark:border-slate-700 rounded-xl shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.2fr_auto_auto] items-stretch overflow-hidden" aria-label="Search Yatra departures">
          <label className="flex items-center gap-2.5 px-4 py-2.5 border-b sm:border-b-0 sm:border-r border-gray-200 dark:border-slate-700 min-w-0">
            <Bus size={16} className="text-gray-400 shrink-0" />
            <span className="min-w-0 flex-1"><span className="block text-[10px] text-gray-400">From</span>
              <select aria-label="From" className="w-full bg-transparent text-sm font-bold text-[#0B192C] dark:text-white outline-none" value={form.origin} onChange={(e) => setForm({ ...form, origin: e.target.value })}>
                <option value="">Any city</option>
                {originOptions.map((c) => <option key={c}>{c}</option>)}
              </select></span>
          </label>
          <label className="flex items-center gap-2.5 px-4 py-2.5 border-b sm:border-b-0 lg:border-r border-gray-200 dark:border-slate-700 min-w-0">
            <MapPin size={16} className="text-gray-400 shrink-0" />
            <span className="min-w-0 flex-1"><span className="block text-[10px] text-gray-400">To</span>
              <select aria-label="To" className="w-full bg-transparent text-sm font-bold text-[#0B192C] dark:text-white outline-none" value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })}>
                <option value="">Any destination</option>
                {destinationOptions.map((c) => <option key={c}>{c}</option>)}
              </select></span>
          </label>
          <label className="flex items-center gap-2.5 px-4 py-2.5 border-t lg:border-t-0 sm:border-r border-gray-200 dark:border-slate-700 min-w-0">
            <CalendarDays size={16} className="text-gray-400 shrink-0" />
            <span className="min-w-0 flex-1"><span className="block text-[10px] text-gray-400">Date of journey</span>
              <input aria-label="Travel date" type="date" min={today} className="w-full bg-transparent text-sm font-bold text-[#0B192C] dark:text-white outline-none" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></span>
          </label>
          <div className="flex items-center gap-1.5 px-3 py-2.5 border-t lg:border-t-0 border-gray-200 dark:border-slate-700">
            {[["Today", today], ["Tomorrow", new Date(Date.now() + 330 * 60_000 + 86_400_000).toISOString().slice(0, 10)]].map(([label, value]) => (
              <button key={label} type="button" onClick={() => setForm({ ...form, date: value })} className={`text-[11px] font-bold rounded-full px-3 py-1.5 ${form.date === value ? "bg-orange-100 text-[#F28C28]" : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300"}`}>{label}</button>
            ))}
          </div>
          <button type="submit" aria-label="Search" className="flex items-center justify-center bg-[#F28C28] hover:bg-[#E57C18] text-white px-5 py-3 sm:col-span-2 lg:col-span-1"><Search size={18} /></button>
        </form>
      </div>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 space-y-4" aria-live="polite">
        {results.state !== "ready" ? (
          <PanelState state={results.state} error={results.error} onRetry={results.reload} />
        ) : sampleMode ? (
          <BusResults items={sampleItems} sample />
        ) : !results.data?.length ? (
          <Empty icon={<Bus size={28} className="text-gray-300" />} title="No departures match" text="Try another date or destination. New departures are added as partners are verified." />
        ) : (
          <BusResults items={results.data} />
        )}
      </section>

      {!(params.get("origin") || params.get("destination")) && (
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { icon: <Search size={18} />, title: "Find a departure", text: "Every departure is from a partner verified by Tirvona, on a verified vehicle." },
          { icon: <Ticket size={18} />, title: "Pick seats and pay Tirvona", text: "Seats are held while you pay. Payment goes to Tirvona, never to a third party." },
          { icon: <Route size={18} />, title: "Manage your journey", text: "Ticket, boarding point, itinerary, meals and puja requests in My Journeys." },
        ].map((s) => (
          <div key={s.title} className="tv-stat">
            <div className="tv-stat-head">
              <span className="tv-stat-label">{s.title}</span>
              <span className="tv-stat-icon">{s.icon}</span>
            </div>
            <p className="tv-stat-hint !mt-2">{s.text}</p>
          </div>
        ))}
      </section>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 text-center">
        <Link to="/yatra-partner" className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#F28C28] hover:underline">
          Are you a pilgrimage tour organiser? Partner with Tirvona Yatra <ArrowRight size={13} />
        </Link>
      </div>
    </div>
  );
};

/** The bus: photos, what Tirvona verified about it (the files stay private), and its amenities. */
const YourBus: React.FC<{ vehicle: any }> = ({ vehicle }) => {
  const [open, setOpen] = useState(0);
  const images: string[] = vehicle.images ?? [];
  const pollution = vehicle.pollutionValidTill ? new Date(vehicle.pollutionValidTill) : null;
  return (
    <Panel title={<span className="flex items-center gap-2"><Bus size={15} className="text-[#F28C28]" /> Your bus</span>}>
      <div className="space-y-3">
        {images.length > 0 && (
          <div className="space-y-2">
            <div className="rounded-2xl overflow-hidden bg-gray-50 dark:bg-slate-900 h-44 sm:h-60">
              <img src={images[open] ?? images[0]} alt={`Bus photo ${open + 1} of ${images.length}`} className="w-full h-full object-cover" loading="lazy" decoding="async" />
            </div>
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Bus photos">
                {images.map((src, i) => (
                  <button key={src} type="button" role="tab" aria-selected={i === open} aria-label={`Show photo ${i + 1}`} onClick={() => setOpen(i)} className={`h-14 w-20 shrink-0 rounded-lg overflow-hidden border-2 ${i === open ? "border-[#F28C28]" : "border-transparent"}`}>
                    <img src={src} alt="" className="w-full h-full object-cover" loading="lazy" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <p className="text-xs font-bold text-gray-600 dark:text-gray-300">
          {[vehicle.make, vehicle.model].filter(Boolean).join(" ") || String(vehicle.vehicleType ?? "bus").replace(/_/g, " ")} · {vehicle.seatCapacity} seats{vehicle.isAc ? " · Air conditioned" : ""}
        </p>
        <div className="flex flex-wrap gap-2">
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black ${vehicle.rcVerified ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-gray-100 text-gray-500 dark:bg-slate-800"}`}>
            <ShieldCheck size={12} /> {vehicle.rcVerified ? "RC verified by Tirvona" : "RC not verified yet"}
          </span>
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black ${pollution ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-gray-100 text-gray-500 dark:bg-slate-800"}`}>
            <ShieldCheck size={12} /> {pollution ? `Pollution certificate valid till ${dateLong(pollution)}` : "Pollution certificate not shown"}
          </span>
        </div>
        {vehicle.amenities?.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {vehicle.amenities.map((a: string) => <li key={a} className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800">{a}</li>)}
          </ul>
        )}
      </div>
    </Panel>
  );
};

/** What travellers say about the partner (first names only). */
const TravellerReviews: React.FC<{ operator: any }> = ({ operator }) => (
  <Panel title={<span className="flex flex-wrap items-center gap-2">Traveller reviews <RatingStars rating={operator.rating} /></span>}>
    <ul className="divide-y divide-gray-50 dark:divide-slate-800">
      {operator.reviews.map((r: any, i: number) => (
        <li key={`${r.name}-${i}`} className="py-3 space-y-1">
          <p className="text-xs font-black flex items-center gap-2"><span className="text-amber-600" aria-label={`${r.stars} out of 5`}>{"★".repeat(r.stars)}<span className="text-gray-300">{"★".repeat(5 - r.stars)}</span></span> {r.name}</p>
          <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">{r.comment}</p>
        </li>
      ))}
    </ul>
  </Panel>
);

/** One highlight card: a short fact about the trip, the bus or the partner. */
const Highlight: React.FC<{ title: string; text: string; tone?: "good" }> = ({ title, text, tone }) => (
  <div className={`rounded-2xl border p-3 ${tone === "good" ? "border-emerald-100 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/30" : "border-gray-100 bg-white dark:border-slate-800 dark:bg-[#0B192C]"}`}>
    <p className="text-xs font-black text-[#0B192C] dark:text-white">{title}</p>
    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{text}</p>
  </div>
);

const hoursLabel = (h: number) => (h >= 24 && h % 24 === 0 ? `${h / 24} day${h === 24 ? "" : "s"}` : `${h} hour${h === 1 ? "" : "s"}`);

const clock24 = (value?: string | Date | null) => (value ? new Date(value).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: IST }) : "—");
const dayShort = (value?: string | Date | null) => (value ? new Date(value).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: IST }) : "");

type DetailTab = "highlights" | "cancellation" | "route" | "itinerary" | "policies" | "reviews";
const TAB_ALIASES: Record<string, DetailTab> = { highlights: "highlights", photos: "highlights", cancellation: "cancellation", route: "route", boarding: "route", itinerary: "itinerary", policies: "policies", reviews: "reviews", ratings: "reviews" };

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => <h3 className="text-sm font-black text-[#0B192C] dark:text-white mb-2.5">{children}</h3>;

/** A vertical list of stops: a dot, the time, the name and where it is. */
const StopList: React.FC<{ items: any[]; empty: string }> = ({ items, empty }) =>
  items.length ? (
    <ol className="relative ml-1.5 border-l-2 border-dashed border-gray-200 dark:border-slate-700 space-y-3.5 pl-4">
      {items.map((p) => (
        <li key={p.id ?? p.name} className="relative">
          <span className="absolute -left-[1.4rem] top-1 h-2.5 w-2.5 rounded-full bg-white dark:bg-[#0B192C] border-2 border-[#F28C28]" aria-hidden="true" />
          <p className="text-xs text-[#0B192C] dark:text-white">
            <b className="tabular-nums">{p.time ? clock24(p.time) : "—"}</b>
            <span className="mx-1.5 text-gray-300">·</span>
            <b>{p.name}</b>
            {p.durationMinutes ? <span className="text-gray-400 font-bold"> · {p.durationMinutes} min stop</span> : null}
          </p>
          {(p.landmark || p.address) && <p className="text-[11px] text-gray-500 mt-0.5">{[p.landmark, p.address].filter(Boolean).join(", ")}</p>}
        </li>
      ))}
    </ol>
  ) : (
    <p className="text-xs text-gray-500">{empty}</p>
  );

/** The tabs on the right of the departure page: highlights, cancellation, route, itinerary, policies and reviews. */
const DepartureDetails: React.FC<{ d: any; tour: any }> = ({ d, tour }) => {
  const [params] = useSearchParams();
  const [tab, setTab] = useState<DetailTab>(TAB_ALIASES[params.get("tab") ?? ""] ?? "highlights");
  const vehicle = d.vehicle;
  const dep = d.departure;
  const rating = d.operator?.rating;
  const pollution = vehicle?.pollutionValidTill ? new Date(vehicle.pollutionValidTill) : null;
  const windows = [...(tour.cancellationPolicy?.windows ?? [])].sort((a: any, b: any) => b.hoursBefore - a.hoursBefore);
  const tabs: Array<{ id: DetailTab; label: string }> = [
    { id: "highlights", label: "Highlights" },
    { id: "cancellation", label: "Cancellation policy" },
    { id: "route", label: "Bus route" },
    { id: "itinerary", label: "Itinerary" },
    { id: "policies", label: "Other policies" },
    { id: "reviews", label: rating?.count ? `Ratings & reviews` : "Reviews" },
  ];
  const seatKinds: string[] = [...new Set<string>((dep.seatLayout?.seats ?? []).map((s: any) => String(s.kind ?? "seater")))];
  const decks = new Set((dep.seatLayout?.seats ?? []).map((s: any) => s.deck ?? "lower")).size > 1 ? 2 : 1;
  const features = [vehicle?.isAc ? "Air conditioned" : "Non-AC", seatKinds.includes("sleeper") ? "Sleeper berths" : "Seater", decks === 2 ? "Double decker" : "Single decker", ...(vehicle?.amenities ?? [])];
  const stops = tour.stops?.length ? tour.stops.map((s: any) => s.name) : [`${tour.originCity}`, `${tour.destinationCity}`];

  return (
    <div className="space-y-4">
      <div className="flex gap-5 overflow-x-auto border-b border-gray-100 dark:border-slate-800" role="tablist" aria-label="Trip details">
        {tabs.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={`shrink-0 pb-2.5 text-xs font-bold border-b-2 -mb-px focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F28C28]/60 rounded-t ${tab === t.id ? "border-[#F28C28] text-[#F28C28]" : "border-transparent text-gray-500 hover:text-[#0B192C] dark:hover:text-white"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "highlights" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {vehicle && <Highlight title={[vehicle.make, vehicle.model].filter(Boolean).join(" ") || String(vehicle.vehicleType ?? "bus").replace(/_/g, " ")} text={`${vehicle.seatCapacity} seats · ${vehicle.isAc ? "Air conditioned" : "Non-AC"}${decks === 2 ? " · Double decker" : ""}`} />}
          <Highlight title={`${dep.seatsLeft} seat${dep.seatsLeft === 1 ? "" : "s"} left`} text={`of ${dep.capacity} · ${dep.seatMode === "auto" ? "Seats are assigned for you" : "Choose your own seat"}`} />
          {vehicle?.rcVerified && <Highlight tone="good" title="RC verified" text="Registration certificate checked by Tirvona" />}
          {pollution && <Highlight tone="good" title="Pollution certificate valid" text={`Valid till ${dateLong(pollution)}`} />}
          {d.operator?.yearsInBusiness > 0 && <Highlight title={`${d.operator.yearsInBusiness} year${d.operator.yearsInBusiness === 1 ? "" : "s"} of experience`} text={`${d.operator.name}, verified by Tirvona`} />}
          {rating?.count > 0 && <Highlight title={`Rated ${rating.average.toFixed(1)} out of 5`} text={`By ${rating.count} traveller${rating.count === 1 ? "" : "s"} after their trip`} />}
          {dep.charterEnabled && <Highlight title="Whole bus bookable" text="Travelling as a group? Ask the partner for the full bus." />}
          {dep.restStops?.length > 0 && <Highlight title={`${dep.restStops.length} rest stop${dep.restStops.length === 1 ? "" : "s"}`} text={dep.restStops.map((r: any) => r.name).join(", ")} />}
        </div>
      )}

      {tab === "cancellation" && (
        <div>
          <SectionTitle>Cancellation policy</SectionTitle>
          <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-slate-800">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 dark:bg-slate-900 text-left text-[10px] uppercase tracking-wider text-gray-400">
                <tr><th className="px-3 py-2.5 font-black">Time before departure</th><th className="px-3 py-2.5 font-black text-right">Refund</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-slate-800">
                {windows.map((w: any) => (
                  <tr key={w.hoursBefore}><td className="px-3 py-2.5">{hoursLabel(w.hoursBefore)} or more before departure</td><td className="px-3 py-2.5 text-right font-black text-emerald-700 dark:text-emerald-400">{w.refundPercent}% refund</td></tr>
                ))}
                <tr><td className="px-3 py-2.5">{windows.length ? `Less than ${hoursLabel(windows[windows.length - 1].hoursBefore)} before departure` : "Any time before departure"}</td><td className="px-3 py-2.5 text-right font-black">{tour.cancellationPolicy?.defaultRefundPercent ?? 0}% refund</td></tr>
              </tbody>
            </table>
          </div>
          <ul className="mt-3 space-y-1.5 text-[11px] text-gray-500 list-disc pl-4 leading-relaxed">
            <li>The refund is a percentage of the fare you paid. The time is counted from the departure of this trip: {dateTimeIst(dep.departAt)}.</li>
            <li>Cancellations are reviewed by Tirvona. An approved refund goes to your Tirvona wallet, not back to the card or bank you paid with.</li>
            <li>A booking is cancelled as a whole. Cancelling only some of the seats in a booking is not available.</li>
            <li>There is no paid "free cancellation" add-on on Tirvona Yatra. The refund percentages above are what applies.</li>
            <li>If the partner or Tirvona cancels the departure, you are refunded in full.</li>
          </ul>
        </div>
      )}

      {tab === "route" && (
        <div className="space-y-6">
          <div>
            <SectionTitle>Bus route</SectionTitle>
            <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">{stops.join("  →  ")}</p>
          </div>
          <div><SectionTitle>Boarding point</SectionTitle><StopList items={dep.boardingPoints ?? []} empty="Boarding points will be shared by the partner." /></div>
          <div><SectionTitle>Dropping point</SectionTitle><StopList items={dep.droppingPoints ?? []} empty="The partner has not listed dropping points for this trip." /></div>
          <div><SectionTitle>Rest stop</SectionTitle><StopList items={dep.restStops ?? []} empty="This bus has no rest stop." /></div>
          <div>
            <SectionTitle>Bus features</SectionTitle>
            <ul className="flex flex-wrap gap-1.5">{features.map((f) => <li key={f} className="text-[11px] font-bold px-2.5 py-1 rounded-md bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800">{f}</li>)}</ul>
          </div>
        </div>
      )}

      {tab === "itinerary" && (
        <div className="space-y-5">
          <div>
            <SectionTitle>Day-by-day itinerary</SectionTitle>
            <ItineraryList days={tour.itinerary} />
          </div>
          {tour.stops?.length > 0 && (
            <div>
              <SectionTitle>Route and stops</SectionTitle>
              <ul className="flex flex-wrap gap-2">
                {tour.stops.map((s: any) => (
                  <li key={`${s.order}-${s.name}`} className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800">Day {s.dayNumber} · {s.name}{s.city ? `, ${s.city}` : ""}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <SectionTitle>Included</SectionTitle>
              <ul className="space-y-1.5">{tour.inclusions.map((x: string) => <li key={x} className="text-xs flex gap-2"><CheckCircle2 size={13} className="text-emerald-500 shrink-0 mt-0.5" />{x}</li>)}</ul>
            </div>
            <div>
              <SectionTitle>Not included</SectionTitle>
              {tour.exclusions?.length ? <ul className="space-y-1.5">{tour.exclusions.map((x: string) => <li key={x} className="text-xs text-gray-500">• {x}</li>)}</ul> : <p className="text-xs text-gray-400">Nothing listed.</p>}
            </div>
          </div>
        </div>
      )}

      {tab === "policies" && (
        <div>
          <SectionTitle>Other policies</SectionTitle>
          <ul className="space-y-2.5">
            {(tour.policies ?? []).map((p: any) => (
              <li key={p.key} className="rounded-xl border border-gray-100 dark:border-slate-800 p-3">
                <p className="text-xs font-black text-[#0B192C] dark:text-white">{p.title}</p>
                <p className="text-[11px] text-gray-500 leading-relaxed mt-0.5">{p.text}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === "reviews" && (
        <div className="space-y-5">
          {rating?.count > 0 ? (
            <>
              <div className="flex flex-wrap items-center gap-5">
                <div className="text-center">
                  <p className="text-3xl font-black text-[#0B192C] dark:text-white leading-none">{rating.average.toFixed(1)}<span className="text-amber-500 text-xl"> ★</span></p>
                  <p className="text-[11px] text-gray-500 mt-1">{rating.count} rating{rating.count === 1 ? "" : "s"}</p>
                </div>
                <ul className="flex-1 min-w-[12rem] space-y-1" aria-label="Rating distribution">
                  {[5, 4, 3, 2, 1].map((stars, i) => {
                    const n = rating.breakdown?.[i] ?? 0;
                    return (
                      <li key={stars} className="flex items-center gap-2 text-[11px] text-gray-600 dark:text-gray-300">
                        <span className="w-6 tabular-nums">{stars} ★</span>
                        <span className="flex-1 h-1.5 rounded-full bg-gray-100 dark:bg-slate-800 overflow-hidden"><span className="block h-full bg-emerald-500" style={{ width: `${rating.count ? (n / rating.count) * 100 : 0}%` }} /></span>
                        <span className="w-6 text-right tabular-nums">{n}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
              {rating.tags?.length > 0 && (
                <div>
                  <SectionTitle>Loved by travellers</SectionTitle>
                  <ul className="flex flex-wrap gap-1.5">{rating.tags.map((t: any) => <li key={t.tag} className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">{t.tag} · {t.count}</li>)}</ul>
                </div>
              )}
              <p className="text-[11px] font-bold text-gray-500">Real feedback from verified travellers</p>
            </>
          ) : null}
          {d.operator?.reviews?.length > 0 ? <TravellerReviews operator={d.operator} /> : <p className="text-xs text-gray-500">No written reviews yet. People who travel with {d.operator?.name} can rate their trip once it has finished.</p>}
        </div>
      )}
    </div>
  );
};

/** "Travelling as a group?": asks the partner for every seat of this departure. */
const CharterCard: React.FC<{ code: string; dep: any; signedIn: boolean; contact: { name: string; phone: string } }> = ({ code, dep, signedIn, contact }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ groupSize: "", name: contact.name, phone: contact.phone, message: "" });
  if (!dep.charterEnabled) return null;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!/^\+?[0-9][0-9 -]{7,15}$/.test(form.phone)) return setError("Enter a valid phone number.");
    setBusy(true);
    try {
      await yatraCustomer.requestCharter({ departureCode: code, groupSize: Number(form.groupSize), contact: { name: form.name.trim(), phone: form.phone.trim() }, message: form.message.trim() || undefined });
      setSent(true);
    } catch (err) {
      setError(getErrorMessage(err, "Your request could not be sent."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="rounded-xl border border-[#F28C28]/30 bg-[#FFF4E5]/60 dark:bg-slate-900 p-3.5">
      <p className="text-xs font-black text-[#0B192C] dark:text-white">Travelling as a group? Book the whole bus</p>
      <p className="text-[11px] text-gray-600 dark:text-gray-300 mt-0.5">Send a request to the partner. If they accept, all {dep.capacity} seats are held for you and you pay through Tirvona as usual.</p>
      {sent ? (
        <p className="mt-2 text-xs font-bold text-emerald-700 dark:text-emerald-400">Request sent. We will notify you when the partner answers. <Link to="/profile/journeys" className="underline">My journeys</Link></p>
      ) : !open ? (
        <button type="button" onClick={() => (signedIn ? setOpen(true) : navigate(`/login?redirect=${encodeURIComponent(location.pathname)}`))} className="mt-2 text-xs font-extrabold text-[#F28C28] hover:underline">{signedIn ? "Request the whole bus" : "Sign in to request"}</button>
      ) : (
        <form onSubmit={submit} className="mt-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input aria-label="Group size" type="number" min={1} max={120} required placeholder="Group size" className={inputClass} value={form.groupSize} onChange={(e) => setForm({ ...form, groupSize: e.target.value })} />
            <input aria-label="Phone" type="tel" required placeholder="Phone" className={inputClass} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <input aria-label="Your name" required minLength={2} placeholder="Your name" className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <textarea aria-label="Message to the partner" rows={2} maxLength={1000} placeholder="Tell the partner about your group (optional)" className={inputClass} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
          {error && <ErrorNote message={error} />}
          <div className="flex gap-2">
            <EnterpriseButton type="submit" disabled={busy} className="justify-center">{busy ? "Sending…" : "Send request"}</EnterpriseButton>
            <button type="button" onClick={() => setOpen(false)} className="text-xs font-bold text-gray-500 px-3">Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
};

// ============================================================= departure page
export const YatraDeparturePage: React.FC = () => (
  <YatraGate>
    <DepartureDetail />
  </YatraGate>
);

const blankPassenger = () => ({ name: "", age: "", gender: "" });
type Step = "seats" | "points" | "passengers";

const DepartureDetail: React.FC = () => {
  const { code = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const sampleTrip = isSampleCode(code) ? sampleDeparture(code) : null;
  const detail = useRemote<any>(() => (sampleTrip ? Promise.resolve({ data: { data: sampleTrip.detail } }) : yatraPublic.departure(code)), [code]);
  const seatMap = useRemote<any>(() => (sampleTrip ? Promise.resolve({ data: { data: sampleTrip.seats } }) : yatraPublic.seats(code)), [code]);
  const [step, setStep] = useState<Step>("seats");
  const [selected, setSelected] = useState<string[]>([]);
  const [count, setCount] = useState(1);
  const [boarding, setBoarding] = useState("");
  const [dropping, setDropping] = useState("");
  const [photo, setPhoto] = useState(0);
  const [protect, setProtect] = useState(false);
  const [addOnKeys, setAddOnKeys] = useState<string[]>([]);
  const [travellers, setTravellers] = useState([blankPassenger()]);
  const [contact, setContact] = useState({ name: "", phone: "", email: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const d = detail.data;
  const choose = d?.departure.seatMode === "choose";
  const seatsWanted = choose ? selected.length : count;
  const max = d?.maxSeatsPerBooking ?? 10;

  useEffect(() => {
    if (user) setContact((c) => ({ name: c.name || user.name || "", phone: c.phone || user.phone || "", email: c.email || user.email || "" }));
  }, [user]);
  useEffect(() => {
    setTravellers((list) => {
      const n = Math.max(1, seatsWanted);
      return list.length === n ? list : Array.from({ length: n }, (_, i) => list[i] ?? blankPassenger());
    });
  }, [seatsWanted]);
  useEffect(() => {
    if (d?.departure.boardingPoints?.length && !boarding) setBoarding(d.departure.boardingPoints[0].id);
    if (d?.departure.droppingPoints?.length && !dropping) setDropping(d.departure.droppingPoints[0].id);
  }, [d, boarding, dropping]);

  if (detail.state !== "ready" || !d)
    return (
      <div className="max-w-5xl mx-auto px-4 py-10">
        <PanelState state={detail.state} error={detail.error} onRetry={detail.reload} missingText="This departure was not found or is no longer listed." />
      </div>
    );

  const toggle = (seatNo: string) =>
    setSelected((s) => (s.includes(seatNo) ? s.filter((x) => x !== seatNo) : s.length >= max ? s : [...s, seatNo]));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!user && !sampleTrip) {
      navigate(`/login?redirect=${encodeURIComponent(location.pathname)}`);
      return;
    }
    if (seatsWanted < 1) return setError("Choose at least one seat.");
    if (travellers.some((t) => t.name.trim().length < 2)) return setError("Enter every traveller's name.");
    if (!/^\+?[0-9][0-9 -]{7,15}$/.test(contact.phone)) return setError("Enter a valid contact phone number.");
    // Sample buses are page-only: everything above is filled in, then payment is where it stops.
    if (sampleTrip) return setError("Payment is not available for this bus yet.");
    setBusy(true);
    try {
      const res = await yatraCustomer.createBooking({
        departureCode: code,
        seats: choose ? selected : undefined,
        passengers: travellers.map((t) => ({ name: t.name.trim(), age: t.age ? Number(t.age) : undefined, gender: t.gender || undefined })),
        contact: { name: contact.name.trim() || travellers[0].name.trim(), phone: contact.phone.trim(), email: contact.email.trim() || undefined },
        boardingPointId: boarding,
        droppingPointId: dropping || undefined,
        cancellationProtection: protect || undefined,
        addOns: addOnKeys.length ? addOnKeys : undefined,
        linkCode: rememberedLink(),
      });
      navigate(`/yatra/checkout/${res.data.data.id}`);
    } catch (err) {
      setError(getErrorMessage(err, "Those seats could not be held. Please try again."));
      seatMap.reload();
      setSelected([]);
      setStep("seats");
    } finally {
      setBusy(false);
    }
  };

  const tour = d.tour;
  const dep = d.departure;
  const vehicle = d.vehicle;
  const images: string[] = [...(vehicle?.images ?? []), ...(tour.coverImage ? [tour.coverImage] : [])];
  const bus = [vehicle?.make, vehicle?.model].filter(Boolean).join(" ") || String(vehicle?.vehicleType ?? "bus").replace(/_/g, " ");
  // Every seat has its own rate; seats without one cost the departure's default fare.
  const seatCells: any[] = seatMap.state === "ready" ? seatMap.data.seats : [];
  const priceOf = (seatNo: string) => seatCells.find((s) => s.seatNo === seatNo)?.price ?? dep.fare;
  const fareTotal = choose ? selected.reduce((sum, n) => sum + Number(priceOf(n)), 0) : dep.fare * Math.max(0, seatsWanted);
  const protection = d.protection ?? { feePerSeat: 15, refundPercent: 100, cutoffHours: 6 };
  const protectionFee = protect ? protection.feePerSeat * Math.max(0, seatsWanted) : 0;
  const offeredAddOns: any[] = d.tour?.serviceAddOns ?? [];
  const pickedAddOns = offeredAddOns.filter((a) => addOnKeys.includes(a.key));
  const addOnsTotal = pickedAddOns.reduce((sum, a) => sum + a.price * Math.max(0, seatsWanted), 0);
  const total = fareTotal + protectionFee + addOnsTotal;
  const lowestPrice = choose && seatCells.length ? Math.min(dep.fare, ...seatCells.map((s) => Number(s.price ?? dep.fare))) : dep.fare;
  const steps: Array<{ id: Step; label: string }> = [
    { id: "seats", label: "Select seats" },
    { id: "points", label: "Board/Drop point" },
    { id: "passengers", label: "Passenger info" },
  ];
  const boardingPoint = dep.boardingPoints.find((p: any) => p.id === boarding);
  const droppingPoint = (dep.droppingPoints ?? []).find((p: any) => p.id === dropping);
  const goPoints = () => {
    if (seatsWanted < 1) return setError("Choose at least one seat.");
    setError("");
    setStep("points");
  };
  const goPassengers = () => {
    if (!boarding) return setError("Choose a boarding point.");
    if (dep.droppingPoints?.length && !dropping) return setError("Choose a dropping point.");
    setError("");
    setStep("passengers");
  };
  const reachable = (id: Step) => id === "seats" || (id === "points" && seatsWanted > 0) || (id === "passengers" && seatsWanted > 0 && Boolean(boarding));

  const radio = (list: any[], value: string, set: (v: string) => void, name: string) => (
    <ul className="space-y-2">
      {list.map((p) => (
        <li key={p.id}>
          <label className={`flex gap-3 rounded-xl border p-3 cursor-pointer ${value === p.id ? "border-[#F28C28] bg-orange-50/60 dark:bg-slate-900" : "border-gray-100 dark:border-slate-800"}`}>
            <input type="radio" name={name} className="mt-1 accent-[#F28C28]" checked={value === p.id} onChange={() => set(p.id)} />
            <span className="min-w-0">
              <span className="block text-xs font-black text-[#0B192C] dark:text-white"><span className="tabular-nums">{p.time ? clock24(p.time) : "—"}</span> · {p.name}</span>
              {(p.landmark || p.address) && <span className="block text-[11px] text-gray-500 mt-0.5">{[p.landmark, p.address].filter(Boolean).join(", ")}</span>}
            </span>
          </label>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="pb-16 lg:pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-3 sm:pt-5">
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          {/* top bar: where you are going and the three steps */}
          <div className="flex items-center gap-3 px-4 sm:px-6 py-3 border-b border-gray-100 dark:border-slate-800">
            <button type="button" aria-label="Back to results" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/yatra"))} className="p-1.5 -ml-1.5 rounded-full text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800"><ArrowLeft size={18} /></button>
            <div className="min-w-0">
              <h1 className="text-sm font-black text-[#0B192C] dark:text-white truncate">{tour.originCity} <span aria-hidden="true">→</span> {tour.destinationCity}</h1>
              <p className="text-[11px] text-gray-500 truncate">{tour.title}</p>
            </div>
            <span className="ml-auto text-right shrink-0"><span className="block text-sm font-black text-[#0B192C] dark:text-white">{rupees(lowestPrice)}</span><span className="block text-[10px] text-gray-400">{lowestPrice < dep.fare || seatCells.some((s) => Number(s.price) > dep.fare) ? "onwards, per seat" : "per seat"}</span></span>
          </div>
          <div className="flex justify-center gap-5 sm:gap-10 border-b border-gray-100 dark:border-slate-800 px-4 overflow-x-auto" role="tablist" aria-label="Booking steps">
            {steps.map((s, i) => (
              <button key={s.id} type="button" role="tab" aria-selected={step === s.id} disabled={!reachable(s.id)} onClick={() => { setError(""); setStep(s.id); }} className={`shrink-0 py-3 text-xs font-bold border-b-2 -mb-px disabled:opacity-40 disabled:cursor-not-allowed ${step === s.id ? "border-[#F28C28] text-[#F28C28]" : "border-transparent text-gray-500"}`}>
                <span className="mr-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-gray-100 dark:bg-slate-800 text-[10px] text-gray-600 dark:text-gray-300">{i + 1}</span>
                {s.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,480px)_minmax(0,1fr)] bg-gray-50/70 dark:bg-slate-950/40">
            {/* left: the step you are on */}
            <form onSubmit={submit} className="p-4 sm:p-6 space-y-4 lg:border-r border-gray-100 dark:border-slate-800" aria-label="Book seats">
              {!d.bookable ? (
                <ErrorNote message={d.unavailableReason ?? "Booking is closed for this departure."} />
              ) : (
                <>
                  {step === "seats" && (
                    <div className="space-y-3">
                      {choose ? (
                        seatMap.state === "ready" ? (
                          <SeatMap seats={seatMap.data.seats} columns={seatMap.data.columns} selected={selected} onToggle={toggle} max={max} price={dep.fare} />
                        ) : (
                          <PanelState state={seatMap.state} error={seatMap.error} onRetry={seatMap.reload} />
                        )
                      ) : (
                        <Field label="Number of seats" hint={`Seats are assigned automatically. ${dep.seatsLeft} left.`}>
                          <input type="number" min={1} max={Math.min(max, dep.seatsLeft)} className={inputClass} value={count} onChange={(e) => setCount(Math.max(1, Math.min(max, Number(e.target.value) || 1)))} />
                        </Field>
                      )}
                      {choose && <p className="text-[11px] text-gray-500">Tap seats to choose them · up to {max}</p>}
                    </div>
                  )}

                  {step === "points" && (
                    <div className="space-y-5">
                      <div><SectionTitle>Boarding point</SectionTitle>{radio(dep.boardingPoints, boarding, setBoarding, "boarding")}</div>
                      {dep.droppingPoints?.length > 0 && <div><SectionTitle>Dropping point</SectionTitle>{radio(dep.droppingPoints, dropping, setDropping, "dropping")}</div>}
                    </div>
                  )}

                  {step === "passengers" && (
                    <div className="space-y-4">
                      <fieldset className="space-y-3">
                        <legend className="text-sm font-black text-[#0B192C] dark:text-white mb-1">Passenger information</legend>
                        {travellers.map((t, i) => (
                          <div key={i} className="grid grid-cols-[1fr_64px_96px] gap-2">
                            <input aria-label={`Traveller ${i + 1} name`} placeholder={`Traveller ${i + 1}${choose && selected[i] ? ` · seat ${selected[i]}` : ""}`} className={inputClass} value={t.name} onChange={(e) => setTravellers(travellers.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} required minLength={2} />
                            <input aria-label={`Traveller ${i + 1} age`} placeholder="Age" type="number" min={0} max={120} className={inputClass} value={t.age} onChange={(e) => setTravellers(travellers.map((x, j) => (j === i ? { ...x, age: e.target.value } : x)))} />
                            <select aria-label={`Traveller ${i + 1} gender`} className={inputClass} value={t.gender} onChange={(e) => setTravellers(travellers.map((x, j) => (j === i ? { ...x, gender: e.target.value } : x)))}>
                              <option value="">Gender</option>
                              <option value="female">Female</option>
                              <option value="male">Male</option>
                              <option value="other">Other</option>
                            </select>
                          </div>
                        ))}
                      </fieldset>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <Field label="Contact phone" required>
                          <input type="tel" className={inputClass} value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} required />
                        </Field>
                        <Field label="Email (optional)">
                          <input type="email" className={inputClass} value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} />
                        </Field>
                      </div>
                      {offeredAddOns.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-[11px] font-black uppercase tracking-wide text-gray-500">Add to your trip (optional)</p>
                          {offeredAddOns.map((a) => {
                            const on = addOnKeys.includes(a.key);
                            return (
                              <label key={a.key} className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer ${on ? "border-[#F28C28] bg-orange-50/60 dark:bg-slate-900" : "border-gray-200 dark:border-slate-700"}`}>
                                <input type="checkbox" className="mt-0.5 accent-[#F28C28]" checked={on} onChange={(e) => setAddOnKeys(e.target.checked ? [...addOnKeys, a.key] : addOnKeys.filter((k) => k !== a.key))} />
                                <span className="text-xs">
                                  <span className="block font-black text-[#0B192C] dark:text-white">{a.title} · {rupees(a.price)} per traveller{seatsWanted > 0 ? ` (${rupees(a.price * seatsWanted)})` : ""}</span>
                                  {a.note && <span className="block text-[11px] text-gray-500 mt-0.5 leading-relaxed">{a.note}</span>}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                      <label className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer ${protect ? "border-[#F28C28] bg-orange-50/60 dark:bg-slate-900" : "border-gray-200 dark:border-slate-700"}`}>
                        <input type="checkbox" className="mt-0.5 accent-[#F28C28]" checked={protect} onChange={(e) => setProtect(e.target.checked)} />
                        <span className="text-xs">
                          <span className="block font-black text-[#0B192C] dark:text-white">Add cancellation protection · {rupees(protection.feePerSeat)} per seat{seatsWanted > 0 ? ` (${rupees(protection.feePerSeat * seatsWanted)})` : ""}</span>
                          <span className="block text-[11px] text-gray-500 mt-0.5 leading-relaxed">Get {protection.refundPercent}% of the fare back in your Tirvona wallet if you cancel at least {protection.cutoffHours} hours before departure. The protection fee itself is not refunded. Without it, the cancellation policy percentages apply.</span>
                        </span>
                      </label>
                    </div>
                  )}

                  {error && <ErrorNote message={error} />}

                  {/* the bar every step ends with: what you picked and the way on */}
                  <div className="rounded-xl bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 p-3.5 space-y-2.5">
                    <dl className="text-xs space-y-1.5">
                      <div className="flex justify-between gap-3"><dt className="text-gray-500">{choose ? "Seat no." : "Seats"}</dt><dd className="font-black text-right">{choose ? (selected.length ? selected.join(", ") : "—") : count}</dd></div>
                      {step !== "seats" && boardingPoint && <div className="flex justify-between gap-3"><dt className="text-gray-500">Boarding</dt><dd className="font-bold text-right">{clock24(boardingPoint.time)} · {boardingPoint.name}</dd></div>}
                      {step === "passengers" && droppingPoint && <div className="flex justify-between gap-3"><dt className="text-gray-500">Dropping</dt><dd className="font-bold text-right">{clock24(droppingPoint.time)} · {droppingPoint.name}</dd></div>}
                      {(protectionFee > 0 || addOnsTotal > 0) && (
                        <>
                          <div className="flex justify-between gap-3"><dt className="text-gray-500">Seat fare</dt><dd className="font-bold text-right">{rupees(fareTotal)}</dd></div>
                          {pickedAddOns.map((a) => <div key={a.key} className="flex justify-between gap-3"><dt className="text-gray-500">{a.title}</dt><dd className="font-bold text-right">{rupees(a.price * seatsWanted)}</dd></div>)}
                          {protectionFee > 0 && <div className="flex justify-between gap-3"><dt className="text-gray-500">Cancellation protection</dt><dd className="font-bold text-right">{rupees(protectionFee)}</dd></div>}
                        </>
                      )}
                      <div className="flex justify-between gap-3 pt-1.5 border-t border-gray-100 dark:border-slate-800"><dt className="font-bold">Total</dt><dd className="text-base font-black text-[#0B192C] dark:text-white">{rupees(total)}</dd></div>
                    </dl>
                    <div className="flex gap-2">
                      {step !== "seats" && <button type="button" onClick={() => { setError(""); setStep(step === "passengers" ? "points" : "seats"); }} className="rounded-full border border-gray-200 dark:border-slate-700 text-xs font-extrabold px-4 py-2.5 text-gray-600 dark:text-gray-300">Back</button>}
                      {step === "seats" && <EnterpriseButton type="button" disabled={seatsWanted < 1} onClick={goPoints} className="flex-1 justify-center">{seatsWanted < 1 ? "Select seats to continue" : "Select boarding & dropping point"}</EnterpriseButton>}
                      {step === "points" && <EnterpriseButton type="button" onClick={goPassengers} className="flex-1 justify-center">Continue</EnterpriseButton>}
                      {step === "passengers" && (
                        <EnterpriseButton type="submit" disabled={busy || seatsWanted < 1} icon={<ShieldCheck size={14} />} className="flex-1 justify-center">
                          {busy ? "Holding seats…" : user || sampleTrip ? "Hold seats and pay" : "Sign in to book"}
                        </EnterpriseButton>
                      )}
                    </div>
                    <p className="text-[10px] text-gray-400 text-center">Seats are held for a few minutes while you pay Tirvona.</p>
                  </div>
                </>
              )}
              <CharterCard code={code} dep={dep} signedIn={Boolean(user)} contact={{ name: contact.name, phone: contact.phone }} />
            </form>

            {/* right: the bus, its photos and everything a pilgrim wants to know before paying */}
            <div className="p-4 sm:p-6 min-w-0 bg-white dark:bg-[#0B192C] space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-base font-black text-[#0B192C] dark:text-white">{d.operator?.name}</h2>
                  <p className="text-xs text-gray-500 mt-0.5">{clock24(dep.departAt)} - {dep.returnAt ? clock24(dep.returnAt) : "—"} · {dayShort(dep.departAt)}</p>
                  <p className="text-xs text-gray-500 capitalize">{bus}{vehicle?.isAc ? " A/C" : ""}{(dep.seatLayout?.seats ?? []).some((s: any) => s.kind === "sleeper") ? " Sleeper" : " Seater"}</p>
                </div>
                <RatingBadge rating={d.operator?.rating} />
              </div>
              {images.length > 0 && (
                <div>
                  <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Photos">
                    {images.map((src, i) => (
                      <button key={src + i} type="button" role="tab" aria-selected={i === photo} aria-label={`Show photo ${i + 1}`} onClick={() => setPhoto(i)} className={`shrink-0 h-24 w-40 rounded-lg overflow-hidden border-2 ${i === photo ? "border-[#F28C28]" : "border-transparent"}`}>
                        <img src={src} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <DepartureDetails d={d} tour={tour} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ================================================================== checkout
export const YatraCheckoutPage: React.FC = () => (
  <YatraGate>
    <Checkout />
  </YatraGate>
);

const Checkout: React.FC = () => {
  const { bookingId = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const remote = useRemote<any>(() => yatraCustomer.booking(bookingId), [bookingId]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const b = remote.data?.booking;
  const left = useCountdown(b?.holdExpiresAt);

  if (remote.state !== "ready" || !b)
    return <div className="max-w-3xl mx-auto px-4 py-10"><PanelState state={remote.state} error={remote.error} onRetry={remote.reload} /></div>;

  const open = ["held", "payment_pending"].includes(b.status);
  const pay = async () => {
    setBusy(true);
    setError("");
    try {
      const order = await yatraCustomer.paymentOrder(b.id);
      const res = await runPayment(order.data.data, { name: b.contact.name || user?.name, email: b.contact.email || user?.email, contact: b.contact.phone || user?.phone }, (proof) =>
        yatraCustomer.confirmPayment(b.id, proof),
      );
      toast.success("Your Yatra booking is confirmed.");
      const journeyId = res.data.data.journeyId;
      navigate(journeyId ? `/profile/journeys/${journeyId}` : "/profile/journeys", { replace: true });
    } catch (err) {
      setError(paymentError(err));
      remote.reload();
    } finally {
      setBusy(false);
    }
  };
  const release = async () => {
    setBusy(true);
    try {
      await yatraCustomer.release(b.id);
      navigate(`/yatra`, { replace: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-5">
      <PageTitle title="Complete your booking" />
      <Panel title={<span className="flex items-center gap-2"><Bus size={15} className="text-[#F28C28]" /> {b.tourTitle}</span>} actions={<StatusPill status={b.status} />}>
        <InfoRow label="Booking">{b.bookingReference}</InfoRow>
        <InfoRow label="Departure">{dateTimeIst(b.departAt)}</InfoRow>
        <InfoRow label="Boarding point">{b.boardingPointName}</InfoRow>
        <InfoRow label="Seats">{b.seats.join(", ")}</InfoRow>
        <InfoRow label="Travellers">{b.passengers.map((p: any) => p.name).join(", ")}</InfoRow>
        {(b.pricing.addOns ?? []).map((a: any) => <InfoRow key={a.key} label={a.title}>{rupees(a.amount)}</InfoRow>)}
        {(b.pricing.protectionFee > 0 || b.pricing.addOnsTotal > 0) && <InfoRow label="Seat fare">{rupees(b.pricing.subtotal)}</InfoRow>}
        {b.pricing.protectionFee > 0 && <InfoRow label="Cancellation protection">{rupees(b.pricing.protectionFee)} · full fare refund if cancelled early</InfoRow>}
        <InfoRow label="Total">{rupees(b.pricing.totalAmount)}</InfoRow>
      </Panel>
      {error && <ErrorNote message={error} />}
      {open ? (
        left > 0 ? (
          <div className="space-y-3">
            <p className="text-xs font-bold text-amber-700 dark:text-amber-400 text-center" role="timer" aria-live="off">Your seats are held for {mmss(left)} more.</p>
            <EnterpriseButton onClick={pay} disabled={busy} icon={<IndianRupee size={14} />} className="w-full justify-center">
              {busy ? "Opening secure payment…" : `Pay ${rupees(b.pricing.totalAmount)} to Tirvona`}
            </EnterpriseButton>
            <EnterpriseButton variant="ghost" onClick={release} disabled={busy} className="w-full justify-center">Release these seats</EnterpriseButton>
          </div>
        ) : (
          <Empty icon={<Clock size={26} className="text-amber-500" />} title="Your seat hold expired" text="The seats went back on sale. You can book again if they are still free." action={<Link className="text-xs font-extrabold text-[#F28C28]" to="/yatra">Back to Yatra</Link>} />
        )
      ) : b.status === "confirmed" ? (
        <Empty icon={<CheckCircle2 size={26} className="text-emerald-500" />} title="This booking is confirmed" action={<Link className="text-xs font-extrabold text-[#F28C28]" to={b.journeyId ? `/profile/journeys/${b.journeyId}` : "/profile/journeys"}>Open my journey</Link>} />
      ) : (
        <Empty title={`This booking is ${b.status.replace(/_/g, " ")}`} action={<Link className="text-xs font-extrabold text-[#F28C28]" to="/yatra">Back to Yatra</Link>} />
      )}
      <p className="text-[11px] text-gray-400 text-center flex items-center justify-center gap-1.5"><ShieldCheck size={12} /> Paid to Tirvona through Razorpay. A booking is confirmed only after the payment is verified.</p>
    </div>
  );
};

// ============================================================ organiser link
export const YatraLinkPage: React.FC = () => (
  <YatraGate>
    <LinkLanding />
  </YatraGate>
);

const LinkLanding: React.FC = () => {
  const { code = "" } = useParams();
  const navigate = useNavigate();
  const remote = useRemote<any>(() => yatraPublic.link(code), [code]);
  useEffect(() => {
    if (remote.state !== "ready" || !remote.data) return;
    try {
      sessionStorage.setItem(LINK_KEY, JSON.stringify({ code: remote.data.code, at: Date.now() }));
    } catch {
      // Private mode: the booking simply counts as a website booking.
    }
    if (remote.data.departureCode) navigate(`/yatra/departures/${remote.data.departureCode}`, { replace: true });
  }, [remote.state, remote.data, navigate]);

  if (remote.state !== "ready") return <div className="max-w-3xl mx-auto px-4 py-10"><PanelState state={remote.state} error={remote.error} missingText="This booking link is no longer active." /></div>;
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-5">
      <PageTitle title={remote.data.tourTitle} subtitle="Choose a departure to continue." />
      {remote.data.departures.length === 0 ? (
        <Empty title="No upcoming departures" text="Please check back later." />
      ) : (
        <div className="space-y-2">
          {remote.data.departures.map((d: any) => (
            <Link key={d.departureCode} to={`/yatra/departures/${d.departureCode}`} className="flex items-center justify-between gap-3 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-2xl p-4 hover:border-[#F28C28]/50">
              <span className="text-xs font-black">{dateTimeIst(d.departAt)}</span>
              <span className="text-xs text-gray-500">{d.seatsLeft} seats left · <b className="text-[#0B192C] dark:text-white">{rupees(d.fare)}</b></span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

// ===================================================== organiser payment link
export const YatraPayLinkPage: React.FC = () => (
  <YatraGate>
    <PayLink />
  </YatraGate>
);

const PayLink: React.FC = () => {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const remote = useRemote<any>(() => yatraPublic.paymentLink(token), [token]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const s = remote.data;
  const left = useCountdown(s?.holdExpiresAt);

  if (remote.state !== "ready" || !s) return <div className="max-w-3xl mx-auto px-4 py-10"><PanelState state={remote.state} error={remote.error} missingText="This payment link is not valid." /></div>;

  const pay = async () => {
    if (!user) {
      navigate(`/login?redirect=${encodeURIComponent(location.pathname)}`);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const order = await yatraCustomer.linkOrder(token);
      const res = await runPayment(order.data.data, { name: user.name, email: user.email, contact: user.phone }, (proof) => yatraCustomer.linkConfirm(token, proof));
      toast.success("Payment received. The booking is confirmed.");
      navigate(res.data.data.journeyId ? `/profile/journeys/${res.data.data.journeyId}` : "/profile/journeys", { replace: true });
    } catch (err) {
      setError(paymentError(err));
      remote.reload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-8 space-y-5">
      <PageTitle title="Pay for your Yatra" subtitle={`Booked for you by ${s.organiser}. You pay Tirvona directly.`} />
      <Panel title={s.tourTitle}>
        <InfoRow label="Booking">{s.bookingReference}</InfoRow>
        <InfoRow label="Departure">{dateTimeIst(s.departAt)}</InfoRow>
        <InfoRow label="Boarding point">{s.boardingPointName}</InfoRow>
        <InfoRow label="Seats">{s.seats.join(", ")}</InfoRow>
        <InfoRow label="Travellers">{s.travellers.join(", ")}</InfoRow>
        <InfoRow label="Amount">{rupees(s.amount)}</InfoRow>
      </Panel>
      {error && <ErrorNote message={error} />}
      {s.status === "payable" ? (
        <div className="space-y-2">
          {left > 0 && <p className="text-xs font-bold text-amber-700 dark:text-amber-400 text-center">Seats are held for {mmss(left)} more.</p>}
          <EnterpriseButton onClick={pay} disabled={busy} icon={<IndianRupee size={14} />} className="w-full justify-center">
            {busy ? "Opening secure payment…" : user ? `Pay ${rupees(s.amount)} to Tirvona` : "Sign in to pay"}
          </EnterpriseButton>
          <p className="text-[10px] text-gray-400 text-center">The booking will be saved to the Tirvona account you pay from, so you can see your ticket and any refund there.</p>
        </div>
      ) : s.status === "paid" ? (
        <Empty icon={<CheckCircle2 size={26} className="text-emerald-500" />} title="This booking is paid and confirmed" action={<Link to="/profile/journeys" className="text-xs font-extrabold text-[#F28C28]">My journeys</Link>} />
      ) : (
        <Empty icon={<Clock size={26} className="text-amber-500" />} title={s.status === "cancelled" ? "This booking was cancelled" : "This payment link has expired"} text="Ask your partner to send a new link." />
      )}
    </div>
  );
};

// ================================================================ partner page
export const YatraPartnerPage: React.FC = () => (
  <YatraGate>
    <Partner />
  </YatraGate>
);

const Partner: React.FC = () => {
  const items = [
    { icon: <Bus size={18} />, title: "One partner console", text: "Tours, vehicles, departures, seats, bookings, manifests and boarding check-in in one place." },
    { icon: <Users size={18} />, title: "Pilgrims from Tirvona", text: "Published tours appear on Tirvona Yatra, next to stays, aarti, parking and food." },
    { icon: <Link2 size={18} />, title: "Your own booking links", text: "Share a link or QR with your customers. Those bookings are recorded as yours." },
    { icon: <Wallet size={18} />, title: "Payments handled by Tirvona", text: "Customers pay Tirvona through Razorpay. No cash handling; refunds follow your published policy." },
    { icon: <ShieldCheck size={18} />, title: "Verified listing", text: "Tirvona checks your KYC, vehicle permits and insurance before anything is sold." },
    { icon: <Route size={18} />, title: "Complete journeys", text: "Pilgrims can add meals, puja and stays to the trip you run." },
  ];
  const steps = ["Tirvona creates your partner login and gives you the email and a first password", "Add PAN, business and payout details", "Upload KYC, vehicle RC, permit and insurance", "Tirvona verifies your organisation", "Submit tours; Tirvona reviews and publishes them", "Open departures and start selling"];
  return (
    <div className="pb-16 lg:pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6">
        <PageTitle title="Tirvona Yatra for partners" subtitle="A growth platform for pilgrimage tour organisers: sell seats from one central inventory, with payments and verification handled by Tirvona." />
      </div>
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((s) => (
          <div key={s.title} className="tv-stat">
            <div className="tv-stat-head"><span className="tv-stat-label">{s.title}</span><span className="tv-stat-icon">{s.icon}</span></div>
            <p className="tv-stat-hint !mt-2">{s.text}</p>
          </div>
        ))}
      </section>
      <section className="max-w-3xl mx-auto px-4 sm:px-6 mt-10 space-y-4">
        <Panel title="How to join">
          <ol className="space-y-2.5">
            {steps.map((step, i) => (
              <li key={step} className="flex gap-3 items-start text-xs">
                <span className="w-6 h-6 rounded-full bg-[#F28C28] text-white text-[11px] font-black flex items-center justify-center shrink-0">{i + 1}</span>
                <span className="pt-1 font-semibold">{step}</span>
              </li>
            ))}
          </ol>
        </Panel>
        <Panel title={<span className="flex items-center gap-2"><FileText size={15} className="text-[#F28C28]" /> Keep these ready</span>}>
          <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">PAN card; GST certificate or business registration (if you have one); for each vehicle its registration certificate (RC), a valid permit and insurance. Documents are stored privately and seen only by Tirvona's verification team.</p>
        </Panel>
        <p className="text-[11px] text-gray-400 text-center">Commission, referral rates and payout terms are shared by Tirvona during onboarding.</p>
        <div className="text-center">
          <Link to="/operator/dashboard" className="inline-flex items-center gap-2 rounded-full bg-[#F28C28] px-5 py-3 text-xs font-extrabold text-white hover:bg-[#E57C18] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F28C28]/50">
            Open my partner dashboard <ArrowRight size={14} />
          </Link>
        </div>
        <p className="text-xs text-center text-gray-500">
          Want to become a partner? Partner accounts are created by Tirvona.{" "}
          <Link to="/contact" className="font-bold text-[#F28C28] hover:underline">Contact us</Link>
        </p>
        <p className="text-xs text-center text-gray-500">
          Drive a cab, auto or tempo traveller in a pilgrimage town?{" "}
          <Link to="/ride-partner/dashboard" className="font-bold text-[#F28C28] hover:underline">Become a ride partner</Link>
        </p>
      </section>
    </div>
  );
};
