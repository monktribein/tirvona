import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  BedDouble, Building2, CalendarCheck, CalendarDays, CircleParking,
  Clock3, IndianRupee, LayoutDashboard, Percent, Plus, RefreshCw,
  Tag, Users, WalletCards,
} from "lucide-react";
import {
  AnalyticsAreaChart,
  AnalyticsBarChart,
  AnalyticsDonutChart,
} from "../components/dashboard/AnalyticsCharts";
import { useAuth } from "../contexts/AuthContext";
import { analyticsService } from "../services";
import { formatCurrency, formatIndianNumber } from "../utils/format";
import { humanizeLabel } from "../utils/labels";

interface TrendPoint {
  date: string;
  label: string;
  bookings: number;
  revenue: number;
  gross: number;
}

interface DashboardAnalytics {
  totalAshrams: number;
  totalRoomCategories: number;
  totalInventory: number;
  occupiedRooms: number;
  availableRooms: number;
  totalBookings: number;
  activeBookings: number;
  occupancyRate: number;
  revenue: number;
  grossBookingValue: number;
  pendingPayments: number;
  checkInsToday: number;
  checkoutSoon: number;
  todayRevenue: number;
  monthlyRevenue: number;
  cancelledBookings: number;
  averageRating: number;
  revenueTrend?: TrendPoint[];
  bookingStatuses?: { status: string; count: number }[];
  paymentStatuses?: { status: string; count: number }[];
  updatedAt?: string;
}

const tones = [
  "from-blue-600 to-indigo-700", "from-emerald-500 to-teal-700",
  "from-violet-600 to-fuchsia-700", "from-amber-500 to-orange-600",
  "from-cyan-500 to-blue-700", "from-rose-500 to-pink-700",
];

const MetricCard: React.FC<{
  label: string; value: string; detail: string; icon: React.ReactNode; tone: string;
}> = ({ label, value, detail, icon, tone }) => (
  <article className={`relative min-h-28 overflow-hidden rounded-2xl bg-gradient-to-br ${tone} p-4 text-white shadow-sm`}>
    <div className="absolute -right-5 -top-5 h-24 w-24 rounded-full bg-white/10" />
    <div className="relative flex items-start justify-between gap-3">
      <div>
        <p className="text-[11px] text-white/75">{label}</p>
        <strong className="mt-2 block text-2xl font-semibold tabular-nums">{value}</strong>
        <span className="mt-1 block text-[10px] text-white/75">{detail}</span>
      </div>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/15">{icon}</span>
    </div>
  </article>
);

export const OwnerDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null);
  const [chartMetric, setChartMetric] = useState<"revenue" | "bookings">("revenue");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const basePath = location.pathname.startsWith("/ashram-admin")
    ? "/ashram-admin"
    : location.pathname.startsWith("/ashram-owner")
      ? "/ashram-owner"
      : "/owner";

  const load = useCallback(async (background = false) => {
    if (background) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const response = await analyticsService.dashboard();
      if (!response.data?.success) throw new Error("Analytics response was not successful");
      setAnalytics(response.data.data);
    } catch (loadError) {
      console.error("Role dashboard analytics load failed:", loadError);
      setError("Dashboard analytics could not be loaded. Refresh to try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load(true);
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const trend = useMemo(
    () => (analytics?.revenueTrend ?? []).map((point) => ({
      ...point,
      revenue: Number(point.revenue || 0),
      bookings: Number(point.bookings || 0),
    })),
    [analytics?.revenueTrend],
  );
  const statuses = useMemo(
    () => (analytics?.bookingStatuses ?? []).map((row) => ({
      label: humanizeLabel(row.status), value: Number(row.count || 0),
    })),
    [analytics?.bookingStatuses],
  );
  const inventoryBars = [
    { label: "Available", value: Number(analytics?.availableRooms ?? 0) },
    { label: "Occupied", value: Number(analytics?.occupiedRooms ?? 0) },
  ];

  const canManage = ["ashram_owner", "ashram_admin", "owner", "stay_admin"].includes(String(user?.role || ""));
  const canOperate = canManage || user?.role === "manager";
  const quickActions = [
    ...(canManage ? [
      { label: "Create booking", detail: "Counter or online reservation", icon: <Plus size={17} />, path: `${basePath}/self-booking` },
      { label: "Manage bookings", detail: "Open booking and payment center", icon: <CalendarCheck size={17} />, path: `${basePath}/bookings` },
    ] : []),
    ...(canOperate ? [
      { label: "Check-in desk", detail: "Verify arrivals and departures", icon: <Clock3 size={17} />, path: `${basePath}/check-in-out` },
      { label: "Rooms & inventory", detail: "Categories, rooms and availability", icon: <BedDouble size={17} />, path: `${basePath}/rooms` },
      { label: "Inventory calendar", detail: "Update sellable room inventory", icon: <CalendarDays size={17} />, path: `${basePath}/calendar` },
    ] : []),
    ...(canManage ? [
      { label: "Offers", detail: "Manage coupons and promotions", icon: <Tag size={17} />, path: `${basePath}/offers` },
      { label: "Payouts", detail: "Bank account and payout requests", icon: <WalletCards size={17} />, path: `${basePath}/payouts` },
      { label: "Parking", detail: "Facilities and parking operations", icon: <CircleParking size={17} />, path: `${basePath}/parking` },
    ] : []),
  ];

  if (loading && !analytics) {
    return (
      <div className="space-y-5">
        <div className="h-24 rounded-2xl bg-slate-100 animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, index) => <div key={index} className="h-28 rounded-2xl bg-slate-100 animate-pulse" />)}
        </div>
        <div className="h-80 rounded-2xl bg-slate-100 animate-pulse" />
      </div>
    );
  }

  const collectionRate = analytics?.grossBookingValue
    ? Math.round((Number(analytics.revenue || 0) * 100) / Number(analytics.grossBookingValue || 1))
    : 0;
  const cards = [
    { label: "Collected revenue", value: formatCurrency(analytics?.revenue ?? 0), detail: `${formatCurrency(analytics?.todayRevenue ?? 0)} today`, icon: <IndianRupee size={18} /> },
    { label: "Bookings", value: formatIndianNumber(analytics?.totalBookings ?? 0), detail: `${formatIndianNumber(analytics?.activeBookings ?? 0)} active`, icon: <CalendarCheck size={18} /> },
    { label: "Occupancy", value: `${analytics?.occupancyRate ?? 0}%`, detail: `${analytics?.occupiedRooms ?? 0} of ${analytics?.totalInventory ?? 0} occupied`, icon: <Percent size={18} /> },
    { label: "Available rooms", value: formatIndianNumber(analytics?.availableRooms ?? 0), detail: `${analytics?.totalRoomCategories ?? 0} room categories`, icon: <BedDouble size={18} /> },
    { label: "Ashrams", value: formatIndianNumber(analytics?.totalAshrams ?? 0), detail: "Within your authorized scope", icon: <Building2 size={18} /> },
    { label: "Check-ins today", value: formatIndianNumber(analytics?.checkInsToday ?? 0), detail: `${analytics?.checkoutSoon ?? 0} check-outs today`, icon: <Users size={18} /> },
    { label: "Booked value", value: formatCurrency(analytics?.grossBookingValue ?? 0), detail: `${collectionRate}% collected`, icon: <WalletCards size={18} /> },
    { label: "Monthly revenue", value: formatCurrency(analytics?.monthlyRevenue ?? 0), detail: `${analytics?.averageRating ?? 0}/5 average rating`, icon: <LayoutDashboard size={18} /> },
  ];

  return (
    <div className={`space-y-5 transition-opacity ${refreshing ? "opacity-70" : "opacity-100"}`}>
      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">{error}</div>}

      <section className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map((card, index) => <MetricCard key={card.label} {...card} tone={tones[index % tones.length]} />)}
      </section>

      <div className="flex justify-end">
        <button type="button" onClick={() => void load(true)} disabled={refreshing} className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white px-4 py-2 text-xs text-slate-700 hover:border-[#0A4DA6] disabled:opacity-60">
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} /> Refresh data
        </button>
      </div>

      <section className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <article className="xl:col-span-7 rounded-2xl border border-orange-200 bg-white dark:bg-[#0B192C] p-5 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-base font-semibold text-slate-900 dark:text-white">14-day performance</h2><p className="text-[11px] text-slate-400">Automatically refreshes every 30 seconds</p></div>
            <div className="flex rounded-xl bg-slate-100 p-1 text-[11px]">
              {(["revenue", "bookings"] as const).map((metric) => (
                <button key={metric} type="button" onClick={() => setChartMetric(metric)} className={`rounded-lg px-3 py-1.5 capitalize ${chartMetric === metric ? "bg-[#0A4DA6] text-white" : "text-slate-500"}`}>{metric}</button>
              ))}
            </div>
          </div>
          <AnalyticsAreaChart data={trend} series={[{ key: chartMetric, label: chartMetric === "revenue" ? "Collected revenue" : "Bookings", color: chartMetric === "revenue" ? "#0A4DA6" : "#8B5CF6" }]} valueFormatter={chartMetric === "revenue" ? (value) => formatCurrency(value) : (value) => formatIndianNumber(value)} />
        </article>
        <article className="xl:col-span-5 rounded-2xl border border-orange-200 bg-white dark:bg-[#0B192C] p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Booking status mix</h2>
          <p className="text-[11px] text-slate-400">All bookings in your authorized scope</p>
          <AnalyticsDonutChart data={statuses} centerLabel="Bookings" centerValue={formatIndianNumber(analytics?.totalBookings ?? 0)} />
        </article>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <article className="rounded-2xl border border-orange-200 bg-white dark:bg-[#0B192C] p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Room utilization</h2>
          <p className="text-[11px] text-slate-400">Live occupied versus available inventory</p>
          <AnalyticsBarChart data={inventoryBars} dataKey="value" />
        </article>
        <article className="lg:col-span-2 rounded-2xl border border-orange-200 bg-white dark:bg-[#0B192C] p-5 shadow-sm">
          <div className="mb-4"><h2 className="text-base font-semibold text-slate-900 dark:text-white">Quick actions</h2><p className="text-[11px] text-slate-400">Only actions permitted for your current role are shown</p></div>
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {quickActions.map((action) => (
              <button key={action.path} type="button" onClick={() => navigate(action.path)} className="group flex min-h-20 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3 text-left transition hover:-translate-y-0.5 hover:border-[#0A4DA6] hover:bg-blue-50">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-[#0A4DA6] shadow-sm group-hover:bg-[#0A4DA6] group-hover:text-white">{action.icon}</span>
                <span><strong className="block text-xs font-semibold text-slate-900">{action.label}</strong><small className="mt-1 block text-[10px] leading-snug text-slate-400">{action.detail}</small></span>
              </button>
            ))}
          </div>
        </article>
      </section>
      <p className="text-right text-[10px] text-slate-400">Last synchronized {analytics?.updatedAt ? new Date(analytics.updatedAt).toLocaleTimeString("en-IN") : "just now"}</p>
    </div>
  );
};

export default OwnerDashboard;
