import React, { useCallback, useEffect, useState } from "react";
import { useNotifications } from "../../../contexts/NotificationContext";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  Clock,
  Flame,
  MapPin,
  RefreshCw,
  Users,
  XCircle,
} from "lucide-react";
import { getErrorMessage } from "../../../lib/api";
import { aartiBookingService } from "../services/aarti.service";
import type {
  AartiBooking,
  AartiPass,
  AartiRefundQuote,
  AartiSession,
} from "../types/aarti.types";
import {
  arriveByTime,
  formatCurrency,
  formatDateTime,
} from "../utils/aartiFormat";
import AartiStatusBadge from "../components/AartiStatusBadge";

export const AartiBookingDetailPage: React.FC = () => {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { promptAction } = useNotifications();

  const [booking, setBooking] = useState<AartiBooking | null>(null);
  const [pass, setPass] = useState<AartiPass | null>(null);
  const [refund, setRefund] = useState<AartiRefundQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await aartiBookingService.get(id);
      const data: AartiBooking = response.data?.data;
      setBooking(data);
      setError("");

      if (data.paymentStatus === "paid" && data.status !== "cancelled") {
        const [passResponse, refundResponse] = await Promise.allSettled([
          aartiBookingService.getPass(id),
          aartiBookingService.refundPreview(id),
        ]);
        if (passResponse.status === "fulfilled")
          setPass(passResponse.value.data?.data ?? null);
        if (refundResponse.status === "fulfilled")
          setRefund(refundResponse.value.data?.data ?? null);
      }
    } catch (err) {
      setError(getErrorMessage(err, "We could not load this booking."));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const reissue = async () => {
    setBusy(true);
    try {
      const response = await aartiBookingService.reissuePass(id);
      setPass(response.data?.data ?? null);
    } catch {
      // The interceptor already surfaced the failure as a toast.
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    const reason = await promptAction({
      title: "Cancel Aarti Booking",
      message: "Tell us why you are cancelling this Aarti booking.",
      placeholder: "Cancellation reason",
      confirmLabel: "Cancel booking",
      required: true,
      tone: "danger",
    });
    if (reason === null) return;
    setBusy(true);
    try {
      await aartiBookingService.cancel(id, reason || undefined);
      await load();
    } catch {
      // Handled by the toast interceptor.
    } finally {
      setBusy(false);
    }
  };

  if (loading)
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16 space-y-5">
        <div className="h-32 bg-gray-100 dark:bg-slate-800 animate-pulse rounded-[24px]" />
        <div className="h-80 bg-gray-100 dark:bg-slate-800 animate-pulse rounded-[24px]" />
      </div>
    );

  if (error || !booking)
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-12 shadow-sm space-y-3">
          <Flame size={36} className="text-gray-300 dark:text-slate-700 mx-auto" />
          <h4 className="font-extrabold text-base text-[#0B192C] dark:text-white">
            {error || "Booking not found"}
          </h4>
          <button
            type="button"
            onClick={() => navigate("/profile/aarti")}
            className="inline-flex items-center gap-2 bg-[#0A4DA6] hover:bg-[#083D85] text-white text-xs font-extrabold px-5 py-2.5 rounded-full shadow-md transition-all active:scale-95 cursor-pointer"
          >
            My aarti bookings
          </button>
        </div>
      </div>
    );

  const session =
    typeof booking.sessionId === "object"
      ? (booking.sessionId as AartiSession)
      : null;
  const cancellable = ["pending", "upcoming"].includes(booking.status);

  return (
    <div className="bg-[#F4F7FB] py-8 sm:py-10 lg:py-12 dark:bg-[#070F1B]">
      <div className="mx-auto w-full max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">

      <section className="space-y-4 rounded-[28px] border border-orange-200 bg-white p-5 shadow-sm shadow-slate-900/[0.03] sm:p-7 dark:border-slate-800 dark:bg-[#0B192C]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-extrabold text-xl sm:text-2xl text-[#0B192C] dark:text-white leading-tight">
              {session?.name ?? "Aarti booking"}
            </h1>
            <p className="mt-1 font-mono text-[11px] font-bold text-gray-400 tracking-wider">
              {booking.bookingReference}
            </p>
          </div>
          <AartiStatusBadge status={booking.status} size="lg" />
        </div>

        <div className="grid sm:grid-cols-2 gap-3 pt-1">
          <p className="flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
            <Clock size={14} className="shrink-0 text-[#0A4DA6] stroke-[2.5]" />
            {formatDateTime(booking.startsAt)}
          </p>
          <p className="flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
            <Users size={14} className="shrink-0 text-[#0A4DA6] stroke-[2.5]" />
            {booking.passCount} pass{booking.passCount === 1 ? "" : "es"}
            {booking.checkedInCount
              ? ` · ${booking.checkedInCount} admitted`
              : ""}
          </p>
          {session?.venue?.city ? (
            <p className="flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400 sm:col-span-2">
              <MapPin size={14} className="shrink-0 text-[#0A4DA6] stroke-[2.5]" />
              {[session.venue.name, session.venue.city, session.venue.state]
                .filter(Boolean)
                .join(", ")}
            </p>
          ) : null}
        </div>

        {booking.status === "pending" ? (
          <div className="flex items-start gap-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 rounded-2xl px-4 py-3">
            <AlertCircle
              size={14}
              className="shrink-0 mt-0.5 text-amber-600 stroke-[2.5]"
            />
            <p className="text-[11px] font-semibold text-amber-800 dark:text-amber-300">
              This booking is still awaiting payment. Your seats are released
              once the hold expires.
            </p>
          </div>
        ) : null}
      </section>

      <div
        className={
          pass
            ? "grid items-start gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.75fr)]"
            : ""
        }
      >
      {pass ? (
        <section className="overflow-hidden rounded-[28px] border border-orange-200 bg-white shadow-sm shadow-slate-900/[0.03] dark:border-slate-800 dark:bg-[#0B192C]">
          <div className="bg-gradient-to-r from-[#073B7A] to-[#0A5CC4] px-5 py-5 text-left text-white sm:px-7">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-100">
              Tirvona digital entry pass
            </p>
            <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-black">Your Aarti Pass</h2>
              <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-[10px] font-extrabold backdrop-blur-sm">
                {booking.passCount} guest{booking.passCount === 1 ? "" : "s"}
              </span>
            </div>
          </div>

          <div className="grid gap-6 p-5 sm:grid-cols-[220px_minmax(0,1fr)] sm:p-7">
          <div className="mx-auto w-full max-w-[220px] text-center">

          <img
            src={pass.image}
            alt="Aarti pass QR code"
            className="aspect-square w-full rounded-[24px] border border-orange-200 bg-white p-2.5 shadow-sm"
          />
            <p className="mt-3 text-[10px] font-semibold leading-relaxed text-slate-400">
              Present this QR code at the entrance
            </p>
          </div>

          <div className="flex min-w-0 flex-col justify-center text-left">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
              Gate code
            </p>
            <p className="mt-1 break-all font-mono text-2xl font-black tracking-[0.18em] text-[#0B192C] sm:text-3xl dark:text-white">
              {pass.displayCode}
            </p>

            <div className="mt-5 space-y-3 border-y border-orange-100 py-4 dark:border-slate-800">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Arrive by
                </p>
                <p className="mt-0.5 text-sm font-extrabold text-[#0B192C] dark:text-white">
                  {arriveByTime(
                    booking.startsAt,
                    session?.policy?.gateOpensBeforeMinutes ?? 60,
                  )}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Pass validity
                </p>
                <p className="mt-0.5 text-xs font-semibold leading-relaxed text-slate-600 dark:text-slate-300">
                  {formatDateTime(pass.validFrom)} – {formatDateTime(pass.validUntil)}
                </p>
              </div>
            </div>

          <button
            type="button"
            onClick={reissue}
            disabled={busy}
            className="mt-5 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-[#0A4DA6]/25 bg-white px-4 py-2.5 text-xs font-extrabold text-[#0A4DA6] shadow-sm transition-all hover:border-[#0A4DA6] hover:bg-blue-50 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#0B192C] dark:text-blue-300"
          >
            <RefreshCw
              size={12}
              className={`stroke-[2.5] ${busy ? "animate-spin" : ""}`}
            />
            Reissue Pass
          </button>
          <p className="mt-2 text-center text-[10px] font-medium text-slate-400">
            Reissuing immediately invalidates the previous QR code.
          </p>
          </div>
          </div>
        </section>
      ) : null}

      <div className="space-y-6 lg:sticky lg:top-24">
      <section className="space-y-3 rounded-[28px] border border-orange-200 bg-white p-5 shadow-sm shadow-slate-900/[0.03] sm:p-6 dark:border-slate-800 dark:bg-[#0B192C]">
        <h2 className="font-extrabold text-base text-[#0B192C] dark:text-white">
          Payment summary
        </h2>
        <div className="space-y-1.5">
          <div className="flex justify-between text-[11px] font-semibold text-gray-500 dark:text-gray-400">
            <span>Pass amount × {booking.pricing.passCount}</span>
            <span>{formatCurrency(booking.pricing.subtotal)}</span>
          </div>
          {booking.pricing.taxAmount ? (
            <div className="flex justify-between text-[11px] font-semibold text-gray-500 dark:text-gray-400">
              <span>Tax ({booking.pricing.taxPercent}%)</span>
              <span>{formatCurrency(booking.pricing.taxAmount)}</span>
            </div>
          ) : null}
          {booking.pricing.donationAmount ? (
            <div className="flex justify-between text-[11px] font-semibold text-gray-500 dark:text-gray-400">
              <span>Sankalp donation</span>
              <span>{formatCurrency(booking.pricing.donationAmount)}</span>
            </div>
          ) : null}
          <div className="flex justify-between items-center pt-2 mt-1 border-t border-gray-100 dark:border-slate-800">
            <span className="text-[10px] tracking-wider font-bold text-gray-400">
              TOTAL PAID
            </span>
            <span className="text-2xl font-black text-[#0B192C] dark:text-white">
              {formatCurrency(booking.pricing.amountPaid)}
            </span>
          </div>
          {booking.pricing.refundAmount ? (
            <div className="flex justify-between text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
              <span>Refunded</span>
              <span>{formatCurrency(booking.pricing.refundAmount)}</span>
            </div>
          ) : null}
        </div>
      </section>

      {cancellable && refund?.allowed ? (
        <section className="space-y-3 rounded-[28px] border border-orange-200 bg-white p-5 shadow-sm shadow-slate-900/[0.03] sm:p-6 dark:border-slate-800 dark:bg-[#0B192C]">
          <h2 className="font-extrabold text-base text-[#0B192C] dark:text-white">
            Cancel this booking
          </h2>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 leading-relaxed">
            You would be refunded{" "}
            <span className="font-extrabold text-[#0B192C] dark:text-white">
              {formatCurrency(refund.refundAmount)}
            </span>{" "}
            ({refund.percent}% of the pass fee).
            {refund.donationRetained
              ? ` The ${formatCurrency(refund.donationRetained)} sankalp donation stays with the ashram.`
              : ""}
          </p>
          <button
            type="button"
            onClick={cancel}
            disabled={busy}
            className="inline-flex items-center gap-1.5 bg-white dark:bg-[#0B192C] border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-extrabold px-4 py-2.5 rounded-full shadow-sm transition-all active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <XCircle size={14} className="stroke-[2.5]" />
            Cancel Booking
          </button>
        </section>
      ) : null}
      </div>
      </div>
      </div>
    </div>
  );
};

export default AartiBookingDetailPage;
