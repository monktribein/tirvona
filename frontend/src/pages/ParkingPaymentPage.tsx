import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { publicParkingPaymentService } from "../services";
import { openRazorpayCheckout } from "../lib/razorpay";
import { formatCurrency } from "../utils/format";
import { getErrorMessage } from "../lib/api";
import { toast } from "../lib/toast";

/**
 * The public page a signed WhatsApp parking payment link opens — the parking
 * counterpart of `BookingPaymentPage`. No website login is required or
 * possible here: the token itself is the capability to view and pay this one
 * booking. Every figure shown comes from `publicParkingPaymentService.summary`,
 * read fresh from the booking's own record. Confirmation never trusts its
 * own success: after Razorpay closes, it polls the summary until the booking
 * itself reports paid — the same Razorpay webhook that confirms the WhatsApp
 * and website flows is what actually settles the booking.
 */

interface ParkingPaymentSummary {
  status: "payable" | "paid" | "expired" | "cancelled";
  bookingReference: string;
  location: { name: string; city: string };
  bay: string;
  vehicleType: string;
  vehicleNumber: string;
  entryAt: string;
  exitAt: string;
  durationHours: number;
  pricing: {
    baseFee: number;
    durationAmount: number;
    subtotal: number;
    taxPercent: number;
    taxAmount: number;
    totalAmount: number;
    currency: string;
  };
  amountDue: number;
  holdExpiresAt: string | null;
  linkExpiresAt: string;
}

const formatDateTime = (iso: string): string =>
  new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

/** A live "Xm Ys" countdown to `target`, ticking every second; empty once past. */
const useCountdown = (target: string | null): string => {
  const [label, setLabel] = useState("");
  useEffect(() => {
    if (!target) {
      setLabel("");
      return;
    }
    const targetMs = new Date(target).getTime();
    const tick = () => {
      const remaining = targetMs - Date.now();
      if (remaining <= 0) {
        setLabel("");
        return;
      }
      const totalSeconds = Math.floor(remaining / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      setLabel(`${minutes}:${String(seconds).padStart(2, "0")}`);
    };
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [target]);
  return label;
};

const StatusBanner: React.FC<{ kind: "expired" | "cancelled" | "paid" }> = ({
  kind,
}) => {
  const copy = {
    paid: {
      icon: "✅",
      title: "Payment received",
      body: "This parking booking is confirmed. You'll get the gate code on WhatsApp.",
      tone: "border-green-200 bg-green-50 text-green-800",
    },
    expired: {
      icon: "⏳",
      title: "This hold has expired",
      body: "The reservation window closed before payment was completed. Ask on WhatsApp for a fresh booking.",
      tone: "border-amber-200 bg-amber-50 text-amber-800",
    },
    cancelled: {
      icon: "✕",
      title: "This booking was cancelled",
      body: "There is nothing to pay. If you expected a refund, check WhatsApp for its status.",
      tone: "border-gray-200 bg-gray-50 text-gray-700",
    },
  }[kind];
  return (
    <div className={`rounded-2xl border p-5 text-center ${copy.tone}`}>
      <div className="text-3xl mb-2">{copy.icon}</div>
      <p className="font-extrabold text-base">{copy.title}</p>
      <p className="text-sm mt-1">{copy.body}</p>
    </div>
  );
};

const Row: React.FC<{ label: string; value: React.ReactNode; strong?: boolean; sub?: boolean }> = ({
  label,
  value,
  strong,
  sub,
}) => (
  <div
    className={`flex items-center justify-between ${sub ? "text-xs text-gray-500" : "text-sm text-gray-700"} ${
      strong ? "font-extrabold text-[15px] text-gray-900" : ""
    }`}
  >
    <span>{label}</span>
    <span className={strong ? "" : "font-semibold"}>{value}</span>
  </div>
);

export const ParkingPaymentPage: React.FC = () => {
  const { token = "" } = useParams<{ token: string }>();
  const [summary, setSummary] = useState<ParkingPaymentSummary | null>(null);
  const [loadError, setLoadError] = useState("");
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const pollTimer = useRef<number | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await publicParkingPaymentService.summary(token);
      setSummary(res.data.data as ParkingPaymentSummary);
      setLoadError("");
      return res.data.data as ParkingPaymentSummary;
    } catch (err) {
      setLoadError(
        getErrorMessage(err, "This payment link is not valid or has expired."),
      );
      return null;
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const expiresAt =
    summary?.status === "payable"
      ? [summary.holdExpiresAt, summary.linkExpiresAt]
          .filter((v): v is string => Boolean(v))
          .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0] ?? null
      : null;
  const countdown = useCountdown(expiresAt ?? null);

  useEffect(() => {
    if (summary?.status === "payable" && expiresAt && !countdown) load();
  }, [countdown, summary?.status, expiresAt, load]);

  useEffect(() => () => {
    if (pollTimer.current) window.clearInterval(pollTimer.current);
  }, []);

  /**
   * Polls the summary until the booking itself reports paid, or gives up
   * after a minute and tells the guest to check WhatsApp — the webhook may
   * still land after that; nothing here ever claims success on its own say-so.
   */
  const pollUntilPaid = useCallback(() => {
    setConfirming(true);
    let attempts = 0;
    pollTimer.current = window.setInterval(async () => {
      attempts += 1;
      const latest = await load();
      if (latest?.status === "paid" || attempts >= 20) {
        if (pollTimer.current) window.clearInterval(pollTimer.current);
        setConfirming(false);
      }
    }, 3000);
  }, [load]);

  const handlePay = async () => {
    setPayError("");
    setPaying(true);
    try {
      const orderRes = await publicParkingPaymentService.createOrder(token);
      const order = orderRes.data.data;
      const result = await openRazorpayCheckout(
        order,
        {},
        { name: "Tirvona", description: summary?.location.name || "Parking payment" },
      );
      try {
        await publicParkingPaymentService.confirm(token, result);
      } catch {
        // The client-side confirm can fail even though the payment went
        // through. The poll below is what actually decides the outcome.
      }
      pollUntilPaid();
    } catch (err) {
      setPayError(getErrorMessage(err, "Payment was not completed. Nothing was charged."));
      toast.error("Payment was not completed.");
    } finally {
      setPaying(false);
    }
  };

  if (loadError) {
    return (
      <PageShell>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <div className="text-3xl mb-2">⚠️</div>
          <p className="font-extrabold text-red-800">Can't open this link</p>
          <p className="text-sm text-red-700 mt-1">{loadError}</p>
          <p className="text-xs text-gray-500 mt-4">
            Go back to WhatsApp and ask for a new payment link.
          </p>
        </div>
      </PageShell>
    );
  }

  if (!summary) {
    return (
      <PageShell>
        <div className="animate-pulse space-y-3">
          <div className="h-5 w-2/3 bg-gray-200 rounded" />
          <div className="h-24 bg-gray-200 rounded-2xl" />
          <div className="h-40 bg-gray-200 rounded-2xl" />
        </div>
      </PageShell>
    );
  }

  const p = summary.pricing;

  return (
    <PageShell reference={summary.bookingReference}>
      {summary.status !== "payable" && <StatusBanner kind={summary.status} />}

      <div className="rounded-2xl border border-gray-200 bg-white p-5 mt-4 shadow-sm">
        <p className="text-[11px] font-bold tracking-widest text-saffron-500 uppercase">
          {summary.bookingReference}
        </p>
        <h1 className="text-lg font-extrabold text-gray-900 mt-1">
          {summary.location.name}
          {summary.location.city ? `, ${summary.location.city}` : ""}
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          {summary.bay} · {summary.vehicleNumber}
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-gray-50 p-3">
            <p className="text-[10px] font-bold text-gray-400 uppercase">Entry</p>
            <p className="font-bold text-gray-800">{formatDateTime(summary.entryAt)}</p>
          </div>
          <div className="rounded-xl bg-gray-50 p-3">
            <p className="text-[10px] font-bold text-gray-400 uppercase">Exit</p>
            <p className="font-bold text-gray-800">{formatDateTime(summary.exitAt)}</p>
          </div>
        </div>
        <div className="mt-2 flex justify-between text-xs text-gray-500 px-1">
          <span>{summary.durationHours} hour(s)</span>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 mt-4 shadow-sm space-y-2">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">
          Price breakdown
        </p>
        <Row label="Base fee" value={formatCurrency(p.baseFee)} />
        {p.durationAmount > 0 && (
          <Row label="Duration charge" value={formatCurrency(p.durationAmount)} />
        )}
        {p.taxAmount > 0 && (
          <Row
            label={`Tax${p.taxPercent ? ` (${p.taxPercent}%)` : ""}`}
            value={formatCurrency(p.taxAmount)}
          />
        )}
        <div className="border-t border-dashed border-gray-200 pt-2 mt-2">
          <Row label="Total" value={formatCurrency(p.totalAmount)} strong />
        </div>
      </div>

      {summary.status === "payable" && (
        <div className="sticky bottom-0 left-0 right-0 mt-6 -mx-4 px-4 pb-4 pt-3 bg-gradient-to-t from-white via-white to-transparent">
          {countdown && (
            <p className="text-center text-xs text-gray-500 mb-2">
              This hold expires in <span className="font-bold text-saffron-500">{countdown}</span>
            </p>
          )}
          {payError && (
            <p className="text-center text-xs text-red-600 mb-2">{payError}</p>
          )}
          <button
            type="button"
            onClick={handlePay}
            disabled={paying || confirming || !countdown}
            className="w-full rounded-full bg-[#0A4DA6] text-white font-extrabold text-base py-3.5 shadow-lg shadow-[#0A4DA6]/25 disabled:opacity-60 disabled:cursor-not-allowed transition active:scale-[0.99]"
          >
            {confirming
              ? "Confirming your payment…"
              : paying
                ? "Opening secure checkout…"
                : !countdown
                  ? "Hold expired"
                  : `Pay Now · ${formatCurrency(summary.amountDue)}`}
          </button>
          <p className="text-center text-[11px] text-gray-400 mt-2">
            Secured by Razorpay. Your payment is verified on Tirvona's server before
            your booking is confirmed.
          </p>
        </div>
      )}
    </PageShell>
  );
};

const PageShell: React.FC<{ children: React.ReactNode; reference?: string }> = ({
  children,
  reference,
}) => (
  <div className="min-h-screen bg-[#FAF7F2] flex flex-col">
    <header className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-white">
      <img src="/logo/logo.png" alt="Tirvona" className="h-8 w-8 object-contain" />
      <div>
        <p className="font-extrabold text-gray-900 leading-tight text-sm">Tirvona</p>
        <p className="text-[10px] text-gray-400 leading-tight">
          {reference ? `Secure payment · ${reference}` : "Secure payment"}
        </p>
      </div>
    </header>
    <main className="flex-1 w-full max-w-md mx-auto px-4 py-5">{children}</main>
  </div>
);

export default ParkingPaymentPage;
