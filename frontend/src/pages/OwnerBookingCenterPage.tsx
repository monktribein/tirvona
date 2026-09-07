import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  CalendarDays,
  CreditCard,
  IndianRupee,
  RefreshCw,
  Search,
  WalletCards,
} from "lucide-react";
import {
  ashramService,
  bookingFinanceService,
  bookingService,
} from "../services";
import { getErrorMessage } from "../lib/api";

type View = "bookings" | "payments" | "settlements" | "refunds";

interface OwnerBookingCenterPageProps {
  initialView?: View;
}

const money = (value: unknown) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);

const dateTime = (value: unknown) =>
  value ? new Date(String(value)).toLocaleString("en-IN") : "—";

const label = (value: unknown) =>
  String(value || "pending")
    .replace(/_/g, " ")
    .replace(/^./, (letter) => letter.toUpperCase());

export const OwnerBookingCenterPage: React.FC<OwnerBookingCenterPageProps> = ({
  initialView = "bookings",
}) => {
  const routeLocation = useLocation();
  const [activeView, setActiveView] = useState<View>(initialView);
  const [ashrams, setAshrams] = useState<any[]>([]);
  const [ashramId, setAshramId] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [bookings, setBookings] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [settlements, setSettlements] = useState<any[]>([]);
  const [refunds, setRefunds] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({});
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedBooking, setSelectedBooking] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const selected = ashramId || undefined;
      const results = await Promise.allSettled([
        ashramService.myListings(),
        bookingFinanceService.summary(selected),
        bookingFinanceService.payments(selected),
        bookingFinanceService.settlements(selected),
        bookingFinanceService.refunds(selected),
      ]);
      const [
        ashramResult,
        summaryResult,
        paymentResult,
        settlementResult,
        refundResult,
      ] = results;

      if (ashramResult.status === "fulfilled")
        setAshrams(
          ashramResult.value.data?.success
            ? ashramResult.value.data.data || []
            : [],
        );
      if (summaryResult.status === "fulfilled")
        setSummary(
          summaryResult.value.data?.success
            ? summaryResult.value.data.data || {}
            : {},
        );
      if (paymentResult.status === "fulfilled")
        setPayments(
          paymentResult.value.data?.success
            ? paymentResult.value.data.data || []
            : [],
        );
      if (settlementResult.status === "fulfilled")
        setSettlements(
          settlementResult.value.data?.success
            ? settlementResult.value.data.data || []
            : [],
        );
      if (refundResult.status === "fulfilled")
        setRefunds(
          refundResult.value.data?.success
            ? refundResult.value.data.data || []
            : [],
        );

      const failedResult = results.find(
        (result): result is PromiseRejectedResult =>
          result.status === "rejected",
      );
      if (failedResult)
        setError(
          getErrorMessage(
            failedResult.reason,
            "Some financial data could not be loaded.",
          ),
        );

      const allBookings: any[] = [];
      let page = 1;
      let batch: any[] = [];
      do {
        const response = await bookingService.dashboard({
          page: String(page),
          limit: "100",
          ...(selected ? { ashramId: selected } : {}),
        });
        batch = response.data?.success ? response.data.data || [] : [];
        allBookings.push(...batch);
        page += 1;
      } while (batch.length === 100);
      setBookings(allBookings);
    } catch (loadError) {
      setError(
        getErrorMessage(loadError, "Could not load booking and payment data."),
      );
    } finally {
      setLoading(false);
    }
  }, [ashramId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setActiveView(
      routeLocation.pathname.endsWith("/payments") ? "payments" : initialView,
    );
  }, [initialView, routeLocation.pathname]);

  const recordAshramId = (record: any): string =>
    String(
      typeof record?.ashramId === "object"
        ? record.ashramId?._id || ""
        : record?.ashramId || "",
    );

  const scopedBookings = useMemo(() => {
    const byAshram = ashramId
      ? bookings.filter(
          (booking) => recordAshramId(booking) === String(ashramId),
        )
      : bookings;
    return sourceFilter === "all"
      ? byAshram
      : byAshram.filter(
          (booking) =>
            String(booking.bookingSource ?? "tirvona") === sourceFilter,
        );
  }, [ashramId, bookings, sourceFilter]);

  const scopedPayments = useMemo(
    () =>
      ashramId
        ? payments.filter(
            (payment) => recordAshramId(payment) === String(ashramId),
          )
        : payments,
    [ashramId, payments],
  );

  const scopedSettlements = useMemo(
    () =>
      ashramId
        ? settlements.filter((settlement) =>
            (settlement.ashramIds || []).some(
              (item: any) =>
                String(typeof item === "object" ? item?._id || "" : item) ===
                String(ashramId),
            ),
          )
        : settlements,
    [ashramId, settlements],
  );

  const scopedRefunds = useMemo(
    () =>
      ashramId
        ? refunds.filter(
            (refund) =>
              recordAshramId(refund.bookingId) === String(ashramId) ||
              recordAshramId(refund.paymentId) === String(ashramId),
          )
        : refunds,
    [ashramId, refunds],
  );

  const filteredBookings = useMemo(() => {
    const term = search.trim().toLowerCase();
    return scopedBookings.filter((booking) => {
      if (status && booking.status !== status) return false;
      if (!term) return true;
      return [
        booking.bookingId,
        booking.reservationNumber,
        booking.customerId?.name,
        booking.customerId?.email,
        booking.customerId?.phone,
        booking.ashramId?.name,
        booking.roomId?.name,
      ].some((value) => String(value || "").toLowerCase().includes(term));
    });
  }, [scopedBookings, search, status]);

  const paymentRows = useMemo(() => {
    const linkedBookings = new Set(
      scopedPayments
        .map((payment) => payment.bookingId?._id)
        .filter((id) => Boolean(id))
        .map(String),
    );
    const bookingOnlyRows = scopedBookings
      .filter((booking) => !linkedBookings.has(String(booking._id)))
      .map((booking) => ({
        _id: `booking-payment-${booking._id}`,
        transactionId: "Not initiated",
        bookingId: booking,
        bookedBy: booking.customerId,
        paidBy: null,
        ashramId: booking.ashramId,
        method: booking.paymentMode || "not initiated",
        status: booking.paymentStatus || "pending",
        amount: booking.pricing?.amountPaid || 0,
        outstandingAmount: Math.max(
          0,
          Number(booking.pricing?.totalAmount || 0) -
            Number(booking.pricing?.amountPaid || 0),
        ),
        createdAt: booking.createdAt,
      }));
    return [...scopedPayments, ...bookingOnlyRows];
  }, [scopedBookings, scopedPayments]);

  const filteredPayments = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return paymentRows;
    return paymentRows.filter((payment) =>
      [
        payment.transactionId,
        payment.gateway?.paymentId,
        payment.gateway?.orderId,
        payment.bookingId?.bookingId,
        payment.bookingId?.reservationNumber,
        payment.bookedBy?.name,
        payment.bookedBy?.email,
        payment.bookedBy?.phone,
        payment.paidBy?.name,
        payment.paidBy?.email,
        payment.paidBy?.phone,
        payment.ashramId?.name,
      ].some((value) => String(value || "").toLowerCase().includes(term)),
    );
  }, [paymentRows, search]);

  const tabs: { id: View; title: string }[] = [
    { id: "bookings", title: `Bookings (${scopedBookings.length})` },
    { id: "payments", title: `Payments (${paymentRows.length})` },
    { id: "settlements", title: `Settlements (${scopedSettlements.length})` },
    { id: "refunds", title: `Refunds (${scopedRefunds.length})` },
  ];

  return (
    <div className="space-y-5 text-left w-full">
      <section className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] p-5 sm:p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-black text-[#0B192C] dark:text-white flex items-center gap-2">
              <CalendarDays size={20} className="text-[#0A4DA6]" /> Booking &amp; Payment Center
            </h1>
            <p className="text-xs text-gray-400 font-semibold mt-1">
              Every reservation and financial record for your owned ashrams.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={ashramId}
              onChange={(event) => setAshramId(event.target.value)}
              className="px-3 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-xs font-bold focus:outline-none"
            >
              <option value="">All my ashrams</option>
              {ashrams.map((ashram) => (
                <option key={ashram._id} value={ashram._id}>{ashram.name}</option>
              ))}
            </select>
            <select
              value={sourceFilter}
              onChange={(event) => setSourceFilter(event.target.value)}
              className="px-3 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-xs font-bold focus:outline-none"
            >
              <option value="all">Self + Online</option>
              <option value="tirvona">Online (Tirvona) only</option>
              <option value="self">Self bookings only</option>
            </select>
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-[#0A4DA6] text-white text-xs font-extrabold disabled:opacity-60"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
            </button>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 text-rose-700 px-4 py-3 text-xs font-semibold">{error}</div>
      )}

      <section className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          ["Gross Booking Value", summary.grossAmount, IndianRupee],
          ["Platform Commission", summary.commissionAmount, CreditCard],
          ["Your Earnings", summary.ownerEarning, WalletCards],
          ["Pending Payout", summary.pendingEarning, WalletCards],
          ["Settled Payout", summary.settledEarning, WalletCards],
        ].map(([title, value, Icon]: any) => (
          <div key={title} className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[20px] p-4 shadow-sm">
            <Icon size={16} className="text-[#0A4DA6]" />
            <p className="text-[10px] text-gray-400 font-bold mt-2">{title}</p>
            <p className="text-base font-black text-[#0B192C] dark:text-white mt-1">{money(value)}</p>
          </div>
        ))}
      </section>

      <section className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] overflow-hidden shadow-sm">
        <div className="flex gap-2 overflow-x-auto p-4 border-b border-gray-100 dark:border-slate-800">
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveView(tab.id)} className={`shrink-0 px-4 py-2 rounded-full text-xs font-extrabold ${activeView === tab.id ? "bg-[#0A4DA6] text-white" : "bg-gray-50 dark:bg-slate-900 text-gray-500"}`}>{tab.title}</button>
          ))}
        </div>

        {activeView === "bookings" && (
          <div>
            <div className="flex flex-wrap gap-2 p-4">
              <label className="relative flex-1 min-w-56"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Booking, guest, phone, room or ashram" className="w-full pl-9 pr-3 py-2.5 bg-gray-50 dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-800 text-xs focus:outline-none" /></label>
              <select value={status} onChange={(event) => setStatus(event.target.value)} className="px-3 py-2.5 bg-gray-50 dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-800 text-xs font-bold"><option value="">All statuses</option>{["pending","confirmed","checked_in","checked_out","completed","cancelled","refunded","no_show","expired"].map((item) => <option key={item} value={item}>{label(item)}</option>)}</select>
            </div>
            <DataTable loading={loading} headers={["Booking", "Guest", "Ashram / Room", "Stay", "Guests", "Payment", "Total", "Status", "Details"]} rows={filteredBookings.map((booking) => [booking.bookingId || booking.reservationNumber || "—", <Contact key="guest" item={booking.customerId} />, <div key="place"><b>{booking.ashramId?.name || "—"}</b><small>{booking.roomId?.name || "—"}</small></div>, <div key="stay"><span>{dateTime(booking.checkInDate)}</span><small>to {dateTime(booking.checkOutDate)}</small></div>, `${booking.guestsCount || 1} / ${booking.roomsBookedCount || 1} room(s)`, label(booking.paymentStatus), money(booking.pricing?.totalAmount), <Status key="status" value={booking.status} />, <button key="details" onClick={() => setSelectedBooking(booking)} className="text-[#0A4DA6] font-extrabold hover:underline">View full record</button>])} />
          </div>
        )}

        {activeView === "payments" && (
          <div>
            <div className="p-4">
              <label className="relative block">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Transaction, booking, booked by, paid by or ashram"
                  className="w-full pl-9 pr-3 py-2.5 bg-gray-50 dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-800 text-xs focus:outline-none"
                />
              </label>
            </div>
            <DataTable
              loading={loading}
              headers={["Transaction", "Booking", "Booked By", "Paid By", "Ashram", "Method", "Gateway", "Payment Date", "Paid", "Outstanding", "Status"]}
              rows={filteredPayments.map((payment) => [
                payment.transactionId || payment._id,
                payment.bookingId?.bookingId || payment.bookingId?.reservationNumber || "—",
                <Contact key="booked" item={payment.bookedBy || payment.bookingId?.customerId} />,
                <Contact
                  key="paid"
                  item={
                    ["success", "partially_refunded", "refunded"].includes(
                      payment.status,
                    )
                      ? payment.paidBy || payment.userId
                      : undefined
                  }
                />,
                payment.ashramId?.name || "—",
                label(payment.method),
                <div key="gateway"><span>{payment.gateway?.paymentId || "—"}</span><small>{payment.gateway?.orderId || payment.gateway?.provider || ""}</small></div>,
                payment.paidAt ? dateTime(payment.paidAt) : "Not paid",
                money(
                  ["success", "partially_refunded", "refunded"].includes(
                    payment.status,
                  )
                    ? payment.amount
                    : 0,
                ),
                money(
                  payment.outstandingAmount ??
                    Math.max(
                      0,
                      Number(payment.bookingId?.pricing?.totalAmount || 0) -
                        (["success", "partially_refunded"].includes(
                          payment.status,
                        )
                          ? Number(payment.amount || 0)
                          : 0),
                    ),
                ),
                <Status key="status" value={payment.status} />,
              ])}
            />
          </div>
        )}

        {activeView === "settlements" && <DataTable loading={loading} headers={["Settlement", "Ashrams", "Gross", "Commission", "Tax", "Payout", "Paid At", "Status"]} rows={scopedSettlements.map((item) => [item.settlementReference, (item.ashramIds || []).map((ashram: any) => ashram.name || ashram).join(", ") || "—", money(item.grossAmount), money(item.commissionAmount), money(item.taxAmount), money(item.payoutAmount), dateTime(item.paidAt), <Status key="status" value={item.status} />])} />}

        {activeView === "refunds" && <DataTable loading={loading} headers={["Refund", "Booking", "Payment", "Requested By", "Reason", "Amount", "Processed", "Status"]} rows={scopedRefunds.map((item) => [item.refundReference, item.bookingId?.bookingId || item.bookingId?._id || "—", item.paymentId?.transactionId || item.paymentId?._id || "—", item.requestedBy?.name || item.requestedBy?.email || "—", item.reason || "—", money(item.amount), dateTime(item.processedAt), <Status key="status" value={item.status} />])} />}
      </section>

      {selectedBooking && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm p-4 flex items-center justify-center">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white dark:bg-[#0B192C] rounded-[28px] p-5 sm:p-7 space-y-5">
            <div className="flex justify-between gap-3 border-b border-gray-100 dark:border-slate-800 pb-4">
              <div><h2 className="font-black text-lg text-[#0B192C] dark:text-white">Booking {selectedBooking.bookingId || selectedBooking.reservationNumber}</h2><p className="text-xs text-gray-400 mt-1">Complete reservation, stay and pricing record.</p></div>
              <button onClick={() => setSelectedBooking(null)} className="text-gray-400 text-xl">×</button>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                ["Guest", selectedBooking.customerId?.name],
                ["Contact", selectedBooking.customerId?.phone || selectedBooking.customerId?.email],
                ["Ashram", selectedBooking.ashramId?.name],
                ["Room", selectedBooking.roomId?.name],
                ["Check in", dateTime(selectedBooking.checkInDate)],
                ["Check out", dateTime(selectedBooking.checkOutDate)],
                ["Guests", selectedBooking.guestsCount],
                ["Rooms", selectedBooking.roomsBookedCount],
                ["Booking status", label(selectedBooking.status)],
                ["Payment status", label(selectedBooking.paymentStatus)],
                ["Payment mode", label(selectedBooking.paymentMode)],
                ["Assigned rooms", (selectedBooking.assignedRoomNumbers && selectedBooking.assignedRoomNumbers.length > 0) ? selectedBooking.assignedRoomNumbers.join(", ") : (selectedBooking.assignedRoomNumber || "Not assigned")],
              ].map(([title, value]) => <div key={String(title)} className="rounded-2xl bg-gray-50 dark:bg-slate-900 p-3"><p className="text-[9px] uppercase tracking-wide text-gray-400 font-bold">{title}</p><p className="text-xs font-extrabold text-[#0B192C] dark:text-white mt-1 break-words">{String(value || "—")}</p></div>)}
            </div>
            <div><h3 className="text-xs font-extrabold text-[#0B192C] dark:text-white mb-2">Pricing breakdown</h3><div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{Object.entries(selectedBooking.pricing || {}).filter(([, value]) => typeof value === "number").map(([key, value]) => <div key={key} className="flex justify-between gap-2 rounded-xl border border-gray-100 dark:border-slate-800 px-3 py-2 text-[10px]"><span className="text-gray-400">{label(key)}</span><b>{key.toLowerCase().includes("percent") ? `${String(value)}%` : money(value)}</b></div>)}</div></div>
            <div><h3 className="text-xs font-extrabold text-[#0B192C] dark:text-white mb-2">Services and special requests</h3><div className="rounded-2xl bg-gray-50 dark:bg-slate-900 p-4 text-xs text-gray-600 dark:text-gray-300"><p>{selectedBooking.specialRequests || "No special requests."}</p>{(selectedBooking.services?.selectedAddOns || []).map((item: any, index: number) => <p key={item.serviceId || index} className="mt-2 font-semibold">{item.name} × {item.quantity || 1} — {money(item.totalPrice || item.price)}</p>)}</div></div>
          </div>
        </div>
      )}
    </div>
  );
};

const Contact = ({ item }: { item?: any }) => <div><b>{item?.name || "—"}</b><small>{item?.email || item?.phone || ""}</small></div>;
const Status = ({ value }: { value?: string }) => <span className="inline-flex px-2.5 py-1 rounded-full bg-[#0A4DA6]/10 text-[#0A4DA6] text-[9px] font-extrabold">{label(value)}</span>;
const DataTable = ({ loading, headers, rows }: { loading: boolean; headers: string[]; rows: React.ReactNode[][] }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-left text-xs min-w-[1000px]">
      <thead className="bg-gray-50 dark:bg-slate-900 text-[10px] text-gray-400 uppercase"><tr>{headers.map((header) => <th key={header} className="px-4 py-3">{header}</th>)}</tr></thead>
      <tbody>{loading ? <tr><td colSpan={headers.length} className="p-12 text-center text-gray-400">Loading records…</td></tr> : rows.length === 0 ? <tr><td colSpan={headers.length} className="p-12 text-center text-gray-400">No records found for this ashram.</td></tr> : rows.map((row, index) => <tr key={index} className="border-t border-gray-50 dark:border-slate-800">{row.map((cell, cellIndex) => <td key={cellIndex} className="px-4 py-3 text-gray-600 dark:text-gray-300 [&_b]:block [&_b]:text-[#0B192C] dark:[&_b]:text-white [&_small]:block [&_small]:text-[10px] [&_small]:text-gray-400">{cell}</td>)}</tr>)}</tbody>
    </table>
  </div>
);

export default OwnerBookingCenterPage;
