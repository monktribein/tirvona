import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Bus, ChevronDown, Filter, Users, X } from "lucide-react";
import { Empty } from "../../marketplace/ui";
import { RatingBadge, rupees, timeOnly } from "../yatraUi";

/** Search results the way pilgrims expect from a bus site: a filter column on the left, one row per bus. */

type Sort = "departure" | "price" | "rating";
interface Filters {
  quick: Set<string>;
  times: Set<string>;
  operators: Set<string>;
  boarding: Set<string>;
  dropping: Set<string>;
  features: Set<string>;
  maxPrice: number | null;
}
const emptyFilters = (): Filters => ({ quick: new Set(), times: new Set(), operators: new Set(), boarding: new Set(), dropping: new Set(), features: new Set(), maxPrice: null });

const TIME_BUCKETS = [
  { id: "early", label: "Before 6 AM", from: 0, to: 6 },
  { id: "morning", label: "6 AM to 12 PM", from: 6, to: 12 },
  { id: "afternoon", label: "12 PM to 6 PM", from: 12, to: 18 },
  { id: "evening", label: "After 6 PM", from: 18, to: 24 },
];

/** Hour of day in India, whatever the viewer's own time zone. */
const istHour = (value: string) => Math.floor((((new Date(value).getUTCHours() * 60 + new Date(value).getUTCMinutes() + 330) % 1440) + 1440) % 1440 / 60);
const bucketOf = (value: string) => TIME_BUCKETS.find((b) => istHour(value) >= b.from && istHour(value) < b.to)?.id ?? "evening";

const QUICK: Array<{ id: string; label: string; test: (d: any) => boolean }> = [
  { id: "ac", label: "AC", test: (d) => Boolean(d.vehicle?.isAc) },
  { id: "nonac", label: "Non-AC", test: (d) => !d.vehicle?.isAc },
  { id: "sleeper", label: "Sleeper", test: (d) => (d.vehicle?.seatKinds ?? []).includes("sleeper") },
  { id: "seater", label: "Seater", test: (d) => (d.vehicle?.seatKinds ?? ["seater"]).includes("seater") },
  { id: "single", label: "Single decker", test: (d) => (d.vehicle?.decks ?? 1) === 1 },
  { id: "double", label: "Double decker", test: (d) => (d.vehicle?.decks ?? 1) === 2 },
  { id: "rated", label: "High rated (4+)", test: (d) => (d.operator?.rating?.average ?? 0) >= 4 },
  { id: "whole", label: "Whole bus bookable", test: (d) => Boolean(d.charterEnabled) },
  { id: "rest", label: "Rest stops", test: (d) => (d.restStopCount ?? 0) > 0 },
];

const names = (list: any[] | undefined) => (list ?? []).map((p) => String(p.name));
const matches = (d: any, f: Filters): boolean => {
  for (const id of f.quick) if (!QUICK.find((q) => q.id === id)?.test(d)) return false;
  if (f.times.size && !f.times.has(bucketOf(d.departAt))) return false;
  if (f.operators.size && !f.operators.has(d.operator?.name)) return false;
  if (f.boarding.size && !names(d.boardingPoints).some((n) => f.boarding.has(n))) return false;
  if (f.dropping.size && !names(d.droppingPoints).some((n) => f.dropping.has(n))) return false;
  if (f.features.size && ![...f.features].every((x) => (d.vehicle?.amenities ?? []).includes(x))) return false;
  if (f.maxPrice !== null && Number(d.fromFare ?? d.fare) > f.maxPrice) return false;
  return true;
};

const count = (items: any[], pick: (d: any) => string[]): Array<[string, number]> => {
  const m = new Map<string, number>();
  for (const d of items) for (const v of new Set(pick(d))) if (v) m.set(v, (m.get(v) ?? 0) + 1);
  return [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
};

const duration = (from: string, to?: string | null) => {
  if (!to) return "";
  const minutes = Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60_000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const rest = minutes % 60;
  if (days) return `${days}d${hours ? ` ${hours}h` : ""}`;
  return `${hours}h${rest ? ` ${rest}m` : ""}`;
};

const Chip: React.FC<{ on: boolean; onClick: () => void; children: React.ReactNode }> = ({ on, onClick, children }) => (
  <button type="button" aria-pressed={on} onClick={onClick} className={`text-[11px] font-medium text-left px-3 py-2 rounded-md border focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F28C28]/50 ${on ? "bg-[#F28C28] text-white border-[#F28C28]" : "bg-white dark:bg-[#0B192C] border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-200 hover:border-[#F28C28]"}`}>
    {children}
  </button>
);

const Group: React.FC<{ title: string; children: React.ReactNode; open?: boolean }> = ({ title, children, open = false }) => {
  const [show, setShow] = useState(open);
  return (
    <div className="border-t border-gray-100 dark:border-slate-800">
      <button type="button" aria-expanded={show} onClick={() => setShow(!show)} className="w-full flex items-center justify-between py-3 text-xs font-extrabold text-[#0B192C] dark:text-white text-left">
        {title}
        <ChevronDown size={14} className={show ? "rotate-180" : ""} />
      </button>
      {show && <div className="pb-3">{children}</div>}
    </div>
  );
};

const Checks: React.FC<{ rows: Array<[string, number]>; set: Set<string>; toggle: (v: string) => void; limit?: number }> = ({ rows, set, toggle, limit = 8 }) => {
  const [all, setAll] = useState(false);
  if (!rows.length) return <p className="text-[11px] text-gray-400">Nothing to filter by.</p>;
  const shown = all ? rows : rows.slice(0, limit);
  return (
    <ul className="space-y-1.5">
      {shown.map(([label, n]) => (
        <li key={label}>
          <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-200 cursor-pointer">
            <input type="checkbox" className="accent-[#F28C28] h-3.5 w-3.5" checked={set.has(label)} onChange={() => toggle(label)} />
            <span className="flex-1 truncate">{label}</span>
            <span className="text-[10px] text-gray-400">({n})</span>
          </label>
        </li>
      ))}
      {rows.length > limit && (
        <li>
          <button type="button" onClick={() => setAll(!all)} className="text-[11px] font-extrabold text-[#F28C28] hover:underline">
            {all ? "Show less" : `Show ${rows.length - limit} more`}
          </button>
        </li>
      )}
    </ul>
  );
};

const clock24 = (value: string) => new Date(value).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" });

const BusRow: React.FC<{ d: any }> = ({ d }) => {
  const vehicle = d.vehicle ?? {};
  const kind = (vehicle.seatKinds ?? []).includes("sleeper") ? ((vehicle.seatKinds ?? []).includes("seater") ? "Seater /Sleeper" : "Sleeper") : "Seater";
  const bus = [vehicle.make, vehicle.model].filter(Boolean).join(" ") || String(vehicle.vehicleType ?? "bus").replace(/_/g, " ");
  const sub = `${bus} ${vehicle.isAc ? "A/C" : "Non-AC"} ${kind}${vehicle.decks === 2 ? " (Double decker)" : ""}`;
  const chips = [...(vehicle.amenities ?? []).slice(0, 4), ...(d.charterEnabled ? ["Whole bus bookable"] : []), ...(d.restStopCount ? [`${d.restStopCount} rest stop${d.restStopCount === 1 ? "" : "s"}`] : [])];
  const to = (tab: string) => `/yatra/departures/${d.departureCode}?tab=${tab}`;
  const links: Array<[string, string]> = [["Highlights", "highlights"], ["Boarding/ Dropping Points", "route"], ["Ratings & Reviews", "reviews"], ["Bus Photos", "photos"], ["Cancellation Policies", "cancellation"]];
  return (
    <li className="bg-white dark:bg-[#0B192C] border border-gray-200 dark:border-slate-800 rounded-lg shadow-sm px-4 pt-3 pb-2.5 hover:shadow-md transition-shadow">
      <span className="inline-block text-[10px] text-gray-500 bg-gray-100 dark:bg-slate-800 rounded px-1.5 py-0.5 mb-1.5">{d.tour.originCity} → {d.tour.destinationCity}{d.operator?.yearsInBusiness > 0 ? ` · ${d.operator.yearsInBusiness} yrs in business` : ""}</span>
      <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1.5fr)_auto_auto] gap-x-6 gap-y-2 items-start">
        <div className="min-w-0">
          <h3 className="text-[13px] font-bold text-[#0B192C] dark:text-white truncate">{d.operator?.name}</h3>
          <p className="text-[10px] text-gray-500 mt-0.5 capitalize truncate">{sub}</p>
        </div>
        <div className="flex items-center gap-3">
          <RatingBadge rating={d.operator?.rating} />
          <div className="text-[#0B192C] dark:text-white">
            <p className="text-[15px] font-semibold leading-tight tabular-nums">{clock24(d.departAt)} <span className="text-gray-400 font-normal">—</span> <span className="text-gray-500">{d.returnAt ? clock24(d.returnAt) : "—"}</span></p>
            <p className="text-[10px] text-gray-500 mt-0.5">{duration(d.departAt, d.returnAt) || `${d.tour.durationDays}d`} · {d.seatsLeft} Seat{d.seatsLeft === 1 ? "" : "s"}</p>
          </div>
        </div>
        <div className="sm:text-right flex sm:block items-center justify-between gap-3">
          <p className="leading-none"><span className="text-base font-bold text-[#0B192C] dark:text-white">{rupees(d.fromFare ?? d.fare)}</span><span className="block text-[9px] text-gray-400 mt-0.5">Onwards</span></p>
          <Link to={`/yatra/departures/${d.departureCode}`} className="sm:mt-2 inline-flex items-center justify-center rounded-md bg-[#F28C28] hover:bg-[#E57C18] text-white text-xs font-bold px-5 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F28C28]/60">View seats</Link>
        </div>
      </div>
      {chips.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{chips.map((c: string) => <span key={c} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300">{c}</span>)}</div>}
      <nav className="mt-2.5 pt-2 border-t border-gray-100 dark:border-slate-800 flex flex-wrap gap-x-4 gap-y-1" aria-label="Bus details">
        {links.map(([label, tab]) => <Link key={tab} to={to(tab)} className="text-[10px] font-medium text-blue-600 dark:text-blue-400 hover:underline">{label}</Link>)}
      </nav>
    </li>
  );
};

export const BusResults: React.FC<{ items: any[] }> = ({ items }) => {
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [sort, setSort] = useState<Sort>("departure");
  const [drawer, setDrawer] = useState(false);
  const prices = items.map((d) => Number(d.fromFare ?? d.fare));
  const lowest = prices.length ? Math.floor(Math.min(...prices)) : 0;
  const highest = prices.length ? Math.ceil(Math.max(...prices)) : 0;

  const toggle = (key: "quick" | "times" | "operators" | "boarding" | "dropping" | "features") => (value: string) =>
    setFilters((prev) => {
      const next = new Set(prev[key]);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return { ...prev, [key]: next };
    });

  const shown = useMemo(() => {
    const rows = items.filter((d) => matches(d, filters));
    const by: Record<Sort, (a: any, b: any) => number> = {
      departure: (a, b) => new Date(a.departAt).getTime() - new Date(b.departAt).getTime(),
      price: (a, b) => Number(a.fromFare ?? a.fare) - Number(b.fromFare ?? b.fare),
      rating: (a, b) => (b.operator?.rating?.average ?? 0) - (a.operator?.rating?.average ?? 0) || (b.operator?.rating?.count ?? 0) - (a.operator?.rating?.count ?? 0),
    };
    return [...rows].sort(by[sort]);
  }, [items, filters, sort]);

  const active = filters.quick.size + filters.times.size + filters.operators.size + filters.boarding.size + filters.dropping.size + filters.features.size + (filters.maxPrice !== null ? 1 : 0);

  const sidebar = (
    <div className="space-y-1">
      <div className="flex items-center justify-between pb-2">
        <h2 className="font-black text-sm text-[#0B192C] dark:text-white">Filter buses</h2>
        {active > 0 && <button type="button" onClick={() => setFilters(emptyFilters())} className="text-[11px] font-extrabold text-[#F28C28] hover:underline">Clear all ({active})</button>}
      </div>
      <div className="grid grid-cols-1 gap-2 pb-3">
        {QUICK.filter((q) => items.some((d) => q.test(d))).map((q) => (
          <Chip key={q.id} on={filters.quick.has(q.id)} onClick={() => toggle("quick")(q.id)}>
            {q.label} ({items.filter(q.test).length})
          </Chip>
        ))}
      </div>
      <Group title="Departure time" open>
        <Checks rows={TIME_BUCKETS.map((b): [string, number] => [b.label, items.filter((d) => bucketOf(d.departAt) === b.id).length]).filter(([, n]) => n > 0)} set={new Set(TIME_BUCKETS.filter((b) => filters.times.has(b.id)).map((b) => b.label))} toggle={(label) => toggle("times")(TIME_BUCKETS.find((b) => b.label === label)!.id)} />
      </Group>
      <Group title="Price" open>
        {highest > lowest ? (
          <div>
            <input type="range" aria-label="Maximum price per seat" min={lowest} max={highest} step={50} value={filters.maxPrice ?? highest} onChange={(e) => setFilters({ ...filters, maxPrice: Number(e.target.value) >= highest ? null : Number(e.target.value) })} className="w-full accent-[#F28C28]" />
            <p className="text-[11px] text-gray-500 mt-1">Up to <b>{rupees(filters.maxPrice ?? highest)}</b> per seat</p>
          </div>
        ) : <p className="text-[11px] text-gray-400">All buses cost {rupees(lowest)}.</p>}
      </Group>
      <Group title="Bus operator"><Checks rows={count(items, (d) => [d.operator?.name])} set={filters.operators} toggle={toggle("operators")} /></Group>
      <Group title="Boarding points"><Checks rows={count(items, (d) => names(d.boardingPoints))} set={filters.boarding} toggle={toggle("boarding")} /></Group>
      <Group title="Dropping points"><Checks rows={count(items, (d) => names(d.droppingPoints))} set={filters.dropping} toggle={toggle("dropping")} /></Group>
      <Group title="Bus features"><Checks rows={count(items, (d) => d.vehicle?.amenities ?? [])} set={filters.features} toggle={toggle("features")} /></Group>
    </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-5 items-start">
      <aside className="hidden lg:block bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-2xl p-4 sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto" aria-label="Filters">
        {sidebar}
      </aside>

      {drawer && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/40" role="dialog" aria-modal="true" aria-label="Filters">
          <div className="absolute inset-y-0 left-0 w-[88%] max-w-sm bg-white dark:bg-[#0B192C] p-4 overflow-y-auto">
            <button type="button" aria-label="Close filters" onClick={() => setDrawer(false)} className="absolute top-3 right-3 p-2 text-gray-500"><X size={18} /></button>
            {sidebar}
            <button type="button" onClick={() => setDrawer(false)} className="mt-4 w-full rounded-full bg-[#F28C28] text-white text-xs font-extrabold py-3">Show {shown.length} bus{shown.length === 1 ? "" : "es"}</button>
          </div>
        </div>
      )}

      <div className="min-w-0 space-y-3">
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-2xl px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <p className="text-xs font-black text-[#0B192C] dark:text-white mr-auto">{shown.length} bus{shown.length === 1 ? "" : "es"} found</p>
          <button type="button" onClick={() => setDrawer(true)} className="lg:hidden inline-flex items-center gap-1.5 text-xs font-extrabold text-[#F28C28]"><Filter size={14} /> Filters{active ? ` (${active})` : ""}</button>
          <div className="flex items-center gap-1 text-xs" role="group" aria-label="Sort buses">
            <span className="text-gray-400 font-bold mr-1">Sort by:</span>
            {([["rating", "Ratings"], ["departure", "Departure time"], ["price", "Price"]] as Array<[Sort, string]>).map(([id, label]) => (
              <button key={id} type="button" aria-pressed={sort === id} onClick={() => setSort(id)} className={`px-2.5 py-1 rounded-md font-extrabold ${sort === id ? "bg-orange-50 text-[#F28C28] dark:bg-slate-800" : "text-gray-500 hover:text-[#0B192C] dark:hover:text-white"}`}>{label}</button>
            ))}
          </div>
        </div>
        {shown.length === 0 ? (
          <Empty icon={<Bus size={28} className="text-gray-300" />} title="No buses match these filters" text="Remove a filter or two to see more buses." />
        ) : (
          <ul className="space-y-2.5">{shown.map((d) => <BusRow key={d.departureCode} d={d} />)}</ul>
        )}
      </div>
    </div>
  );
};
