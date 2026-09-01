import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  BedDouble, Building2, CalendarCheck, CalendarDays, CircleParking,
  Clock3, IndianRupee, LayoutDashboard, Percent, Plus, RefreshCw,
  Tag, Users, WalletCards, Edit2, Sparkles, X, Calendar as CalendarIcon,
  ChevronLeft, ChevronRight, Search, CheckCircle2, AlertCircle, Phone,
  Mail, ArrowRight, Ban, Check, ExternalLink, ShieldCheck,
} from "lucide-react";
import {
  AnalyticsAreaChart,
  AnalyticsBarChart,
  AnalyticsDonutChart,
} from "../components/dashboard/AnalyticsCharts";
import { useAuth } from "../contexts/AuthContext";
import { useNotifications } from "../contexts/NotificationContext";
import { analyticsService, ashramService, roomService, offerService, bookingService } from "../services";
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

const isDealActive = (offer: any): boolean => {
  if (offer.status !== "active") return false;
  if (offer.validTill && new Date(offer.validTill).getTime() < Date.now()) return false;
  if (typeof offer.remainingRedemptions === "number" && offer.remainingRedemptions <= 0) return false;
  return true;
};

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

  // Inventory Calendar & Rolling Date Window State
  const getTodayDateStr = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const todayStr = useMemo(() => getTodayDateStr(), []);
  const [centerDate, setCenterDate] = useState<string>(getTodayDateStr());
  const [searchDateInput, setSearchDateInput] = useState<string>("");

  const [myRooms, setMyRooms] = useState<any[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [calendar, setCalendar] = useState<any[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);

  // Date Booking Details & Actions Modal
  const [activeDetailDate, setActiveDetailDate] = useState<string | null>(null);
  const [dateBookings, setDateBookings] = useState<any[]>([]);
  const [dateBookingsLoading, setDateBookingsLoading] = useState(false);

  // Booking Edit / Assign Room Number State
  const [editingBooking, setEditingBooking] = useState<any | null>(null);
  const [editRoomNumber, setEditRoomNumber] = useState("");
  const [savingRoomNo, setSavingRoomNo] = useState(false);

  // Ashram Cancellation Modal State (100% Refund)
  const [cancellingBooking, setCancellingBooking] = useState<any | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancellingLoading, setCancellingLoading] = useState(false);

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

  // Max 90-day booking window boundary calculation
  const maxSearchDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 90);
    return d.toISOString().split("T")[0];
  }, []);

  const minSearchDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  }, []);

  // 15-Day Rolling Window: 7 days before centerDate, centerDate, and 7 days after centerDate
  const fifteenDays = useMemo(() => {
    const base = new Date(`${centerDate}T00:00:00`);
    const list = [];
    for (let i = -7; i <= 7; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      const dateStr = d.toISOString().split("T")[0];
      const dayName = d.toLocaleDateString("en-US", { weekday: "short" });
      const dayNumber = d.getDate();
      const monthName = d.toLocaleDateString("en-US", { month: "short" });
      const fullDateStr = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
      const item = calendar.find((c) => c.date === dateStr);

      list.push({
        date: dateStr,
        dayName,
        dayNumber,
        monthName,
        fullDateStr,
        offset: i,
        isToday: dateStr === todayStr,
        isSelected: dateStr === activeDetailDate,
        isCenter: i === 0,
        booked: Number(item?.booked ?? 0),
        available: Number(item?.available ?? 0),
        price: Number(item?.price ?? 0),
        transferredFromOffline: Number(item?.transferredFromOffline ?? 0),
        maintenance: Number(item?.maintenance ?? 0),
      });
    }
    return list;
  }, [centerDate, todayStr, activeDetailDate, calendar]);

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

  // Load Calendar Data for 15-Day window around centerDate
  const fetchCalendar = useCallback(async () => {
    if (!selectedRoomId) {
      setCalendar([]);
      setCalendarLoading(false);
      return;
    }
    setCalendarLoading(true);
    try {
      const base = new Date(`${centerDate}T00:00:00`);
      const startObj = new Date(base);
      startObj.setDate(base.getDate() - 14);
      const endObj = new Date(base);
      endObj.setDate(base.getDate() + 20);

      const start = startObj.toISOString().split("T")[0];
      const end = endObj.toISOString().split("T")[0];
      const res = await roomService.calendar(selectedRoomId, start, end);
      if (res.data?.success) {
        setCalendar(res.data.data || []);
      }
    } catch (err) {
      console.error("Dashboard calendar load error:", err);
      setCalendar([]);
    } finally {
      setCalendarLoading(false);
    }
  }, [selectedRoomId, centerDate]);

  useEffect(() => {
    void fetchCalendar();
  }, [fetchCalendar]);

  // Fetch Bookings for a Specific Clicked Date
  const fetchDateBookings = useCallback(async (dateStr: string) => {
    setDateBookingsLoading(true);
    try {
      const res = await bookingService.dashboard({
        date: dateStr,
        limit: "100",
        ...(selectedAshramId && selectedAshramId !== ALL_ASHRAMS ? { ashramId: selectedAshramId } : {}),
      });
      if (res.data?.success) {
        let list = res.data.data || [];
        if (selectedRoomId) {
          list = list.filter((b: any) => {
            const rId = typeof b.roomId === "object" ? b.roomId?._id : b.roomId;
            return !rId || String(rId) === String(selectedRoomId);
          });
        }
        setDateBookings(list);
      } else {
        setDateBookings([]);
      }
    } catch (err) {
      console.error("Failed to load date bookings:", err);
      setDateBookings([]);
    } finally {
      setDateBookingsLoading(false);
    }
  }, [selectedAshramId, selectedRoomId]);

  useEffect(() => {
    if (activeDetailDate) {
      void fetchDateBookings(activeDetailDate);
    }
  }, [activeDetailDate, fetchDateBookings]);

  // Handle Date Navigation (Prev 7 Days, Today, Next 7 Days)
  const handlePrev7Days = () => {
    const curr = new Date(`${centerDate}T00:00:00`);
    curr.setDate(curr.getDate() - 7);
    setCenterDate(curr.toISOString().split("T")[0]);
  };

  const handleNext7Days = () => {
    const curr = new Date(`${centerDate}T00:00:00`);
    curr.setDate(curr.getDate() + 7);
    setCenterDate(curr.toISOString().split("T")[0]);
  };

  const handleResetToday = () => {
    const t = getTodayDateStr();
    setCenterDate(t);
    setSearchDateInput("");
  };

  const handleSearchDateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchDateInput) return;
    setCenterDate(searchDateInput);
    setActiveDetailDate(searchDateInput);
  };

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
        if (activeDetailDate === targetDate) {
          fetchDateBookings(targetDate);
        }
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

  // Handle Room Assignment
  const handleSaveRoomNumber = async (bookingId: string) => {
    if (!editRoomNumber.trim()) return;
    setSavingRoomNo(true);
    try {
      await bookingService.assignRoomNumber(bookingId, editRoomNumber.trim());
      notifyRef.current("Room Assigned", `Room number set to ${editRoomNumber.trim()}`, "success");
      setEditingBooking(null);
      setEditRoomNumber("");
      if (activeDetailDate) void fetchDateBookings(activeDetailDate);
      void fetchCalendar();
      void load(true);
    } catch (err) {
      notifyRef.current("Update Failed", getErrorMessage(err, "Could not assign room number."), "error");
    } finally {
      setSavingRoomNo(false);
    }
  };

  // Handle Check-In / Check-Out
  const handleQuickCheckin = async (booking: any) => {
    try {
      const code = booking.checkInCode || "0000";
      await bookingService.checkin(booking._id, code);
      notifyRef.current("Check-in Confirmed", `${booking.customerId?.name || "Guest"} checked in successfully.`, "success");
      if (activeDetailDate) void fetchDateBookings(activeDetailDate);
      void fetchCalendar();
      void load(true);
    } catch (err) {
      notifyRef.current("Check-in Failed", getErrorMessage(err, "Could not process check-in."), "error");
    }
  };

  const handleQuickCheckout = async (booking: any) => {
    try {
      await bookingService.checkout(booking._id);
      notifyRef.current("Check-out Completed", `${booking.customerId?.name || "Guest"} checked out successfully.`, "success");
      if (activeDetailDate) void fetchDateBookings(activeDetailDate);
      void fetchCalendar();
      void load(true);
    } catch (err) {
      notifyRef.current("Check-out Failed", getErrorMessage(err, "Could not process check-out."), "error");
    }
  };

  // Handle Ashram-Side Cancellation (100% Refund guaranteed)
  const handleCancelBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancellingBooking) return;
    setCancellingLoading(true);
    try {
      await bookingService.cancel(
        cancellingBooking._id,
        cancelReason.trim() || "Cancelled by Ashram / Stay Management",
      );
      notifyRef.current(
        "Booking Cancelled",
        "Booking cancelled. 100% full refund has been credited to the guest per Ashram policy.",
        "success",
      );
      setCancellingBooking(null);
      setCancelReason("");
      if (activeDetailDate) void fetchDateBookings(activeDetailDate);
      void fetchCalendar();
      void load(true);
    } catch (err) {
      notifyRef.current("Cancellation Failed", getErrorMessage(err, "Could not cancel booking."), "error");
    } finally {
      setCancellingLoading(false);
    }
  };

  const activeDealsList = useMemo(
    () => myOffers.filter(isDealActive),
    [myOffers],
  );

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

  const inventoryBars = useMemo(
    () => [
      { label: "Available", value: Number(analytics?.availableRooms ?? 0) },
      { label: "Occupied", value: Number(analytics?.occupiedRooms ?? 0) },
    ],
    [analytics?.availableRooms, analytics?.occupiedRooms],
  );

  const thirtyDayBookings = useMemo(() => {
    if (analytics?.revenueTrend && analytics.revenueTrend.length > 0) {
      return analytics.revenueTrend.reduce((sum, point) => sum + Number(point.bookings || 0), 0);
    }
    return Number(analytics?.totalBookings || 0);
  }, [analytics?.revenueTrend, analytics?.totalBookings]);

  const windowBookedCount = useMemo(
    () => fifteenDays.reduce((sum, item) => sum + item.booked, 0),
    [fifteenDays],
  );

  const windowFreeRooms = useMemo(
    () => fifteenDays.reduce((sum, item) => sum + item.available, 0),
    [fifteenDays],
  );

  const avgNightPrice = useMemo(() => {
    const valid = fifteenDays.filter((i) => i.price > 0);
    if (!valid.length) return 0;
    const total = valid.reduce((sum, item) => sum + item.price, 0);
    return Math.round(total / valid.length);
  }, [fifteenDays]);

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

  // Active detail date info
  const activeDateMeta = useMemo(() => {
    if (!activeDetailDate) return null;
    return fifteenDays.find((d) => d.date === activeDetailDate) || {
      date: activeDetailDate,
      fullDateStr: new Date(`${activeDetailDate}T00:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" }),
      isToday: activeDetailDate === todayStr,
      booked: dateBookings.length,
      available: 0,
      price: 0,
      maintenance: 0,
    };
  }, [activeDetailDate, fifteenDays, todayStr, dateBookings]);

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
            <p className="text-xs text-slate-400 font-medium">Real-time metrics, booking trends & live calendar bookings</p>
          </div>
          <button type="button" onClick={() => void load(true)} disabled={refreshing} className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white dark:bg-[#0B192C] dark:border-slate-700 px-4 py-2 text-xs text-slate-700 dark:text-slate-200 hover:border-[#0A4DA6] disabled:opacity-60 cursor-pointer shadow-xs">
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} /> Refresh data
          </button>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((card, index) => <MetricCard key={card.label} {...card} tone={tones[index % tones.length]} />)}
        </div>
      </section>

      {/* ROLLING CALENDAR SECTION: TODAY ± 7 DAYS WITH DATE SEARCH & DETAILS */}
      <section className="rounded-3xl border border-blue-100 dark:border-slate-800 bg-white dark:bg-[#0B192C] p-6 shadow-sm space-y-5">
        {/* CALENDAR CONTROLS & HEADER */}
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 border-b border-gray-100 dark:border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-extrabold text-[#0B192C] dark:text-white flex items-center gap-2">
                <CalendarIcon size={18} className="text-[#0A4DA6]" />
                Live Booking & Inventory Calendar
              </h2>
              <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-blue-100 text-[#0A4DA6] dark:bg-blue-950 dark:text-blue-300">
                Today ± 7 Days
              </span>
              <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 flex items-center gap-1">
                <ShieldCheck size={12} /> 100% Refund on Ashram Cancel
              </span>
            </div>
            <p className="text-xs text-slate-400 font-semibold mt-0.5">
              Click any date to view all guest booking details, assign room numbers, manage status, and adjust daily rates.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto justify-between xl:justify-end">
            {/* Ashram Selector */}
            {myAshrams.length > 0 && (
              <div className="flex items-center gap-1.5">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Ashram</label>
                <select
                  value={selectedAshramId}
                  onChange={(e) => setSelectedAshramId(e.target.value)}
                  className="p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none"
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

            {/* Room Category Selector */}
            <div className="flex items-center gap-1.5">
              <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Category</label>
              <select
                value={selectedRoomId}
                disabled={myRooms.length === 0}
                onChange={(e) => setSelectedRoomId(e.target.value)}
                className="p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none disabled:opacity-50"
              >
                {myRooms.length === 0 && <option value="">No room categories</option>}
                {myRooms.map((room) => (
                  <option key={room._id} value={room._id}>
                    {isAllSelected && room.ashramName ? `${room.name} — ${room.ashramName}` : room.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Specific Date Search (Max 90 Days Window) */}
            <form onSubmit={handleSearchDateSubmit} className="flex items-center gap-1.5">
              <input
                type="date"
                min={minSearchDate}
                max={maxSearchDate}
                value={searchDateInput}
                onChange={(e) => setSearchDateInput(e.target.value)}
                className="p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none"
                title="Search any booking date up to 90 days ahead"
              />
              <button
                type="submit"
                disabled={!searchDateInput}
                className="p-2 bg-[#0A4DA6] text-white rounded-xl hover:bg-[#083b80] transition disabled:opacity-40 cursor-pointer shadow-xs"
                title="Jump to date and view booking details"
              >
                <Search size={14} />
              </button>
            </form>
          </div>
        </div>

        {/* DATE RANGE NAVIGATION BAR */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50/90 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 p-3 rounded-2xl">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrev7Days}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:border-[#0A4DA6] hover:text-[#0A4DA6] transition cursor-pointer shadow-2xs"
            >
              <ChevronLeft size={14} /> 7 Days Back
            </button>
            <button
              type="button"
              onClick={handleResetToday}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer shadow-2xs ${
                centerDate === todayStr
                  ? "bg-[#0A4DA6] text-white"
                  : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-[#0A4DA6]"
              }`}
            >
              <CalendarCheck size={13} /> Reset to Today
            </button>
            <button
              type="button"
              onClick={handleNext7Days}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:border-[#0A4DA6] hover:text-[#0A4DA6] transition cursor-pointer shadow-2xs"
            >
              Next 7 Days <ChevronRight size={14} />
            </button>
          </div>

          {/* SUMMARY PILLS */}
          <div className="flex items-center gap-3 text-xs font-bold">
            <span className="text-slate-500 dark:text-slate-400">
              Window Total: <strong className="text-slate-900 dark:text-white tabular-nums">{windowBookedCount} Booked</strong>
            </span>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <span className="text-emerald-700 dark:text-emerald-400">
              <strong className="tabular-nums">{windowFreeRooms} Free Left</strong>
            </span>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <span className="text-[#0A4DA6] dark:text-blue-400">
              Avg: <strong className="tabular-nums">{formatCurrency(avgNightPrice)}/nt</strong>
            </span>
          </div>
        </div>

        {/* 15-DAY HORIZONTAL ROLLING CALENDAR STRIP */}
        {loadingAshrams || calendarLoading ? (
          <div className="h-32 rounded-2xl bg-slate-100 dark:bg-slate-900 animate-pulse" />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-8 xl:grid-cols-15 gap-2 overflow-x-auto pb-1">
            {fifteenDays.map((day) => {
              const isToday = day.isToday;
              const isSelected = activeDetailDate === day.date;

              return (
                <div
                  key={day.date}
                  onClick={() => setActiveDetailDate(day.date)}
                  className={`relative rounded-2xl p-2.5 text-center cursor-pointer transition-all duration-200 flex flex-col justify-between select-none ${
                    isSelected
                      ? "ring-2 ring-[#0A4DA6] bg-blue-50/90 dark:bg-blue-950/50 shadow-md transform -translate-y-0.5"
                      : isToday
                        ? "border-2 border-orange-400 bg-orange-50/60 dark:bg-orange-950/20 shadow-xs hover:border-orange-500"
                        : "border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/70 hover:border-[#0A4DA6]/60 hover:bg-blue-50/40"
                  }`}
                >
                  {/* Top Badge (TODAY / Offset) */}
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-[10px] font-black uppercase text-slate-400">
                      {day.dayName}
                    </span>
                    {isToday && (
                      <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full bg-orange-500 text-white animate-pulse">
                        Today
                      </span>
                    )}
                  </div>

                  {/* Day Number */}
                  <div className="my-1">
                    <span className={`text-base font-black tabular-nums ${isToday ? "text-orange-600 dark:text-orange-400 font-extrabold" : "text-slate-900 dark:text-white"}`}>
                      {day.dayNumber}
                    </span>
                    <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-tight">
                      {day.monthName}
                    </span>
                  </div>

                  {/* Pricing */}
                  <div className="text-[10px] font-black text-slate-700 dark:text-slate-300 my-0.5">
                    {day.price > 0 ? formatCurrency(day.price) : "—"}
                  </div>

                  {/* Booked / Free Mini Badges */}
                  <div className="space-y-1 mt-1.5 pt-1.5 border-t border-slate-200/60 dark:border-slate-800">
                    <div className={`text-[9px] font-black py-0.5 px-1 rounded ${day.booked > 0 ? "bg-[#0A4DA6] text-white" : "bg-slate-200/60 dark:bg-slate-800 text-slate-500"}`}>
                      {day.booked} Bkd
                    </div>
                    <div className="text-[9px] font-black py-0.5 px-1 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                      {day.available} Free
                    </div>
                  </div>

                  {/* Action link */}
                  <div className="mt-1.5 text-[8px] font-extrabold text-[#0A4DA6] dark:text-blue-400 underline flex items-center justify-center gap-0.5">
                    Details →
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* DATE BOOKINGS DETAIL MODAL / DRAWER */}
      {activeDetailDate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="bg-white dark:bg-[#0B192C] border border-slate-200 dark:border-slate-800 max-w-4xl w-full rounded-3xl p-5 sm:p-6 space-y-5 shadow-2xl my-auto max-h-[92vh] flex flex-col">
            {/* MODAL HEADER */}
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4 shrink-0">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <CalendarDays size={20} className="text-[#0A4DA6]" />
                    Bookings for {activeDateMeta?.fullDateStr || activeDetailDate}
                  </h3>
                  {activeDetailDate === todayStr && (
                    <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-orange-500 text-white">
                      ⚡ TODAY
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 font-semibold mt-0.5">
                  Comprehensive guest list, room allocations, payment status, and quick booking operations for this date.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setActiveDetailDate(null)}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* DATE STATS & QUICK ACTIONS BAR */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 dark:bg-slate-900/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shrink-0">
              <div className="flex items-center justify-between sm:justify-start gap-3">
                <div className="text-xs font-bold text-slate-400">Total Bookings</div>
                <div className="text-sm font-black text-[#0A4DA6] dark:text-blue-400">
                  {dateBookings.length} Guests Booked
                </div>
              </div>
              <div className="flex items-center justify-between sm:justify-start gap-3">
                <div className="text-xs font-bold text-slate-400">Night Rate</div>
                <div className="text-sm font-black text-slate-900 dark:text-white">
                  {activeDateMeta?.price ? formatCurrency(activeDateMeta.price) : "Standard rate"}
                </div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setTargetDate(activeDetailDate);
                    setCustomPrice(activeDateMeta?.price?.toString() || "");
                    setShowOverride(true);
                  }}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:border-[#0A4DA6] hover:text-[#0A4DA6] transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                >
                  <Edit2 size={12} /> Edit Date Rate
                </button>
                <button
                  type="button"
                  onClick={() => navigate(`${basePath}/self-booking`)}
                  className="px-3 py-1.5 rounded-xl bg-[#0A4DA6] text-white text-xs font-bold hover:bg-[#083b80] transition cursor-pointer flex items-center gap-1 shadow-2xs"
                >
                  <Plus size={12} /> Add Booking
                </button>
              </div>
            </div>

            {/* 100% REFUND ASHRAM CANCELLATION GUARANTEE BANNER */}
            <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center gap-2.5 text-xs text-emerald-800 dark:text-emerald-300 font-bold shrink-0">
              <ShieldCheck size={18} className="text-emerald-600 shrink-0" />
              <span>
                <strong>Ashram Policy Guarantee:</strong> If a room is cancelled from the Ashram management side, a <strong>100% full refund</strong> is automatically credited back to the customer.
              </span>
            </div>

            {/* BOOKINGS LIST BODY */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {dateBookingsLoading ? (
                <div className="py-12 text-center space-y-3">
                  <RefreshCw size={24} className="animate-spin mx-auto text-[#0A4DA6]" />
                  <p className="text-xs font-bold text-slate-400">Loading booking records for {activeDetailDate}...</p>
                </div>
              ) : dateBookings.length === 0 ? (
                <div className="py-10 text-center bg-slate-50/70 dark:bg-slate-900/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 space-y-2">
                  <BedDouble size={32} className="mx-auto text-slate-300 dark:text-slate-600" />
                  <p className="text-xs font-extrabold text-slate-700 dark:text-slate-300">
                    No bookings found for {activeDetailDate}
                  </p>
                  <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                    All rooms are currently free and available for direct or online reservations.
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate(`${basePath}/self-booking`)}
                    className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0A4DA6] text-white text-xs font-bold hover:bg-[#083D85] transition cursor-pointer"
                  >
                    <Plus size={13} /> Create Counter Reservation
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {dateBookings.map((booking) => {
                    const guestName = booking.customerId?.name || booking.primaryGuest?.fullName || "Guest";
                    const guestPhone = booking.customerId?.phone || booking.primaryGuest?.phone || "N/A";
                    const guestEmail = booking.customerId?.email || booking.primaryGuest?.email || "N/A";
                    const roomName = booking.roomId?.name || "Standard Room";
                    const assignedRoom = booking.assignedRoomNumber || booking.roomNumber || "Unassigned";
                    const isCheckedIn = booking.status === "checked_in";
                    const isCancelled = ["cancelled", "refunded"].includes(booking.status);
                    const isConfirmed = booking.status === "confirmed";

                    return (
                      <div
                        key={booking._id}
                        className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 hover:border-[#0A4DA6]/40 transition space-y-3 shadow-2xs"
                      >
                        {/* TOP ROW: GUEST & STATUS */}
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
                          <div className="flex items-center gap-2.5">
                            <div className="grid h-8 w-8 place-items-center rounded-full bg-[#0A4DA6]/10 text-[#0A4DA6] dark:text-blue-400 font-black text-xs">
                              {guestName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <strong className="text-xs font-black text-slate-900 dark:text-white block">
                                {guestName}
                              </strong>
                              <span className="text-[10px] font-mono text-slate-400">
                                {booking.bookingId || booking.reservationNumber || booking._id}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                              isCheckedIn
                                ? "bg-blue-100 text-[#0A4DA6] dark:bg-blue-950 dark:text-blue-300"
                                : isConfirmed
                                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                                  : isCancelled
                                    ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                                    : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                            }`}>
                              {humanizeLabel(booking.status)}
                            </span>
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase">
                              {booking.bookingSource || "tirvona"}
                            </span>
                          </div>
                        </div>

                        {/* DETAILS GRID */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 block">Room Category</span>
                            <strong className="text-slate-800 dark:text-slate-200 font-bold">{roomName}</strong>
                          </div>

                          <div>
                            <span className="text-[10px] font-bold text-slate-400 block">Assigned Room #</span>
                            <span className="font-mono font-black text-[#0A4DA6] dark:text-blue-400">
                              {assignedRoom !== "Unassigned" ? `Room #${assignedRoom}` : "Not Assigned"}
                            </span>
                          </div>

                          <div>
                            <span className="text-[10px] font-bold text-slate-400 block">Stay Duration</span>
                            <span className="text-slate-700 dark:text-slate-300 font-bold">
                              {booking.checkInDate ? new Date(booking.checkInDate).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"} →{" "}
                              {booking.checkOutDate ? new Date(booking.checkOutDate).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
                            </span>
                          </div>

                          <div>
                            <span className="text-[10px] font-bold text-slate-400 block">Payment ({booking.paymentStatus || "Paid"})</span>
                            <span className="text-slate-900 dark:text-white font-black">
                              {formatCurrency(booking.pricing?.totalPrice || booking.totalAmount || 0)}
                            </span>
                          </div>
                        </div>

                        {/* CONTACT & ACTION BUTTONS */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                          <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                            {guestPhone !== "N/A" && (
                              <a
                                href={`tel:${guestPhone}`}
                                className="hover:text-[#0A4DA6] flex items-center gap-1 font-bold"
                              >
                                <Phone size={12} /> {guestPhone}
                              </a>
                            )}
                            {guestEmail !== "N/A" && (
                              <span className="hidden sm:inline-flex items-center gap-1 font-medium">
                                <Mail size={12} /> {guestEmail}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5">
                            {/* Assign / Edit Room Number Button */}
                            {!isCancelled && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingBooking(booking);
                                  setEditRoomNumber(assignedRoom !== "Unassigned" ? assignedRoom : "");
                                }}
                                className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:border-[#0A4DA6] hover:text-[#0A4DA6] transition cursor-pointer flex items-center gap-1"
                              >
                                <Tag size={11} /> {assignedRoom !== "Unassigned" ? "Edit Room #" : "Assign Room"}
                              </button>
                            )}

                            {/* Quick Check-in Button */}
                            {isConfirmed && (
                              <button
                                type="button"
                                onClick={() => void handleQuickCheckin(booking)}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-bold hover:bg-emerald-700 transition cursor-pointer flex items-center gap-1"
                              >
                                <CheckCircle2 size={11} /> Check In
                              </button>
                            )}

                            {/* Quick Check-out Button */}
                            {isCheckedIn && (
                              <button
                                type="button"
                                onClick={() => void handleQuickCheckout(booking)}
                                className="px-2.5 py-1 rounded-lg bg-blue-600 text-white text-[11px] font-bold hover:bg-blue-700 transition cursor-pointer flex items-center gap-1"
                              >
                                <ArrowRight size={11} /> Check Out
                              </button>
                            )}

                            {/* Cancel Booking Button (100% Refund guarantee) */}
                            {!isCancelled && (
                              <button
                                type="button"
                                onClick={() => {
                                  setCancellingBooking(booking);
                                  setCancelReason("");
                                }}
                                className="px-2.5 py-1 rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 text-[11px] font-bold hover:bg-rose-100 transition cursor-pointer flex items-center gap-1"
                              >
                                <Ban size={11} /> Cancel
                              </button>
                            )}

                            {/* Link to Full Booking Center */}
                            <button
                              type="button"
                              onClick={() => navigate(`${basePath}/bookings`)}
                              className="px-2 py-1 text-slate-400 hover:text-[#0A4DA6] text-[11px] font-bold transition cursor-pointer"
                              title="Open in Booking Center"
                            >
                              <ExternalLink size={13} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* MODAL FOOTER */}
            <div className="border-t border-slate-100 dark:border-slate-800 pt-3 flex justify-between items-center text-xs text-slate-400 shrink-0">
              <span>Showing all bookings on {activeDateMeta?.fullDateStr || activeDetailDate}</span>
              <button
                type="button"
                onClick={() => setActiveDetailDate(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-200 transition cursor-pointer"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ASSIGN / EDIT ROOM NUMBER MODAL */}
      {editingBooking && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-60 flex items-center justify-center p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSaveRoomNumber(editingBooking._id);
            }}
            className="bg-white dark:bg-[#0B192C] border border-slate-200 dark:border-slate-800 max-w-sm w-full rounded-3xl p-6 space-y-4 shadow-2xl"
          >
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Tag size={16} className="text-[#0A4DA6]" /> Assign Room Number
              </h3>
              <button
                type="button"
                onClick={() => setEditingBooking(null)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-400 block font-bold">Guest</span>
                <strong className="text-slate-900 dark:text-white">
                  {editingBooking.customerId?.name || editingBooking.primaryGuest?.fullName || "Guest"}
                </strong>
                <span className="text-[11px] text-slate-500 block">
                  {editingBooking.roomId?.name || "Standard Room"}
                </span>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400">Room Number / Door Label</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 101, B-204, Deluxe Suite 4"
                  value={editRoomNumber}
                  onChange={(e) => setEditRoomNumber(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold focus:outline-none dark:text-white"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={savingRoomNo || !editRoomNumber.trim()}
              className="w-full py-3 bg-[#0A4DA6] text-white rounded-full font-extrabold text-xs shadow-md hover:bg-[#083b80] transition disabled:opacity-50 cursor-pointer"
            >
              {savingRoomNo ? "Saving..." : "Save Room Allocation"}
            </button>
          </form>
        </div>
      )}

      {/* ASHRAM CANCELLATION MODAL WITH 100% REFUND POLICY NOTICE */}
      {cancellingBooking && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-60 flex items-center justify-center p-4">
          <form
            onSubmit={handleCancelBookingSubmit}
            className="bg-white dark:bg-[#0B192C] border border-slate-200 dark:border-slate-800 max-w-md w-full rounded-3xl p-6 space-y-4 shadow-2xl"
          >
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-extrabold text-sm text-rose-600 flex items-center gap-2">
                <Ban size={16} /> Cancel Reservation (Ashram Side)
              </h3>
              <button
                type="button"
                onClick={() => setCancellingBooking(null)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-1">
                <span className="text-[11px] font-black text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                  <ShieldCheck size={16} /> 100% Full Refund Policy
                </span>
                <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                  Because this cancellation is initiated from the Ashram side, the guest will receive a <strong>100% full refund of {formatCurrency(cancellingBooking.pricing?.amountPaid || cancellingBooking.pricing?.totalPrice || cancellingBooking.totalAmount || 0)}</strong> directly to their original payment mode.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-400 block font-bold">Booking Details</span>
                <strong className="text-slate-900 dark:text-white">
                  {cancellingBooking.customerId?.name || "Guest"} • {cancellingBooking.bookingId}
                </strong>
                <span className="text-[11px] text-slate-500 block">
                  {cancellingBooking.roomId?.name} ({cancellingBooking.checkInDate ? new Date(cancellingBooking.checkInDate).toLocaleDateString() : ""})
                </span>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400">Cancellation Reason (Sent to Guest)</label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g., Emergency maintenance / spiritual event overlap"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold focus:outline-none dark:text-white resize-none"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCancellingBooking(null)}
                className="flex-1 py-2.5 border border-slate-200 dark:border-slate-700 rounded-full font-bold text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 transition cursor-pointer"
              >
                Keep Booking
              </button>
              <button
                type="submit"
                disabled={cancellingLoading || !cancelReason.trim()}
                className="flex-1 py-2.5 bg-rose-600 text-white rounded-full font-extrabold text-xs shadow-md hover:bg-rose-700 transition disabled:opacity-50 cursor-pointer"
              >
                {cancellingLoading ? "Processing..." : "Confirm & 100% Refund"}
              </button>
            </div>
          </form>
        </div>
      )}

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
              Active Deals & Promotional Offers ({activeDealsList.length})
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

        {activeDealsList.length === 0 ? (
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
            {activeDealsList
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

      {/* OVERRIDE DAILY RATE & MAINTENANCE MODAL */}
      {showOverride && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-60 flex items-center justify-center p-4">
          <form
            onSubmit={handleOverrideSubmit}
            className="bg-white dark:bg-[#0B192C] border border-slate-200 dark:border-slate-800 max-w-md w-full rounded-3xl p-6 space-y-4 shadow-2xl"
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
