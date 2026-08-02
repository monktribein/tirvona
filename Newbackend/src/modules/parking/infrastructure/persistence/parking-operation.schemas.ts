import { Schema, SchemaTypes } from "mongoose";
import {
  PARKING_BOOKING_STATUSES,
  PARKING_PAYMENT_STATUSES,
  PARKING_VEHICLE_TYPES,
} from "../../domain/parking.constants";

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

export const ParkingBookingSchema = new Schema(
  {
    bookingReference: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    customerId: id("User", true),
    locationId: id("ParkingLocation", true),
    partnerId: id("ParkingPartner", true),
    slotTypeId: { ...id("ParkingSlotType", true), index: true },
    assignedSlotId: id("ParkingSlot"),
    assignedSlotNumber: { type: String, default: "" },
    vehicleType: {
      type: String,
      enum: PARKING_VEHICLE_TYPES,
      required: true,
      index: true,
    },
    vehicleNumber: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    vehicleModel: String,
    driverName: String,
    driverPhone: String,
    entryAt: { type: Date, required: true, index: true },
    exitAt: { type: Date, required: true },
    durationHours: { type: Number, required: true, min: 0 },
    occupiedDates: [Date],
    checkedInAt: Date,
    checkedOutAt: Date,
    actualDurationMinutes: Number,
    overstayMinutes: { type: Number, default: 0, min: 0 },
    pricing: {
      baseFee: { type: Number, default: 0 },
      durationAmount: { type: Number, default: 0 },
      peakMultiplier: { type: Number, default: 1 },
      subtotal: { type: Number, default: 0 },
      taxPercent: { type: Number, default: 0 },
      taxAmount: { type: Number, default: 0 },
      overstayAmount: { type: Number, default: 0 },
      totalAmount: { type: Number, default: 0 },
      amountPaid: { type: Number, default: 0 },
      refundAmount: { type: Number, default: 0 },
      currency: { type: String, default: "INR" },
    },
    commission: {
      percent: { type: Number, default: 0 },
      amount: { type: Number, default: 0 },
      partnerEarning: { type: Number, default: 0 },
    },
    status: {
      type: String,
      enum: PARKING_BOOKING_STATUSES,
      default: "pending",
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: PARKING_PAYMENT_STATUSES,
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
  opts("parking_bookings"),
);
ParkingBookingSchema.index({ customerId: 1, createdAt: -1 });
ParkingBookingSchema.index({ locationId: 1, status: 1, entryAt: 1 });
ParkingBookingSchema.index({ partnerId: 1, status: 1, createdAt: -1 });
ParkingBookingSchema.index({ locationId: 1, vehicleNumber: 1, status: 1 });
ParkingBookingSchema.index({ status: 1, reservationExpiresAt: 1 });

export const ParkingQrCodeSchema = new Schema(
  {
    bookingId: id("ParkingBooking", true),
    locationId: { ...id("ParkingLocation", true), index: true },
    customerId: { ...id("User", true), index: true },
    tokenHash: { type: String, required: true },
    displayCode: { type: String, required: true, uppercase: true, trim: true },
    version: { type: Number, default: 1 },
    issuedAt: { type: Date, default: Date.now },
    validFrom: { type: Date, required: true },
    validUntil: { type: Date, required: true, index: true },
    entryScannedAt: Date,
    exitScannedAt: Date,
    scanCount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["active", "used", "expired", "revoked"],
      default: "active",
      index: true,
    },
    revokedReason: String,
  },
  opts("parking_qr_codes"),
);
ParkingQrCodeSchema.index({ tokenHash: 1, status: 1 });
ParkingQrCodeSchema.index({ bookingId: 1, version: -1 });
ParkingQrCodeSchema.index({ displayCode: 1 });

export const ParkingScanLogSchema = new Schema(
  {
    bookingId: id("ParkingBooking"),
    qrCodeId: { ...id("ParkingQrCode"), index: true },
    locationId: id("ParkingLocation", true),
    scannedByUserId: { ...id("User", true), index: true },
    scannedByStaffId: id("ParkingStaff"),
    action: {
      type: String,
      enum: ["entry", "exit", "verify"],
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
        "wrong_location",
        "not_paid",
        "cancelled",
        "out_of_window",
      ],
      required: true,
    },
    tokenFingerprint: String,
    vehicleNumber: String,
    assignedSlotNumber: String,
    message: String,
    deviceInfo: String,
    ipAddress: String,
    scannedAt: { type: Date, default: Date.now, index: true },
  },
  opts("parking_scan_logs"),
);
ParkingScanLogSchema.index({ locationId: 1, scannedAt: -1 });
ParkingScanLogSchema.index({ bookingId: 1, scannedAt: -1 });
ParkingScanLogSchema.index({ result: 1, scannedAt: -1 });

export const ParkingReviewSchema = new Schema(
  {
    locationId: id("ParkingLocation", true),
    customerId: { ...id("User", true), index: true },
    bookingId: id("ParkingBooking", true),
    rating: {
      overall: { type: Number, required: true, min: 1, max: 5 },
      safety: { type: Number, min: 1, max: 5 },
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
    partnerResponse: { text: String, at: Date, by: id("User") },
  },
  opts("parking_reviews"),
);
ParkingReviewSchema.index({ bookingId: 1 }, { unique: true });
ParkingReviewSchema.index({ locationId: 1, status: 1, createdAt: -1 });

export const ParkingNotificationSchema = new Schema(
  {
    userId: id("User", true),
    bookingId: id("ParkingBooking"),
    event: {
      type: String,
      enum: [
        "booking_confirmed",
        "payment_success",
        "payment_failed",
        "qr_ready",
        "entry_reminder",
        "exit_reminder",
        "cancellation",
        "refund",
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
    deliveryError: String,
    providerMessageId: String,
    sentAt: Date,
    readAt: Date,
    meta: { type: SchemaTypes.Mixed, default: {} },
  },
  opts("parking_notifications"),
);
ParkingNotificationSchema.index({ userId: 1, createdAt: -1 });
ParkingNotificationSchema.index({ userId: 1, readAt: 1 });
ParkingNotificationSchema.index({ bookingId: 1, event: 1 });
