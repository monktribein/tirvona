import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { analyticsService } from "../../../services";
import { useAuth } from "../../../contexts/AuthContext";
import { formatCurrency, formatIndianNumber, getFormattingLocale } from "../../../utils/format";
import { humanizeLabel } from "../../../utils/labels";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Building2,
  ClipboardCheck,
  Eye,
  Inbox,
  Lock,
  Plus,
  RefreshCw,
  Search,
  Table2,
  Users,
  LayoutDashboard,
} from "lucide-react";
import { EnterprisePageHeader } from "../../shared";

const VIZ_TOKENS = `
.tv-viz {
  --viz-series-1: #2a78d6;
  --viz-series-2: #eb6834;
  --viz-grid: #e6e7e4;
  --viz-axis: #c3c2b7;
  --viz-muted: #7c8794;
  --viz-surface: #ffffff;
}
.dark .tv-viz {
  --viz-series-1: #3987e5;
  --viz-series-2: #d95926;
  --viz-grid: #1d3145;
  --viz-axis: #274257;
  --viz-muted: #93a4b5;
  --viz-surface: #0B192C;
}
`;

type Range = "daily" | "weekly" | "monthly" | "yearly";

interface SeriesPoint {
  bucket: string;
  label: string;
  onlineBookings: number;
  deskBookings: number;
  onlineRevenue: number;
  deskRevenue: number;
  onlineGross: number;
  deskGross: number;
  bookings: number;
  revenue: number;
  gross: number;
}

type Metric = "gross" | "revenue" | "bookings";

const METRIC: Record<
  Metric,
  {
    label: string;
    online: (p: SeriesPoint) => number;
    desk: (p: SeriesPoint) => number;
    total: (p: SeriesPoint) => number;
    money: boolean;
  }
> = {
  gross: {
    label: "Booked",
    online: (p) => p.onlineGross,
    desk: (p) => p.deskGross,
    total: (p) => p.gross,
    money: true,
  },
  revenue: {
    label: "Collected",
    online: (p) => p.onlineRevenue,
    desk: (p) => p.deskRevenue,
    total: (p) => p.revenue,
    money: true,
  },
  bookings: {
    label: "Bookings",
    online: (p) => p.onlineBookings,
    desk: (p) => p.deskBookings,
    total: (p) => p.bookings,
    money: false,
  },
};

interface Overview {
  range: Range;
  series: SeriesPoint[];
  channels: {
    channel: string;
    label: string;
    count: number;
    revenue: number;
    share: number;
  }[];
  statuses: { status: string; count: number; share: number }[];
  modules?: {
    module: string;
    label: string;
    bookings: number;
    revenue: number;
    allTimeBookings?: number;
    allTimeRevenue?: number;
  }[];
  topAshrams: {
    ashramId: string;
    name: string;
    city: string;
    revenue: number;
    gross: number;
    bookings: number;
  }[];
  totals: {
    windowBookings: number;
    windowRevenue: number;
    windowGrossValue: number;
    windowGuests: number;
    averageBookingValue: number;
    collectionRate: number;
  };
  trend: {
    revenueChange: number;
    bookingsChange: number;
    comparable: boolean;
  };
}

const RANGE_LABEL: Record<Range, string> = {
  daily: "last 14 days",
  weekly: "last 12 weeks",
  monthly: "last 12 months",
  yearly: "last 5 years",
};

const niceCeiling = (value: number): number => {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const step =
    normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
};

const compactCurrency = (value: number): string => {
  const fullyFormatted = formatCurrency(value);
  if (fullyFormatted.startsWith("$") || getFormattingLocale().startsWith("hi"))
    return fullyFormatted;
  if (Math.abs(value) >= 10_000_000)
    return `₹${(value / 10_000_000).toFixed(1)}Cr`;
  if (Math.abs(value) >= 100_000) return `₹${(value / 100_000).toFixed(1)}L`;
  if (Math.abs(value) >= 1_000) return `₹${(value / 1_000).toFixed(1)}k`;
  return `₹${Math.round(value)}`;
};

const EmptyState: React.FC<{ message: string; hint?: string }> = ({
  message,
  hint,
}) => (
  <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
    <Inbox size={26} className="text-gray-300 dark:text-slate-600" />
    <p className="text-xs font-bold text-gray-600 dark:text-gray-300">
      {message}
    </p>
    {hint && (
      <p className="text-[11px] text-gray-400 max-w-xs leading-relaxed">
        {hint}
      </p>
    )}
  </div>
);

const TrendChart: React.FC<{
  series: SeriesPoint[];
  metric: Metric;
}> = ({ series, metric }) => {
  const [hovered, setHovered] = useState<number | null>(null);
  const spec = METRIC[metric];

  const W = 720;
  const H = 260;
  const padLeft = 58;
  const padRight = 18;
  const padTop = 18;
  const padBottom = 36;
  const plotW = W - padLeft - padRight;
  const plotH = H - padTop - padBottom;

  const online = series.map(spec.online);
  const desk = series.map(spec.desk);
  const max = niceCeiling(Math.max(...online, ...desk, 0));

  const xAt = (index: number) =>
    series.length <= 1
      ? padLeft + plotW / 2
      : padLeft + (index / (series.length - 1)) * plotW;
  const yAt = (value: number) => padTop + plotH - (value / max) * plotH;

  const linePath = (values: number[]) =>
    values.map((v, i) => `${i === 0 ? "M" : "L"} ${xAt(i)},${yAt(v)}`).join(" ");
  const areaPath = (values: number[]) =>
    `${linePath(values)} L ${xAt(values.length - 1)},${padTop + plotH} L ${xAt(0)},${padTop + plotH} Z`;

  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const formatValue = (value: number) =>
    spec.money ? formatCurrency(value) : formatIndianNumber(value);

  const labelStride = Math.ceil(series.length / 7);

  return (
    <div className="relative w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-64"
        role="img"
        aria-label={`${spec.label} by booking channel over time`}
      >
        <defs>
          <linearGradient id="tvOnlineFill" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor="var(--viz-series-1)"
              stopOpacity="0.20"
            />
            <stop
              offset="100%"
              stopColor="var(--viz-series-1)"
              stopOpacity="0"
            />
          </linearGradient>
          <linearGradient id="tvDeskFill" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor="var(--viz-series-2)"
              stopOpacity="0.18"
            />
            <stop
              offset="100%"
              stopColor="var(--viz-series-2)"
              stopOpacity="0"
            />
          </linearGradient>
        </defs>

        {ticks.map((t) => {
          const y = padTop + plotH - t * plotH;
          return (
            <g key={t}>
              <line
                x1={padLeft}
                y1={y}
                x2={W - padRight}
                y2={y}
                stroke="var(--viz-grid)"
                strokeWidth="1"
              />
              <text
                x={padLeft - 10}
                y={y + 4}
                textAnchor="end"
                fontSize="10"
                fill="var(--viz-muted)"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {spec.money
                  ? compactCurrency(max * t)
                  : formatIndianNumber(Math.round(max * t))}
              </text>
            </g>
          );
        })}

        <path d={areaPath(online)} fill="url(#tvOnlineFill)" />
        <path d={areaPath(desk)} fill="url(#tvDeskFill)" />
        <path
          d={linePath(online)}
          fill="none"
          stroke="var(--viz-series-1)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={linePath(desk)}
          fill="none"
          stroke="var(--viz-series-2)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {series.map((point, i) =>
          i % labelStride === 0 || i === series.length - 1 ? (
            <text
              key={point.bucket}
              x={xAt(i)}
              y={H - 12}
              textAnchor="middle"
              fontSize="10"
              fill="var(--viz-muted)"
            >
              {point.label}
            </text>
          ) : null,
        )}

        {hovered !== null && (
          <line
            x1={xAt(hovered)}
            y1={padTop}
            x2={xAt(hovered)}
            y2={padTop + plotH}
            stroke="var(--viz-axis)"
            strokeWidth="1"
          />
        )}

        {series.length > 0 &&
          (
            [
              { values: online, color: "var(--viz-series-1)" },
              { values: desk, color: "var(--viz-series-2)" },
            ] as const
          ).map(({ values, color }, seriesIndex) => {
            const last = values.length - 1;
            return (
              <circle
                key={seriesIndex}
                cx={xAt(last)}
                cy={yAt(values[last])}
                r="4"
                fill={color}
                stroke="var(--viz-surface)"
                strokeWidth="2"
              />
            );
          })}

        {hovered !== null &&
          (
            [
              { values: online, color: "var(--viz-series-1)" },
              { values: desk, color: "var(--viz-series-2)" },
            ] as const
          ).map(({ values, color }, seriesIndex) => (
            <circle
              key={seriesIndex}
              cx={xAt(hovered)}
              cy={yAt(values[hovered])}
              r="4"
              fill={color}
              stroke="var(--viz-surface)"
              strokeWidth="2"
            />
          ))}

        {series.map((point, i) => (
          <rect
            key={point.bucket}
            x={xAt(i) - plotW / Math.max(series.length - 1, 1) / 2}
            y={padTop}
            width={plotW / Math.max(series.length - 1, 1)}
            height={plotH}
            fill="transparent"
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          />
        ))}
      </svg>

      {hovered !== null && (
        <div
          className="absolute -top-1 z-10 pointer-events-none bg-[#0B192C] text-white px-3 py-2 rounded-lg shadow-xl border border-white/10 text-[11px] min-w-[150px]"
          style={{
            left: `${(xAt(hovered) / W) * 100}%`,
            transform:
              hovered > series.length / 2
                ? "translateX(-105%)"
                : "translateX(5%)",
          }}
        >
          <div className="font-black mb-1.5 text-[10px] tracking-wide text-white/60">
            {series[hovered].label}
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: "var(--viz-series-1)" }}
              />
              Online
            </span>
            <span className="font-bold">{formatValue(online[hovered])}</span>
          </div>
          <div className="flex items-center justify-between gap-4 mt-0.5">
            <span className="flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: "var(--viz-series-2)" }}
              />
              Desk
            </span>
            <span className="font-bold">{formatValue(desk[hovered])}</span>
          </div>
        </div>
      )}
    </div>
  );
};

const TrendTable: React.FC<{
  series: SeriesPoint[];
  metric: Metric;
}> = ({ series, metric }) => {
  const spec = METRIC[metric];
  const value = (n: number) =>
    spec.money ? formatCurrency(n) : formatIndianNumber(n);
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-slate-800 max-h-64 overflow-y-auto overscroll-contain">
      <table className="w-full text-left text-xs">
        <thead className="bg-gray-50 dark:bg-slate-900 text-gray-600 dark:text-gray-300 font-extrabold text-[10px] sticky top-0">
          <tr>
            <th className="py-2 px-3">Period</th>
            <th className="py-2 px-3 text-right">Online</th>
            <th className="py-2 px-3 text-right">Desk</th>
            <th className="py-2 px-3 text-right">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-slate-800 tabular-nums">
          {series.map((point) => (
            <tr key={point.bucket}>
              <td className="py-2 px-3 font-semibold">{point.label}</td>
              <td className="py-2 px-3 text-right">
                {value(spec.online(point))}
              </td>
              <td className="py-2 px-3 text-right">{value(spec.desk(point))}</td>
              <td className="py-2 px-3 text-right font-bold">
                {value(spec.total(point))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const ChannelSplit: React.FC<{ channels: Overview["channels"] }> = ({
  channels,
}) => {
  const total = channels.reduce((sum, c) => sum + c.count, 0);
  if (total === 0)
    return (
      <EmptyState
        message="No bookings yet"
        hint="The channel split appears once pilgrims start booking."
      />
    );

  return (
    <div className="space-y-3">
      <div className="flex w-full h-9 rounded-lg overflow-hidden gap-[2px]">
        {channels
          .filter((c) => c.count > 0)
          .map((c, i) => (
            <div
              key={c.channel}
              className="h-full flex items-center justify-center"
              style={{
                width: `${c.share}%`,
                background:
                  i === 0 ? "var(--viz-series-1)" : "var(--viz-series-2)",
              }}
              title={`${c.label}: ${c.count}`}
            >
              {c.share >= 18 && (
                <span className="text-[11px] font-black text-white">
                  {c.share}%
                </span>
              )}
            </div>
          ))}
      </div>
      <div className="space-y-2">
        {channels.map((c, i) => (
          <div
            key={c.channel}
            className="flex items-center justify-between text-xs"
          >
            <span className="flex items-center gap-2 text-gray-600 dark:text-gray-300 font-semibold">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{
                  background:
                    i === 0 ? "var(--viz-series-1)" : "var(--viz-series-2)",
                }}
              />
              {c.label}
            </span>
            <span className="font-black text-[#0B192C] dark:text-white tabular-nums">
              {c.share}%{" "}
              <span className="text-gray-400 font-semibold">
                ({formatIndianNumber(c.count)})
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const RankedBars: React.FC<{
  rows: { key: string; label: string; sub?: string; value: number }[];
  format: (value: number) => string;
}> = ({ rows, format }) => {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.key} className="space-y-1">
          <div className="flex items-baseline justify-between gap-3 text-xs">
            <span className="font-bold text-[#0B192C] dark:text-white truncate">
              {row.label}
              {row.sub && (
                <span className="text-gray-400 font-medium"> · {row.sub}</span>
              )}
            </span>
            <span className="font-black tabular-nums text-[#0B192C] dark:text-white shrink-0">
              {format(row.value)}
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-gray-100 dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max((row.value / max) * 100, row.value > 0 ? 3 : 0)}%`,
                background: "var(--viz-series-1)",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

const Sparkline: React.FC<{ values: number[] }> = ({ values }) => {
  if (values.length < 2 || values.every((v) => v === 0))
    return <div className="h-10" />;
  const max = Math.max(...values);
  const W = 100;
  const H = 30;
  const x = (i: number) => (i / (values.length - 1)) * W;
  const y = (v: number) => H - (v / max) * (H - 4) - 2;
  const line = values
    .map((v, i) => `${i === 0 ? "M" : "L"} ${x(i)},${y(v)}`)
    .join(" ");
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-10"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d={`${line} L ${W},${H} L 0,${H} Z`}
        fill="var(--viz-series-1)"
        fillOpacity="0.14"
      />
      <path
        d={line}
        fill="none"
        stroke="var(--viz-series-1)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
};

const DeltaBadge: React.FC<{ change: number; comparable: boolean }> = ({
  change,
  comparable,
}) => {
  if (!comparable)
    return (
      <span className="text-[10px] font-semibold text-gray-400">
        No prior period
      </span>
    );
  const up = change >= 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[10px] font-black ${
        up
          ? "text-emerald-600 dark:text-emerald-400"
          : "text-rose-600 dark:text-rose-400"
      }`}
    >
      {up ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
      {Math.abs(change)}%
    </span>
  );
};

const StatTile: React.FC<{
  label: string;
  value: string;
  caption?: React.ReactNode;
  children?: React.ReactNode;
}> = ({ label, value, caption, children }) => (
  <div className="bg-white dark:bg-[#0B192C] border border-gray-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-2">
    <span className="text-[11px] font-extrabold text-gray-500 dark:text-gray-400 block tracking-wide">
      {label}
    </span>
    <h4 className="text-2xl font-black text-[#0B192C] dark:text-white">
      {value}
    </h4>
    {caption && <div className="text-[10px] font-semibold">{caption}</div>}
    {children}
  </div>
);

const QuickPill: React.FC<{
  icon: React.ReactNode;
  tone: string;
  label: string;
  value: string;
}> = ({ icon, tone, label, value }) => (
  <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800">
    <div
      className={`w-9 h-9 rounded-full ${tone} flex items-center justify-center shrink-0`}
    >
      {icon}
    </div>
    <div className="min-w-0">
      <span className="text-[10px] text-gray-500 font-semibold block leading-tight">
        {label}
      </span>
      <span className="text-xs font-black text-[#0B192C] dark:text-white tabular-nums">
        {value}
      </span>
    </div>
  </div>
);

export const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [range, setRange] = useState<Range>("daily");
  const [metric, setMetric] = useState<Metric>("gross");
  const [showTable, setShowTable] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const [overview, setOverview] = useState<Overview | null>(null);
  const [system, setSystem] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const load = useCallback(
    async (nextRange: Range, isInitial: boolean) => {
      if (isInitial) setLoading(true);
      else setRefreshing(true);

      const [overviewRes, systemRes, bookingsRes, logsRes] =
        await Promise.allSettled([
          analyticsService.overview(nextRange),
          analyticsService.system(),
          analyticsService.recentBookings(8),
          analyticsService.auditLogs(),
        ]);

      const failed: string[] = [];
      if (overviewRes.status === "fulfilled")
        setOverview(overviewRes.value.data?.data ?? null);
      else failed.push("analytics overview");

      if (systemRes.status === "fulfilled")
        setSystem(systemRes.value.data?.data ?? null);
      else failed.push("platform totals");

      if (bookingsRes.status === "fulfilled")
        setBookings(bookingsRes.value.data?.data ?? []);
      else failed.push("recent bookings");

      if (logsRes.status === "fulfilled")
        setActivities(logsRes.value.data?.data?.slice(0, 6) ?? []);
      else failed.push("audit activity");

      setErrors(failed);
      setLoading(false);
      setRefreshing(false);
    },
    [],
  );

  useEffect(() => {
    load(range, overview === null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, load]);

  const filteredBookings = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return bookings;
    return bookings.filter((row) =>
      [row.customerName, row.ashramName, row.city, row.bookingId]
        .filter(Boolean)
        .some((field: string) => String(field).toLowerCase().includes(term)),
    );
  }, [bookings, searchTerm]);

  const statusRows = useMemo(
    () =>
      (overview?.statuses ?? []).map((row) => ({
        key: row.status,
        label: humanizeLabel(row.status),
        sub: `${row.share}%`,
        value: row.count,
      })),
    [overview],
  );

  const ashramRows = useMemo(
    () =>
      (overview?.topAshrams ?? []).map((row) => ({
        key: row.ashramId,
        label: row.name,
        sub: [row.city, `${row.bookings} booking${row.bookings === 1 ? "" : "s"}`]
          .filter(Boolean)
          .join(", "),
        value: row.gross,
      })),
    [overview],
  );

  if (loading) {
    return (
      <div className="space-y-6 p-2 sm:p-4">
        <div className="h-72 rounded-2xl bg-gray-100 dark:bg-slate-900 animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-32 rounded-2xl bg-gray-100 dark:bg-slate-900 animate-pulse"
            />
          ))}
        </div>
        <div className="h-64 rounded-2xl bg-gray-100 dark:bg-slate-900 animate-pulse" />
      </div>
    );
  }

  const series = overview?.series ?? [];
  const hasWindowData = (overview?.totals.windowBookings ?? 0) > 0;

  return (
    <div className="tv-viz space-y-6 text-left w-full font-sans">
      <style>{VIZ_TOKENS}</style>

      {errors.length > 0 && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500/30 px-4 py-3">
          <AlertTriangle
            size={16}
            className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0"
          />
          <div className="text-xs">
            <p className="font-bold text-amber-900 dark:text-amber-300">
              Some panels could not load
            </p>
            <p className="text-amber-800/80 dark:text-amber-400/80">
              Failed to fetch: {errors.join(", ")}. The affected panels are left
              empty rather than filled with placeholder figures.
            </p>
          </div>
        </div>
      )}

      <EnterprisePageHeader
        title="Executive Dashboard"
        subtitle={`Live platform telemetry for ${user?.name || "Super Admin"} · ${RANGE_LABEL[range]}`}
        icon={<LayoutDashboard size={22} />}
        badgeText={RANGE_LABEL[range]}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 p-1 rounded-2xl text-xs font-bold">
              {(["daily", "weekly", "monthly", "yearly"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setRange(tab)}
                  className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer capitalize ${
                    range === tab
                      ? "bg-[#0A4DA6] text-white shadow-sm font-black"
                      : "text-gray-500 hover:text-[#0A4DA6] dark:hover:text-white"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
            <button
              onClick={() => load(range, false)}
              className="p-2.5 bg-gray-50 dark:bg-slate-900 hover:bg-gray-100 dark:hover:bg-slate-800 border border-gray-100 dark:border-slate-800 rounded-2xl text-gray-500 cursor-pointer transition-colors"
              title="Refresh Telemetry"
            >
              <RefreshCw size={16} className={refreshing ? "animate-spin text-[#0A4DA6]" : ""} />
            </button>
          </div>
        }
      />

      <div
        className={`space-y-6 transition-opacity ${refreshing ? "opacity-60" : "opacity-100"}`}
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 bg-white dark:bg-[#0B192C] rounded-2xl border border-gray-200 dark:border-slate-800 p-6 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="space-y-1">
                <h3 className="text-3xl font-black text-[#0B192C] dark:text-white">
                  {formatCurrency(overview?.totals.windowRevenue ?? 0)}
                </h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 font-medium">
                    Collected · {RANGE_LABEL[range]}
                  </span>
                  <DeltaBadge
                    change={overview?.trend.revenueChange ?? 0}
                    comparable={overview?.trend.comparable ?? false}
                  />
                </div>
                <div className="text-xs text-gray-500 font-medium">
                  of{" "}
                  <strong className="text-[#0B192C] dark:text-white font-black">
                    {formatCurrency(overview?.totals.windowGrossValue ?? 0)}
                  </strong>{" "}
                  booked ({overview?.totals.collectionRate ?? 0}% collected)
                </div>
                <div className="text-xs text-gray-500 font-medium pt-1">
                  <strong className="text-[#0B192C] dark:text-white font-black">
                    {formatIndianNumber(overview?.totals.windowBookings ?? 0)}
                  </strong>{" "}
                  bookings ·{" "}
                  <strong className="text-[#0B192C] dark:text-white font-black">
                    {formatIndianNumber(overview?.totals.windowGuests ?? 0)}
                  </strong>{" "}
                  guests
                </div>
              </div>

              <div className="flex flex-col items-end gap-2">
                <div className="flex gap-4 text-xs font-semibold">
                  <span className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ background: "var(--viz-series-1)" }}
                    />
                    Online Gateway
                  </span>
                  <span className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ background: "var(--viz-series-2)" }}
                    />
                    Direct Desk
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {(["gross", "revenue", "bookings"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setMetric(m)}
                      className={`px-3 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                        metric === m
                          ? "bg-[#0A4DA6] text-white border-[#0A4DA6]"
                          : "border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-300 hover:border-[#0A4DA6]"
                      }`}
                    >
                      {METRIC[m].label}
                    </button>
                  ))}
                  <button
                    onClick={() => setShowTable((v) => !v)}
                    className="px-2.5 py-1 rounded-lg border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-300 hover:border-[#0A4DA6] transition-colors cursor-pointer"
                    title={showTable ? "Show chart" : "Show data table"}
                  >
                    {showTable ? <BarChart3 size={13} /> : <Table2 size={13} />}
                  </button>
                </div>
              </div>
            </div>

            {!hasWindowData ? (
              <EmptyState
                message={`No bookings in the ${RANGE_LABEL[range]}`}
                hint="Switch to a wider range, or wait for the first booking of this period."
              />
            ) : showTable ? (
              <TrendTable series={series} metric={metric} />
            ) : (
              <TrendChart series={series} metric={metric} />
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-gray-200 dark:border-slate-800">
              <QuickPill
                icon={<Building2 size={18} />}
                tone="bg-blue-100 text-blue-600"
                label="Tirvona Verified ashrams"
                value={`${formatIndianNumber(system?.ashrams?.approved ?? 0)} active`}
              />
              <QuickPill
                icon={<ClipboardCheck size={18} />}
                tone="bg-amber-100 text-amber-600"
                label="Verification queue"
                value={`${formatIndianNumber(system?.ashrams?.pending ?? 0)} pending`}
              />
              <QuickPill
                icon={<Users size={18} />}
                tone="bg-emerald-100 text-emerald-600"
                label="Pilgrims booked"
                value={formatIndianNumber(system?.users?.pilgrims ?? 0)}
              />
              <QuickPill
                icon={<Building2 size={18} />}
                tone="bg-pink-100 text-pink-600"
                label="Registered owners"
                value={formatIndianNumber(system?.users?.owners ?? 0)}
              />
            </div>
          </div>

          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white dark:bg-[#0B192C] rounded-2xl border border-gray-200 dark:border-slate-800 p-6 shadow-sm">
              <h3 className="text-base font-bold text-[#0B192C] dark:text-white tracking-tight mb-4">
                Booking channel
              </h3>
              <ChannelSplit channels={overview?.channels ?? []} />
            </div>

            {(overview?.modules ?? []).length > 0 && (
              <div className="bg-white dark:bg-[#0B192C] rounded-2xl border border-gray-200 dark:border-slate-800 p-6 shadow-sm">
                <h3 className="text-base font-bold text-[#0B192C] dark:text-white tracking-tight mb-4">
                  Revenue by stream
                </h3>
                <RankedBars
                  rows={(overview?.modules ?? []).map((m) => ({
                    key: m.module,
                    label: m.label,
                    sub: `${m.bookings} booking${m.bookings === 1 ? "" : "s"}`,
                    value: m.revenue,
                  }))}
                  format={formatCurrency}
                />
                {(overview?.modules ?? []).some(
                  (m) => (m.allTimeRevenue ?? 0) > 0,
                ) && (
                  <p className="text-[10px] text-gray-400 mt-3 leading-relaxed">
                    {(overview?.modules ?? [])
                      .filter((m) => (m.allTimeRevenue ?? 0) > 0)
                      .map(
                        (m) =>
                          `${m.label}: ${formatCurrency(m.allTimeRevenue ?? 0)} collected all time across ${m.allTimeBookings} bookings.`,
                      )
                      .join(" ")}
                  </p>
                )}
              </div>
            )}

            <div className="bg-white dark:bg-[#0B192C] rounded-2xl border border-gray-200 dark:border-slate-800 p-6 shadow-sm">
              <h3 className="text-base font-bold text-[#0B192C] dark:text-white tracking-tight mb-4">
                Booking status
              </h3>
              {statusRows.length === 0 ? (
                <EmptyState message="No bookings recorded yet" />
              ) : (
                <RankedBars rows={statusRows} format={formatIndianNumber} />
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <StatTile
            label="Booked value"
            value={formatCurrency(overview?.totals.windowGrossValue ?? 0)}
            caption={
              <span className="text-gray-400">
                {overview?.totals.collectionRate ?? 0}% collected
              </span>
            }
          >
            <Sparkline values={series.map((p) => p.gross)} />
          </StatTile>

          <StatTile
            label="Bookings"
            value={formatIndianNumber(overview?.totals.windowBookings ?? 0)}
            caption={
              <DeltaBadge
                change={overview?.trend.bookingsChange ?? 0}
                comparable={overview?.trend.comparable ?? false}
              />
            }
          >
            <Sparkline values={series.map((p) => p.bookings)} />
          </StatTile>

          <StatTile
            label="Average booking value"
            value={formatCurrency(overview?.totals.averageBookingValue ?? 0)}
            caption={
              <span className="text-gray-400">
                Booked, across{" "}
                {formatIndianNumber(overview?.totals.windowBookings ?? 0)}{" "}
                bookings
              </span>
            }
          />

          <StatTile
            label="Cancellation rate"
            value={`${system?.financials?.cancellationRate ?? 0}%`}
            caption={
              <span className="text-gray-400">
                All time ·{" "}
                {formatIndianNumber(system?.financials?.totalBookings ?? 0)}{" "}
                bookings
              </span>
            }
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-white dark:bg-[#0B192C] rounded-2xl border border-gray-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h3 className="text-base font-bold text-[#0B192C] dark:text-white tracking-tight">
                  Recent bookings
                </h3>
                <span className="text-xs text-gray-500 font-medium">
                  Newest {bookings.length} across your jurisdiction
                </span>
              </div>
              <div className="relative min-w-[190px]">
                <input
                  type="text"
                  placeholder="Search bookings..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-3 pr-8 py-1.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-[#0B192C] dark:text-white focus:outline-none focus:ring-1 focus:ring-[#0A4DA6]"
                />
                <Search
                  size={14}
                  className="absolute right-2.5 top-2 text-gray-400 pointer-events-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate("/admin/users")}
                className="px-4 py-2 bg-[#0A4DA6] hover:bg-[#083d85] text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <Plus size={14} /> Manage users
              </button>
              <button
                onClick={() => navigate("/admin/manage/bookings/all")}
                className="p-2 rounded-xl border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="View all bookings"
              >
                <Eye size={14} />
              </button>
              <button
                onClick={() => navigate("/admin/audit-logs")}
                className="p-2 rounded-xl border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Security audit log"
              >
                <Lock size={14} />
              </button>
            </div>

            {filteredBookings.length === 0 ? (
              <EmptyState
                message={
                  bookings.length === 0
                    ? "No bookings recorded yet"
                    : "No bookings match that search"
                }
              />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 dark:bg-slate-900 text-gray-600 dark:text-gray-300 font-extrabold tracking-wider text-[10px] border-b border-gray-200 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Booking</th>
                      <th className="py-3 px-4">Pilgrim</th>
                      <th className="py-3 px-4">Ashram</th>
                      <th className="py-3 px-4 text-right">Paid</th>
                      <th className="py-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-800 font-medium text-[#0B192C] dark:text-gray-200">
                    {filteredBookings.map((row) => (
                      <tr
                        key={row.id}
                        onClick={() => navigate(`/admin/manage/bookings/all`)}
                        className="hover:bg-gray-50/60 dark:hover:bg-slate-900/50 transition-colors cursor-pointer"
                      >
                        <td className="py-3 px-4 font-mono font-bold">
                          {row.bookingId || row.id.slice(-6)}
                        </td>
                        <td className="py-3 px-4 font-extrabold">
                          {row.customerName}
                        </td>
                        <td className="py-3 px-4 text-gray-600 dark:text-gray-400">
                          {row.ashramName}
                          {row.city && (
                            <span className="text-gray-400"> · {row.city}</span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-bold text-right tabular-nums">
                          {formatCurrency(row.amountPaid)}
                          {row.amountPaid < row.totalAmount && (
                            <span className="block text-[10px] text-gray-400 font-semibold">
                              of {formatCurrency(row.totalAmount)}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2.5 py-1 rounded-lg text-[10px] font-black bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-200">
                            {humanizeLabel(row.status)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="lg:col-span-5 bg-white dark:bg-[#0B192C] rounded-2xl border border-gray-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
            <div>
              <h3 className="text-base font-bold text-[#0B192C] dark:text-white tracking-tight">
                Top ashrams by booked value
              </h3>
              <span className="text-xs text-gray-500 font-medium">
                All time, across your jurisdiction
              </span>
            </div>
            {ashramRows.length === 0 ? (
              <EmptyState message="No revenue recorded yet" />
            ) : (
              <RankedBars rows={ashramRows} format={formatCurrency} />
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-[#0B192C] rounded-2xl border border-gray-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-gray-200 dark:border-slate-800 pb-3">
            <h3 className="text-base font-bold text-[#0B192C] dark:text-white tracking-tight">
              Recent system activity
            </h3>
            <button
              onClick={() => navigate("/admin/audit-logs")}
              className="text-[11px] font-bold text-[#0A4DA6] hover:underline cursor-pointer"
            >
              View full audit log
            </button>
          </div>

          {activities.length === 0 ? (
            <EmptyState
              message="No audit activity recorded"
              hint="Entries appear here as admins approve listings, change roles and settle payments."
            />
          ) : (
            <div className="space-y-4 text-xs">
              {activities.map((log) => (
                <div key={log._id} className="flex items-start gap-4">
                  <span className="w-32 text-[11px] font-semibold text-gray-500 shrink-0 tabular-nums">
                    {log.timestamp
                      ? new Date(log.timestamp).toLocaleString(getFormattingLocale(), {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-extrabold text-[#0B192C] dark:text-white text-xs">
                      {humanizeLabel(String(log.action ?? "Activity"))}
                    </h4>
                    <span className="text-[11px] text-gray-500 font-medium block truncate">
                      {log.userId?.name || "System"} · {log.summary || log.module}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
