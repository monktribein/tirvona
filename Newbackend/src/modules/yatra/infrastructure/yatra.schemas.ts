import { Schema, SchemaTypes } from "../../../database/orm";
import {
  BOOKING_SOURCES,
  BOOKING_STATUSES,
  DEPARTURE_STATUSES,
  DOCUMENT_STATUSES,
  DOCUMENT_TYPES,
  JOURNEY_LINK_MODULES,
  JOURNEY_STATUSES,
  LEDGER_TYPES,
  MEMBER_ROLES,
  MEMBER_STATUSES,
  OPERATOR_STATUSES,
  ORGANISATION_TYPES,
  PAYMENT_PURPOSES,
  PAYMENT_ROW_STATUSES,
  PAYMENT_STATUSES,
  PERMIT_TYPES,
  PRODUCT_TYPES,
  SEAT_MODES,
  SEAT_STATUSES,
  SERVICE_REQUEST_STATUSES,
  SERVICE_TYPES,
  TOUR_STATUSES,
  VEHICLE_STATUSES,
  VEHICLE_TYPES,
  YATRA_MODEL,
} from "../domain/yatra.constants";

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
const historyEntry = {
  status: { type: String, default: "" },
  note: { type: String, default: "" },
  by: id("User"),
  at: { type: Date, default: () => new Date() },
};

/** One organiser (tour operator). Owned by the Tirvona account that registered it. */
export const YatraOperatorSchema = new Schema(
  {
    ownerUserId: id("User", true),
    organisationName: { type: String, required: true, trim: true },
    displayName: { type: String, default: "", trim: true },
    slug: { type: String, required: true, trim: true, lowercase: true },
    organisationType: { type: String, enum: ORGANISATION_TYPES, default: "proprietorship" },
    description: { type: String, default: "" },
    logoUrl: { type: String, default: "" },
    contactName: { type: String, default: "", trim: true },
    contactPhone: { type: String, default: "", trim: true },
    contactEmail: { type: String, default: "", trim: true, lowercase: true },
    address: { type: String, default: "" },
    city: { type: String, default: "", trim: true },
    state: { type: String, default: "", trim: true },
    pincode: { type: String, default: "", trim: true },
    operatingRegions: [{ type: String, trim: true }],
    yearsInBusiness: { type: Number, default: 0, min: 0, max: 200 },
    kyc: {
      panNumber: { type: String, default: "", uppercase: true, trim: true },
      gstin: { type: String, default: "", uppercase: true, trim: true },
      registrationNumber: { type: String, default: "", trim: true },
    },
    // Payouts are manual and done by Finance. The account number is encrypted;
    // only its last four digits are ever returned.
    payout: {
      accountHolderName: { type: String, default: "" },
      accountNumberEncrypted: { type: SchemaTypes.Mixed, default: null, select: false },
      accountNumberLast4: { type: String, default: "" },
      ifsc: { type: String, default: "", uppercase: true },
      bankName: { type: String, default: "" },
      upiId: { type: String, default: "" },
      updatedAt: { type: Date, default: null },
    },
    status: { type: String, enum: OPERATOR_STATUSES, default: "draft" },
    submittedAt: { type: Date, default: null },
    reviewedAt: { type: Date, default: null },
    reviewedBy: id("User"),
    reviewNote: { type: String, default: "" },
    approvedAt: { type: Date, default: null },
    termsAcceptedAt: { type: Date, default: null },
  },
  opts("yatra_operators"),
);
YatraOperatorSchema.index({ ownerUserId: 1 }, { unique: true });
YatraOperatorSchema.index({ slug: 1 }, { unique: true });
YatraOperatorSchema.index({ status: 1, createdAt: -1 });

/** A Tirvona account working for an organiser: its owner, managers and staff. */
export const YatraOperatorMemberSchema = new Schema(
  {
    operatorId: id(YATRA_MODEL.Operator, true),
    userId: id("User", true),
    role: { type: String, enum: MEMBER_ROLES, default: "staff" },
    status: { type: String, enum: MEMBER_STATUSES, default: "active" },
    name: { type: String, default: "" },
    email: { type: String, default: "" },
    phone: { type: String, default: "" },
    addedBy: id("User"),
    removedAt: { type: Date, default: null },
    removedBy: id("User"),
  },
  opts("yatra_operator_members"),
);
YatraOperatorMemberSchema.index({ operatorId: 1, userId: 1 }, { unique: true });
// An account works for at most one organiser at a time.
YatraOperatorMemberSchema.index(
  { userId: 1 },
  { unique: true, partialFilterExpression: { status: "active" } },
);
YatraOperatorMemberSchema.index({ operatorId: 1, status: 1 });

/**
 * A KYC, permit or insurance file. Stored in Cloudinary as an authenticated
 * (non-public) asset: only its storage id is kept, and every view goes
 * through a short-lived signed link issued after an access check.
 */
export const YatraDocumentSchema = new Schema(
  {
    operatorId: id(YATRA_MODEL.Operator),
    ridePartnerId: id(YATRA_MODEL.RidePartner),
    vehicleId: id(YATRA_MODEL.Vehicle),
    documentType: { type: String, enum: DOCUMENT_TYPES, required: true },
    documentNumber: { type: String, default: "", trim: true },
    expiresAt: { type: Date, default: null },
    storage: {
      publicId: { type: String, default: "" },
      resourceType: { type: String, default: "image" },
      format: { type: String, default: "" },
      bytes: { type: Number, default: 0 },
      mimeType: { type: String, default: "" },
    },
    originalName: { type: String, default: "" },
    status: { type: String, enum: DOCUMENT_STATUSES, default: "pending" },
    reviewNote: { type: String, default: "" },
    reviewedBy: id("User"),
    reviewedAt: { type: Date, default: null },
    uploadedBy: id("User"),
  },
  opts("yatra_documents"),
);
YatraDocumentSchema.index({ operatorId: 1, createdAt: -1 });
YatraDocumentSchema.index({ vehicleId: 1 });
YatraDocumentSchema.index({ ridePartnerId: 1, createdAt: -1 });
YatraDocumentSchema.index({ status: 1, createdAt: -1 });

export const YatraVehicleSchema = new Schema(
  {
    operatorId: id(YATRA_MODEL.Operator, true),
    registrationNumber: { type: String, required: true, trim: true, uppercase: true },
    registrationKey: { type: String, required: true },
    vehicleType: { type: String, enum: VEHICLE_TYPES, default: "bus" },
    make: { type: String, default: "", trim: true },
    model: { type: String, default: "", trim: true },
    seatCapacity: { type: Number, required: true, min: 1, max: 120 },
    isAc: { type: Boolean, default: false },
    amenities: [{ type: String, trim: true }],
    permitType: { type: String, enum: PERMIT_TYPES, default: "tourist_permit" },
    seatLayout: { type: SchemaTypes.Mixed, default: null },
    images: [{ type: String, trim: true }],
    status: { type: String, enum: VEHICLE_STATUSES, default: "draft" },
    reviewNote: { type: String, default: "" },
    reviewedBy: id("User"),
    reviewedAt: { type: Date, default: null },
  },
  opts("yatra_vehicles"),
);
YatraVehicleSchema.index({ registrationKey: 1 }, { unique: true });
YatraVehicleSchema.index({ operatorId: 1, status: 1 });
YatraVehicleSchema.index({ status: 1, createdAt: -1 });

export const YatraTourSchema = new Schema(
  {
    operatorId: id(YATRA_MODEL.Operator, true),
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, lowercase: true },
    summary: { type: String, default: "" },
    description: { type: String, default: "" },
    productType: { type: String, enum: PRODUCT_TYPES, default: "group_tour" },
    originCity: { type: String, required: true, trim: true },
    originState: { type: String, default: "", trim: true },
    destinationCity: { type: String, required: true, trim: true },
    destinationState: { type: String, default: "", trim: true },
    originCityKey: { type: String, default: "" },
    destinationCityKey: { type: String, default: "" },
    durationDays: { type: Number, required: true, min: 1, max: 30 },
    durationNights: { type: Number, default: 0, min: 0, max: 30 },
    // Route stops and the day-by-day plan; whole arrays are always $set.
    stops: { type: SchemaTypes.Mixed, default: [] },
    itinerary: { type: SchemaTypes.Mixed, default: [] },
    highlights: [{ type: String, trim: true }],
    inclusions: [{ type: String, trim: true }],
    exclusions: [{ type: String, trim: true }],
    images: [{ type: String, trim: true }],
    coverImage: { type: String, default: "" },
    baseFare: { type: Number, required: true, min: 1 },
    cancellationPolicy: { type: SchemaTypes.Mixed, default: null },
    circuitTemplateId: id(YATRA_MODEL.CircuitRef),
    circuitTemplateName: { type: String, default: "" },
    status: { type: String, enum: TOUR_STATUSES, default: "draft" },
    submittedAt: { type: Date, default: null },
    reviewedAt: { type: Date, default: null },
    reviewedBy: id("User"),
    reviewNote: { type: String, default: "" },
    publishedAt: { type: Date, default: null },
    publishedBy: id("User"),
    createdBy: id("User"),
  },
  opts("yatra_tours"),
);
YatraTourSchema.index({ slug: 1 }, { unique: true });
YatraTourSchema.index({ operatorId: 1, status: 1 });
YatraTourSchema.index({ status: 1, originCityKey: 1, destinationCityKey: 1 });

export const YatraDepartureSchema = new Schema(
  {
    tourId: id(YATRA_MODEL.Tour, true),
    operatorId: id(YATRA_MODEL.Operator, true),
    vehicleId: id(YATRA_MODEL.Vehicle, true),
    departureCode: { type: String, required: true },
    departAt: { type: Date, required: true },
    returnAt: { type: Date, default: null },
    timezone: { type: String, default: "Asia/Kolkata" },
    boardingPoints: { type: SchemaTypes.Mixed, default: [] },
    fare: { type: Number, required: true, min: 1 },
    seatMode: { type: String, enum: SEAT_MODES, default: "choose" },
    seatLayout: { type: SchemaTypes.Mixed, default: null },
    blockedSeats: [{ type: String }],
    capacity: { type: Number, default: 0, min: 0 },
    bookedSeats: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: DEPARTURE_STATUSES, default: "draft" },
    salesOpenedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    cancelledBy: id("User"),
    cancellationReason: { type: String, default: "" },
    notes: { type: String, default: "" },
    createdBy: id("User"),
  },
  opts("yatra_departures"),
);
YatraDepartureSchema.index({ departureCode: 1 }, { unique: true });
YatraDepartureSchema.index({ tourId: 1, departAt: 1 });
YatraDepartureSchema.index({ operatorId: 1, departAt: -1 });
YatraDepartureSchema.index({ status: 1, departAt: 1 });

/**
 * The central seat inventory: one row per seat per departure. The unique
 * (departureId, seatNo) index makes a double-sold seat impossible, and every
 * claim is a conditional update inside a transaction.
 */
export const YatraSeatSchema = new Schema(
  {
    departureId: id(YATRA_MODEL.Departure, true),
    seatNo: { type: String, required: true },
    row: { type: Number, default: 0 },
    col: { type: Number, default: 0 },
    deck: { type: String, default: "lower" },
    kind: { type: String, default: "seater" },
    status: { type: String, enum: SEAT_STATUSES, default: "available" },
    bookingId: id(YATRA_MODEL.Booking),
    holdExpiresAt: { type: Date, default: null },
    heldAt: { type: Date, default: null },
    bookedAt: { type: Date, default: null },
  },
  opts("yatra_seats"),
);
YatraSeatSchema.index({ departureId: 1, seatNo: 1 }, { unique: true });
YatraSeatSchema.index({ departureId: 1, status: 1 });
YatraSeatSchema.index({ bookingId: 1 });

export const YatraBookingSchema = new Schema(
  {
    bookingReference: { type: String, required: true },
    departureId: id(YATRA_MODEL.Departure, true),
    tourId: id(YATRA_MODEL.Tour, true),
    operatorId: id(YATRA_MODEL.Operator, true),
    // The Tirvona account that owns (and paid for) the booking. Empty only
    // while an organiser-assisted booking waits for its customer to pay.
    customerId: id("User"),
    source: { type: String, enum: BOOKING_SOURCES, required: true },
    bookedByUserId: id("User", true),
    organizerStaffUserId: id("User"),
    organizerMemberRole: { type: String, default: "" },
    attribution: {
      linkId: id(YATRA_MODEL.Link),
      code: { type: String, default: "" },
      campaign: { type: String, default: "" },
    },
    seats: [{ type: String }],
    seatCount: { type: Number, required: true, min: 1 },
    passengers: { type: SchemaTypes.Mixed, default: [] },
    contact: {
      name: { type: String, default: "" },
      phone: { type: String, default: "" },
      email: { type: String, default: "" },
    },
    boardingPointId: { type: String, default: "" },
    boardingPointName: { type: String, default: "" },
    departAt: { type: Date, required: true },
    tourTitle: { type: String, default: "" },
    pricing: {
      farePerSeat: { type: Number, default: 0 },
      seatCount: { type: Number, default: 0 },
      subtotal: { type: Number, default: 0 },
      totalAmount: { type: Number, default: 0 },
      amountPaid: { type: Number, default: 0 },
      refundAmount: { type: Number, default: 0 },
      currency: { type: String, default: "INR" },
    },
    policySnapshot: { type: SchemaTypes.Mixed, default: null },
    commissionSnapshot: { type: SchemaTypes.Mixed, default: null },
    reminderSentAt: { type: Date, default: null },
    status: { type: String, enum: BOOKING_STATUSES, default: "held" },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: "unpaid" },
    holdExpiresAt: { type: Date, default: null },
    confirmedAt: { type: Date, default: null },
    journeyId: id(YATRA_MODEL.Journey),
    ticketCode: { type: String, default: "" },
    paymentLink: {
      jti: { type: String, default: "" },
      issuedAt: { type: Date, default: null },
      expiresAt: { type: Date, default: null },
      issuedBy: id("User"),
    },
    cancellation: {
      status: { type: String, default: "" },
      requestedAt: { type: Date, default: null },
      requestedBy: id("User"),
      reason: { type: String, default: "" },
      quotedPercent: { type: Number, default: 0 },
      quotedAmount: { type: Number, default: 0 },
      decidedAt: { type: Date, default: null },
      decidedBy: id("User"),
      decisionNote: { type: String, default: "" },
      refundPercent: { type: Number, default: 0 },
      refundAmount: { type: Number, default: 0 },
      refundedToWalletAt: { type: Date, default: null },
    },
    history: [historyEntry],
  },
  opts("yatra_bookings"),
);
YatraBookingSchema.index({ bookingReference: 1 }, { unique: true });
YatraBookingSchema.index({ customerId: 1, createdAt: -1 });
YatraBookingSchema.index({ operatorId: 1, createdAt: -1 });
YatraBookingSchema.index({ departureId: 1, status: 1 });
YatraBookingSchema.index({ status: 1, holdExpiresAt: 1 });
YatraBookingSchema.index({ source: 1, createdAt: -1 });

/** One payment attempt through Tirvona's Razorpay account. */
export const YatraPaymentSchema = new Schema(
  {
    purpose: { type: String, enum: PAYMENT_PURPOSES, default: "booking" },
    bookingId: id(YATRA_MODEL.Booking),
    serviceRequestId: id(YATRA_MODEL.ServiceRequest),
    rideRequestId: id(YATRA_MODEL.RideRequest),
    operatorId: id(YATRA_MODEL.Operator),
    userId: id("User", true),
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "INR" },
    method: { type: String, default: "razorpay" },
    channel: { type: String, default: "checkout" },
    status: { type: String, enum: PAYMENT_ROW_STATUSES, default: "pending" },
    gateway: {
      orderId: String,
      paymentId: String,
      signature: { type: String, select: false },
      provider: { type: String, default: "razorpay" },
    },
    paidAt: { type: Date, default: null },
    confirmedBy: { type: String, default: "" },
    failureReason: { type: String, default: "" },
    // A verified payment that could not be used (seats gone, already paid):
    // its amount went back to the payer's Tirvona wallet.
    unapplied: { type: Boolean, default: false },
  },
  opts("yatra_payments"),
);
YatraPaymentSchema.index({ bookingId: 1, status: 1 });
YatraPaymentSchema.index({ serviceRequestId: 1, status: 1 });
YatraPaymentSchema.index({ rideRequestId: 1, status: 1 });
YatraPaymentSchema.index({ status: 1, createdAt: -1 });
YatraPaymentSchema.index({ "gateway.orderId": 1 }, { unique: true, sparse: true });
YatraPaymentSchema.index({ "gateway.paymentId": 1 }, { unique: true, sparse: true });

/** Append-only money ledger. Entries are never edited; reversals are new rows. */
export const YatraLedgerEntrySchema = new Schema(
  {
    type: { type: String, enum: LEDGER_TYPES, required: true },
    direction: { type: String, enum: ["credit", "debit"], required: true },
    amount: { type: Number, required: true, min: 0 },
    bookingId: id(YATRA_MODEL.Booking),
    serviceRequestId: id(YATRA_MODEL.ServiceRequest),
    rideRequestId: id(YATRA_MODEL.RideRequest),
    ridePartnerId: id(YATRA_MODEL.RidePartner),
    paymentId: id(YATRA_MODEL.Payment),
    operatorId: id(YATRA_MODEL.Operator),
    customerId: id("User"),
    source: { type: String, default: "" },
    reference: { type: String, default: "" },
    description: { type: String, default: "" },
    idempotencyKey: { type: String, required: true },
    recordedBy: id("User"),
  },
  opts("yatra_ledger_entries"),
);
YatraLedgerEntrySchema.index({ idempotencyKey: 1 }, { unique: true });
YatraLedgerEntrySchema.index({ operatorId: 1, createdAt: -1 });
YatraLedgerEntrySchema.index({ type: 1, createdAt: -1 });
YatraLedgerEntrySchema.index({ bookingId: 1 });

/** A shareable booking link / QR an organiser gives to its own customers. */
export const YatraBookingLinkSchema = new Schema(
  {
    operatorId: id(YATRA_MODEL.Operator, true),
    tourId: id(YATRA_MODEL.Tour, true),
    departureId: id(YATRA_MODEL.Departure),
    code: { type: String, required: true },
    campaign: { type: String, default: "", trim: true },
    active: { type: Boolean, default: true },
    bookingsCount: { type: Number, default: 0 },
    createdBy: id("User"),
  },
  opts("yatra_booking_links"),
);
YatraBookingLinkSchema.index({ code: 1 }, { unique: true });
YatraBookingLinkSchema.index({ operatorId: 1, createdAt: -1 });

/** The pilgrim's trip: created once per confirmed Yatra booking. */
export const YatraJourneySchema = new Schema(
  {
    journeyNumber: { type: String, required: true },
    customerId: id("User", true),
    bookingId: id(YATRA_MODEL.Booking, true),
    departureId: id(YATRA_MODEL.Departure, true),
    tourId: id(YATRA_MODEL.Tour, true),
    operatorId: id(YATRA_MODEL.Operator, true),
    title: { type: String, default: "" },
    originCity: { type: String, default: "" },
    destinationCity: { type: String, default: "" },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    travellers: { type: Number, default: 1 },
    status: { type: String, enum: JOURNEY_STATUSES, default: "upcoming" },
  },
  opts("yatra_journeys"),
);
YatraJourneySchema.index({ journeyNumber: 1 }, { unique: true });
YatraJourneySchema.index({ bookingId: 1 }, { unique: true });
YatraJourneySchema.index({ customerId: 1, startDate: -1 });

/** A pilgrim's existing Stay / Parking / Aarti booking attached to a journey. */
export const YatraJourneyLinkSchema = new Schema(
  {
    journeyId: id(YATRA_MODEL.Journey, true),
    customerId: id("User", true),
    module: { type: String, enum: JOURNEY_LINK_MODULES, required: true },
    refId: { type: SchemaTypes.ObjectId, required: true },
    reference: { type: String, default: "" },
    title: { type: String, default: "" },
    date: { type: Date, default: null },
  },
  opts("yatra_journey_links"),
);
YatraJourneyLinkSchema.index({ journeyId: 1, module: 1, refId: 1 }, { unique: true });
YatraJourneyLinkSchema.index({ customerId: 1, createdAt: -1 });

/** A Food or Puja add-on requested from a journey, confirmed by the supplier. */
export const YatraServiceRequestSchema = new Schema(
  {
    requestNumber: { type: String, required: true },
    journeyId: id(YATRA_MODEL.Journey, true),
    bookingId: id(YATRA_MODEL.Booking, true),
    customerId: id("User", true),
    operatorId: id(YATRA_MODEL.Operator),
    serviceType: { type: String, enum: SERVICE_TYPES, required: true },
    serviceDate: { type: Date, required: true },
    details: { type: SchemaTypes.Mixed, default: {} },
    foodVendorId: id(YATRA_MODEL.FoodVendorRef),
    providerId: id(YATRA_MODEL.ProviderRef),
    supplierName: { type: String, default: "" },
    status: { type: String, enum: SERVICE_REQUEST_STATUSES, default: "requested" },
    quotedAmount: { type: Number, default: 0, min: 0 },
    quotedAt: { type: Date, default: null },
    quotedBy: id("User"),
    supplierNote: { type: String, default: "" },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: "unpaid" },
    paidAt: { type: Date, default: null },
    confirmedAt: { type: Date, default: null },
    fulfilledAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    cancelReason: { type: String, default: "" },
    refundAmount: { type: Number, default: 0 },
    commissionSnapshot: { type: SchemaTypes.Mixed, default: null },
    history: [historyEntry],
  },
  opts("yatra_service_requests"),
);
YatraServiceRequestSchema.index({ requestNumber: 1 }, { unique: true });
YatraServiceRequestSchema.index({ journeyId: 1, createdAt: -1 });
YatraServiceRequestSchema.index({ foodVendorId: 1, status: 1 });
YatraServiceRequestSchema.index({ providerId: 1, status: 1 });
YatraServiceRequestSchema.index({ status: 1, createdAt: -1 });

/** Platform settings for Yatra (a single row, scope "platform"). */
export const YatraSettingSchema = new Schema(
  {
    scope: { type: String, default: "platform" },
    holdMinutes: { type: Number, default: null },
    paymentLinkMinutes: { type: Number, default: null },
    maxSeatsPerBooking: { type: Number, default: null },
    salesCloseMinutes: { type: Number, default: null },
    supportPhone: { type: String, default: "" },
    rideFullRefundHours: { type: Number, default: null },
    ridePartnerResponseHours: { type: Number, default: null },
    reminderHours: { type: Number, default: null },
    updatedBy: id("User"),
  },
  opts("yatra_settings"),
);
YatraSettingSchema.index({ scope: 1 }, { unique: true });

export const YATRA_SCHEMAS = [
  [YATRA_MODEL.Operator, YatraOperatorSchema],
  [YATRA_MODEL.Member, YatraOperatorMemberSchema],
  [YATRA_MODEL.Document, YatraDocumentSchema],
  [YATRA_MODEL.Vehicle, YatraVehicleSchema],
  [YATRA_MODEL.Tour, YatraTourSchema],
  [YATRA_MODEL.Departure, YatraDepartureSchema],
  [YATRA_MODEL.Seat, YatraSeatSchema],
  [YATRA_MODEL.Booking, YatraBookingSchema],
  [YATRA_MODEL.Payment, YatraPaymentSchema],
  [YATRA_MODEL.Ledger, YatraLedgerEntrySchema],
  [YATRA_MODEL.Link, YatraBookingLinkSchema],
  [YATRA_MODEL.Journey, YatraJourneySchema],
  [YATRA_MODEL.JourneyLink, YatraJourneyLinkSchema],
  [YATRA_MODEL.ServiceRequest, YatraServiceRequestSchema],
  [YATRA_MODEL.Setting, YatraSettingSchema],
] as const;
