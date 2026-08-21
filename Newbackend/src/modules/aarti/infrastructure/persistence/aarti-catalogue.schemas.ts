import { Schema, SchemaTypes } from "mongoose";
import {
  AARTI_FACILITIES,
  AARTI_KINDS,
  AARTI_ROLES,
  AARTI_SESSION_STATUSES,
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
const CLOCK = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const AartiSessionSchema = new Schema(
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
    kind: { type: String, enum: AARTI_KINDS, default: "other", index: true },
    deity: { type: String, default: "", trim: true },
    description: { type: String, default: "" },
    ritualNotes: { type: String, default: "" },
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
    startTime: { type: String, required: true, match: CLOCK },
    durationMinutes: { type: Number, default: 45, min: 5, max: 720 },
    daysOfWeek: [{ type: Number, min: 0, max: 6 }],
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    timezone: { type: String, default: "Asia/Kolkata" },
    facilities: [{ type: String, enum: AARTI_FACILITIES }],
    contactPhone: { type: String, default: "", trim: true },
    contactEmail: { type: String, default: "", lowercase: true, trim: true },
    totalCapacity: { type: Number, default: 0, min: 0 },
    commissionPercent: { type: Number, default: null, min: 0, max: 100 },
    isFeatured: { type: Boolean, default: false, index: true },
    allowLiveStream: { type: Boolean, default: false },
    status: {
      type: String,
      enum: AARTI_SESSION_STATUSES,
      default: "draft",
      index: true,
    },
    submittedAt: Date,
    approvedAt: Date,
    approvedBy: id("User"),
    rejectionReason: { type: String, default: "" },
    rating: {
      average: { type: Number, default: 0 },
      count: { type: Number, default: 0 },
    },
    viewCount: { type: Number, default: 0 },
  },
  opts("aarti_sessions"),
);
AartiSessionSchema.index({ status: 1, isFeatured: -1, createdAt: -1 });
AartiSessionSchema.index({ ashramId: 1, status: 1 });
AartiSessionSchema.index({ "venue.city": 1, status: 1 });
AartiSessionSchema.index({ ownerId: 1, status: 1, createdAt: -1 });

export const AartiPassTypeSchema = new Schema(
  {
    sessionId: { ...id("AartiSession", true), index: true },
    ashramId: id("Ashram", true),
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    description: { type: String, default: "" },
    basePrice: { type: Number, required: true, min: 0 },
    totalCapacity: { type: Number, required: true, min: 0 },
    maxPerBooking: { type: Number, default: 10, min: 1 },
    perks: [{ type: String, enum: AARTI_FACILITIES }],
    zoneLabel: { type: String, default: "" },
    includesPrasad: { type: Boolean, default: false },
    includesSankalp: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true, index: true },
    displayOrder: { type: Number, default: 0 },
  },
  opts("aarti_pass_types"),
);
AartiPassTypeSchema.index({ sessionId: 1, code: 1 }, { unique: true });
AartiPassTypeSchema.index({ sessionId: 1, isActive: 1, displayOrder: 1 });

export const AartiPricingSchema = new Schema(
  {
    sessionId: { ...id("AartiSession", true), index: true },
    passTypeId: id("AartiPassType"),
    name: { type: String, default: "" },
    validFrom: { type: Date, default: null },
    validUntil: { type: Date, default: null },
    daysOfWeek: [{ type: Number, min: 0, max: 6 }],
    multiplier: { type: Number, default: 1, min: 0 },
    overridePrice: { type: Number, default: null, min: 0 },
    taxPercent: { type: Number, default: null, min: 0, max: 100 },
    priority: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true, index: true },
  },
  opts("aarti_pricing"),
);
AartiPricingSchema.index({ sessionId: 1, passTypeId: 1, isActive: 1 });

export const AartiAvailabilitySchema = new Schema(
  {
    sessionId: { ...id("AartiSession", true), index: true },
    passTypeId: id("AartiPassType", true),
    date: { type: Date, required: true },
    totalCapacity: { type: Number, required: true, min: 0 },
    bookedCount: { type: Number, default: 0, min: 0 },
    blockedCount: { type: Number, default: 0, min: 0 },
    customPrice: { type: Number, default: null, min: 0 },
    isClosed: { type: Boolean, default: false },
    note: { type: String, default: "" },
  },
  opts("aarti_availability"),
);
AartiAvailabilitySchema.index({ passTypeId: 1, date: 1 }, { unique: true });
AartiAvailabilitySchema.index({ sessionId: 1, date: 1 });

export const AartiHolidaySchema = new Schema(
  {
    sessionId: id("AartiSession"),
    ashramId: id("Ashram"),
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ["festival", "closure", "special"],
      default: "festival",
    },
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, required: true },
    peakMultiplier: { type: Number, default: 1, min: 0 },
    isClosed: { type: Boolean, default: false },
    note: { type: String, default: "" },
    isActive: { type: Boolean, default: true, index: true },
  },
  opts("aarti_holidays"),
);
AartiHolidaySchema.index({ isActive: 1, startDate: 1, endDate: 1 });

export const AartiSettingSchema = new Schema(
  {
    scope: {
      type: String,
      enum: ["platform", "ashram", "session"],
      required: true,
      index: true,
    },
    ashramId: id("Ashram"),
    sessionId: id("AartiSession"),
    reservationHoldMinutes: { type: Number, default: null },
    gateOpensBeforeMinutes: { type: Number, default: null },
    gateClosesAfterMinutes: { type: Number, default: null },
    noShowAfterMinutes: { type: Number, default: null },
    commissionPercent: { type: Number, default: null },
    taxPercent: { type: Number, default: null },
    maxPassesPerBooking: { type: Number, default: null },
    bookingOpensDaysAhead: { type: Number, default: null },
    bookingClosesBeforeMinutes: { type: Number, default: null },
    freeCancellationHours: { type: Number, default: null },
    refundPercentInsideWindow: { type: Number, default: null },
    refundPercentOutsideWindow: { type: Number, default: null },
    qrValidityBufferMinutes: { type: Number, default: null },
    allowOnlineBooking: { type: Boolean, default: null },
    allowCancellation: { type: Boolean, default: null },
    requireDevoteeNames: { type: Boolean, default: null },
    updatedBy: id("User"),
  },
  opts("aarti_settings"),
);
AartiSettingSchema.index({ scope: 1, ashramId: 1, sessionId: 1 });

export const AartiStaffSchema = new Schema(
  {
    userId: { ...id("User", true), index: true },
    ashramId: { ...id("Ashram", true), index: true },
    sessionIds: [{ type: SchemaTypes.ObjectId, ref: "AartiSession" }],
    aartiRole: { type: String, enum: AARTI_ROLES, required: true, index: true },
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
  opts("aarti_staff"),
);
AartiStaffSchema.index({ userId: 1, status: 1 });
AartiStaffSchema.index({ ashramId: 1, aartiRole: 1, status: 1 });

export const AartiAshramRefSchema = new Schema(
  {
    ownerId: { type: SchemaTypes.ObjectId, ref: "User", index: true },
  },
  { strict: false, timestamps: true, collection: "ashrams" },
);
