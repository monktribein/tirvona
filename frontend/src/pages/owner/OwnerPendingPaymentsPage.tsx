import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
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

export default function OwnerPendingPaymentsPage() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { addNotification } = useNotifications();

  // Manual confirm modal state
  const [selectedBooking, setSelectedBooking] = useState<any | null>(null);
  const [paymentMode, setPaymentMode] = useState("cash");
  const [transactionReference, setTransactionReference] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const res = await bookingService.paymentPending();
      if (res.data?.success) {
        setBookings(res.data.data);
      }
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white dark:bg-[#0B192C] p-6 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-[#0B192C] dark:text-white flex items-center gap-2">
            <AlertCircle className="text-amber-500" /> Payment Pending Bookings
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Bookings where the guest dropped off before completing payment.
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {bookings.map((b) => (
            <div
              key={b._id}
              className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4 flex flex-col"
            >
              <div className="flex justify-between items-start border-b border-gray-50 dark:border-slate-800 pb-3">
                <div className="space-y-1">
                  <span className="text-xs font-bold text-[#F28C28]">
                    {b.bookingId}
                  </span>
                  <h3 className="font-bold text-sm text-[#0B192C] dark:text-white line-clamp-1">
                    {b.customerId?.name || b.walkInGuest?.name || "Unknown Guest"}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                    <MapPin size={12} /> {b.ashramId?.name}
                  </p>
                </div>
                <EnterpriseStatusBadge status={b.status} />
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-gray-400 block text-[10px]">Check In</span>
                  <span className="font-semibold flex items-center gap-1">
                    <Calendar size={12} className="text-[#F28C28]" />
                    {new Date(b.checkInDate).toLocaleDateString()}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px]">Check Out</span>
                  <span className="font-semibold flex items-center gap-1">
                    <Calendar size={12} className="text-[#F28C28]" />
                    {new Date(b.checkOutDate).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-gray-50 dark:border-slate-800 mt-auto flex justify-between items-center bg-gray-50 dark:bg-slate-900/50 -mx-5 -mb-5 px-5 py-3 rounded-b-2xl">
                <div>
                  <span className="text-[10px] text-gray-500 block">Amount Due</span>
                  <span className="font-bold text-base text-[#0B192C] dark:text-white">
                    {formatCurrency(b.pricing?.totalAmount)}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedBooking(b)}
                  className="px-4 py-2 bg-[#F28C28] text-white text-xs font-bold rounded-lg hover:bg-opacity-90 transition-colors shadow-sm"
                >
                  Confirm Payment
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#0B192C] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border border-gray-100 dark:border-slate-800">
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
