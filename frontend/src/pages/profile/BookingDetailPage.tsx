import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  MapPin,
  BedDouble,
  KeyRound,
  Mail,
  ShieldCheck,
  Download,
  XCircle,
  Clock,
  AlertCircle,
  Loader2,
  Utensils,
  HelpCircle,
} from "lucide-react";
import { EnterpriseStatusBadge } from "../../admin/shared";
import { bookingService } from "../../services";
import { getErrorMessage } from "../../lib/api";
import {
  formatCurrency,
  formatDateIN,
  formatDateTimeIN,
} from "../../utils/format";
import { SUPPORT_CONFIG } from "../../constants/support";
import { useNotifications } from "../../contexts/NotificationContext";

interface BookingDetailsData {
  _id: string;
  bookingId: string;
  reservationNumber?: string;
  status: string;
  paymentStatus: string;
  paymentMode?: string;
  checkInDate: string;
  checkOutDate: string;
  guestsCount: number;
  roomsBookedCount: number;
  assignedRoomNumber?: string;
  checkInCode?: string;
  specialRequests?: string;
  ashramId?: {
    _id: string;
    name: string;
    address?: {
      street?: string;
      city?: string;
      state?: string;
      pincode?: string;
    };
    rules?: string[];
    images?: string[];
    contactPhone?: string;
    contactEmail?: string;
  };
  roomId?: {
    _id: string;
    name: string;
    acType?: string;
    type?: string;
  };
  customerId?: {
    _id: string;
    name?: string;
    email?: string;
    phone?: string;
  };
  pricing?: {
    basePrice?: number;
    servicesPrice?: number;
    donationAmount?: number;
    gstAmount?: number;
    platformFee?: number;
    totalAmount?: number;
    amountPaid?: number;
    totalSavings?: number;
  };
  services?: {
    selectedAddOns?: Array<{
      serviceId?: string;
      name: string;
      price: number;
      quantity: number;
      totalPrice: number;
    }>;
  };
  history?: Array<{
    status: string;
    updatedBy?: string;
    timestamp?: string;
  }>;
  cancellation?: {
    reason?: string;
    date?: string;
    refundAmount?: number;
    refundTransactionId?: string;
  };
}

const isPaymentComplete = (paymentStatus?: string): boolean =>
  ["fully_paid", "paid", "success", "completed"].includes(
    String(paymentStatus ?? "").trim().toLowerCase(),
  );

const isStayConfirmed = (booking: BookingDetailsData): boolean =>
  isPaymentComplete(booking.paymentStatus) &&
  ["confirmed", "checked_in", "checked_out", "completed"].includes(
    String(booking.status ?? "").trim().toLowerCase(),
  );

export const BookingDetailPage: React.FC = () => {
  // Public urls carry the booking reference (TRV-…); the API accepts either.
  const { bookingReference, id } = useParams<{
    bookingReference?: string;
    id?: string;
  }>();
  const bookingKey = bookingReference || id;
  const navigate = useNavigate();
  const { addNotification, confirmAction } = useNotifications();

  const [booking, setBooking] = useState<BookingDetailsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [cancelling, setCancelling] = useState<boolean>(false);
  const [cancelError, setCancelError] = useState<string>("");
  const [showReceiptModal, setShowReceiptModal] = useState<boolean>(false);
  const [isDownloadingReceipt, setIsDownloadingReceipt] = useState<boolean>(false);

  const fetchBookingDetails = async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const res = await bookingService.getById(bookingKey);
      if (res.data?.success && res.data?.data) {
        setBooking(res.data.data);
      } else {
        setError(res.data?.message || "Booking details not found");
      }
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load booking details"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookingDetails();
  }, [bookingKey]);

  const handleCancelBooking = async () => {
    if (!booking || cancelling) return;
    const confirmCancel = await confirmAction({
      title: "Cancel this stay?",
      message: `Booking ${booking.bookingId} will be cancelled and its inventory released back to the ashram.`,
      confirmLabel: "Cancel Stay",
      tone: "danger",
    });
    if (!confirmCancel) return;

    setCancelling(true);
    setCancelError("");
    try {
      const res = await bookingService.cancel(
        booking._id,
        "Cancelled from Guest Booking Details",
      );
      if (res.data?.success) {
        await fetchBookingDetails();
        addNotification("Booking Cancelled", `${booking.bookingId} was cancelled successfully.`, "success");
      } else {
        setCancelError(res.data?.message || "Could not cancel booking.");
        addNotification("Cancellation Failed", res.data?.message || "Could not cancel booking.", "error");
      }
    } catch (err) {
      const message = getErrorMessage(err, "Error cancelling booking.");
      setCancelError(message);
      addNotification("Cancellation Failed", message, "error");
    } finally {
      setCancelling(false);
    }
  };

  const handlePrintReceipt = () => {
    setShowReceiptModal(true);
  };

  const handleDownloadReceiptCanvas = async () => {
    if (!booking || isDownloadingReceipt) return;
    setIsDownloadingReceipt(true);

    try {
      const scale = 2;
      const width = 450;
      const height = 680;
      const canvas = document.createElement("canvas");
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext("2d");

      if (!ctx) return;
      ctx.scale(scale, scale);

      const drawRoundedRect = (
        x: number,
        y: number,
        w: number,
        h: number,
        r: number | [number, number, number, number]
      ) => {
        if (typeof ctx.roundRect === "function") {
          ctx.beginPath();
          ctx.roundRect(x, y, w, h, r);
        } else {
          const [tl, tr, br, bl] = typeof r === "number" ? [r, r, r, r] : r;
          ctx.beginPath();
          ctx.moveTo(x + tl, y);
          ctx.lineTo(x + w - tr, y);
          ctx.quadraticCurveTo(x + w, y, x + w, y + tr);
          ctx.lineTo(x + w, y + h - br);
          ctx.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
          ctx.lineTo(x + bl, y + h);
          ctx.quadraticCurveTo(x, y + h, x, y + h - bl);
          ctx.lineTo(x, y + tl);
          ctx.quadraticCurveTo(x, y, x + tl, y);
          ctx.closePath();
        }
      };

      const logoImg = await new Promise<HTMLImageElement | null>((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = "/logo/logo.png";
      });

      drawRoundedRect(0, 0, width, height, 24);
      ctx.fillStyle = "#FFFFFF";
      ctx.fill();
      ctx.strokeStyle = "#E5E7EB";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      const headerH = 80;
      ctx.save();
      drawRoundedRect(0, 0, width, headerH, [24, 24, 0, 0]);
      ctx.clip();
      const headerGrad = ctx.createLinearGradient(0, 0, width, 0);
      headerGrad.addColorStop(0, "#0B192C");
      headerGrad.addColorStop(0.5, "#0A4DA6");
      headerGrad.addColorStop(1, "#0B192C");
      ctx.fillStyle = headerGrad;
      ctx.fillRect(0, 0, width, headerH);

      let textY = 28;
      if (logoImg && logoImg.naturalWidth > 0) {
        const logoH = 24;
        const logoW = (logoImg.naturalWidth / logoImg.naturalHeight) * logoH;
        ctx.drawImage(logoImg, (width - logoW) / 2, 10, logoW, logoH);
        textY = 46;
      }

      ctx.textAlign = "center";
      ctx.fillStyle = "#DBEAFE";
      ctx.font = "900 9.5px sans-serif";
      ctx.fillText("TIRVONA SACRED STAYS", width / 2, textY);

      ctx.fillStyle = "#FFFFFF";
      ctx.font = "800 14px sans-serif";
      ctx.fillText(
        isPaymentComplete(booking.paymentStatus)
          ? "OFFICIAL ACCOMMODATION RECEIPT"
          : "BOOKING & PAYMENT SUMMARY",
        width / 2,
        textY + 18,
      );
      ctx.restore();

      const ashramName = booking.ashramId?.name || "Ashram Stay";
      const roomName = booking.roomId?.name || booking.roomId?.type || "Standard Room";

      ctx.textAlign = "left";
      ctx.fillStyle = "#0B192C";
      ctx.font = "900 16px sans-serif";
      ctx.fillText(ashramName, 24, 114);

      if (booking.ashramId?.address) {
        const addr = [
          booking.ashramId.address.street,
          booking.ashramId.address.city,
          booking.ashramId.address.state,
          booking.ashramId.address.pincode,
        ]
          .filter(Boolean)
          .join(", ");
        ctx.fillStyle = "#64748B";
        ctx.font = "500 10px sans-serif";
        ctx.fillText(addr, 24, 130);
      }

      drawRoundedRect(24, 146, width - 48, 56, 14);
      ctx.fillStyle = "#ECFDF5";
      ctx.fill();
      ctx.strokeStyle = "#A7F3D0";
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.textAlign = "left";
      ctx.fillStyle = "#047857";
      ctx.font = "700 9px sans-serif";
      ctx.fillText("6-DIGIT DESK CHECK-IN CODE", 40, 166);

      ctx.fillStyle = "#064E3B";
      ctx.font = "900 18px monospace";
      ctx.fillText(
        isStayConfirmed(booking)
          ? booking.checkInCode || "CONFIRMED"
          : "PAYMENT PENDING",
        40,
        190,
      );

      ctx.textAlign = "right";
      ctx.fillStyle = "#047857";
      ctx.font = "700 9px sans-serif";
      ctx.fillText("ROOM CATEGORY", width - 40, 166);
      ctx.fillStyle = "#064E3B";
      ctx.font = "800 12px sans-serif";
      ctx.fillText(roomName, width - 40, 188);

      const drawDetailRow = (l1: string, v1: string, l2: string, v2: string, y: number) => {
        ctx.textAlign = "left";
        ctx.fillStyle = "#94A3B8";
        ctx.font = "700 9px sans-serif";
        ctx.fillText(l1, 24, y);
        ctx.fillStyle = "#0B192C";
        ctx.font = "800 12px sans-serif";
        ctx.fillText(v1, 24, y + 16);

        ctx.textAlign = "left";
        ctx.fillStyle = "#94A3B8";
        ctx.font = "700 9px sans-serif";
        ctx.fillText(l2, 240, y);
        ctx.fillStyle = "#0B192C";
        ctx.font = "800 12px sans-serif";
        ctx.fillText(v2, 240, y + 16);
      };

      drawDetailRow(
        "BOOKING REFERENCE",
        booking.bookingId,
        "RESERVATION NO",
        booking.reservationNumber || booking._id.substring(0, 10),
        224
      );

      drawDetailRow(
        "CHECK-IN DATE",
        formatDateIN(booking.checkInDate),
        "CHECK-OUT DATE",
        formatDateIN(booking.checkOutDate),
        268
      );

      drawDetailRow(
        "GUESTS & ROOMS",
        `${booking.guestsCount} Guest(s) • ${booking.roomsBookedCount} Room(s)`,
        "ASSIGNED ROOM",
        booking.assignedRoomNumber || "Front Desk",
        312
      );

      ctx.save();
      ctx.strokeStyle = "#E2E8F0";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(24, 356);
      ctx.lineTo(width - 24, 356);
      ctx.stroke();
      ctx.restore();

      drawRoundedRect(24, 372, width - 48, 170, 16);
      ctx.fillStyle = "#F8FAFC";
      ctx.fill();
      ctx.strokeStyle = "#E2E8F0";
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.textAlign = "left";
      ctx.fillStyle = "#0B192C";
      ctx.font = "800 11px sans-serif";
      ctx.fillText("TARIFF & PAYMENT BREAKDOWN", 38, 394);

      const drawItem = (label: string, val: string, y: number, bold = false) => {
        ctx.textAlign = "left";
        ctx.fillStyle = bold ? "#0B192C" : "#64748B";
        ctx.font = bold ? "800 11px sans-serif" : "600 10.5px sans-serif";
        ctx.fillText(label, 38, y);

        ctx.textAlign = "right";
        ctx.fillStyle = bold ? "#0A4DA6" : "#0B192C";
        ctx.font = bold ? "900 13px sans-serif" : "700 11px sans-serif";
        ctx.fillText(val, width - 38, y);
      };

      drawItem("Base Room Charges", formatCurrency(booking.pricing?.basePrice || 0), 418);
      if (booking.pricing?.servicesPrice) {
        drawItem("Add-On Services", formatCurrency(booking.pricing.servicesPrice), 438);
      }
      if (booking.pricing?.donationAmount) {
        drawItem("Seva / Donation", formatCurrency(booking.pricing.donationAmount), 458);
      }
      drawItem("Total Amount", formatCurrency(booking.pricing?.totalAmount || 0), 484, true);
      drawItem("Amount Paid", formatCurrency(booking.pricing?.amountPaid || 0), 506);
      drawItem("Payment Status", (booking.paymentStatus || "Pending").toUpperCase(), 526);

      ctx.textAlign = "left";
      ctx.fillStyle = "#475569";
      ctx.font = "600 9.5px sans-serif";
      ctx.fillText("📞 24x7 Pilgrim Helpline: 1800-11-1363 / 112 • Support: +91 98765 43210", 24, 574);
      ctx.fillStyle = "#94A3B8";
      ctx.font = "500 9px sans-serif";
      ctx.fillText("Valid digital accommodation voucher issued under Government Digital India guidelines.", 24, 592);

      ctx.textAlign = "right";
      ctx.fillStyle = "#0A4DA6";
      ctx.font = "900 10px sans-serif";
      ctx.fillText("VERIFIED BY TIRVONA", width - 24, 620);

      const dataUrl = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `tirvona-${isPaymentComplete(booking.paymentStatus) ? "booking-receipt" : "booking-summary"}-${booking.bookingId}.png`;
      a.click();
    } catch (err) {
      console.error("Failed to generate receipt image:", err);
    } finally {
      setIsDownloadingReceipt(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <Loader2 className="animate-spin text-[#0A4DA6] mb-3" size={36} />
        <p className="text-xs font-bold text-gray-500 dark:text-gray-400">
          Loading reservation details...
        </p>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-left">
        <div className="max-w-md w-full bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-3xl p-8 shadow-xl space-y-4 text-center">
          <AlertCircle size={44} className="text-rose-500 mx-auto" />
          <h2 className="text-lg font-black text-[#0B192C] dark:text-white">
            Booking Not Found
          </h2>
          <p className="text-xs text-gray-400 font-medium">
            {error || "The requested booking could not be retrieved."}
          </p>
        </div>
      </div>
    );
  }

  const ashram = booking.ashramId;
  const room = booking.roomId;
  const pricing = booking.pricing;
  const paymentComplete = isPaymentComplete(booking.paymentStatus);
  const stayConfirmed = isStayConfirmed(booking);
  const effectiveStatus =
    booking.status === "confirmed" && !paymentComplete
      ? "pending"
      : booking.status;
  const lifecycle = (() => {
    switch (effectiveStatus) {
      case "confirmed":
        return {
          title: "Reservation Confirmed",
          detail: "Payment completed and the stay is confirmed.",
          dot: "bg-emerald-500",
        };
      case "cancelled":
        return {
          title: "Reservation Cancelled",
          detail: "This reservation has been cancelled.",
          dot: "bg-rose-500",
        };
      case "expired":
        return {
          title: "Reservation Expired",
          detail: "The payment window expired before confirmation.",
          dot: "bg-rose-500",
        };
      case "checked_in":
        return {
          title: "Guest Checked In",
          detail: "The stay is currently in progress.",
          dot: "bg-blue-500",
        };
      case "checked_out":
      case "completed":
        return {
          title: effectiveStatus === "completed" ? "Stay Completed" : "Guest Checked Out",
          detail: "The guest has completed the stay.",
          dot: "bg-blue-500",
        };
      default:
        return {
          title: "Reservation Created — Payment Pending",
          detail: `Payment status: ${booking.paymentStatus || "pending"}. The stay is not confirmed yet.`,
          dot: "bg-amber-500",
        };
    }
  })();
  const ashramImage =
    ashram?.images && ashram.images.length > 0
      ? ashram.images[0]
      : "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100%25' height='100%25' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='1.5'%3E%3Crect width='100%25' height='100%25' fill='%23f1f5f9'/%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'/%3E%3Cpath d='m21 15-5-5-11 11'/%3E%3C/svg%3E";

  const isCancellable =
    booking.status === "confirmed" || booking.status === "pending";

  return (
    <div className="min-h-screen pb-24 text-left">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-2 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black text-[#0B192C] dark:text-white">
                Booking #{booking.bookingId}
              </h1>
              <EnterpriseStatusBadge status={effectiveStatus} />
            </div>
            <p className="text-xs text-gray-400 font-semibold">
              Ref: {booking.reservationNumber || booking._id}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrintReceipt}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 text-[#0B192C] dark:text-white border border-gray-200 dark:border-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-2xs"
          >
            <Download size={14} /> {paymentComplete ? "Receipt" : "Booking Summary"}
          </button>

          {isCancellable && (
            <button
              onClick={handleCancelBooking}
              disabled={cancelling}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50 rounded-xl text-xs font-bold hover:bg-rose-100 transition-colors cursor-pointer disabled:opacity-50"
            >
              {cancelling ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <XCircle size={14} />
              )}{" "}
              Cancel Stay
            </button>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {cancelError && (
          <div className="flex items-center gap-2 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 text-rose-700 dark:text-rose-300 rounded-2xl p-4 text-xs font-semibold">
            <AlertCircle size={16} className="shrink-0" />
            <span>{cancelError}</span>
          </div>
        )}

        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-6 shadow-md flex flex-col md:flex-row gap-6 items-start">
          <img
            src={ashramImage}
            alt={ashram?.name || "Ashram"}
            className="w-full md:w-56 h-44 rounded-2xl object-cover shrink-0 border border-gray-100 dark:border-slate-800 shadow-sm"
          />

          <div className="space-y-3 flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] tracking-wider font-extrabold px-3 py-1 bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 rounded-full">
                Ashram Reservation
              </span>
              <span className="text-xs font-bold text-gray-400">
                Payment:{" "}
                <strong className="text-[#0B192C] dark:text-white capitalize">
                  {booking.paymentStatus || "Pending"}
                </strong>
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-[#0B192C] dark:text-white leading-tight">
              {ashram?.name || "Ashram Stay"}
            </h2>

            {ashram?.address && (
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium flex items-start gap-1.5">
                <MapPin size={15} className="text-[#E58C28] shrink-0 mt-0.5" />
                <span>
                  {[
                    ashram.address.street,
                    ashram.address.city,
                    ashram.address.state,
                    ashram.address.pincode,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </span>
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-2 text-xs font-semibold">
              <div className="bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 px-3.5 py-1.5 rounded-xl flex items-center gap-2">
                <BedDouble size={15} className="text-[#0A4DA6]" />
                <span>
                  <strong>Category:</strong>{" "}
                  {room?.name || room?.type || "Standard Room"}
                </span>
              </div>

              {stayConfirmed && booking.assignedRoomNumber ? (
                <div className="bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-900/50 text-purple-700 dark:text-purple-300 px-3.5 py-1.5 rounded-xl flex items-center gap-2 font-extrabold">
                  <BedDouble size={15} />
                  <span>Assigned Room: {booking.assignedRoomNumber}</span>
                </div>
              ) : (
                <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/40 text-amber-800 dark:text-amber-300 px-3.5 py-1.5 rounded-xl flex items-center gap-2 text-xs">
                  <Clock size={14} />
                  <span>
                    {stayConfirmed
                      ? "Room Number: Assigned at Front Desk"
                      : "Room assignment available after payment confirmation"}
                  </span>
                </div>
              )}

              {stayConfirmed && booking.checkInCode && (
                <div className="bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-300 px-3.5 py-1.5 rounded-xl flex items-center gap-2 font-black">
                  <KeyRound size={15} />
                  <span>Check-in Code: {booking.checkInCode}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-6 shadow-sm space-y-5">
            <h3 className="font-black text-sm text-[#0B192C] dark:text-white tracking-wide border-b border-gray-100 dark:border-slate-800 pb-3">
              Stay Schedule & Guests
            </h3>

            <div className="grid grid-cols-2 gap-4 bg-gray-50 dark:bg-slate-900/70 p-4 rounded-2xl border border-gray-100 dark:border-slate-800">
              <div>
                <span className="text-[10px] text-gray-400 font-bold block">
                  Check-In
                </span>
                <span className="text-sm font-extrabold text-[#0B192C] dark:text-white block mt-0.5">
                  {formatDateIN(booking.checkInDate)}
                </span>
                <span className="text-[10px] text-gray-400 font-medium">
                  Standard 12:00 PM
                </span>
              </div>

              <div>
                <span className="text-[10px] text-gray-400 font-bold block">
                  Check-Out
                </span>
                <span className="text-sm font-extrabold text-[#0B192C] dark:text-white block mt-0.5">
                  {formatDateIN(booking.checkOutDate)}
                </span>
                <span className="text-[10px] text-gray-400 font-medium">
                  Standard 11:00 AM
                </span>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-gray-50 dark:border-slate-850">
                <span className="text-gray-400 font-medium">Total Guests:</span>
                <span className="font-extrabold text-[#0B192C] dark:text-white">
                  {booking.guestsCount} Guest(s)
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-50 dark:border-slate-850">
                <span className="text-gray-400 font-medium">
                  Rooms Reserved:
                </span>
                <span className="font-extrabold text-[#0B192C] dark:text-white">
                  {booking.roomsBookedCount} Room(s)
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-50 dark:border-slate-850">
                <span className="text-gray-400 font-medium">Payment Mode:</span>
                <span className="font-extrabold text-[#0B192C] dark:text-white">
                  {booking.paymentMode || "Pay at Ashram"}
                </span>
              </div>
              {booking.specialRequests && (
                <div className="pt-2">
                  <span className="text-gray-400 font-medium block mb-1">
                    Special Requests / Notes:
                  </span>
                  <p className="p-3 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-xl text-amber-900 dark:text-amber-200 font-medium italic">
                    "{booking.specialRequests}"
                  </p>
                </div>
              )}
            </div>

            {booking.services?.selectedAddOns &&
              booking.services.selectedAddOns.length > 0 && (
                <div className="pt-2 space-y-2">
                  <h4 className="font-extrabold text-xs text-[#0B192C] dark:text-white flex items-center gap-1.5">
                    <Utensils size={14} className="text-[#0A4DA6]" /> Booked
                    Add-On Services
                  </h4>
                  <div className="space-y-1.5">
                    {booking.services.selectedAddOns.map((addon, idx) => (
                      <div
                        key={idx}
                        className="flex justify-between items-center bg-gray-50 dark:bg-slate-900 p-2.5 rounded-xl text-xs font-semibold border border-gray-100 dark:border-slate-800"
                      >
                        <span>
                          {addon.name} x{addon.quantity}
                        </span>
                        <span className="font-black text-[#0A4DA6] dark:text-blue-300">
                          {formatCurrency(addon.totalPrice)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
          </div>

          <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-6 shadow-sm space-y-5 flex flex-col justify-between">
            <div className="space-y-4">
              <h3 className="font-black text-sm text-[#0B192C] dark:text-white tracking-wide border-b border-gray-100 dark:border-slate-800 pb-3">
                Tariff & Payment Summary
              </h3>

              <div className="space-y-2.5 text-xs font-semibold">
                <div className="flex justify-between">
                  <span className="text-gray-400">Base Room Charges:</span>
                  <span className="text-[#0B192C] dark:text-white">
                    {formatCurrency(pricing?.basePrice || 0)}
                  </span>
                </div>
                {Boolean(pricing?.servicesPrice) && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Add-On Services:</span>
                    <span className="text-[#0B192C] dark:text-white">
                      {formatCurrency(pricing?.servicesPrice || 0)}
                    </span>
                  </div>
                )}
                {Boolean(pricing?.donationAmount) && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">
                      Seva / Ashram Donation:
                    </span>
                    <span className="text-[#0B192C] dark:text-white">
                      {formatCurrency(pricing?.donationAmount || 0)}
                    </span>
                  </div>
                )}
                {Boolean(pricing?.totalSavings) && (
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-extrabold">
                    <span>Discount / Offer Savings:</span>
                    <span>-{formatCurrency(pricing?.totalSavings || 0)}</span>
                  </div>
                )}
              </div>

              <div className="border-t border-gray-100 dark:border-slate-800 pt-3 flex justify-between items-center">
                <div>
                  <span className="text-xs text-gray-400 font-bold block">
                    Total Amount
                  </span>
                  <span className="text-xl font-black text-[#0A4DA6] dark:text-blue-400">
                    {formatCurrency(pricing?.totalAmount || 0)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-gray-400 font-bold block">
                    Amount Paid
                  </span>
                  <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(pricing?.amountPaid || 0)}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-blue-50/60 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 p-4 rounded-2xl space-y-2 text-xs">
              <h4 className="font-extrabold text-[#0B192C] dark:text-white flex items-center gap-1.5">
                <ShieldCheck size={15} className="text-[#0A4DA6]" /> Ashram
                Support & Emergency Contact
              </h4>
              <p className="text-gray-500 dark:text-gray-400 font-medium">
                Phone:{" "}
                <strong className="text-[#0B192C] dark:text-white">
                  {ashram?.contactPhone || "+91 98765 43210"}
                </strong>
              </p>
              <p className="text-gray-500 dark:text-gray-400 font-medium">
                24x7 Pilgrim Helpline:{" "}
                <strong className="text-[#0B192C] dark:text-white">
                  {SUPPORT_CONFIG.helpline}
                </strong>
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-6 shadow-sm space-y-4">
          <h3 className="font-black text-sm text-[#0B192C] dark:text-white tracking-wide border-b border-gray-100 dark:border-slate-800 pb-3">
            Reservation Timeline & History
          </h3>

          <div className="relative pl-6 space-y-4 border-l-2 border-gray-100 dark:border-slate-800">
            <div className="relative">
              <div className={`absolute -left-[31px] top-0 w-4 h-4 rounded-full ${lifecycle.dot} border-2 border-white dark:border-[#0B192C]`} />
              <p className="text-xs font-black text-[#0B192C] dark:text-white">
                {lifecycle.title}
              </p>
              <p className="text-[10px] text-gray-400 font-medium">
                Booking ID #{booking.bookingId}. {lifecycle.detail}
              </p>
            </div>

            {booking.history?.map((h, i) => (
              <div key={i} className="relative">
                <div className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-[#0A4DA6] border-2 border-white dark:border-[#0B192C]" />
                <p className="text-xs font-black text-[#0B192C] dark:text-white capitalize">
                  {!paymentComplete && h.status === "confirmed"
                    ? "payment pending"
                    : h.status.replaceAll("_", " ")}
                </p>
                <p className="text-[10px] text-gray-400 font-medium">
                  {h.timestamp ? formatDateTimeIN(h.timestamp) : "Recorded"}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showReceiptModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <style>{`
            @media print {
              body * {
                visibility: hidden !important;
              }
              #printable-receipt-card, #printable-receipt-card * {
                visibility: visible !important;
              }
              #printable-receipt-card {
                position: fixed !important;
                left: 50% !important;
                top: 20px !important;
                transform: translateX(-50%) !important;
                width: 100% !important;
                max-width: 650px !important;
                box-shadow: none !important;
                border: 1px solid #e5e7eb !important;
                background: #ffffff !important;
                color: #0b192c !important;
              }
            }
          `}</style>

          <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] max-w-lg w-full p-6 shadow-2xl space-y-5 text-left relative my-8">
            <button
              onClick={() => setShowReceiptModal(false)}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400 cursor-pointer"
            >
              ✕
            </button>

            <div id="printable-receipt-card" className="space-y-4">
              <div className="bg-gradient-to-r from-[#0B192C] via-[#0A4DA6] to-[#0B192C] text-white p-4 rounded-2xl text-center relative overflow-hidden">
                <img src="/logo/logo.png" alt="Tirvona Logo" className="h-6 w-auto mx-auto mb-1 object-contain" />
                <p className="text-[10px] font-black tracking-widest text-blue-100 uppercase">
                  Tirvona Sacred Stays
                </p>
                <h3 className="font-extrabold text-sm mt-0.5">
                  {paymentComplete
                    ? "Official Accommodation Receipt"
                    : "Booking & Payment Summary"}
                </h3>
              </div>

              <div className="border border-gray-100 dark:border-slate-800 p-4 rounded-2xl space-y-3 bg-gray-50/50 dark:bg-slate-900/50">
                <div>
                  <h4 className="font-black text-base text-[#0B192C] dark:text-white">
                    {ashram?.name || "Omkarananda Ashram Himalayas"}
                  </h4>
                  {ashram?.address && (
                    <p className="text-xs text-gray-400 font-medium">
                      {[
                        ashram.address.street,
                        ashram.address.city,
                        ashram.address.state,
                        ashram.address.pincode,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  )}
                </div>

                <div className={`${stayConfirmed ? "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-900/50" : "bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-900/50"} border p-3 rounded-xl flex items-center justify-between`}>
                  <div>
                    <span className={`text-[9px] font-extrabold tracking-wider ${stayConfirmed ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300"} block`}>
                      {stayConfirmed ? "6-DIGIT CHECK-IN CODE" : "RESERVATION STATUS"}
                    </span>
                    <span className={`font-mono font-black text-lg ${stayConfirmed ? "text-emerald-900 dark:text-emerald-200" : "text-amber-900 dark:text-amber-200"}`}>
                      {stayConfirmed
                        ? booking.checkInCode || "CONFIRMED"
                        : "PAYMENT PENDING"}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] font-extrabold tracking-wider text-emerald-700 dark:text-emerald-300 block">
                      ROOM CATEGORY
                    </span>
                    <span className="font-bold text-xs text-emerald-900 dark:text-emerald-200">
                      {room?.name || room?.type || "Standard Room"}
                    </span>
                  </div>
                </div>
              </div>

              <dl className="grid grid-cols-2 gap-3 text-xs border-b border-gray-100 dark:border-slate-800 pb-3">
                <div>
                  <dt className="text-gray-400 font-bold text-[10px]">Booking Reference:</dt>
                  <dd className="font-mono font-extrabold text-[#0B192C] dark:text-white">
                    #{booking.bookingId}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-400 font-bold text-[10px]">Reservation No:</dt>
                  <dd className="font-mono font-bold text-[#0A4DA6]">
                    {booking.reservationNumber || booking._id.substring(0, 10)}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-400 font-bold text-[10px]">Check-In Date:</dt>
                  <dd className="font-semibold text-[#0B192C] dark:text-white">
                    {formatDateIN(booking.checkInDate)} (12:00 PM)
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-400 font-bold text-[10px]">Check-Out Date:</dt>
                  <dd className="font-semibold text-[#0B192C] dark:text-white">
                    {formatDateIN(booking.checkOutDate)} (11:00 AM)
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-400 font-bold text-[10px]">Guests & Rooms:</dt>
                  <dd className="font-semibold text-[#0B192C] dark:text-white">
                    {booking.guestsCount} Guest(s) • {booking.roomsBookedCount} Room(s)
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-400 font-bold text-[10px]">Assigned Room:</dt>
                  <dd className="font-bold text-purple-600 dark:text-purple-400">
                    {stayConfirmed
                      ? booking.assignedRoomNumber || "Front Desk"
                      : "After payment"}
                  </dd>
                </div>
              </dl>

              <div className="space-y-2 text-xs bg-gray-50 dark:bg-slate-900/60 p-3.5 rounded-2xl border border-gray-100 dark:border-slate-800">
                <span className="text-[10px] font-extrabold tracking-wider text-gray-400 block mb-1">
                  TARIFF & PAYMENT SUMMARY
                </span>
                <div className="flex justify-between">
                  <span className="text-gray-500">Base Room Charges:</span>
                  <span className="font-semibold">{formatCurrency(pricing?.basePrice || 0)}</span>
                </div>
                {Boolean(pricing?.servicesPrice) && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Add-On Services:</span>
                    <span className="font-semibold">{formatCurrency(pricing?.servicesPrice || 0)}</span>
                  </div>
                )}
                {Boolean(pricing?.donationAmount) && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Seva / Donation:</span>
                    <span className="font-semibold">{formatCurrency(pricing?.donationAmount || 0)}</span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-slate-800 font-black text-sm">
                  <span>Total Amount:</span>
                  <span className="text-[#0A4DA6] dark:text-blue-400">
                    {formatCurrency(pricing?.totalAmount || 0)}
                  </span>
                </div>
                <div className="flex justify-between text-xs font-extrabold pt-1">
                  <span className="text-gray-400">Amount Paid:</span>
                  <span className="text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(pricing?.amountPaid || 0)}
                  </span>
                </div>
                <div className="flex justify-between text-[11px] font-bold text-amber-600">
                  <span>Payment Status:</span>
                  <span className="capitalize">{booking.paymentStatus || "Pending"}</span>
                </div>
              </div>

              <div className="text-[10px] text-gray-400 leading-relaxed space-y-0.5 pt-1">
                <p>📞 <strong>24x7 Pilgrim Helpline:</strong> 1800-11-1363 / 112 | <strong>Support:</strong> +91 98765 43210</p>
                <p className="italic text-gray-400">Digital India compliant stay voucher. Present check-in code at ashram desk.</p>
              </div>
            </div>

            <div className="pt-2 flex flex-wrap gap-2.5">
              <button
                onClick={handleDownloadReceiptCanvas}
                disabled={isDownloadingReceipt}
                className="flex-1 py-2.5 bg-[#0A4DA6] hover:bg-[#083D85] disabled:opacity-50 text-white font-extrabold text-xs rounded-xl cursor-pointer transition-all inline-flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Download size={14} />
                {isDownloadingReceipt
                  ? "Generating Image..."
                  : paymentComplete
                    ? "Download Receipt"
                    : "Download Summary"}
              </button>
              <button
                onClick={() => window.print()}
                className="px-5 py-2.5 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-slate-700 font-bold text-xs rounded-xl cursor-pointer transition-colors"
              >
                Print Receipt
              </button>
              <button
                onClick={() => setShowReceiptModal(false)}
                className="px-4 py-2.5 bg-gray-100 dark:bg-slate-800 text-gray-500 font-bold text-xs rounded-xl cursor-pointer hover:bg-gray-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookingDetailPage;
