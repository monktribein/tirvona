import { Paginated } from "../../components/shared/Pagination";
import React, { useState, useEffect } from "react";
import { useNotifications } from "../../contexts/NotificationContext";
import { bookingService } from "../../services";
import { getErrorMessage } from "../../lib/api";
import { formatCurrency } from "../../utils/format";
import { EnterpriseStatusBadge } from "../../admin/shared";
import {
  MapPin,
  Calendar,
  AlertCircle,
  CreditCard,
  RefreshCw,
  CheckCircle,
} from "lucide-react";

export default function AdminPendingPaymentsPage() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { addNotification } = useNotifications();

  // Manual confirm modal state
  const [selectedBooking, setSelectedBooking] = useState<any | null>(null);
  const [paymentMode, setPaymentMode] = useState("cash");
  const [transactionReference, setTransactionReference] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");

  const fetchBookings = async () => {
    setLoading(true);
    try {
      // Every booking with money still due, in any status, across all pages.
      const all: any[] = [];
      for (let page = 1; page <= 50; page += 1) {
        const res = await bookingService.paymentPending({
          status: "all",
          paymentStatus: "pending,partially_paid",
          page: String(page),
          limit: "100",
        });
        const rows =
          res.data?.success && Array.isArray(res.data.data) ? res.data.data : [];
        all.push(...rows);
        if (rows.length < 100) break;
      }
      setBookings(all);
    } catch (err) {
      addNotification(
        "Error",
        getErrorMessage(err, "Failed to load pending payments"),
        "error",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const handleManualConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBooking) return;
    setSubmitting(true);
    try {
      const res = await bookingService.manualConfirm(selectedBooking._id, {
        paymentMode,
        transactionReference: transactionReference || undefined,
        note: note || undefined,
      });
      if (res.data?.success) {
        addNotification(
          "Success",
          "Booking has been manually confirmed.",
          "success",
        );
        setSelectedBooking(null);
        setPaymentMode("cash");
        setTransactionReference("");
        setNote("");
        fetchBookings();
      }
    } catch (err) {
      addNotification(
        "Error",
        getErrorMessage(err, "Failed to confirm booking"),
        "error",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const guestOf = (b: any) => ({
    name:
      b.customerId?.name ||
      b.walkInGuest?.name ||
      b.whatsappCustomerId?.name ||
      "Unknown Guest",
    phone:
      b.customerId?.phone ||
      b.walkInGuest?.phone ||
      b.whatsappCustomerId?.phone ||
      "",
  });
  const dueOf = (b: any) =>
    Math.max(
      0,
      Number(b.pricing?.totalAmount || 0) - Number(b.pricing?.amountPaid || 0),
    );
  const needle = search.trim().toLowerCase();
  const visible = needle
    ? bookings.filter((b) => {
        const g = guestOf(b);
        return [b.bookingId, b.reservationNumber, g.name, g.phone, b.ashramId?.name]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(needle));
      })
    : bookings;
  const totalDue = visible.reduce((sum, b) => sum + dueOf(b), 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white dark:bg-[#0B192C] p-6 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-[#0B192C] dark:text-white flex items-center gap-2">
            <AlertCircle className="text-amber-500" /> Pending Payments (Admin)
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Global view of all bookings awaiting payment across all stays.
          </p>
        </div>
        <button
          onClick={fetchBookings}
          className="p-2 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
          title="Refresh"
        >
          <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="h-48 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-2xl animate-pulse"
            />
          ))}
        </div>
      ) : bookings.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-2xl">
          <CheckCircle className="mx-auto text-green-500 mb-4" size={48} />
          <h3 className="text-lg font-bold text-[#0B192C] dark:text-white">
            All caught up!
          </h3>
          <p className="text-gray-500">No pending payment bookings found.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 dark:border-slate-800 px-4 py-3">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search ref, guest, phone, property…"
              className="w-full sm:w-80 border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:border-[#F28C28]"
            />
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">
              {visible.length} of {bookings.length} bookings · Total due{" "}
              <span className="text-rose-600">{formatCurrency(totalDue)}</span>
            </p>
          </div>
          <Paginated items={visible} pageSize={15}>
            {(pageItems) => (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                      <th className="px-4 py-3">Booking Ref</th>
                      <th className="px-4 py-3">Guest</th>
                      <th className="px-4 py-3">Property</th>
                      <th className="px-4 py-3">Stay</th>
                      <th className="px-4 py-3">Rooms</th>
                      <th className="px-4 py-3 text-right">Total</th>
                      <th className="px-4 py-3 text-right">Paid</th>
                      <th className="px-4 py-3 text-right">Due</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Payment</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageItems.map((b) => {
                      const guest = guestOf(b);
                      const rooms = (b.rooms || [])
                        .map((r: any) => r.roomId?.name)
                        .filter(Boolean)
                        .join(", ");
                      return (
                        <tr
                          key={b._id}
                          className="border-b border-gray-50 dark:border-slate-800/70 align-top hover:bg-gray-50/60 dark:hover:bg-slate-900/40"
                        >
                          <td className="px-4 py-3 font-bold text-[#F28C28] whitespace-nowrap">
                            {b.bookingId}
                            <span className="block text-[10px] font-medium text-gray-400">
                              {b.createdAt ? new Date(b.createdAt).toLocaleDateString() : ""}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="block font-semibold text-[#0B192C] dark:text-white">
                              {guest.name}
                            </span>
                            {guest.phone && (
                              <span className="block text-xs text-gray-500">{guest.phone}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-300">
                            <span className="inline-flex items-start gap-1">
                              <MapPin size={12} className="mt-0.5 shrink-0" />
                              {b.ashramId?.name || "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs whitespace-nowrap">
                            <span className="flex items-center gap-1">
                              <Calendar size={12} className="text-[#F28C28]" />
                              {b.checkInDate ? new Date(b.checkInDate).toLocaleDateString() : "—"}
                            </span>
                            <span className="mt-0.5 flex items-center gap-1 text-gray-500">
                              <Calendar size={12} />
                              {b.checkOutDate ? new Date(b.checkOutDate).toLocaleDateString() : "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-300 max-w-[180px]">
                            {rooms || "—"}
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            {formatCurrency(b.pricing?.totalAmount || 0)}
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            {formatCurrency(b.pricing?.amountPaid || 0)}
                          </td>
                          <td className="px-4 py-3 text-right font-bold whitespace-nowrap text-rose-600">
                            {formatCurrency(dueOf(b))}
                          </td>
                          <td className="px-4 py-3">
                            <EnterpriseStatusBadge status={b.status} />
                          </td>
                          <td className="px-4 py-3">
                            <EnterpriseStatusBadge status={b.paymentStatus} />
                          </td>
                          <td className="px-4 py-3 text-right">
                            {["pending", "payment_pending", "confirmed", "checked_in"].includes(b.status) ? (
                              <button
                                onClick={() => setSelectedBooking(b)}
                                className="px-3 py-1.5 bg-[#F28C28] text-white text-xs font-bold hover:bg-opacity-90 transition-colors whitespace-nowrap"
                              >
                                Confirm Payment
                              </button>
                            ) : (
                              <span className="text-[11px] text-gray-400">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {pageItems.length === 0 && (
                      <tr>
                        <td colSpan={11} className="px-4 py-10 text-center text-sm text-gray-500">
                          No bookings match your search.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </Paginated>
        </div>
      )}

      {selectedBooking && (
        <div className="tv-drawer-overlay fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="tv-drawer-panel bg-white dark:bg-[#0B192C] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border border-gray-100 dark:border-slate-800">
            <div className="p-4 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center bg-gray-50 dark:bg-slate-900/50">
              <h3 className="font-bold text-[#0B192C] dark:text-white flex items-center gap-2">
                <CreditCard size={18} className="text-[#F28C28]" />
                Manual Payment Confirmation
              </h3>
            </div>
            
            <form onSubmit={handleManualConfirm} className="p-6 space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 mb-4">
                Confirming this booking will mark it as fully paid and generate an invoice for {formatCurrency(selectedBooking.pricing?.totalAmount)}.
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                  Payment Mode
                </label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                  className="w-full p-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:border-[#F28C28]"
                >
                  <option value="cash">Cash</option>
                  <option value="upi">UPI / QR Code</option>
                  <option value="cards">Card (POS)</option>
                  <option value="net_banking">Bank Transfer</option>
                  <option value="offline">Other Offline</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                  Transaction Reference <span className="text-gray-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={transactionReference}
                  onChange={(e) => setTransactionReference(e.target.value)}
                  placeholder="e.g. UPI Ref Number"
                  className="w-full p-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:border-[#F28C28]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                  Note / Remarks <span className="text-gray-400 font-normal">(Optional)</span>
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Additional details..."
                  className="w-full p-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:border-[#F28C28] resize-none h-20"
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedBooking(null)}
                  className="flex-1 py-2.5 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 text-sm font-bold rounded-lg hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 bg-[#F28C28] text-white text-sm font-bold rounded-lg hover:bg-opacity-90 transition-colors flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <RefreshCw size={16} className="animate-spin" />
                  ) : (
                    "Confirm Payment"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
