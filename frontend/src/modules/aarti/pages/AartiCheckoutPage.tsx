import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  AlertCircle,
  CalendarClock,
  Flame,
  Loader2,
  MapPin,
  ShieldCheck,
  Ticket,
  Users,
} from "lucide-react";
import { openRazorpayCheckout } from "../../../lib/razorpay";
import { useAuth } from "../../../contexts/AuthContext";
import { aartiBookingService } from "../services/aarti.service";
import type { AartiQuote } from "../types/aarti.types";
import { formatCurrency, formatDateTime } from "../utils/aartiFormat";

interface CheckoutState {
  sessionId: string;
  sessionName: string;
  sessionSlug: string;
  passTypeId: string;
  passTypeName?: string;
  sessionDate: string;
  passCount: number;
  donationAmount: number;
  quote: AartiQuote;
  coverImage?: string;
  venueLabel?: string;
  kindLabel?: string;
  policy?: { freeCancellationHours: number; gateOpensBeforeMinutes: number };
}

/**
 * The shared `getErrorMessage` drops `err.message` for anything that is not an
 * Axios error, which turns a cancelled Razorpay modal into a generic "we could
 * not complete your booking". Payment failures are exactly where the real
 * reason matters, so plain Errors keep their message here.
 */
const checkoutError = (err: unknown): string => {
  if (axios.isAxiosError(err)) {
    const message = err.response?.data?.message ?? err.message;
    return Array.isArray(message) ? message.join(" · ") : String(message);
  }
  if (err instanceof Error && err.message) return err.message;
  return "We could not complete your booking. Please try again.";
};

const inputClass =
  "w-full rounded-xl border border-orange-200 bg-gray-50/70 px-4 py-3 text-sm font-semibold text-[#0B192C] placeholder:text-gray-400 placeholder:font-medium transition-all focus:border-[#0A4DA6] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white";
const labelClass =
  "mb-1.5 block px-0.5 text-[11px] font-bold tracking-wide text-slate-500 dark:text-slate-400";
const cardClass =
  "rounded-[28px] border border-orange-200 bg-white p-5 shadow-sm shadow-slate-900/[0.03] sm:p-6 dark:border-slate-800 dark:bg-[#0B192C]";

const StepHeading: React.FC<{
  step: number;
  title: string;
  hint?: string;
}> = ({ step, title, hint }) => (
  <div className="flex items-start gap-3.5">
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#0A4DA6]/15 bg-[#0A4DA6]/10 text-xs font-black text-[#0A4DA6]">
      {step}
    </span>
    <div className="min-w-0">
      <h2 className="text-base font-extrabold text-[#0B192C] dark:text-white">
        {title}
      </h2>
      {hint ? (
        <p className="mt-0.5 text-xs font-medium leading-relaxed text-slate-500 dark:text-slate-400">
          {hint}
        </p>
      ) : null}
    </div>
  </div>
);

export const AartiCheckoutPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const state = location.state as CheckoutState | null;

  const [contactName, setContactName] = useState(user?.name ?? "");
  const [contactPhone, setContactPhone] = useState(user?.phone ?? "");
  const [contactEmail, setContactEmail] = useState(user?.email ?? "");
  const [sankalpName, setSankalpName] = useState("");
  const [sankalpGotra, setSankalpGotra] = useState("");
  const [devotees, setDevotees] = useState<string[]>([]);
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!state) navigate("/aarti", { replace: true });
  }, [state, navigate]);

  useEffect(() => {
    if (state) setDevotees(Array.from({ length: state.passCount }, () => ""));
  }, [state]);

  const quote = state?.quote;
  const total = useMemo(() => quote?.totalAmount ?? 0, [quote]);

  if (!state || !quote) return null;

  const pay = async () => {
    setSubmitting(true);
    setError("");
    try {
      const created = await aartiBookingService.create({
        sessionId: state.sessionId,
        passTypeId: state.passTypeId,
        sessionDate: state.sessionDate,
        passCount: state.passCount,
        donationAmount: state.donationAmount || undefined,
        devotees: devotees
          .map((name) => name.trim())
          .filter(Boolean)
          .map((name) => ({ name })),
        sankalpName: sankalpName.trim() || undefined,
        sankalpGotra: sankalpGotra.trim() || undefined,
        contactName: contactName.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
        contactEmail: contactEmail.trim() || undefined,
      });

      const bookingId = created.data?.data?.booking?._id;
      if (!bookingId)
        throw new Error(
          "The ashram held your seats but did not return a booking reference. Check My Aarti Bookings before paying again.",
        );

      const order = await aartiBookingService.createPaymentOrder(bookingId);

      if (order.data?.demo) {
        await aartiBookingService.confirmPayment(bookingId, { method: "demo" });
      } else {
        const result = await openRazorpayCheckout(order.data.data, {
          name: contactName || user?.name,
          email: contactEmail || user?.email,
          contact: contactPhone || user?.phone,
        });
        await aartiBookingService.confirmPayment(bookingId, {
          razorpay_order_id: result.razorpay_order_id,
          razorpay_payment_id: result.razorpay_payment_id,
          razorpay_signature: result.razorpay_signature,
        });
      }

      navigate(`/aarti/booking/${bookingId}`, { replace: true });
    } catch (err) {
      setError(checkoutError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const multipleDevotees = devotees.length > 1;

  return (
    <div className="bg-[#F4F7FB] py-8 sm:py-10 lg:py-12 dark:bg-[#070F1B]">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <header className="mb-6 rounded-[28px] border border-orange-200 bg-white px-5 py-6 shadow-sm shadow-slate-900/[0.03] sm:px-7 sm:py-7 dark:border-slate-800 dark:bg-[#0B192C]">
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#0A4DA6]/10 text-[#0A4DA6]">
              <Flame size={24} className="stroke-[2.3]" />
            </span>
            <div className="min-w-0">
              <h1 className="text-2xl font-black leading-tight text-[#0B192C] sm:text-3xl dark:text-white">
                Confirm your aarti pass
              </h1>
              <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                Review your details and complete payment. Your QR pass is issued
                as soon as payment clears.
              </p>
            </div>
          </div>
        </header>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_400px] xl:gap-8 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-4 min-w-0">
          <section className={cardClass}>
            <StepHeading
              step={1}
              title="Contact for this booking"
              hint="Where the ashram reaches you about this aarti."
            />
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label htmlFor="aarti-contact-name" className={labelClass}>
                  Name
                </label>
                <input
                  id="aarti-contact-name"
                  value={contactName}
                  onChange={(event) => setContactName(event.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="aarti-contact-phone" className={labelClass}>
                  Phone
                </label>
                <input
                  id="aarti-contact-phone"
                  value={contactPhone}
                  onChange={(event) => setContactPhone(event.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="sm:col-span-2 lg:col-span-1">
                <label htmlFor="aarti-contact-email" className={labelClass}>
                  Email
                </label>
                <input
                  id="aarti-contact-email"
                  type="email"
                  value={contactEmail}
                  onChange={(event) => setContactEmail(event.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
          </section>

          <section className={cardClass}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <StepHeading
                step={2}
                title="Devotees attending"
                hint="Optional — some ashrams call out names during the sankalp."
              />
              <span className="inline-flex items-center gap-1.5 shrink-0 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-full px-2.5 py-1 text-[10px] font-bold text-gray-500 dark:text-gray-400">
                <Users size={11} className="stroke-[2.5]" />
                {state.passCount} pass{state.passCount === 1 ? "" : "es"}
              </span>
            </div>

            <div
              className={`mt-4 grid gap-3 ${multipleDevotees ? "sm:grid-cols-2" : ""}`}
            >
              {devotees.map((name, index) => (
                <div key={`devotee-${index}`}>
                  <label
                    htmlFor={`aarti-devotee-${index}`}
                    className={labelClass}
                  >
                    Devotee {index + 1}
                  </label>
                  <input
                    id={`aarti-devotee-${index}`}
                    value={name}
                    onChange={(event) =>
                      setDevotees((current) =>
                        current.map((item, position) =>
                          position === index ? event.target.value : item,
                        ),
                      )
                    }
                    placeholder="Full name as it should be read out"
                    className={inputClass}
                  />
                </div>
              ))}
            </div>
          </section>

          {state.donationAmount ? (
            <section className={cardClass}>
              <StepHeading
                step={3}
                title="Sankalp details"
                hint={`Your ${formatCurrency(state.donationAmount)} offering is made in this name.`}
              />
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="aarti-sankalp-name" className={labelClass}>
                    Sankalp name
                  </label>
                  <input
                    id="aarti-sankalp-name"
                    value={sankalpName}
                    onChange={(event) => setSankalpName(event.target.value)}
                    placeholder="Name for the sankalp"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="aarti-sankalp-gotra" className={labelClass}>
                    Gotra
                  </label>
                  <input
                    id="aarti-sankalp-gotra"
                    value={sankalpGotra}
                    onChange={(event) => setSankalpGotra(event.target.value)}
                    placeholder="Optional"
                    className={inputClass}
                  />
                </div>
              </div>
            </section>
          ) : null}
        </div>

        <aside className="overflow-hidden rounded-[28px] border border-orange-200 bg-white shadow-lg shadow-[#0B192C]/5 lg:sticky lg:top-24 dark:border-slate-800 dark:bg-[#0B192C]">
          <div className="border-b border-orange-100 p-5 dark:border-slate-800">
            <p className="mb-4 text-xs font-black uppercase tracking-wider text-slate-400">
              Booking summary
            </p>
            <div className="flex gap-3.5">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gray-100 dark:bg-slate-900">
              {state.coverImage ? (
                <img
                  src={state.coverImage}
                  alt={state.sessionName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Flame size={20} className="text-gray-300 dark:text-slate-700" />
              )}
            </div>
            <div className="min-w-0 space-y-1">
              {state.kindLabel ? (
                <span className="inline-block bg-[#0A4DA6]/10 text-[#0A4DA6] text-[9px] font-black tracking-wider px-2 py-0.5 rounded-full">
                  {state.kindLabel}
                </span>
              ) : null}
              <h2 className="line-clamp-2 text-base font-extrabold leading-snug text-[#0B192C] dark:text-white">
                {state.sessionName}
              </h2>
              {state.venueLabel ? (
                <p className="flex items-center gap-1 text-[10px] font-medium text-gray-400 truncate">
                  <MapPin size={10} className="shrink-0 stroke-[2.5]" />
                  <span className="truncate">{state.venueLabel}</span>
                </p>
              ) : null}
            </div>
            </div>
          </div>

          <div className="space-y-4 p-5">
            <div className="flex items-start gap-2 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl px-3 py-2.5">
              <CalendarClock
                size={14}
                className="shrink-0 mt-0.5 text-[#0A4DA6] stroke-[2.5]"
              />
              <div className="min-w-0">
                <p className="text-[11px] font-extrabold text-[#0B192C] dark:text-white">
                  {formatDateTime(quote.startsAt)}
                </p>
                {state.policy ? (
                  <p className="text-[10px] font-medium text-gray-400">
                    Gate opens {state.policy.gateOpensBeforeMinutes} min earlier
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex items-center gap-2 text-[11px] font-bold text-gray-500 dark:text-gray-400">
              <Ticket size={13} className="shrink-0 text-[#0A4DA6] stroke-[2.5]" />
              {state.passTypeName}
            </div>

            <div className="space-y-1.5 border-t border-gray-100 dark:border-slate-800 pt-3">
              <div className="flex justify-between gap-2 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                <span>
                  {formatCurrency(quote.unitPrice)} × {quote.passCount} pass
                  {quote.passCount === 1 ? "" : "es"}
                </span>
                <span className="shrink-0">{formatCurrency(quote.subtotal)}</span>
              </div>
              {quote.taxAmount ? (
                <div className="flex justify-between gap-2 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                  <span>Tax ({quote.taxPercent}%)</span>
                  <span className="shrink-0">
                    {formatCurrency(quote.taxAmount)}
                  </span>
                </div>
              ) : null}
              {quote.donationAmount ? (
                <div className="flex justify-between gap-2 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                  <span>Sankalp donation</span>
                  <span className="shrink-0">
                    {formatCurrency(quote.donationAmount)}
                  </span>
                </div>
              ) : null}
              <div className="flex justify-between items-center pt-2.5 mt-1 border-t border-gray-100 dark:border-slate-800">
                <span className="text-[10px] tracking-wider font-bold text-gray-400">
                  TOTAL
                </span>
                <span className="text-xl font-black text-[#0B192C] dark:text-white">
                  {formatCurrency(total)}
                </span>
              </div>
            </div>

            <label className="flex items-start gap-2.5 cursor-pointer bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl px-3 py-2.5">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(event) => setAgreed(event.target.checked)}
                className="mt-0.5 w-3.5 h-3.5 shrink-0 accent-[#0A4DA6] cursor-pointer"
              />
              <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 leading-relaxed">
                I accept the aarti terms, the dress code, and the ashram&apos;s
                cancellation policy.
              </span>
            </label>

            {error ? (
              <div className="flex items-start gap-2 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-2xl px-3 py-2.5">
                <AlertCircle
                  size={13}
                  className="mt-0.5 shrink-0 text-rose-600 stroke-[2.5]"
                />
                <p className="text-[11px] font-semibold text-rose-700 dark:text-rose-300 leading-relaxed">
                  {error}
                </p>
              </div>
            ) : null}

            <button
              type="button"
              onClick={pay}
              disabled={submitting || !agreed}
              className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-[#0A4DA6] px-5 py-3.5 text-sm font-extrabold text-white shadow-md transition-all hover:bg-[#083D85] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 size={14} className="animate-spin stroke-[2.5]" />
              ) : null}
              {submitting ? "Confirming…" : `Pay ${formatCurrency(total)}`}
            </button>

            <p className="flex items-center justify-center gap-1.5 text-[10px] font-bold text-gray-400">
              <ShieldCheck size={11} className="stroke-[2.5]" /> Secured by
              Razorpay
            </p>

            {state.policy ? (
              <p className="text-center text-[10px] font-medium text-gray-400 leading-relaxed">
                Free cancellation up to {state.policy.freeCancellationHours}h
                before the aarti.
              </p>
            ) : null}
          </div>
        </aside>
        </div>
      </div>
    </div>
  );
};

export default AartiCheckoutPage;
