import React, { useCallback, useEffect, useState } from "react";
import {
  Car,
  Building2,
  Users,
  QrCode,
  AlertCircle,
  IndianRupee,
  TrendingUp,
  MapPin,
  Plus,
  RefreshCw,
  Sliders,
  X,
  Layers,
  LogOut,
  LogIn,
} from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";
import { useNotifications } from "../../../contexts/NotificationContext";
import { getErrorMessage } from "../../../lib/api";
import {
  parkingPartnerService,
  parkingScanService,
  parkingBookingService,
} from "../services/parking.service";
import type {
  ParkingBooking,
  ParkingDashboardStats,
  ParkingLocation,
} from "../types/parking.types";
import {
  formatCurrency,
  formatDateTime,
  vehicleLabel,
} from "../utils/parkingFormat";
import ParkingStatTile from "../components/ParkingStatTile";
import ParkingStatusBadge from "../components/ParkingStatusBadge";
import ParkingGuardPanelPage from "./ParkingGuardPanelPage";
import { AnalyticsBarChart } from "../../../components/dashboard/AnalyticsCharts";

export const ParkingRoleDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { addNotification } = useNotifications();

  const grantedRoles = user?.parkingRoles ?? [];
  const isPlatformAdmin = user?.role === "super_admin";
  const isAshramOwner = ["ashram_owner", "ashram_admin", "owner", "stay_admin"].includes(
    user?.role ?? "",
  );
  const canUsePartnerView =
    isPlatformAdmin || isAshramOwner || grantedRoles.includes("parking_partner");
  const canUseManagerView =
    isPlatformAdmin ||
    isAshramOwner ||
    grantedRoles.includes("parking_partner") ||
    grantedRoles.includes("parking_manager");
  const canUseGuardView =
    isPlatformAdmin || isAshramOwner || grantedRoles.length > 0;
  const isGuardOnly =
    grantedRoles.includes("security_guard") &&
    !grantedRoles.some((role) =>
      ["parking_partner", "parking_manager"].includes(role),
    ) &&
    !isPlatformAdmin &&
    !isAshramOwner;
  const [activeRoleView, setActiveRoleView] = useState<
    "partner" | "manager" | "guard"
  >(() => {
    if (grantedRoles.includes("parking_partner")) return "partner";
    if (grantedRoles.includes("parking_manager")) return "manager";
    if (grantedRoles.includes("security_guard")) return "guard";
    return "partner";
  });

  const [stats, setStats] = useState<ParkingDashboardStats | null>(null);
  const [locations, setLocations] = useState<ParkingLocation[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [partnerReports, setPartnerReports] = useState<any>(null);
  const [partnerBookings, setPartnerBookings] = useState<ParkingBooking[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);

  const [slotTypes, setSlotTypes] = useState<any[]>([]);
  const [slots, setSlots] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [showManualCheckInModal, setShowManualCheckInModal] = useState(false);
  const [manualVehicleNo, setManualVehicleNo] = useState("");
  const [manualDriverName, setManualDriverName] = useState("");
  const [manualDriverPhone, setManualDriverPhone] = useState("");
  const [manualVehicleType, setManualVehicleType] = useState("car");
  const [manualSlotTypeId] = useState("");

  const fetchDashboardData = useCallback(
    async (isSilent = false) => {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);
      setError("");

      try {
        if (isGuardOnly) {
          const guardLocationsRes = await parkingScanService.myLocations();
          const guardLocations = guardLocationsRes.data?.data ?? [];
          setLocations(guardLocations);
          setStats(null);
          if (guardLocations.length > 0 && !selectedLocationId)
            setSelectedLocationId(guardLocations[0]._id);
          return;
        }
        const [dashRes, locRes] = await Promise.all([
          parkingPartnerService.dashboard().catch(() => null),
          parkingPartnerService.listLocations().catch(() => null),
        ]);

        if (dashRes?.data?.success) setStats(dashRes.data.data);
        if (locRes?.data?.success) {
          const locs = locRes.data.data || [];
          setLocations(locs);
          if (locs.length > 0 && !selectedLocationId) {
            setSelectedLocationId(locs[0]._id);
          }
        }
      } catch (err) {
        setError(getErrorMessage(err, "Failed to load parking dashboard data."));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [isGuardOnly, selectedLocationId],
  );

  useEffect(() => {
    void fetchDashboardData();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void fetchDashboardData(true);
      }
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [fetchDashboardData]);

  const fetchRoleData = useCallback(async () => {
    if (activeRoleView === "partner") {
      try {
        const [repRes, bookRes, staffRes] = await Promise.all([
          parkingPartnerService.reports().catch(() => null),
          parkingPartnerService.listBookings({ limit: 25 }).catch(() => null),
          parkingPartnerService.listStaff().catch(() => null),
        ]);
        if (repRes?.data?.success) setPartnerReports(repRes.data.data);
        if (bookRes?.data?.success) setPartnerBookings(bookRes.data.data || []);
        if (staffRes?.data?.success) setStaffList(staffRes.data.data || []);
      } catch (err) {
        console.warn("Partner data fetch error:", err);
      }
    } else if (activeRoleView === "manager" && selectedLocationId) {
      try {
        const [stRes, slRes, bookRes] = await Promise.all([
          parkingPartnerService
            .listSlotTypes(selectedLocationId)
            .catch(() => null),
          parkingPartnerService
            .listSlots(selectedLocationId, { status: statusFilter || undefined })
            .catch(() => null),
          parkingPartnerService
            .listBookings({ locationId: selectedLocationId, limit: 30 })
            .catch(() => null),
        ]);
        if (stRes?.data?.success) setSlotTypes(stRes.data.data || []);
        if (slRes?.data?.success) setSlots(slRes.data.data || []);
        if (bookRes?.data?.success) setPartnerBookings(bookRes.data.data || []);
      } catch (err) {
        console.warn("Manager data fetch error:", err);
      }
    }
  }, [activeRoleView, selectedLocationId, statusFilter]);

  useEffect(() => {
    fetchRoleData();
  }, [fetchRoleData]);

  const handleToggleBayStatus = async (slotId: string, currentStatus: string) => {
    const nextStatus = currentStatus === "available" ? "maintenance" : "available";
    try {
      const res = await parkingPartnerService.updateSlot(slotId, { status: nextStatus });
      if (res.data?.success) {
        addNotification("Bay Status Updated", `Bay set to ${nextStatus}`, "success");
        fetchRoleData();
      }
    } catch (err) {
      addNotification("Update Failed", getErrorMessage(err, "Could not update bay status."), "error");
    }
  };

  const handleManualCheckInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLocationId || !manualVehicleNo.trim()) {
      addNotification("Missing Fields", "Please enter vehicle registration number.", "warning");
      return;
    }

    try {
      const res = await parkingBookingService.create({
        locationId: selectedLocationId,
        slotTypeId: manualSlotTypeId || (slotTypes[0]?._id ?? ""),
        vehicleType: manualVehicleType as any,
        vehicleNumber: manualVehicleNo.trim().toUpperCase(),
        entryAt: new Date().toISOString(),
        exitAt: new Date(Date.now() + 4 * 3600 * 1000).toISOString(),
        driverName: manualDriverName.trim() || undefined,
        driverPhone: manualDriverPhone.trim() || undefined,
      });

      if (res.data?.success) {
        addNotification("Spot Created", "Manual check-in booking created successfully.", "success");
        setShowManualCheckInModal(false);
        setManualVehicleNo("");
        setManualDriverName("");
        setManualDriverPhone("");
        fetchRoleData();
        fetchDashboardData(true);
      }
    } catch (err) {
      addNotification("Check-in Failed", getErrorMessage(err, "Manual check-in failed."), "error");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen pt-28 pb-16 flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#0A4DA6] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-xs font-bold text-gray-500 dark:text-gray-400">
          Loading Parking Management...
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 text-left w-full">
      <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[11px] font-black tracking-wider flex items-center gap-1.5">
                <Car size={13} /> Parking Operations
              </span>
              {refreshing && (
                <span className="text-[11px] font-bold text-gray-400 flex items-center gap-1 animate-pulse">
                  <RefreshCw size={12} className="animate-spin" /> Syncing...
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-[#0B192C] dark:text-white tracking-tight">
              Parking Management
            </h1>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">
              {isGuardOnly
                ? "Assigned parking details and secure QR vehicle check-in/check-out."
                : "Live capacity monitoring, QR gate validation, slot maintenance and parking operations."}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {locations.length > 0 && (
              <div className="relative">
                <select
                  value={selectedLocationId}
                  onChange={(e) => setSelectedLocationId(e.target.value)}
                  className="appearance-none bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl px-4 py-2.5 pr-8 text-xs font-extrabold text-[#0B192C] dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  {locations.map((loc) => (
                    <option key={loc._id} value={loc._id}>
                      📍 {loc.name} ({loc.address?.city || "Uttarakhand"})
                    </option>
                  ))}
                </select>
                <MapPin
                  size={14}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                />
              </div>
            )}

            <button
              onClick={() => {
                fetchDashboardData(true);
                fetchRoleData();
              }}
              className="p-2.5 rounded-2xl bg-gray-50 dark:bg-slate-900 hover:bg-gray-100 dark:hover:bg-slate-800 border border-gray-200 dark:border-slate-800 text-gray-700 dark:text-gray-200 transition-colors cursor-pointer"
              title="Refresh Dashboard"
            >
              <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {!isGuardOnly && <div className="mt-6 pt-5 border-t border-gray-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 bg-gray-100/80 dark:bg-slate-900/80 p-1.5 rounded-2xl border border-gray-200/50 dark:border-slate-800">
            {canUsePartnerView && <button
              onClick={() => setActiveRoleView("partner")}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
                activeRoleView === "partner"
                  ? "bg-[#0A4DA6] text-white shadow-md"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              <Building2 size={14} />
              <span>Partner Dashboard</span>
            </button>}

            {canUseManagerView && <button
              onClick={() => setActiveRoleView("manager")}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
                activeRoleView === "manager"
                  ? "bg-[#0A4DA6] text-white shadow-md"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              <Sliders size={14} />
              <span>Manager Console</span>
            </button>}

            {canUseGuardView && <button
              onClick={() => setActiveRoleView("guard")}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
                activeRoleView === "guard"
                  ? "bg-amber-600 text-white shadow-md"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              <QrCode size={14} />
              <span>Gate Scanner</span>
            </button>}
          </div>

          <div className="text-[11px] font-extrabold text-gray-400">
            Role Mode:{" "}
            <span className="text-amber-600 dark:text-amber-400">
              {activeRoleView}
            </span>
          </div>
        </div>}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl text-red-600 dark:text-red-400 text-xs font-bold flex items-center gap-3">
          <AlertCircle size={18} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {activeRoleView !== "guard" && <div className="-order-1 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <ParkingStatTile
          icon={IndianRupee}
          label="Today's Revenue"
          value={formatCurrency(stats?.todayRevenue ?? 0)}
          sub={`${stats?.statusBreakdown?.checked_out ?? 0} departures completed`}
          tone="warning"
        />
        <ParkingStatTile
          icon={Car}
          label="Live Occupancy"
          value={`${stats?.occupiedSlots ?? 0} / ${stats?.totalSlots ?? 0}`}
          sub={`${stats?.occupancyPercent ?? 0}% capacity utilised`}
          tone="success"
        />
        <ParkingStatTile
          icon={LogIn}
          label="Expected Arrivals"
          value={stats?.expectedArrivals ?? 0}
          sub="Upcoming visitor bookings today"
          tone="primary"
        />
        <ParkingStatTile
          icon={LogOut}
          label="Expected Departures"
          value={stats?.expectedExits ?? 0}
          sub="Scheduled exits today"
          tone="danger"
        />
      </div>}

      {activeRoleView === "guard" && selectedLocationId && (() => {
        const selected = locations.find((location) => location._id === selectedLocationId) as any;
        if (!selected) return null;
        return <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#0B192C]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div><h3 className="text-base text-[#0B192C] dark:text-white">{selected.name}</h3><p className="mt-1 text-xs text-gray-400">{[selected.address?.line1, selected.address?.city, selected.address?.state].filter(Boolean).join(", ")}</p></div>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-700">Assigned facility</span>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
            <div className="rounded-2xl bg-gray-50 p-3"><span className="block text-xs text-gray-400">Capacity</span>{selected.totalCapacity ?? "—"}</div>
            <div className="rounded-2xl bg-gray-50 p-3"><span className="block text-xs text-gray-400">Contact</span>{selected.contactPhone || "—"}</div>
            <div className="rounded-2xl bg-gray-50 p-3"><span className="block text-xs text-gray-400">Vehicle types</span>{(selected.supportedVehicleTypes ?? []).map(vehicleLabel).join(", ") || "—"}</div>
            <div className="rounded-2xl bg-gray-50 p-3"><span className="block text-xs text-gray-400">Facilities</span>{(selected.amenities ?? []).join(", ") || "—"}</div>
          </div>
        </div>;
      })()}

      {activeRoleView === "partner" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-sm text-[#0B192C] dark:text-white tracking-wider flex items-center gap-2">
                  <TrendingUp size={16} className="text-[#0A4DA6]" /> Financial
                  Performance Reports
                </h3>
                <span className="text-xs font-bold text-[#0A4DA6] bg-blue-50 dark:bg-blue-900/30 px-3 py-1 rounded-full">
                  Partner Scope
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
                <div className="p-4 rounded-2xl bg-gray-50 dark:bg-slate-900/80 border border-gray-100 dark:border-slate-800">
                  <span className="text-[10px] font-black text-gray-400 tracking-wider block">
                    Gross Volume
                  </span>
                  <span className="text-lg font-black text-[#0B192C] dark:text-white">
                    {formatCurrency(partnerReports?.revenue?.totals?.revenue ?? 0)}
                  </span>
                </div>
                <div className="p-4 rounded-2xl bg-gray-50 dark:bg-slate-900/80 border border-gray-100 dark:border-slate-800">
                  <span className="text-[10px] font-black text-gray-400 tracking-wider block">
                    Platform Fee
                  </span>
                  <span className="text-lg font-black text-rose-500">
                    {formatCurrency(partnerReports?.revenue?.totals?.commission ?? 0)}
                  </span>
                </div>
                <div className="p-4 rounded-2xl bg-gray-50 dark:bg-slate-900/80 border border-gray-100 dark:border-slate-800">
                  <span className="text-[10px] font-black text-gray-400 tracking-wider block">
                    Partner Net
                  </span>
                  <span className="text-lg font-black text-emerald-500">
                    {formatCurrency(partnerReports?.revenue?.totals?.partnerEarning ?? 0)}
                  </span>
                </div>
                <div className="p-4 rounded-2xl bg-gray-50 dark:bg-slate-900/80 border border-gray-100 dark:border-slate-800">
                  <span className="text-[10px] font-black text-gray-400 tracking-wider block">
                    Total Bookings
                  </span>
                  <span className="text-lg font-black text-[#0B192C] dark:text-white">
                    {partnerReports?.revenue?.totals?.bookings ?? 0}
                  </span>
                </div>
              </div>

              {partnerReports?.peakHours && partnerReports.peakHours.length > 0 && (
                <div className="pt-4 border-t border-gray-100 dark:border-slate-800">
                  <h4 className="text-xs font-extrabold text-gray-500 dark:text-gray-400 mb-3">
                    Peak Arrival Traffic Hours
                  </h4>
                  <AnalyticsBarChart
                    data={partnerReports.peakHours.map((hour: any) => ({
                      label: hour.label,
                      arrivals: Number(hour.count || 0),
                    }))}
                    dataKey="arrivals"
                    valueFormatter={(value) => `${value} arrival${value === 1 ? "" : "s"}`}
                    height={220}
                  />
                </div>
              )}
            </div>

            <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-sm text-[#0B192C] dark:text-white tracking-wider flex items-center gap-2">
                  <Users size={16} className="text-[#0A4DA6]" /> Assigned Staff
                </h3>
                <span className="text-xs font-bold text-gray-400">
                  {staffList.length} members
                </span>
              </div>

              <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
                {staffList.length === 0 ? (
                  <p className="text-xs text-gray-400 italic py-4 text-center">
                    No staff members assigned to this location.
                  </p>
                ) : (
                  staffList.map((st: any) => (
                    <div
                      key={st._id}
                      className="p-3 rounded-2xl bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 flex items-center justify-between"
                    >
                      <div className="space-y-0.5">
                        <div className="text-xs font-black text-[#0B192C] dark:text-white">
                          {st.userId?.name || st.employeeCode || "Staff Member"}
                        </div>
                        <div className="text-[10px] font-bold text-gray-400 tracking-wider">
                          Role: {st.parkingRole || "Security Guard"}
                        </div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                          st.status === "active"
                            ? "bg-emerald-500/10 text-emerald-500"
                            : "bg-gray-500/10 text-gray-400"
                        }`}
                      >
                        {st.status || "active"}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <h3 className="font-extrabold text-sm text-[#0B192C] dark:text-white tracking-wider flex items-center gap-2">
              <Car size={16} className="text-[#0A4DA6]" /> Facility Booking Roster
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-slate-800 text-[10px] font-black tracking-wider text-gray-400">
                    <th className="py-3 px-4">Ref Code</th>
                    <th className="py-3 px-4">Vehicle Number</th>
                    <th className="py-3 px-4">Vehicle Type</th>
                    <th className="py-3 px-4">Entry / Exit</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800 text-xs font-bold text-[#0B192C] dark:text-white">
                  {partnerBookings.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-gray-400 italic">
                        No bookings found for this location.
                      </td>
                    </tr>
                  ) : (
                    partnerBookings.map((b) => (
                      <tr key={b._id} className="hover:bg-gray-50/50 dark:hover:bg-slate-900/50">
                        <td className="py-3 px-4 font-mono text-[#0A4DA6]">{b.bookingReference}</td>
                        <td className="py-3 px-4 font-black">{b.vehicleNumber}</td>
                        <td className="py-3 px-4 capitalize">{vehicleLabel(b.vehicleType)}</td>
                        <td className="py-3 px-4 text-gray-500 dark:text-gray-400">
                          {formatDateTime(b.entryAt)}
                        </td>
                        <td className="py-3 px-4 font-black">{formatCurrency(b.pricing?.totalAmount ?? 0)}</td>
                        <td className="py-3 px-4">
                          <ParkingStatusBadge status={b.status} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeRoleView === "manager" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 p-4 rounded-2xl shadow-sm">
            <div className="flex items-center gap-3">
              <span className="text-xs font-extrabold text-gray-500">Filter Bays:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs font-bold text-[#0B192C] dark:text-white"
              >
                <option value="">All Statuses</option>
                <option value="available">Available Only</option>
                <option value="occupied">Occupied Only</option>
                <option value="maintenance">Maintenance Only</option>
              </select>
            </div>

            <button
              onClick={() => setShowManualCheckInModal(true)}
              className="w-full sm:w-auto px-4 py-2 rounded-xl bg-[#0A4DA6] hover:bg-blue-900 text-white font-extrabold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Plus size={15} />
              <span>Manual Spot Allocation</span>
            </button>
          </div>

          <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <h3 className="font-extrabold text-sm text-[#0B192C] dark:text-white tracking-wider flex items-center gap-2">
              <Layers size={16} className="text-[#0A4DA6]" /> Parking Areas & Slot Categories
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {slotTypes.length === 0 ? (
                <p className="text-xs text-gray-400 italic col-span-3 py-4 text-center">
                  No slot categories configured for this facility.
                </p>
              ) : (
                slotTypes.map((st) => (
                  <div
                    key={st._id}
                    className="p-4 rounded-2xl bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-[#0B192C] dark:text-white">
                        {st.name} ({st.code})
                      </span>
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500">
                        Cap: {st.totalCapacity}
                      </span>
                    </div>
                    <div className="text-[11px] font-semibold text-gray-400">
                      Vehicle Types: {(st.vehicleTypes || []).join(", ")}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-sm text-[#0B192C] dark:text-white tracking-wider flex items-center gap-2">
                <Car size={16} className="text-[#0A4DA6]" /> Live Parking Bays ({slots.length})
              </h3>
              <span className="text-[11px] font-bold text-gray-400">
                Click bay to toggle maintenance status
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
              {slots.length === 0 ? (
                <p className="text-xs text-gray-400 italic col-span-full py-6 text-center">
                  No individual bays created yet. Use bulk setup in partner console.
                </p>
              ) : (
                slots.map((sl) => {
                  const isOcc = sl.status === "occupied";
                  const isMaint = sl.status === "maintenance";

                  return (
                    <button
                      key={sl._id}
                      onClick={() => handleToggleBayStatus(sl._id, sl.status)}
                      disabled={isOcc}
                      className={`p-3 rounded-2xl border text-center transition-all cursor-pointer space-y-1 ${
                        isOcc
                          ? "bg-rose-500/10 border-rose-500/20 text-rose-500 opacity-90 cursor-not-allowed"
                          : isMaint
                          ? "bg-amber-500/10 border-amber-500/20 text-amber-500"
                          : "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:scale-105"
                      }`}
                    >
                      <div className="text-xs font-black">{sl.slotNumber}</div>
                      <div className="text-[9px] font-extrabold tracking-wider opacity-80">
                        {sl.status}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {activeRoleView === "guard" && (
        <ParkingGuardPanelPage
          embedded
          preferredLocationId={selectedLocationId}
        />
      )}

      {showManualCheckInModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-sm text-[#0B192C] dark:text-white tracking-wider flex items-center gap-2">
                <Plus size={16} className="text-[#0A4DA6]" /> Manual Spot Allocation
              </h3>
              <button
                onClick={() => setShowManualCheckInModal(false)}
                className="p-1 rounded-full text-gray-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleManualCheckInSubmit} className="space-y-3 text-xs font-bold">
              <div className="space-y-1">
                <label className="text-gray-500">Vehicle Registration Number *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. UK07AB1234"
                  value={manualVehicleNo}
                  onChange={(e) => setManualVehicleNo(e.target.value)}
                  className="w-full p-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl font-mono text-[#0B192C] dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-gray-500">Vehicle Type</label>
                  <select
                    value={manualVehicleType}
                    onChange={(e) => setManualVehicleType(e.target.value)}
                    className="w-full p-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-[#0B192C] dark:text-white"
                  >
                    <option value="car">Car</option>
                    <option value="suv">SUV</option>
                    <option value="bike">Bike</option>
                    <option value="scooter">Scooter</option>
                    <option value="tempo">Tempo</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-gray-500">Driver Phone</label>
                  <input
                    type="text"
                    placeholder="9876543210"
                    value={manualDriverPhone}
                    onChange={(e) => setManualDriverPhone(e.target.value)}
                    className="w-full p-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-[#0B192C] dark:text-white"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowManualCheckInModal(false)}
                  className="px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-800 text-gray-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#0A4DA6] text-white font-extrabold"
                >
                  Create Check-In
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ParkingRoleDashboardPage;
