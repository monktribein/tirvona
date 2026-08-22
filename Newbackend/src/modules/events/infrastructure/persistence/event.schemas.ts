import { Schema, SchemaTypes } from "mongoose";
import {
  EVENT_FACILITIES,
  EVENT_REGISTRATION_STATUSES,
  EVENT_ROLES,
  EVENT_STATUSES,
  EVENT_TYPES,
} from "../../domain/event.constants";

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
const CLOCK = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const EventFestivalSchema = new Schema(
  {
    ashramId: { ...id("Ashram", true), index: true },
    ownerId: { ...id("User", true), index: true },
    name: { type: String, required: true, trim: true },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    eventType: {
      type: String,
      enum: EVENT_TYPES,
      default: "festival",
      index: true,
    },
    deity: { type: String, default: "", trim: true },
    tagline: { type: String, default: "", trim: true },
    description: { type: String, default: "" },
    highlights: [{ type: String, trim: true }],
    dressCode: { type: String, default: "" },
    instructions: { type: String, default: "" },
    termsAndConditions: { type: String, default: "" },
    images: [{ type: String, trim: true }],
    coverImage: { type: String, default: "" },
    venue: {
      name: { type: String, default: "" },
      line1: String,
      landmark: String,
      city: { type: String, index: true },
      district: String,
      state: { type: String, index: true },
      pincode: String,
    },
    geo: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], default: [0, 0] },
    },
    latitude: { type: Number, default: 0 },
    longitude: { type: Number, default: 0 },
    googleMapsUrl: { type: String, default: "" },
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, required: true, index: true },
    startTime: { type: String, default: "09:00", match: CLOCK },
    durationMinutes: { type: Number, default: 180, min: 5, max: 1440 },
    timezone: { type: String, default: "Asia/Kolkata" },
    dailySchedule: [
      {
        label: String,
        startTime: { type: String, match: CLOCK },
        note: String,
      },
    ],
    facilities: [{ type: String, enum: EVENT_FACILITIES }],
    contactPhone: { type: String, default: "", trim: true },
    contactEmail: { type: String, default: "", lowercase: true, trim: true },
    requiresRegistration: { type: Boolean, default: true },
    dailyCapacity: { type: Number, default: 0, min: 0 },
    maxSeatsPerRegistration: { type: Number, default: 10, min: 1, max: 50 },
    isFeatured: { type: Boolean, default: false, index: true },
    status: {
      type: String,
      enum: EVENT_STATUSES,
      default: "draft",
      index: true,
    },
    submittedAt: Date,
    approvedAt: Date,
    approvedBy: id("User"),
    rejectionReason: { type: String, default: "" },
    viewCount: { type: Number, default: 0 },
  },
  opts("event_festivals"),
);
EventFestivalSchema.index({ status: 1, isFeatured: -1, startDate: 1 });
EventFestivalSchema.index({ ashramId: 1, status: 1 });
EventFestivalSchema.index({ "venue.city": 1, status: 1 });
EventFestivalSchema.index({ status: 1, startDate: 1, endDate: 1 });
EventFestivalSchema.index({ ownerId: 1, status: 1, createdAt: -1 });

export const EventAvailabilitySchema = new Schema(
  {
    eventId: { ...id("EventFestivalListing", true), index: true },
    ashramId: id("Ashram"),
    date: { type: Date, required: true },
    totalCapacity: { type: Number, required: true, min: 0 },
    bookedCount: { type: Number, default: 0, min: 0 },
    blockedCount: { type: Number, default: 0, min: 0 },
    isClosed: { type: Boolean, default: false },
    note: { type: String, default: "" },
  },
  opts("event_availability"),
);
EventAvailabilitySchema.index({ eventId: 1, date: 1 }, { unique: true });

export const EventRegistrationSchema = new Schema(
  {
    registrationReference: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    customerId: id("User", true),
    eventId: id("EventFestivalListing", true),
    ashramId: id("Ashram", true),
    attendDate: { type: Date, required: true, index: true },
    startsAt: { type: Date, required: true, index: true },
    endsAt: { type: Date, required: true },
    seats: { type: Number, required: true, min: 1 },
    attendees: [{ name: String, age: Number }],
    contactName: { type: String, default: "" },
    contactPhone: { type: String, default: "" },
    contactEmail: { type: String, default: "", lowercase: true },
    checkedInAt: Date,
    checkedInCount: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: EVENT_REGISTRATION_STATUSES,
      default: "confirmed",
      index: true,
    },
    cancellation: {
      reason: String,
      cancelledAt: Date,
      cancelledBy: id("User"),
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
  opts("event_registrations"),
);
EventRegistrationSchema.index({ customerId: 1, createdAt: -1 });
EventRegistrationSchema.index({ eventId: 1, status: 1, attendDate: 1 });
EventRegistrationSchema.index({ ashramId: 1, status: 1, createdAt: -1 });
// One live registration per devotee per event day; a cancelled row must not
// block them from registering again, hence the partial filter.
EventRegistrationSchema.index(
  { eventId: 1, attendDate: 1, customerId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ["confirmed", "checked_in", "attended"] },
    },
  },
);

export const EventQrCodeSchema = new Schema(
  {
    registrationId: id("EventRegistration", true),
    eventId: { ...id("EventFestivalListing", true), index: true },
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
  opts("event_qr_codes"),
);
EventQrCodeSchema.index({ tokenHash: 1, status: 1 });
EventQrCodeSchema.index({ registrationId: 1, version: -1 });
EventQrCodeSchema.index({ displayCode: 1 });

export const EventScanLogSchema = new Schema(
  {
    registrationId: id("EventRegistration"),
    qrCodeId: { ...id("EventQrCode"), index: true },
    eventId: id("EventFestivalListing", true),
    ashramId: id("Ashram"),
    scannedByUserId: { ...id("User", true), index: true },
    scannedByStaffId: id("EventStaff"),
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
        "wrong_event",
        "cancelled",
        "out_of_window",
      ],
      required: true,
    },
    tokenFingerprint: String,
    registrationReference: String,
    seats: Number,
    message: String,
    deviceInfo: String,
    ipAddress: String,
    scannedAt: { type: Date, default: Date.now, index: true },
  },
  opts("event_scan_logs"),
);
EventScanLogSchema.index({ eventId: 1, scannedAt: -1 });
EventScanLogSchema.index({ result: 1, scannedAt: -1 });

export const EventNotificationSchema = new Schema(
  {
    userId: id("User", true),
    registrationId: id("EventRegistration"),
    event: {
      type: String,
      enum: [
        "registration_confirmed",
        "pass_ready",
        "event_reminder",
        "cancellation",
        "event_updated",
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
  opts("event_notifications"),
);
EventNotificationSchema.index({ userId: 1, createdAt: -1 });
EventNotificationSchema.index({ userId: 1, readAt: 1 });

export const EventStaffSchema = new Schema(
  {
    userId: { ...id("User", true), index: true },
    ashramId: { ...id("Ashram", true), index: true },
    eventIds: [{ type: SchemaTypes.ObjectId, ref: "EventFestivalListing" }],
    eventRole: { type: String, enum: EVENT_ROLES, required: true, index: true },
    capabilityOverrides: [{ type: String }],
    employeeCode: { type: String, default: "", trim: true },
    phone: { type: String, default: "", trim: true },
    shift: { type: String, default: "" },
    status: {
      type: String,
      enum: ["active", "suspended", "revoked"],
      default: "active",
      index: true,
    },
    lastActiveAt: Date,
    createdBy: id("User"),
  },
  opts("event_staff"),
);
EventStaffSchema.index({ userId: 1, status: 1 });

export const EventSettingSchema = new Schema(
  {
    scope: {
      type: String,
      enum: ["platform", "ashram", "event"],
      required: true,
      index: true,
    },
    ashramId: id("Ashram"),
    eventId: id("EventFestivalListing"),
    gateOpensBeforeMinutes: { type: Number, default: null },
    noShowAfterMinutes: { type: Number, default: null },
    maxSeatsPerRegistration: { type: Number, default: null },
    registrationOpensDaysAhead: { type: Number, default: null },
    registrationClosesBeforeMinutes: { type: Number, default: null },
    qrValidityBufferMinutes: { type: Number, default: null },
    allowRegistration: { type: Boolean, default: null },
    allowCancellation: { type: Boolean, default: null },
    requireAttendeeNames: { type: Boolean, default: null },
    updatedBy: id("User"),
  },
  opts("event_settings"),
);
EventSettingSchema.index({ scope: 1, ashramId: 1, eventId: 1 });

export const EventAshramRefSchema = new Schema(
  { ownerId: { type: SchemaTypes.ObjectId, ref: "User", index: true } },
  { strict: false, timestamps: true, collection: "ashrams" },
);
