import { Schema, SchemaTypes } from "../../../database/orm";
import { YATRA_MODEL } from "../domain/yatra.constants";

/**
 * Read-only views of tables that belong to other modules. Each declares only
 * columns that already exist (and no indexes), so they add nothing to the
 * database layout and leave the owning modules untouched. Yatra never writes
 * through these models.
 */
const ref = (collection: string) => ({ strict: false, collection, timestamps: false });

export const YatraUserRefSchema = new Schema(
  {
    name: String,
    email: String,
    phone: String,
    role: String,
    status: String,
    isDeleted: Boolean,
  },
  ref("users"),
);

export const YatraCircuitRefSchema = new Schema(
  {
    name: String,
    slug: String,
    summary: String,
    description: String,
    startCity: String,
    endCity: String,
    state: String,
    durationDays: Number,
    highlights: SchemaTypes.Mixed,
    images: SchemaTypes.Mixed,
    coverImage: String,
    status: String,
    usableAsPlannerTemplate: Boolean,
  },
  ref("pilgrimage_circuits"),
);

export const YatraCircuitStopRefSchema = new Schema(
  {
    circuitId: SchemaTypes.ObjectId,
    dayNumber: Number,
    order: Number,
    name: String,
    stopType: String,
    city: String,
    state: String,
    notes: String,
    arrivalTime: String,
    suggestedDurationMinutes: Number,
    isOvernightStop: Boolean,
  },
  ref("pilgrimage_stops"),
);

export const YatraStayBookingRefSchema = new Schema(
  {
    bookingId: String,
    reservationNumber: String,
    customerId: SchemaTypes.ObjectId,
    ashramId: SchemaTypes.ObjectId,
    checkInDate: Date,
    checkOutDate: Date,
    status: String,
    paymentStatus: String,
    guestsCount: Number,
  },
  ref("booking_bookings"),
);

export const YatraParkingBookingRefSchema = new Schema(
  {
    bookingReference: String,
    customerId: SchemaTypes.ObjectId,
    locationId: SchemaTypes.ObjectId,
    vehicleNumber: String,
    entryAt: Date,
    exitAt: Date,
    status: String,
    paymentStatus: String,
  },
  ref("parking_bookings"),
);

export const YatraAartiBookingRefSchema = new Schema(
  {
    bookingReference: String,
    customerId: SchemaTypes.ObjectId,
    sessionId: SchemaTypes.ObjectId,
    startsAt: Date,
    passCount: Number,
    status: String,
    paymentStatus: String,
  },
  ref("aarti_bookings"),
);

export const YatraFoodVendorRefSchema = new Schema(
  {
    businessName: String,
    ownerUserId: SchemaTypes.ObjectId,
    contactPhone: String,
    status: String,
  },
  ref("food_vendors"),
);

export const YatraProviderRefSchema = new Schema(
  {
    userId: SchemaTypes.ObjectId,
    displayName: String,
    homeCity: String,
    serviceCities: [String],
    status: String,
    isPubliclyListed: Boolean,
    avatarUrl: String,
  },
  ref("provider_profiles"),
);

export const YATRA_REF_SCHEMAS = [
  [YATRA_MODEL.UserRef, YatraUserRefSchema],
  [YATRA_MODEL.CircuitRef, YatraCircuitRefSchema],
  [YATRA_MODEL.CircuitStopRef, YatraCircuitStopRefSchema],
  [YATRA_MODEL.StayBookingRef, YatraStayBookingRefSchema],
  [YATRA_MODEL.ParkingBookingRef, YatraParkingBookingRefSchema],
  [YATRA_MODEL.AartiBookingRef, YatraAartiBookingRefSchema],
  [YATRA_MODEL.FoodVendorRef, YatraFoodVendorRefSchema],
  [YATRA_MODEL.ProviderRef, YatraProviderRefSchema],
] as const;
