/* oxlint-disable react/only-export-components -- small shared kit for the Yatra screens */
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bus, Loader2 } from "lucide-react";
import { openRazorpayCheckout, type RazorpayOrder } from "../../lib/razorpay";
import { getErrorMessage } from "../../lib/api";
import { Empty, Pill } from "../marketplace/ui";
import { humanizeLabel } from "../../utils/labels";
import { yatraPublic, type RazorpayProof } from "./services/yatra.service";

// ------------------------------------------------------------------ feature flag
let enabledPromise: Promise<boolean> | null = null;
/** Whether Tirvona Yatra is switched on (YATRA_ENABLED on the API). Cached for the session. */
export const fetchYatraEnabled = (): Promise<boolean> => {
  enabledPromise ??= yatraPublic
    .config()
    .then((res) => Boolean(res.data?.data?.enabled))
    .catch(() => false);
  return enabledPromise;
};

export function useYatraEnabled(): boolean | null {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    fetchYatraEnabled().then((value) => live && setEnabled(value));
    return () => {
      live = false;
    };
  }, []);
  return enabled;
}

/** Shows the page only while Yatra is switched on; otherwise a calm "not available yet" notice. */
export const YatraGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const enabled = useYatraEnabled();
  if (enabled === null)
    return (
      <div className="py-24 flex justify-center" role="status" aria-live="polite">
        <Loader2 size={24} className="animate-spin text-[#F28C28]" />
        <span className="sr-only">Loading</span>
      </div>
    );
  if (!enabled)
    return (
      <div className="max-w-xl mx-auto px-4 py-16">
        <Empty
          icon={<Bus size={30} className="text-[#F28C28]" />}
          title="Tirvona Yatra is not available yet"
          text="Bus and group pilgrimage bookings are coming soon. Meanwhile you can book stays, aarti passes and parking on Tirvona."
          action={
            <Link to="/" className="text-xs font-extrabold text-[#F28C28] hover:underline">
              Back to Tirvona
            </Link>
          }
        />
      </div>
    );
  return <>{children}</>;
};

// --------------------------------------------------------------------- formats
export const IST = "Asia/Kolkata";
export const dateLong = (value?: string | Date | null) =>
  value ? new Date(value).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: IST }) : "—";
export const timeOnly = (value?: string | Date | null) =>
  value ? new Date(value).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: IST }) : "—";
export const dateTimeIst = (value?: string | Date | null) => (value ? `${dateLong(value)}, ${timeOnly(value)}` : "—");
/** "2026-12-01T05:30" for a datetime-local input, in India time. */
export const toLocalInput = (value?: string | Date | null) => {
  if (!value) return "";
  const d = new Date(new Date(value).getTime() + 330 * 60_000);
  return d.toISOString().slice(0, 16);
};
/** A datetime-local value (India time) as an ISO instant. */
export const fromLocalInput = (value: string) => (value ? new Date(`${value}:00+05:30`).toISOString() : undefined);
export const rupees = (value?: number | null) => `₹${Number(value ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const TONES: Record<string, "green" | "amber" | "saffron" | "red" | "blue" | "gray"> = {
  approved: "green", published: "green", scheduled: "green", confirmed: "green", paid: "green", active: "green", fulfilled: "green", completed: "green", available: "green", upcoming: "blue", ongoing: "saffron",
  submitted: "amber", under_review: "amber", pending_review: "amber", pending_verification: "amber", pending: "amber", held: "amber", payment_pending: "amber", cancellation_requested: "amber", requested: "amber", supplier_pending: "amber", unpaid: "amber",
  accepted: "saffron", partially_refunded: "saffron", partner_pending: "amber", in_progress: "saffron", open: "amber", transfer_recorded: "blue", reconciled: "green", resolved: "green", closed: "gray", retired: "gray", skipped: "gray", failed: "red",
  rejected: "red", suspended: "red", cancelled: "red", expired: "gray", refunded: "gray", unpublished: "gray", draft: "gray", sales_closed: "gray", removed: "gray",
};
const LABELS: Record<string, string> = {
  held: "Seats held",
  payment_pending: "Awaiting payment",
  cancellation_requested: "Cancellation requested",
  pending_review: "Awaiting Tirvona review",
  pending_verification: "Awaiting verification",
  supplier_pending: "Waiting for supplier",
  partner_pending: "Waiting for ride partner",
  in_progress: "In progress",
  transfer_recorded: "Transfer recorded",
  accepted: "Accepted · pay to confirm",
  sales_closed: "Sales closed",
  scheduled: "Open for booking",
  MARKETPLACE: "Tirvona website",
  OPERATOR_LINK: "Organiser link",
  ORGANIZER: "Organiser-assisted",
};
export const statusLabel = (status?: string | null) => (status ? LABELS[status] ?? humanizeLabel(status) : "—");
export const StatusPill: React.FC<{ status?: string | null }> = ({ status }) => (
  <Pill status={status ?? ""} label={statusLabel(status)} tone={TONES[status ?? ""] ?? "gray"} />
);

// --------------------------------------------------------------------- payment
export interface YatraOrder {
  demo: boolean;
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
  name?: string;
  description?: string;
}

/**
 * Opens Tirvona's Razorpay checkout and hands the result to `confirm`, which
 * verifies it on the server. In local development without Razorpay keys the
 * API runs in demo mode, and the confirmation uses demo ids it alone accepts.
 */
export async function runPayment<T>(
  order: YatraOrder,
  prefill: { name?: string; email?: string; contact?: string },
  confirm: (proof: RazorpayProof) => Promise<T>,
): Promise<T> {
  if (order.demo) {
    const id = Math.random().toString(16).slice(2, 14);
    return confirm({ razorpay_order_id: order.orderId, razorpay_payment_id: `demo_pay_${id}` });
  }
  const result = await openRazorpayCheckout(
    { orderId: order.orderId, amount: order.amount, currency: order.currency, keyId: order.keyId } satisfies RazorpayOrder,
    prefill,
    { name: order.name ?? "Tirvona Yatra", description: order.description },
  );
  return confirm(result);
}

/** The API message, or the browser error for a cancelled checkout. */
export const paymentError = (error: unknown, fallback = "Payment was not completed.") => {
  const anyErr = error as { response?: unknown; message?: string };
  if (anyErr?.response) return getErrorMessage(error, fallback);
  return anyErr?.message || fallback;
};

// -------------------------------------------------------------------- seat map
export interface SeatCell {
  seatNo: string;
  row: number;
  col: number;
  deck?: string;
  kind?: string;
  status: string;
  bookingReference?: string;
}

const SEAT_STYLE: Record<string, string> = {
  available: "bg-white dark:bg-slate-900 border-[#F28C28]/50 text-[#0B192C] dark:text-white hover:bg-orange-50 dark:hover:bg-slate-800",
  selected: "bg-[#F28C28] border-[#F28C28] text-white shadow-sm",
  unavailable: "bg-gray-200 dark:bg-slate-700 border-gray-200 dark:border-slate-700 text-gray-400 cursor-not-allowed",
  booked: "bg-emerald-100 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300",
  held: "bg-amber-100 dark:bg-amber-950/50 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300",
  blocked: "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900 text-rose-400 line-through",
};

/**
 * A bus seat plan. In "select" mode the pilgrim (or organiser) taps
 * available seats; in "view" mode staff see who holds each seat. Every
 * seat is a button with an accessible name, so it works with a keyboard and
 * a screen reader.
 */
export const SeatMap: React.FC<{
  seats: SeatCell[];
  columns: number;
  selected?: string[];
  onToggle?: (seatNo: string) => void;
  max?: number;
  mode?: "select" | "view";
}> = ({ seats, columns, selected = [], onToggle, max, mode = "select" }) => {
  const picked = new Set(selected);
  const legend = mode === "select" ? ["available", "selected", "unavailable", "blocked"] : ["available", "held", "booked", "blocked"];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3 text-[10px] font-bold text-gray-500" aria-hidden="true">
        {legend.map((key) => (
          <span key={key} className="inline-flex items-center gap-1.5">
            <span className={`w-3.5 h-3.5 rounded border ${SEAT_STYLE[key]}`} />
            {humanizeLabel(key)}
          </span>
        ))}
      </div>
      <div className="rounded-2xl border border-gray-100 dark:border-slate-800 p-3 sm:p-4 bg-gray-50/60 dark:bg-slate-900/40 overflow-x-auto">
        <div className="flex justify-end mb-2 pr-1 text-[10px] font-black uppercase tracking-wider text-gray-400">Driver ▸</div>
        <div
          className="grid gap-1.5 sm:gap-2 mx-auto"
          style={{ gridTemplateColumns: `repeat(${Math.max(1, columns)}, minmax(2.25rem, 2.75rem))`, width: "max-content" }}
          role="group"
          aria-label="Seat plan"
        >
          {seats.map((seat) => {
            const isPicked = picked.has(seat.seatNo);
            const state = isPicked ? "selected" : seat.status;
            const selectable = mode === "select" && (seat.status === "available" || isPicked);
            const full = mode === "select" && !isPicked && max !== undefined && picked.size >= max;
            return (
              <button
                key={seat.seatNo}
                type="button"
                disabled={!selectable || full || !onToggle}
                onClick={() => onToggle?.(seat.seatNo)}
                aria-pressed={mode === "select" ? isPicked : undefined}
                aria-label={`Seat ${seat.seatNo}, ${statusLabel(state)}${seat.bookingReference ? `, ${seat.bookingReference}` : ""}`}
                title={seat.bookingReference ? `${seat.seatNo} · ${seat.bookingReference}` : `Seat ${seat.seatNo}`}
                style={{ gridRow: seat.row + 1, gridColumn: seat.col + 1 }}
                className={`h-10 sm:h-11 rounded-lg border text-[11px] font-black transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F28C28]/60 disabled:cursor-not-allowed ${
                  seat.kind === "sleeper" ? "h-14 sm:h-16" : ""
                } ${SEAT_STYLE[state] ?? SEAT_STYLE.unavailable} ${full && seat.status === "available" ? "opacity-50" : ""}`}
              >
                {seat.seatNo}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/** Label + value row used on detail cards. */
export const InfoRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex items-start justify-between gap-3 py-2 border-b border-gray-50 dark:border-slate-800/70 last:border-0 text-xs">
    <span className="text-gray-500 font-bold shrink-0">{label}</span>
    <span className="text-right font-semibold text-[#0B192C] dark:text-gray-100 min-w-0 break-words">{children}</span>
  </div>
);

/** Countdown to a hold's expiry, e.g. "9:41". */
export function useCountdown(until?: string | null): number {
  const [left, setLeft] = useState(() => (until ? new Date(until).getTime() - Date.now() : 0));
  useEffect(() => {
    if (!until) return;
    const tick = () => setLeft(new Date(until).getTime() - Date.now());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [until]);
  return Math.max(0, left);
}
export const mmss = (ms: number) => `${Math.floor(ms / 60_000)}:${String(Math.floor((ms % 60_000) / 1000)).padStart(2, "0")}`;
