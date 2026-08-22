import React, { useCallback, useEffect, useState } from "react";
import { useNotifications } from "../../../contexts/NotificationContext";
import { AlertCircle, CalendarDays, Loader2, Search, XCircle } from "lucide-react";
import { getErrorMessage } from "../../../lib/api";
import { EnterprisePageHeader } from "../../../admin/shared/components/EnterprisePageHeader";
import AartiStatusBadge from "../components/AartiStatusBadge";
import { aartiOwnerService } from "../services/aarti.service";
import type { AartiBooking, AartiSession } from "../types/aarti.types";
import {
  formatCurrency,
  formatDateTime,
} from "../utils/aartiFormat";

export const OwnerAartiBookingsPage: React.FC = () => {
  const { promptAction } = useNotifications();
  const [sessions, setSessions] = useState<AartiSession[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [status, setStatus] = useState("");
  const [date, setDate] = useState("");
  const [q, setQ] = useState("");
  const [bookings, setBookings] = useState<AartiBooking[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    aartiOwnerService
      .listSessions({ limit: 100 })
      .then((response) => setSessions(response.data?.data ?? []))
      .catch(() => undefined);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await aartiOwnerService.listBookings({
        sessionId: sessionId || undefined,
        status: status || undefined,
        date: date || undefined,
        q: q || undefined,
        limit: 100,
      });
      setBookings(response.data?.data ?? []);
      setTotal(response.data?.total ?? 0);
    } catch (err) {
      setError(getErrorMessage(err, "We could not load aarti bookings."));
    } finally {
      setLoading(false);
    }
  }, [sessionId, status, date, q]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  const cancel = async (booking: AartiBooking) => {
    const reason = await promptAction({
      title: "Cancel Aarti Booking",
      message: `Cancel booking ${booking.bookingReference}? Give the devotee a reason.`,
      placeholder: "Cancellation reason",
      confirmLabel: "Cancel booking",
      required: true,
      tone: "danger",
    });
    if (reason === null) return;
    await aartiOwnerService
      .cancelBooking(booking._id, reason || undefined)
      .catch(() => undefined);
    await load();
  };

  return (
    <div className="space-y-6">
      <EnterprisePageHeader
        title="Aarti Bookings"
        subtitle="Every pass sold for your aartis, with gate status and refunds."
        icon={<CalendarDays size={22} />}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <select
          value={sessionId}
          onChange={(event) => setSessionId(event.target.value)}
          className="bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-[#0B192C] dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/30 transition-all"
        >
          <option value="">All aartis</option>
          {sessions.map((session) => (
            <option key={session._id} value={session._id}>
              {session.name}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-[#0B192C] dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/30 transition-all"
        >
          <option value="">All statuses</option>
          <option value="pending">Awaiting payment</option>
          <option value="upcoming">Confirmed</option>
          <option value="checked_in">Admitted</option>
          <option value="attended">Attended</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <input
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          className="bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-[#0B192C] dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/30 transition-all"
        />
        <div className="flex items-center gap-2 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl px-3 py-2">
          <Search size={14} className="shrink-0 text-[#0A4DA6] stroke-[2.5]" />
          <input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Booking reference"
            className="w-full bg-transparent text-xs font-semibold outline-none text-[#0B192C] dark:text-white placeholder:text-gray-400"
          />
        </div>
      </div>

      {error ? (
        <div className="flex items-start gap-2.5 p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-sm font-semibold">
          <AlertCircle size={16} /> {error}
        </div>
      ) : loading ? (
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] shadow-sm p-12 flex items-center justify-center gap-3">
          <Loader2 size={20} className="animate-spin text-[#0A4DA6]" />
          <span className="text-sm font-bold text-gray-400">Loading…</span>
        </div>
      ) : bookings.length === 0 ? (
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] shadow-sm p-12 text-center space-y-3">
          <CalendarDays size={36} className="text-gray-300 dark:text-slate-700 mx-auto" />
          <h3 className="font-extrabold text-base text-[#0B192C] dark:text-white">
            No bookings match these filters
          </h3>
        </div>
      ) : (
        <>
          <p className="text-xs text-gray-400 font-semibold">{total} booking(s)</p>
          <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] shadow-sm overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="border-b border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-900 text-left text-[10px] tracking-wider font-bold text-gray-400 uppercase">
                <tr>
                  <th className="px-4 py-3">Reference</th>
                  <th className="px-4 py-3">Aarti</th>
                  <th className="px-4 py-3">Devotee</th>
                  <th className="px-4 py-3">When</th>
                  <th className="px-4 py-3">Passes</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {bookings.map((booking) => {
                  const session =
                    typeof booking.sessionId === "object"
                      ? (booking.sessionId as AartiSession)
                      : null;
                  const customer = booking.customerId as unknown as
                    | { name?: string; phone?: string }
                    | undefined;
                  return (
                    <tr key={booking._id}>
                      <td className="px-4 py-3 font-mono text-[11px] font-bold text-gray-400 tracking-wider">
                        {booking.bookingReference}
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-300">
                        {session?.name ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">
                        {typeof customer === "object" ? (customer?.name ?? "—") : "—"}
                        <span className="block text-[10px] font-bold text-gray-400">
                          {booking.contactPhone}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">
                        {formatDateTime(booking.startsAt)}
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">
                        {booking.passCount}
                        {booking.checkedInCount
                          ? ` (${booking.checkedInCount} in)`
                          : ""}
                      </td>
                      <td className="px-4 py-3 text-xs font-black text-[#0B192C] dark:text-white">
                        {formatCurrency(booking.pricing.totalAmount)}
                      </td>
                      <td className="px-4 py-3">
                        <AartiStatusBadge status={booking.status} size="sm" />
                      </td>
                      <td className="px-4 py-3 text-right">
                        {["pending", "upcoming"].includes(booking.status) ? (
                          <button
                            type="button"
                            onClick={() => cancel(booking)}
                            className="inline-flex items-center gap-1 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-400 text-[10px] font-bold px-2.5 py-1.5 rounded-full transition-all active:scale-95 cursor-pointer"
                          >
                            <XCircle size={12} /> Cancel
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default OwnerAartiBookingsPage;
