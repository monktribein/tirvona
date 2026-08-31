import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  BedDouble, Building2, CalendarCheck, CalendarDays, CircleParking,
  Clock3, IndianRupee, LayoutDashboard, Percent, Plus, RefreshCw,
  Tag, Users, WalletCards, Edit2, Sparkles, X, Calendar as CalendarIcon,
} from "lucide-react";
import {
  AnalyticsAreaChart,
  AnalyticsBarChart,
  AnalyticsDonutChart,
} from "../components/dashboard/AnalyticsCharts";
import { useAuth } from "../contexts/AuthContext";
import { useNotifications } from "../contexts/NotificationContext";
import { analyticsService, ashramService, roomService, offerService } from "../services";
import { useAshramSelection, ALL_ASHRAMS } from "../hooks/useAshramSelection";
import { formatCurrency, formatIndianNumber } from "../utils/format";
import { humanizeLabel } from "../utils/labels";
import { getErrorMessage } from "../lib/api";

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
  "from-indigo-600 to-purple-700", "from-teal-600 to-emerald-700",
];

const MetricCard: React.FC<{
  label: string; value: string; detail: string; icon: React.ReactNode; tone: string;
}> = ({ label, value, detail, icon, tone }) => (
  <article className={`relative min-h-28 overflow-hidden rounded-2xl bg-gradient-to-br ${tone} p-4 text-white shadow-sm transition-transform hover:-translate-y-0.5`}>
    <div className="absolute -right-5 -top-5 h-24 w-24 rounded-full bg-white/10" />
    <div className="relative flex items-start justify-between gap-3">
      <div>
        <p className="text-[11px] font-medium text-white/80">{label}</p>
        <strong className="mt-2 block text-2xl font-bold tabular-nums tracking-tight">{value}</strong>
        <span className="mt-1 block text-[10px] text-white/75">{detail}</span>
      </div>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/15 backdrop-blur-xs">{icon}</span>
    </div>
  </article>
);

export const OwnerDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { addNotification } = useNotifications();
  const notifyRef = useRef(addNotification);
  notifyRef.current = addNotification;

  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null);
  const [chartMetric, setChartMetric] = useState<"revenue" | "bookings">("revenue");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  // Inventory Calendar State inside Dashboard
  const [myRooms, setMyRooms] = useState<any[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [calendar, setCalendar] = useState<any[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);

  const [myOffers, setMyOffers] = useState<any[]>([]);

  const [showOverride, setShowOverride] = useState(false);
  const [targetDate, setTargetDate] = useState("");
  const [customPrice, setCustomPrice] = useState("");
  const [maintenanceCount, setMaintenanceCount] = useState("0");

  const {
    ashrams: myAshrams,
    selectedAshramId,
    setSelectedAshramId,
    loadingAshrams,
    targetAshrams,
    isAllSelected,
  } = useAshramSelection({
    storageKey: "tirvona:dashboard-ashram-filter",
    allowAll: true,
  });

  const targetsRef = useRef<any[]>([]);
  targetsRef.current = targetAshrams;

  const basePath = location.pathname.startsWith("/ashram-admin")
    ? "/ashram-admin"
    : location.pathname.startsWith("/ashram-owner")
      ? "/ashram-owner"
      : "/owner";

  // Load Dashboard Analytics & Offers
  const load = useCallback(async (background = false) => {
    if (background) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const [analyticsRes, offersRes] = await Promise.allSettled([
        analyticsService.dashboard(),
        offerService.mine(),
      ]);
      if (analyticsRes.status === "fulfilled" && analyticsRes.value.data?.success) {
        setAnalytics(analyticsRes.value.data.data);
      } else if (analyticsRes.status === "rejected") {
        throw new Error("Analytics response was not successful");
      }
      if (offersRes.status === "fulfilled" && Array.isArray(offersRes.value.data?.data)) {
        setMyOffers(offersRes.value.data.data);
      }
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

  // Load Room Categories for Calendar
  const fetchRooms = useCallback(async () => {
    setCalendarLoading(true);
    try {
      const targets = targetsRef.current;
      const results = await Promise.allSettled(
        targets.map((a: any) => ashramService.getManagedById(a._id)),
      );
      const rooms: any[] = [];
      results.forEach((result, index) => {
        if (result.status === "fulfilled" && result.value.data?.success) {
          const owner = targets[index];
          (result.value.data.data.rooms || []).forEach((room: any) =>
            rooms.push({ ...room, ashramName: owner.name }),
          );
        }
      });
      setMyRooms(rooms);
      setSelectedRoomId((current) => {
        if (current && rooms.some((r) => r._id === current)) return current;
        return rooms[0]?._id || "";
      });
      if (rooms.length === 0) setCalendarLoading(false);
    } catch (err) {
      console.error("Dashboard fetch rooms error:", err);
      setMyRooms([]);
      setSelectedRoomId("");
      setCalendarLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedAshramId) {
      setMyRooms([]);
      setSelectedRoomId("");
      setCalendar([]);
      setCalendarLoading(false);
      return;
    }
    void fetchRooms();
  }, [selectedAshramId, fetchRooms]);

  // Load 30-Day Calendar Data for Selected Room Category
  const fetchCalendar = useCallback(async () => {
    if (!selectedRoomId) {
      setCalendar([]);
      setCalendarLoading(false);
      return;
    }
    setCalendarLoading(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      const res = await roomService.calendar(selectedRoomId, today, end);
      if (res.data?.success) {
        setCalendar(res.data.data || []);
      }
    } catch (err) {
      console.error("Dashboard calendar load error:", err);
      setCalendar([]);
    } finally {
      setCalendarLoading(false);
    }
  }, [selectedRoomId]);

  useEffect(() => {
    void fetchCalendar();
  }, [fetchCalendar]);

  // Handle Daily Override Submission
  const handleOverrideSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await roomService.setAvailability(selectedRoomId, {
        date: targetDate,
        customPrice: parseFloat(customPrice) || undefined,
        maintenanceCount: parseInt(maintenanceCount) || 0,
      });
      if (res.data?.success) {
        setShowOverride(false);
        setCustomPrice("");
        setMaintenanceCount("0");
        notifyRef.current(
          "Override Applied",
          `Adjustments updated for ${targetDate}`,
          "success",
        );
        fetchCalendar();
        void load(true);
      }
    } catch (err) {
      console.error("Override error:", err);
      notifyRef.current(
        "Save Failed",
        getErrorMessage(err, "Could not apply override."),
        "error",
      );
    }
  };

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

  // 30-Day Calculations for metric cards & calendar banner
  const thirtyDayBookings = useMemo(() => {
    if (analytics?.revenueTrend && analytics.revenueTrend.length > 0) {
      return analytics.revenueTrend.reduce((sum, point) => sum + Number(point.bookings || 0), 0);
    }
    return Number(analytics?.totalBookings || 0);
  }, [analytics?.revenueTrend, analytics?.totalBookings]);

  const thirtyDayCalendarBookings = useMemo(
    () => calendar.reduce((sum, item) => sum + Number(item.booked || 0), 0),
    [calendar],
  );

  const thirtyDayFreeRooms = useMemo(
    () => calendar.reduce((sum, item) => sum + Number(item.available || 0), 0),
    [calendar],
  );

  const avgNightPrice = useMemo(() => {
    if (!calendar.length) return 0;
    const total = calendar.reduce((sum, item) => sum + Number(item.price || 0), 0);
    return Math.round(total / calendar.length);
  }, [calendar]);

  const collectionRate = analytics?.grossBookingValue
    ? Math.round((Number(analytics.revenue || 0) * 100) / Number(analytics.grossBookingValue || 1))
    : 0;

  // Total 8 Cards
  const cards = [
    { label: "Collected revenue", value: formatCurrency(analytics?.revenue ?? 0), detail: `${formatCurrency(analytics?.todayRevenue ?? 0)} today`, icon: <IndianRupee size={18} /> },
    { label: "Total Bookings", value: formatIndianNumber(analytics?.totalBookings ?? 0), detail: `${formatIndianNumber(analytics?.activeBookings ?? 0)} active`, icon: <CalendarCheck size={18} /> },
    { label: "Occupancy rate", value: `${analytics?.occupancyRate ?? 0}%`, detail: `${analytics?.occupiedRooms ?? 0} of ${analytics?.totalInventory ?? 0} occupied`, icon: <Percent size={18} /> },
    { label: "Free / Available rooms", value: formatIndianNumber(analytics?.availableRooms ?? 0), detail: `${analytics?.totalRoomCategories ?? 0} categories free`, icon: <BedDouble size={18} /> },
    { label: "30-Day Total Bookings", value: formatIndianNumber(thirtyDayBookings), detail: "Bookings in 30-day window", icon: <CalendarDays size={18} /> },
    { label: "Check-ins today", value: formatIndianNumber(analytics?.checkInsToday ?? 0), detail: `${analytics?.checkoutSoon ?? 0} check-outs today`, icon: <Users size={18} /> },
    { label: "Booked value", value: formatCurrency(analytics?.grossBookingValue ?? 0), detail: `${collectionRate}% collected`, icon: <WalletCards size={18} /> },
    { label: "Monthly revenue", value: formatCurrency(analytics?.monthlyRevenue ?? 0), detail: `${analytics?.totalAshrams ?? 0} ashram(s) managed`, icon: <Building2 size={18} /> },
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

  return (
    <div className={`space-y-6 text-left transition-opacity ${refreshing ? "opacity-75" : "opacity-100"}`}>
      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">{error}</div>}

      {/* TOP SECTION: EXACT 8 METRIC CARDS */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-black text-slate-900 dark:text-white">Stay Overview</h1>
            <p className="text-xs text-slate-400 font-medium">Real-time metrics, booking trends & 30-day inventory statistics</p>
          </div>
          <button type="button" onClick={() => void load(true)} disabled={refreshing} className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white dark:bg-[#0B192C] dark:border-slate-700 px-4 py-2 text-xs text-slate-700 dark:text-slate-200 hover:border-[#0A4DA6] disabled:opacity-60 cursor-pointer shadow-xs">
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} /> Refresh data
          </button>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((card, index) => <MetricCard key={card.label} {...card} tone={tones[index % tones.length]} />)}
        </div>
      </section>

      {/* INVENTORY CALENDAR SECTION */}
      <section className="rounded-3xl border border-blue-100 dark:border-slate-800 bg-white dark:bg-[#0B192C] p-6 shadow-sm space-y-5">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-gray-100 dark:border-slate-800 pb-4">
          <div>
            <h2 className="text-base font-extrabold text-[#0B192C] dark:text-white flex items-center gap-2">
              <CalendarIcon size={18} className="text-[#0A4DA6]" />
              30-Day Inventory & Booking Calendar
            </h2>
            <p className="text-xs text-slate-400 font-semibold mt-0.5">
              Day-by-day room availability, bookings count, free rooms left, and night rates across 30 days.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {myAshrams.length > 0 && (
              <div className="flex items-center gap-2">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Ashram</label>
                <select
                  value={selectedAshramId}
                  onChange={(e) => setSelectedAshramId(e.target.value)}
                  className="p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none"
                >
                  {myAshrams.length > 1 && (
                    <option value={ALL_ASHRAMS}>All Ashrams ({myAshrams.length})</option>
                  )}
                  {myAshrams.map((a) => (
                    <option key={a._id} value={a._id}>{a.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-center gap-2">
              <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Category</label>
              <select
                value={selectedRoomId}
                disabled={myRooms.length === 0}
                onChange={(e) => setSelectedRoomId(e.target.value)}
                className="p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none disabled:opacity-50"
              >
                {myRooms.length === 0 && <option value="">No room categories</option>}
                {myRooms.map((room) => (
                  <option key={room._id} value={room._id}>
                    {isAllSelected && room.ashramName ? `${room.name} — ${room.ashramName}` : room.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* 30-DAY SUMMARY STATS BANNER */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-blue-50/60 dark:bg-slate-900/60 border border-blue-100 dark:border-slate-800 p-4 rounded-2xl">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#0A4DA6] text-white shadow-xs">
              <CalendarCheck size={18} />
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">30-Day Bookings</span>
              <strong className="text-lg font-black text-slate-900 dark:text-white tabular-nums">
                {thirtyDayCalendarBookings} Bookings
              </strong>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-600 text-white shadow-xs">
              <BedDouble size={18} />
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Free Rooms Left</span>
              <strong className="text-lg font-black text-emerald-700 dark:text-emerald-400 tabular-nums">
                {thirtyDayFreeRooms} Rooms Free
              </strong>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-500 text-white shadow-xs">
              <IndianRupee size={18} />
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Avg Night Rate</span>
              <strong className="text-lg font-black text-slate-900 dark:text-white tabular-nums">
                {formatCurrency(avgNightPrice)} / night
              </strong>
            </div>
          </div>
        </div>

        {/* DETAILED CARDS GRID VIEW */}
        {loadingAshrams || calendarLoading ? (
          <div className="h-44 rounded-2xl bg-slate-100 dark:bg-slate-900 animate-pulse" />
        ) : calendar.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-8 text-center text-xs font-semibold text-slate-400">
            No 30-day inventory data published for the selected category.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {calendar.map((item, index) => {
              const dateObj = new Date(`${item.date}T00:00:00`);
              const formattedDate = dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" });
              return (
                <div
                  key={index}
                  className="bg-slate-50/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 space-y-2.5 relative hover:border-[#0A4DA6]/60 transition-colors shadow-2xs"
                >
                  <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-1.5">
                    <span className="text-xs font-extrabold text-[#0B192C] dark:text-white flex items-center gap-1.5">
                      <CalendarIcon size={13} className="text-[#0A4DA6] shrink-0" />
                      <strong className="font-black tracking-tight text-slate-900 dark:text-white">{formattedDate}</strong>
                    </span>
                    <button
                      onClick={() => {
                        setTargetDate(item.date);
                        setCustomPrice(item.price.toString());
                        setShowOverride(true);
                      }}
                      className="p-1 hover:bg-white dark:hover:bg-slate-800 rounded text-slate-400 hover:text-[#0A4DA6] transition-colors cursor-pointer"
                      title="Override daily rate / maintenance"
                    >
                      <Edit2 size={10} />
                    </button>
                  </div>

                  <div>
                    <span className="text-[9px] text-slate-400 block font-semibold">Night Rate</span>
                    <span className="text-xs font-black text-slate-900 dark:text-white">
                      {formatCurrency(item.price)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-1 text-center text-[9px] font-bold">
                    <div className="p-1 bg-[#0A4DA6]/10 text-[#0A4DA6] dark:text-blue-400 rounded-md">
                      <span>{item.booked} Booked</span>
                    </div>
                    <div className="p-1 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded-md">
                      <span>{item.available} Free</span>
                    </div>
                  </div>

                  {Number(item.transferredFromOffline || 0) > 0 && (
                    <div className="p-1 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 text-center text-[8px] font-black">
                      +{item.transferredFromOffline} OFFLINE
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 14-DAY PERFORMANCE & BOOKING MIX CHARTS */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <article className="xl:col-span-7 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B192C] p-5 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">14-day performance</h2>
              <p className="text-[11px] text-slate-400">Automatically refreshes every 30 seconds</p>
            </div>
            <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 text-[11px]">
              {(["revenue", "bookings"] as const).map((metric) => (
                <button
                  key={metric}
                  type="button"
                  onClick={() => setChartMetric(metric)}
                  className={`rounded-lg px-3 py-1.5 capitalize cursor-pointer ${chartMetric === metric ? "bg-[#0A4DA6] text-white" : "text-slate-500 dark:text-slate-400"}`}
                >
                  {metric}
                </button>
              ))}
            </div>
          </div>
          <AnalyticsAreaChart data={trend} series={[{ key: chartMetric, label: chartMetric === "revenue" ? "Collected revenue" : "Bookings", color: chartMetric === "revenue" ? "#0A4DA6" : "#8B5CF6" }]} valueFormatter={chartMetric === "revenue" ? (value) => formatCurrency(value) : (value) => formatIndianNumber(value)} />
        </article>

        <article className="xl:col-span-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B192C] p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Booking status mix</h2>
          <p className="text-[11px] text-slate-400">All bookings in your authorized scope</p>
          <AnalyticsDonutChart data={statuses} centerLabel="Bookings" centerValue={formatIndianNumber(analytics?.totalBookings ?? 0)} />
        </article>
      </section>

      {/* ACTIVE DEALS & PROMOTIONS SECTION */}
      <section className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B192C] p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <Tag size={18} className="text-[#0A4DA6]" />
              Active Deals & Promotional Offers ({myOffers.filter((o) => o.status === "active").length})
            </h2>
            <p className="text-xs text-slate-400 font-semibold mt-0.5">
              Live discount coupons, Last Minute Deals, and special packages configured for your ashrams.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate(`${basePath}/offers`)}
              className="px-4 py-2 rounded-xl bg-[#0A4DA6] hover:bg-[#083D85] text-white text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-sm"
            >
              <Plus size={14} /> Create / Manage Deals
            </button>
          </div>
        </div>

        {myOffers.filter((o) => o.status === "active").length === 0 ? (
          <div className="py-8 text-center bg-slate-50/60 dark:bg-slate-900/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 space-y-2">
            <Tag size={28} className="mx-auto text-slate-300 dark:text-slate-600" />
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No active promotional deals yet.</p>
            <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
              Create a Last Minute Deal or discount voucher to attract more guests and boost your retreat bookings.
            </p>
            <button
              type="button"
              onClick={() => navigate(`${basePath}/offers`)}
              className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0A4DA6] text-white text-xs font-bold hover:bg-[#083D85] transition cursor-pointer"
            >
              <Sparkles size={13} /> Launch Last Minute Deal
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {myOffers
              .filter((o) => o.status === "active")
              .slice(0, 6)
              .map((offer) => {
                const discountText =
                  offer.discountType === "Percentage"
                    ? `${offer.discountValue}% OFF`
                    : offer.discountType === "Flat Amount"
                      ? `₹${offer.discountValue} OFF`
                      : offer.discountType;

                const ashramName =
                  offer.ashramId?.name ||
                  (offer.applicableAshrams && offer.applicableAshrams[0]?.name) ||
                  "All Managed Ashrams";

                return (
                  <div
                    key={offer._id}
                    className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 hover:border-[#0A4DA6]/40 transition space-y-3 relative overflow-hidden flex flex-col justify-between"
                  >
                    {offer.isLastMinuteDeal && (
                      <div className="absolute top-0 right-0">
                        <span className="text-[9px] font-black uppercase px-2.5 py-0.5 rounded-bl-xl bg-gradient-to-r from-rose-600 to-amber-500 text-white shadow-xs">
                          ⚡ Last Minute Deal
                        </span>
                      </div>
                    )}

                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-black text-xs px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[#0A4DA6] dark:text-blue-400 rounded-lg shadow-xs tracking-wider">
                          {offer.promoCode}
                        </span>
                        <span className="text-[10px] font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-md">
                          {discountText}
                        </span>
                      </div>

                      <h4 className="text-xs font-black text-slate-900 dark:text-white line-clamp-1">
                        {offer.offerTitle}
                      </h4>
                      <p className="text-[10px] font-bold text-slate-400 line-clamp-1">
                        {ashramName}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between text-[10px] font-bold text-slate-500 dark:text-slate-400">
                      <span>
                        Redemptions:{" "}
                        <strong className="text-slate-900 dark:text-white tabular-nums">
                          {offer.remainingRedemptions ?? 0} left
                        </strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => navigate(`${basePath}/offers`)}
                        className="text-[#0A4DA6] dark:text-blue-400 hover:underline font-extrabold cursor-pointer"
                      >
                        Edit →
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </section>

      {/* ROOM UTILIZATION & QUICK ACTIONS */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <article className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B192C] p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Room utilization</h2>
          <p className="text-[11px] text-slate-400">Live occupied versus available inventory</p>
          <AnalyticsBarChart data={inventoryBars} dataKey="value" />
        </article>

        <article className="lg:col-span-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B192C] p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Quick actions</h2>
            <p className="text-[11px] text-slate-400">Only actions permitted for your current role are shown</p>
          </div>
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {quickActions.map((action) => (
              <button
                key={action.path}
                type="button"
                onClick={() => navigate(action.path)}
                className="group flex min-h-20 items-center gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 p-3 text-left transition hover:-translate-y-0.5 hover:border-[#0A4DA6] hover:bg-blue-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white dark:bg-slate-800 text-[#0A4DA6] shadow-sm group-hover:bg-[#0A4DA6] group-hover:text-white">
                  {action.icon}
                </span>
                <span>
                  <strong className="block text-xs font-semibold text-slate-900 dark:text-white">{action.label}</strong>
                  <small className="mt-1 block text-[10px] leading-snug text-slate-400">{action.detail}</small>
                </span>
              </button>
            ))}
          </div>
        </article>
      </section>

      {/* OVERRIDE MODAL */}
      {showOverride && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleOverrideSubmit}
            className="bg-white dark:bg-[#0B192C] border border-slate-200 dark:border-slate-800 max-w-md w-full rounded-3xl p-6 space-y-4 shadow-xl"
          >
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Sparkles size={16} className="text-[#0A4DA6]" /> Override Daily Rate / Inventory
              </h3>
              <button
                type="button"
                onClick={() => setShowOverride(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400">Selected Date</label>
                <input
                  type="text"
                  disabled
                  value={targetDate}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-500 cursor-not-allowed"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400">Custom Night Rate (₹)</label>
                  <input
                    type="number"
                    required
                    value={customPrice}
                    onChange={(e) => setCustomPrice(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-center focus:outline-none dark:text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400">Maintenance Units</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={maintenanceCount}
                    onChange={(e) => setMaintenanceCount(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-center focus:outline-none dark:text-white"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-[#0A4DA6] text-white rounded-full font-extrabold text-xs shadow-md hover:bg-[#083b80] transition-all cursor-pointer"
            >
              Apply Daily Adjustments
            </button>
          </form>
        </div>
      )}

      <p className="text-right text-[10px] text-slate-400">
        Last synchronized {analytics?.updatedAt ? new Date(analytics.updatedAt).toLocaleTimeString("en-IN") : "just now"}
      </p>
    </div>
  );
};

export default OwnerDashboard;
