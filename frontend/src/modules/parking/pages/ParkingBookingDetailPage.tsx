import React, { useCallback, useEffect, useState } from "react";
import {
  useParams,
  useSearchParams,
  useNavigate,
  Link,
} from "react-router-dom";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  Navigation,
  AlertCircle,
  Loader2,
  XCircle,
  MapPin,
  Phone,
  Info,
  Star,
} from "lucide-react";
import { getErrorMessage } from "../../../lib/api";
import { parkingBookingService } from "../services/parking.service";
import type {
  ParkingBooking,
  ParkingLocation,
  ParkingPass,
  ParkingRefundQuote,
} from "../types/parking.types";
import {
  formatCurrency,
  formatDateTime,
  formatDuration,
  vehicleLabel,
} from "../utils/parkingFormat";
import ParkingQrTicket from "../components/ParkingQrTicket";
import ParkingStatusBadge from "../components/ParkingStatusBadge";

export const ParkingBookingDetailPage: React.FC = () => {
  const { bookingReference, id: legacyId } = useParams<{
    bookingReference?: string;
    id?: string;
  }>();
  const id = bookingReference || legacyId;
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const justBooked = searchParams.get("justBooked") === "1";

  const [booking, setBooking] = useState<ParkingBooking | null>(null);
  const [pass, setPass] = useState<ParkingPass | null>(null);
  const [refund, setRefund] = useState<ParkingRefundQuote | null>(null);

  const [loading, setLoading] = useState(true);
  const [qrLoading, setQrLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showCancel, setShowCancel] = useState(false);

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [reviewSaved, setReviewSaved] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await parkingBookingService.get(id);
      if (res.data?.success) {
        setBooking(res.data.data.booking);
        setPass(res.data.data.pass);
      }
    } catch (err) {
      setError(getErrorMessage(err, "Could not load this booking."));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const loadQr = useCallback(async () => {
    if (!id || !booking) return;
    if (booking.paymentStatus !== "paid") return;
    if (["cancelled", "expired", "no_show"].includes(booking.status)) return;

    setQrLoading(true);
    try {
      const res = await parkingBookingService.getQr(id, "png");
      if (res.data?.success) {
        setPass((prev) => ({
          ...(prev || ({} as ParkingPass)),
          ...res.data.data,
        }));
      }
    } catch {
    } finally {
      setQrLoading(false);
    }
  }, [id, booking]);

  useEffect(() => {
    if (booking && !pass?.image) loadQr();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking]);

  const openCancel = async () => {
    if (!id) return;
    try {
      const res = await parkingBookingService.previewRefund(id);
      if (res.data?.success) setRefund(res.data.data);
    } catch {
      setRefund(null);
    }
    setShowCancel(true);
  };

  const handleCancel = async () => {
    if (!id || cancelling) return;
    setCancelling(true);
    try {
      const res = await parkingBookingService.cancel(
        id,
        "Cancelled by visitor",
      );
      if (res.data?.success) {
        setNotice(res.data.message);
        setShowCancel(false);
        await load();
      } else {
        setError(res.data?.message || "Could not cancel.");
      }
    } catch (err) {
      setError(getErrorMessage(err, "Could not cancel this booking."));
    } finally {
      setCancelling(false);
    }
  };

  const handleReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !rating) return;
    try {
      const res = await parkingBookingService.review(id, { rating, comment });
      if (res.data?.success) setReviewSaved(true);
      else setError(res.data?.message || "Could not save your review.");
    } catch (err) {
      setError(getErrorMessage(err, "Could not save your review."));
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 pt-10 pb-20 space-y-4">
        <div className="h-24 bg-gray-100 dark:bg-slate-800 animate-pulse rounded-[24px]" />
        <div className="h-96 bg-gray-100 dark:bg-slate-800 animate-pulse rounded-[28px]" />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="max-w-3xl mx-auto px-4 pt-16 pb-20 text-center space-y-4">
        <AlertCircle
          size={40}
          className="text-gray-300 dark:text-slate-700 mx-auto"
        />
        <h1 className="font-extrabold text-lg text-[#0B192C] dark:text-white">
          Booking not found
        </h1>
        <p className="text-xs text-gray-400 font-medium">
          {error || "This booking is not available."}
        </p>
        <Link
          to="/parking/my-bookings"
          className="inline-block bg-[#0A4DA6] hover:bg-[#083D85] text-white text-xs font-extrabold px-5 py-2.5 rounded-full transition-all active:scale-95"
        >
          My parking bookings
        </Link>
      </div>
    );
  }

  const location =
    typeof booking.locationId === "object"
      ? (booking.locationId as ParkingLocation)
      : null;
  const canCancel = ["pending", "upcoming"].includes(booking.status);
  const canReview = booking.status === "checked_out" && !reviewSaved;

  return (
    <div className="pb-16 lg:pb-24 pt-8 sm:pt-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-5">
        {justBooked && booking.paymentStatus === "paid" && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 rounded-[24px] px-5 py-4"
          >
            <CheckCircle2
              size={20}
              className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5 stroke-[2.5]"
            />
            <div className="space-y-0.5">
              <h2 className="font-extrabold text-sm text-emerald-900 dark:text-emerald-200">
                Your parking is confirmed
              </h2>
              <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300/90 leading-relaxed">
                Booking {booking.bookingReference}. Show the QR pass below at
                the gate for entry and exit.
              </p>
            </div>
          </motion.div>
        )}

        {notice && (
          <div className="flex items-start gap-2.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 text-[#0A4DA6] dark:text-blue-300 rounded-2xl px-4 py-3">
            <Info size={15} className="shrink-0 mt-0.5 stroke-[2.5]" />
            <p className="text-xs font-semibold">{notice}</p>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 rounded-2xl px-4 py-3">
            <AlertCircle size={15} className="shrink-0 mt-0.5 stroke-[2.5]" />
            <p className="text-xs font-semibold">{error}</p>
          </div>
        )}

        <div className="grid lg:grid-cols-5 gap-5">
          <div className="lg:col-span-2 order-1">
            {booking.paymentStatus === "paid" &&
            !["cancelled", "expired", "no_show"].includes(booking.status) ? (
              qrLoading && !pass?.image ? (
                <div className="h-[32rem] bg-gray-100 dark:bg-slate-800 animate-pulse rounded-[28px]" />
              ) : pass ? (
                <ParkingQrTicket
                  booking={booking}
                  pass={pass}
                  locationName={location?.name}
                />
              ) : null
            ) : (
              <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-8 text-center space-y-2 shadow-sm">
                <XCircle
                  size={32}
                  className="text-gray-300 dark:text-slate-700 mx-auto"
                />
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400">
                  {booking.paymentStatus !== "paid"
                    ? "A pass is issued once payment is complete."
                    : "This booking no longer has an active pass."}
                </p>
              </div>
            )}
          </div>

          <div className="lg:col-span-3 order-2 space-y-4">
            <section className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] p-5 space-y-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <h1 className="font-extrabold text-base text-[#0B192C] dark:text-white line-clamp-2">
                    {location?.name || "Parking booking"}
                  </h1>
                  {location?.address && (
                    <p className="inline-flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400 font-medium">
                      <MapPin size={12} className="shrink-0 stroke-[2.5]" />
                      {[location.address.line1, location.address.city]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  )}
                </div>
                <ParkingStatusBadge status={booking.status} size="lg" />
              </div>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 pt-1">
                {[
                  ["Reference", booking.bookingReference],
                  [
                    "Vehicle",
                    `${booking.vehicleNumber} · ${vehicleLabel(booking.vehicleType)}`,
                  ],
                  ["Selected check-in", formatDateTime(booking.entryAt)],
                  ["Selected check-out", formatDateTime(booking.exitAt)],
                  [
                    "Actual check-in",
                    booking.checkedInAt
                      ? formatDateTime(booking.checkedInAt)
                      : "Pending gate scan",
                  ],
                  [
                    "Actual check-out",
                    booking.checkedOutAt
                      ? formatDateTime(booking.checkedOutAt)
                      : "Pending gate scan",
                  ],
                  ["Bay", booking.assignedSlotNumber || "Assigned on arrival"],
                  [
                    "Actual stay",
                    formatDuration(booking.actualDurationMinutes),
                  ],
                ].map(([label, value]) => (
                  <div key={label} className="pt-2 space-y-0.5">
                    <dt className="text-[9px] tracking-wider font-bold text-gray-400">
                      {label}
                    </dt>
                    <dd className="text-[11px] font-bold text-slate-700 dark:text-gray-200 break-words">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>

            <section className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] p-5 space-y-2.5 shadow-sm">
              <h2 className="font-extrabold text-sm text-[#0B192C] dark:text-white">
                Payment
              </h2>

              {[
                ["Parking charges", booking.pricing.durationAmount],
                ["Base fee", booking.pricing.baseFee],
                [
                  `GST (${booking.pricing.taxPercent}%)`,
                  booking.pricing.taxAmount,
                ],
                ...(booking.pricing.overstayAmount > 0
                  ? [
                      ["Overstay", booking.pricing.overstayAmount] as [
                        string,
                        number,
                      ],
                    ]
                  : []),
                ...(booking.pricing.refundAmount > 0
                  ? [
                      ["Refunded", -booking.pricing.refundAmount] as [
                        string,
                        number,
                      ],
                    ]
                  : []),
              ]
                .filter(([, v]) => v !== 0)
                .map(([label, value]) => (
                  <div
                    key={label as string}
                    className="flex justify-between text-[11px] font-semibold"
                  >
                    <span className="text-gray-500 dark:text-gray-400">
                      {label}
                    </span>
                    <span
                      className={
                        Number(value) < 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-slate-700 dark:text-gray-200"
                      }
                    >
                      {formatCurrency(Math.abs(Number(value)))}
                    </span>
                  </div>
                ))}

              <div className="flex justify-between items-center pt-2.5">
                <span className="text-xs font-black text-[#0B192C] dark:text-white">
                  Paid
                </span>
                <span className="text-base font-black text-[#0A4DA6] dark:text-blue-300">
                  {formatCurrency(booking.pricing.amountPaid)}
                </span>
              </div>
            </section>

            <div className="flex flex-wrap gap-2.5">
              {location?.googleMapsUrl && (
                <a
                  href={location.googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 min-w-[10rem] bg-[#0A4DA6] hover:bg-[#083D85] text-white text-xs font-extrabold px-4 py-2.5 rounded-full shadow-md transition-all active:scale-95 inline-flex items-center justify-center gap-2"
                >
                  <Navigation size={14} className="stroke-[2.5]" />
                  Navigate
                </a>
              )}
              {location?.contactPhone && (
                <a
                  href={`tel:${location.contactPhone}`}
                  className="flex-1 min-w-[10rem] bg-white dark:bg-[#0B192C] border border-gray-200 dark:border-slate-700 hover:border-[#0A4DA6] text-slate-700 dark:text-gray-200 text-xs font-extrabold px-4 py-2.5 rounded-full transition-all active:scale-95 inline-flex items-center justify-center gap-2"
                >
                  <Phone size={14} className="stroke-[2.5]" />
                  Call parking
                </a>
              )}
              {canCancel && (
                <button
                  type="button"
                  onClick={openCancel}
                  className="flex-1 min-w-[10rem] bg-white dark:bg-[#0B192C] border border-rose-200 dark:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs font-extrabold px-4 py-2.5 rounded-full transition-all active:scale-95 inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  <XCircle size={14} className="stroke-[2.5]" />
                  Cancel booking
                </button>
              )}
            </div>

            {showCancel && (
              <motion.section
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-[24px] p-5 space-y-3 overflow-hidden"
              >
                <h3 className="font-extrabold text-sm text-rose-900 dark:text-rose-200">
                  Cancel this booking?
                </h3>

                {refund ? (
                  <p className="text-[11px] font-semibold text-rose-700 dark:text-rose-300/90 leading-relaxed">
                    {refund.refundAmount > 0
                      ? `You will be refunded ${formatCurrency(refund.refundAmount)} (${refund.percent}% of the amount paid).`
                      : "No refund is due for this cancellation."}
                    {refund.freeCancellationHours !== undefined && (
                      <span className="block mt-1 text-rose-600/80 dark:text-rose-400/70">
                        Full refund applies up to {refund.freeCancellationHours}{" "}
                        hours before entry.
                      </span>
                    )}
                  </p>
                ) : (
                  <p className="text-[11px] font-semibold text-rose-700 dark:text-rose-300/90">
                    Your bay will be released immediately.
                  </p>
                )}

                <div className="flex gap-2.5">
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={cancelling}
                    className="bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-xs font-extrabold px-5 py-2.5 rounded-full transition-all active:scale-95 cursor-pointer inline-flex items-center gap-2"
                  >
                    {cancelling && (
                      <Loader2
                        size={13}
                        className="animate-spin stroke-[2.5]"
                      />
                    )}
                    Yes, cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCancel(false)}
                    className="bg-white dark:bg-[#0B192C] border border-gray-200 dark:border-slate-700 text-slate-700 dark:text-gray-200 text-xs font-extrabold px-5 py-2.5 rounded-full transition-all active:scale-95 cursor-pointer"
                  >
                    Keep booking
                  </button>
                </div>
              </motion.section>
            )}

            {canReview && (
              <form
                onSubmit={handleReview}
                className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] p-5 space-y-3 shadow-sm"
              >
                <h2 className="font-extrabold text-sm text-[#0B192C] dark:text-white">
                  Rate this parking
                </h2>

                <div className="flex gap-1.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setRating(n)}
                      aria-label={`${n} star${n > 1 ? "s" : ""}`}
                      className="cursor-pointer transition-transform hover:scale-110 active:scale-95"
                    >
                      <Star
                        size={24}
                        className={
                          n <= rating
                            ? "fill-[#D4AF37] text-[#D4AF37]"
                            : "text-gray-300 dark:text-slate-700"
                        }
                      />
                    </button>
                  ))}
                </div>

                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  placeholder="How was the parking? Was it easy to find, secure, well-staffed?"
                  className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-medium text-[#0B192C] dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/30 resize-none"
                />

                <button
                  type="submit"
                  disabled={!rating}
                  className="bg-[#0A4DA6] hover:bg-[#083D85] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-extrabold px-5 py-2.5 rounded-full transition-all active:scale-95 cursor-pointer"
                >
                  Submit review
                </button>
              </form>
            )}

            {reviewSaved && (
              <p className="flex items-center gap-2 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 rounded-2xl px-4 py-3">
                <CheckCircle2 size={15} className="stroke-[2.5]" />
                Thank you for your feedback.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ParkingBookingDetailPage;
