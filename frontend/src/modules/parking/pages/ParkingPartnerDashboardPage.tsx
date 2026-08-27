import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  IndianRupee,
  CalendarCheck,
  CircleParking,
  CarFront,
  LogIn,
  LogOut,
  Gauge,
  Ticket,
  AlertCircle,
  Loader2,
  Building2,
  TrendingUp,
  Clock,
} from "lucide-react";
import { getErrorMessage } from "../../../lib/api";
import { parkingPartnerService } from "../services/parking.service";
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
import { AnalyticsBarChart } from "../../../components/dashboard/AnalyticsCharts";

interface ReportBundle {
  revenue?: {
    totals: {
      revenue: number;
      commission: number;
      partnerEarning: number;
      bookings: number;
    };
  };
  peakHours?: { hour: number; label: string; count: number }[];
  cancellations?: {
    cancellationRate: number;
    noShowRate: number;
    total: number;
  };
  averageStay?: { averageHours: number; count: number };
  popular?: { name: string; bookings: number; revenue: number }[];
}

export const ParkingPartnerDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<ParkingDashboardStats | null>(null);
  const [locations, setLocations] = useState<
    (ParkingLocation & { liveOccupancy?: Record<string, number> })[]
  >([]);
  const [bookings, setBookings] = useState<ParkingBooking[]>([]);
  const [reports, setReports] = useState<ReportBundle>({});

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [dashRes, locRes, bookRes, repRes] = await Promise.all([
        parkingPartnerService.dashboard(),
        parkingPartnerService.listLocations(),
        parkingPartnerService.listBookings({
          status: statusFilter || undefined,
          limit: 25,
        }),
        parkingPartnerService.reports(),
      ]);

      if (dashRes.data?.success) setStats(dashRes.data.data);
      if (locRes.data?.success) setLocations(locRes.data.data || []);
      if (bookRes.data?.success) setBookings(bookRes.data.data || []);
      if (repRes.data?.success) setReports(repRes.data.data || {});
    } catch (err) {
      setError(getErrorMessage(err, "Could not load your parking dashboard."));
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [load]);

  if (loading && !stats) {
    return (
      <div className="max-w-7xl mx-auto px-4 pt-8 pb-20 space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-24 bg-gray-100 dark:bg-slate-800 animate-pulse rounded-[24px]"
            />
          ))}
        </div>
        <div className="h-64 bg-gray-100 dark:bg-slate-800 animate-pulse rounded-[24px]" />
      </div>
    );
  }

  const peakMax = Math.max(1, ...(reports.peakHours || []).map((h) => h.count));

  return (
    <div className="space-y-6 text-left w-full">
      {error && (
        <div className="flex items-start gap-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 rounded-2xl px-4 py-3">
          <AlertCircle size={15} className="shrink-0 mt-0.5 stroke-[2.5]" />
          <p className="text-xs font-semibold">{error}</p>
        </div>
      )}

      {stats && (
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-3"
        >
          <ParkingStatTile
            icon={IndianRupee}
            label="Today's Revenue"
            value={formatCurrency(stats.todayRevenue)}
            sub={`${stats.todayBookings} booking(s)`}
            tone="success"
          />
          <ParkingStatTile
            icon={CalendarCheck}
            label="Today's Bookings"
            value={stats.todayBookings}
            sub={`Earning ${formatCurrency(stats.todayPartnerEarning)}`}
            tone="primary"
          />
          <ParkingStatTile
            icon={CarFront}
            label="Occupied Slots"
            value={stats.occupiedSlots}
            sub={`of ${stats.totalSlots} bays`}
            tone="warning"
          />
          <ParkingStatTile
            icon={CircleParking}
            label="Available Slots"
            value={stats.availableSlots}
            sub="Ready to sell"
            tone="success"
          />
          <ParkingStatTile
            icon={Ticket}
            label="Reserved Slots"
            value={stats.reservedSlots}
            sub="Paid, not yet arrived"
            tone="primary"
          />
          <ParkingStatTile
            icon={LogIn}
            label="Expected Arrivals"
            value={stats.expectedArrivals}
            sub="Today"
            tone="primary"
          />
          <ParkingStatTile
            icon={LogOut}
            label="Expected Exits"
            value={stats.expectedExits}
            sub="Today"
            tone="neutral"
          />
          <ParkingStatTile
            icon={Gauge}
            label="Occupancy"
            value={`${stats.occupancyPercent}%`}
            sub={`${stats.currentlyParked} vehicle(s) inside`}
            tone={
              stats.occupancyPercent > 85
                ? "danger"
                : stats.occupancyPercent > 60
                  ? "warning"
                  : "success"
            }
          />
        </motion.section>
      )}

      <div className="flex justify-end">
        <button type="button" onClick={load} disabled={loading} className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-xs text-slate-700 disabled:opacity-60 dark:border-slate-700 dark:bg-[#0B192C]">
          {loading ? <Loader2 size={13} className="animate-spin" /> : <TrendingUp size={13} />} Refresh data
        </button>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <section className="lg:col-span-2 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] p-5 shadow-sm">
          <h2 className="font-semibold text-sm text-[#0B192C] dark:text-white">Booking activity by hour</h2>
          <p className="text-[10px] text-gray-400">Live peak-hour distribution from recorded parking entries</p>
          <AnalyticsBarChart
            data={(reports.peakHours ?? []).map((hour) => ({ label: hour.label, bookings: hour.count }))}
            dataKey="bookings"
            valueFormatter={(value) => `${value} booking${value === 1 ? "" : "s"}`}
          />
        </section>
        <section className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] p-5 shadow-sm">
          <h2 className="font-semibold text-sm text-[#0B192C] dark:text-white">Quick actions</h2>
          <p className="mb-4 text-[10px] text-gray-400">Open a dedicated parking workspace</p>
          <div className="space-y-2">
            {[
              { label: "Parking management", path: "/parking/dashboard" },
              { label: "Parking staff", path: "/parking/staff" },
              { label: "Gate scanner", path: "/parking/gate" },
              { label: "Parking bookings", path: "/parking/my-bookings" },
            ].map((action, index) => (
              <button key={action.path} type="button" onClick={() => navigate(action.path)} className="flex w-full items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-left text-xs text-slate-700 transition hover:border-[#0A4DA6]">
                <span className="grid h-8 w-8 place-items-center rounded-lg text-white" style={{ backgroundColor: ["#0A4DA6", "#14B8A6", "#F59E0B", "#8B5CF6"][index] }}><CircleParking size={15} /></span>
                {action.label}
              </button>
            ))}
          </div>
        </section>
      </div>

      {false && (
      <div className="grid lg:grid-cols-3 gap-5">
        <section className="lg:col-span-2 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="font-extrabold text-sm text-[#0B192C] dark:text-white">
              Bookings
            </h2>
            <div className="flex gap-1.5 overflow-x-auto">
              {[
                { value: "", label: "All" },
                { value: "upcoming", label: "Arriving" },
                { value: "checked_in", label: "Parked" },
                { value: "checked_out", label: "Completed" },
              ].map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setStatusFilter(f.value)}
                  className={`shrink-0 text-[10px] font-bold px-3 py-1.5 rounded-full border transition-all cursor-pointer ${
                    statusFilter === f.value
                      ? "bg-[#0A4DA6] border-[#0A4DA6] text-white"
                      : "bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 text-slate-600 dark:text-gray-300 hover:border-[#0A4DA6]"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {bookings.length === 0 ? (
            <p className="text-xs text-gray-400 font-medium py-8 text-center">
              No bookings to show.
            </p>
          ) : (
            <div className="overflow-x-auto -mx-5 px-5">
              <table className="w-full min-w-[36rem]">
                <thead>
                  <tr>
                    {[
                      "Vehicle",
                      "Entry",
                      "Exit",
                      "Bay",
                      "Amount",
                      "Status",
                    ].map((h) => (
                      <th
                        key={h}
                        className="text-left text-[9px] tracking-wider font-bold text-gray-400 pb-2 pr-3"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((b) => (
                    <tr key={b._id}>
                      <td className="py-2.5 pr-3">
                        <p className="text-[11px] font-black text-[#0B192C] dark:text-white">
                          {b.vehicleNumber}
                        </p>
                        <p className="text-[9px] font-semibold text-gray-400">
                          {vehicleLabel(b.vehicleType)}
                        </p>
                      </td>
                      <td className="py-2.5 pr-3 text-[10px] font-semibold text-slate-600 dark:text-gray-300">
                        {formatDateTime(b.entryAt)}
                      </td>
                      <td className="py-2.5 pr-3 text-[10px] font-semibold text-slate-600 dark:text-gray-300">
                        {formatDateTime(b.exitAt)}
                      </td>
                      <td className="py-2.5 pr-3 text-[10px] font-bold text-slate-700 dark:text-gray-200">
                        {b.assignedSlotNumber || "—"}
                      </td>
                      <td className="py-2.5 pr-3 text-[10px] font-black text-[#0B192C] dark:text-white">
                        {formatCurrency(b.pricing.amountPaid)}
                      </td>
                      <td className="py-2.5">
                        <ParkingStatusBadge status={b.status} size="sm" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="space-y-5">
          <section className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] p-5 space-y-3 shadow-sm">
            <h2 className="inline-flex items-center gap-2 font-extrabold text-sm text-[#0B192C] dark:text-white">
              <Building2 size={15} className="text-[#0A4DA6] stroke-[2.5]" />
              Your Locations
            </h2>

            {locations.length === 0 ? (
              <p className="text-xs text-gray-400 font-medium py-2">
                No parking locations yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {locations.map((loc) => (
                  <li
                    key={loc._id}
                    className="bg-gray-50 dark:bg-slate-900/60 rounded-2xl p-3 space-y-1.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[11px] font-extrabold text-[#0B192C] dark:text-white line-clamp-1">
                        {loc.name}
                      </p>
                      <span
                        className={`text-[8px] font-black tracking-wider px-2 py-0.5 rounded-full shrink-0 ${
                          loc.status === "active"
                            ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
                            : "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300"
                        }`}
                      >
                        {loc.status}
                      </span>
                    </div>
                    <p className="text-[9px] font-semibold text-gray-400">
                      {loc.address?.city}
                    </p>
                    {loc.liveOccupancy && (
                      <div className="flex items-center gap-2 pt-0.5">
                        <div className="flex-1 h-1.5 bg-gray-200 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#0A4DA6] rounded-full transition-all"
                            style={{
                              width: `${Math.min(100, Number(loc.liveOccupancy.occupancyPercent) || 0)}%`,
                            }}
                          />
                        </div>
                        <span className="text-[9px] font-black text-gray-500 dark:text-gray-400 shrink-0">
                          {loc.liveOccupancy.occupancyPercent || 0}%
                        </span>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {(reports.peakHours?.length ?? 0) > 0 && (
            <section className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] p-5 space-y-3 shadow-sm">
              <h2 className="inline-flex items-center gap-2 font-extrabold text-sm text-[#0B192C] dark:text-white">
                <Clock size={15} className="text-[#0A4DA6] stroke-[2.5]" />
                Peak Hours
              </h2>

              <div
                className="flex items-end gap-0.5 h-24"
                role="img"
                aria-label="Bookings by hour of entry"
              >
                {(reports.peakHours ?? []).map((h) => (
                  <div
                    key={h.hour}
                    className="flex-1 flex flex-col items-center gap-1 group relative"
                  >
                    <div
                      className="w-full bg-[#0A4DA6]/80 hover:bg-[#0A4DA6] rounded-t transition-all min-h-[2px]"
                      style={{ height: `${(h.count / peakMax) * 100}%` }}
                      title={`${h.label} — ${h.count} booking(s)`}
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-[8px] font-bold text-gray-400">
                <span>00:00</span>
                <span>06:00</span>
                <span>12:00</span>
                <span>18:00</span>
                <span>23:00</span>
              </div>
            </section>
          )}

          {reports.revenue?.totals && (
            <section className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] p-5 space-y-2.5 shadow-sm">
              <h2 className="font-extrabold text-sm text-[#0B192C] dark:text-white">
                Last 30 Days
              </h2>

              {[
                [
                  "Gross revenue",
                  formatCurrency(reports.revenue?.totals.revenue ?? 0),
                ],
                [
                  "Your earnings",
                  formatCurrency(reports.revenue?.totals.partnerEarning ?? 0),
                ],
                [
                  "Platform commission",
                  formatCurrency(reports.revenue?.totals.commission ?? 0),
                ],
                ["Bookings", String(reports.revenue?.totals.bookings ?? 0)],
                [
                  "Avg. stay",
                  reports.averageStay
                    ? `${reports.averageStay?.averageHours ?? 0} hr`
                    : "—",
                ],
                [
                  "Cancellation rate",
                  reports.cancellations
                    ? `${reports.cancellations?.cancellationRate ?? 0}%`
                    : "—",
                ],
                [
                  "No-show rate",
                  reports.cancellations
                    ? `${reports.cancellations?.noShowRate ?? 0}%`
                    : "—",
                ],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between text-[11px]">
                  <span className="font-semibold text-gray-500 dark:text-gray-400">
                    {label}
                  </span>
                  <span className="font-black text-[#0B192C] dark:text-white">
                    {value}
                  </span>
                </div>
              ))}
            </section>
          )}
        </div>
      </div>
      )}
    </div>
  );
};

export default ParkingPartnerDashboardPage;
