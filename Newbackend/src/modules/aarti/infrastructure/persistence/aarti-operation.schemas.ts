import { Schema, SchemaTypes } from "mongoose";
import {
  AARTI_BOOKING_STATUSES,
  AARTI_PAYMENT_STATUSES,
  AARTI_STREAM_PROVIDERS,
  AARTI_STREAM_STATUSES,
} from "../../domain/aarti.constants";

const id = (ref: string, required = false) => ({
  type: SchemaTypes.ObjectId,
  ref,
  required,
  default: required ? undefined : null,
});
const opts = (collection: string) => ({
  timestamps: true,
  collection,
  optimisticConcurrency: true,
});

export const AartiBookingSchema = new Schema(
  {
    bookingReference: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    customerId: id("User", true),
    sessionId: id("AartiSession", true),
    ashramId: id("Ashram", true),
    passTypeId: { ...id("AartiPassType", true), index: true },
    sessionDate: { type: Date, required: true, index: true },
    startsAt: { type: Date, required: true, index: true },
    endsAt: { type: Date, required: true },
    passCount: { type: Number, required: true, min: 1 },
    devotees: [
      {
        name: String,
        age: Number,
        gotra: String,
      },
    ],
    sankalpName: { type: String, default: "" },
    sankalpGotra: { type: String, default: "" },
    contactName: { type: String, default: "" },
    contactPhone: { type: String, default: "" },
    contactEmail: { type: String, default: "", lowercase: true },
    checkedInAt: Date,
    checkedInCount: { type: Number, default: 0, min: 0 },
    pricing: {
      unitPrice: { type: Number, default: 0 },
      passCount: { type: Number, default: 0 },
      peakMultiplier: { type: Number, default: 1 },
      subtotal: { type: Number, default: 0 },
      donationAmount: { type: Number, default: 0 },
      taxPercent: { type: Number, default: 0 },
      taxAmount: { type: Number, default: 0 },
      totalAmount: { type: Number, default: 0 },
      amountPaid: { type: Number, default: 0 },
      refundAmount: { type: Number, default: 0 },
      currency: { type: String, default: "INR" },
    },
    commission: {
      percent: { type: Number, default: 0 },
      amount: { type: Number, default: 0 },
      ashramEarning: { type: Number, default: 0 },
    },
    status: {
      type: String,
      enum: AARTI_BOOKING_STATUSES,
      default: "pending",
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: AARTI_PAYMENT_STATUSES,
      default: "pending",
      index: true,
    },
    reservationExpiresAt: Date,
    cancellation: {
      reason: String,
      cancelledAt: Date,
      cancelledBy: id("User"),
      refundAmount: Number,
      refundReference: String,
    },
    history: [
      {
        status: String,
        note: String,
        at: { type: Date, default: Date.now },
        updatedBy: id("User"),
      },
    ],
    notes: String,
    source: { type: String, enum: ["web", "app", "counter"], default: "web" },
  },
  opts("aarti_bookings"),
);
AartiBookingSchema.index({ customerId: 1, createdAt: -1 });
AartiBookingSchema.index({ sessionId: 1, status: 1, sessionDate: 1 });
AartiBookingSchema.index({ ashramId: 1, status: 1, createdAt: -1 });
AartiBookingSchema.index({ status: 1, reservationExpiresAt: 1 });

export const AartiQrCodeSchema = new Schema(
  {
    bookingId: id("AartiBooking", true),
    sessionId: { ...id("AartiSession", true), index: true },
    customerId: { ...id("User", true), index: true },
    tokenHash: { type: String, required: true },
    token: { type: String, select: false },
    displayCode: { type: String, required: true, uppercase: true, trim: true },
    version: { type: Number, default: 1 },
    issuedAt: { type: Date, default: Date.now },
    validFrom: { type: Date, required: true },
    validUntil: { type: Date, required: true, index: true },
    entryScannedAt: Date,
    scanCount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["active", "used", "expired", "revoked"],
      default: "active",
      index: true,
    },
    revokedReason: String,
  },
  opts("aarti_qr_codes"),
);
AartiQrCodeSchema.index({ tokenHash: 1, status: 1 });
AartiQrCodeSchema.index({ bookingId: 1, version: -1 });
AartiQrCodeSchema.index({ displayCode: 1 });

export const AartiScanLogSchema = new Schema(
  {
    bookingId: id("AartiBooking"),
    qrCodeId: { ...id("AartiQrCode"), index: true },
    sessionId: id("AartiSession", true),
    ashramId: id("Ashram"),
    scannedByUserId: { ...id("User", true), index: true },
    scannedByStaffId: id("AartiStaff"),
    action: {
      type: String,
      enum: ["entry", "verify"],
      required: true,
      index: true,
    },
    result: {
      type: String,
      enum: [
        "success",
        "invalid_token",
        "not_found",
        "expired",
        "already_used",
        "wrong_session",
        "not_paid",
        "cancelled",
        "out_of_window",
      ],
      required: true,
    },
    tokenFingerprint: String,
    bookingReference: String,
    passCount: Number,
    message: String,
    deviceInfo: String,
    ipAddress: String,
    scannedAt: { type: Date, default: Date.now, index: true },
  },
  opts("aarti_scan_logs"),
);
AartiScanLogSchema.index({ sessionId: 1, scannedAt: -1 });
AartiScanLogSchema.index({ bookingId: 1, scannedAt: -1 });
AartiScanLogSchema.index({ result: 1, scannedAt: -1 });

export const AartiReviewSchema = new Schema(
  {
    sessionId: id("AartiSession", true),
    customerId: { ...id("User", true), index: true },
    bookingId: id("AartiBooking", true),
    rating: {
      overall: { type: Number, required: true, min: 1, max: 5 },
      arrangement: { type: Number, min: 1, max: 5 },
      cleanliness: { type: Number, min: 1, max: 5 },
      staff: { type: Number, min: 1, max: 5 },
      valueForMoney: { type: Number, min: 1, max: 5 },
    },
    comment: { type: String, default: "", trim: true, maxlength: 2000 },
    images: [String],
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "approved",
      index: true,
    },
    moderationNote: String,
    moderatedBy: id("User"),
    ashramResponse: { text: String, at: Date, by: id("User") },
  },
  opts("aarti_reviews"),
);
AartiReviewSchema.index({ bookingId: 1 }, { unique: true });
AartiReviewSchema.index({ sessionId: 1, status: 1, createdAt: -1 });

export const AartiNotificationSchema = new Schema(
  {
    userId: id("User", true),
    bookingId: id("AartiBooking"),
    event: {
      type: String,
      enum: [
        "booking_confirmed",
        "payment_success",
        "payment_failed",
        "pass_ready",
        "aarti_reminder",
        "cancellation",
        "refund",
        "stream_live",
      ],
      required: true,
      index: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    channel: {
      type: String,
      enum: ["in_app", "email", "sms", "socket"],
      default: "in_app",
    },
    status: {
      type: String,
      enum: ["queued", "sent", "failed", "skipped"],
      default: "queued",
      index: true,
    },
    recipientPhone: { type: String, default: "" },
    deliveryError: String,
    providerMessageId: String,
    sentAt: Date,
    readAt: Date,
    meta: { type: SchemaTypes.Mixed, default: {} },
  },
  opts("aarti_notifications"),
);
AartiNotificationSchema.index({ userId: 1, createdAt: -1 });
AartiNotificationSchema.index({ userId: 1, readAt: 1 });
AartiNotificationSchema.index({ bookingId: 1, event: 1 });

export const AartiStreamSchema = new Schema(
  {
    ashramId: { ...id("Ashram", true), index: true },
    ownerId: { ...id("User", true), index: true },
    sessionId: id("AartiSession"),
    title: { type: String, required: true, trim: true },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    description: { type: String, default: "" },
    deity: { type: String, default: "", trim: true },
    provider: {
      type: String,
      enum: AARTI_STREAM_PROVIDERS,
      default: "youtube",
    },
    streamUrl: { type: String, required: true, trim: true },
    embedUrl: { type: String, default: "" },
    thumbnailUrl: { type: String, default: "" },
    venueName: { type: String, default: "" },
    city: { type: String, default: "", index: true },
    state: { type: String, default: "" },
    startsAt: { type: Date, default: null, index: true },
    endsAt: { type: Date, default: null },
    recurrenceDays: [{ type: Number, min: 0, max: 6 }],
    isLive: { type: Boolean, default: false, index: true },
    isFeatured: { type: Boolean, default: false, index: true },
    status: {
      type: String,
      enum: AARTI_STREAM_STATUSES,
      default: "draft",
      index: true,
    },
    submittedAt: Date,
    approvedAt: Date,
    approvedBy: id("User"),
    rejectionReason: { type: String, default: "" },
    viewCount: { type: Number, default: 0 },
    lastLiveAt: Date,
    displayOrder: { type: Number, default: 0 },
  },
  opts("aarti_streams"),
);
AartiStreamSchema.index({ status: 1, isFeatured: -1, startsAt: -1 });
AartiStreamSchema.index({ ashramId: 1, status: 1 });
AartiStreamSchema.index({ status: 1, startsAt: 1, endsAt: 1 });
