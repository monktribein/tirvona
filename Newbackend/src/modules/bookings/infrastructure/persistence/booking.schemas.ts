import { Schema, SchemaTypes } from "mongoose";
import { IDENTITY_CODE_PATTERN } from "../../domain/identity-code";
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

export const BookingSchema = new Schema(
  {
    bookingId: { type: String, required: true, unique: true },
    reservationNumber: { type: String, unique: true, sparse: true },
    /**
     * Ashram Booking Unique Identity Code — `CCPT-PPPPP-VXXXX`.
     *
     * `immutable`, so Mongoose strips it from any later update: a code handed
     * to a guest is never rewritten. `sparse`, because bookings created before
     * this field existed carry no code and a plain unique index over their
     * missing values would admit exactly one such row platform-wide.
     *
     * Not `required` for the same reason — the existing corpus stays valid and
     * every existing read path keeps working untouched.
     */
    identityCode: {
      type: String,
      unique: true,
      sparse: true,
      immutable: true,
      uppercase: true,
      trim: true,
      match: IDENTITY_CODE_PATTERN,
    },
    customerId: id("User", true),
    ashramId: id("Ashram", true),
    roomId: id("Room", true),
    checkInDate: { type: Date, required: true },
    checkOutDate: { type: Date, required: true },
    occupiedDates: [Date],
    guestsCount: { type: Number, required: true, min: 1 },
    roomsBookedCount: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      enum: [
        "pending",
        "confirmed",
        "checked_in",
        "checked_out",
        "completed",
        "cancelled",
        "refunded",
        "no_show",
        "expired",
      ],
      default: "pending",
      index: true,
    },
    services: {
      prasad: { ordered: Boolean, price: Number },
      meals: { ordered: Boolean, price: Number },
      parking: { ordered: Boolean, price: Number },
      locker: { ordered: Boolean, price: Number },
      donation: { amount: Number },
      selectedAddOns: [
        {
          serviceId: String,
          name: String,
          price: Number,
          unit: String,
          unitLabel: String,
          quantity: Number,
          totalPrice: Number,
        },
      ],
    },
    pricing: {
      basePrice: { type: Number, required: true },
      servicesPrice: { type: Number, default: 0 },
      donationAmount: { type: Number, default: 0 },
      extraGuestAmount: { type: Number, default: 0 },
      mealAmount: { type: Number, default: 0 },
      upgradeAmount: { type: Number, default: 0 },
      discountAmount: { type: Number, default: 0 },
      loyaltyDiscount: { type: Number, default: 0 },
      gstAmount: { type: Number, default: 0 },
      // GST is levied on the platform fee only, never on the stay, so the
      // taxable base is recorded alongside the rate that produced the amount.
      gstPercent: { type: Number, default: 18 },
      gstTaxableAmount: { type: Number, default: 0 },
      platformFee: { type: Number, default: 0 },
      originalAmount: Number,
      finalAmount: Number,
      totalSavings: { type: Number, default: 0 },
      totalAmount: { type: Number, required: true },
      amountPaid: { type: Number, default: 0 },
      currency: { type: String, default: "INR" },
    },
    offerId: id("BookingCoupon"),
    appliedOfferId: id("BookingCoupon"),
    offerName: String,
    promoCode: { type: String, uppercase: true, trim: true },
    discountType: String,
    discountPercentage: Number,
    reservationExpiresAt: Date,
    paymentSummary: SchemaTypes.Mixed,
    assignedRoomNumber: String,
    paymentMode: {
      type: String,
      enum: ["pay_at_ashram", "online", "offline"],
      default: "pay_at_ashram",
    },
    gatewayStatus: {
      type: String,
      enum: ["not_initiated", "pending", "success", "failed"],
      default: "not_initiated",
    },
    specialRequests: String,
    paymentStatus: {
      type: String,
      enum: ["pending", "partially_paid", "fully_paid", "refunded"],
      default: "pending",
      index: true,
    },
    checkInCode: { type: String, required: true },
    cancellation: {
      reason: String,
      date: Date,
      refundAmount: Number,
      refundTransactionId: String,
    },
    version: { type: Number, default: 1 },
  },
  opts("booking_bookings"),
);
BookingSchema.index({ customerId: 1, createdAt: -1 });
BookingSchema.index({ ashramId: 1, status: 1, createdAt: -1 });
BookingSchema.index({ ashramId: 1, checkInDate: 1 });
BookingSchema.index({ status: 1, reservationExpiresAt: 1 });

export const BookingStatusHistorySchema = new Schema(
  {
    bookingId: id("Booking", true),
    fromStatus: String,
    toStatus: { type: String, required: true },
    note: String,
    actorId: id("User"),
    actorRole: String,
    metadata: { type: SchemaTypes.Mixed, default: {} },
    occurredAt: { type: Date, default: Date.now },
  },
  opts("booking_status_history"),
);
BookingStatusHistorySchema.index({ bookingId: 1, occurredAt: 1 });
export const BookingGuestDetailSchema = new Schema(
  {
    bookingId: id("Booking", true),
    customerId: id("User", true),
    guests: [
      {
        name: String,
        age: Number,
        gender: String,
        idType: String,
        idNumberEncrypted: { type: String, select: false },
        isPrimary: Boolean,
      },
    ],
    specialNeeds: String,
  },
  opts("booking_guest_details"),
);
BookingGuestDetailSchema.index({ bookingId: 1 }, { unique: true });
export const BookingRoomAssignmentSchema = new Schema(
  {
    bookingId: id("Booking", true),
    ashramId: id("Ashram", true),
    roomId: id("Room", true),
    roomNumber: { type: String, required: true },
    assignedBy: id("User", true),
    assignedAt: { type: Date, default: Date.now },
    releasedAt: Date,
    status: {
      type: String,
      enum: ["assigned", "occupied", "released"],
      default: "assigned",
    },
  },
  opts("booking_room_assignments"),
);
BookingRoomAssignmentSchema.index({ bookingId: 1, status: 1 });
BookingRoomAssignmentSchema.index({ ashramId: 1, roomNumber: 1, status: 1 });
export const BookingCheckinSchema = new Schema(
  {
    bookingId: id("Booking", true),
    ashramId: id("Ashram", true),
    verifiedBy: id("User", true),
    checkInCodeHash: String,
    checkedInAt: { type: Date, default: Date.now },
    guestCount: Number,
    roomNumber: String,
    notes: String,
  },
  opts("booking_checkins"),
);
BookingCheckinSchema.index({ bookingId: 1 }, { unique: true });
export const BookingCheckoutSchema = new Schema(
  {
    bookingId: id("Booking", true),
    ashramId: id("Ashram", true),
    checkedOutBy: id("User", true),
    checkedOutAt: { type: Date, default: Date.now },
    damages: [{ description: String, amount: Number }],
    additionalCharges: Number,
    notes: String,
  },
  opts("booking_checkouts"),
);
BookingCheckoutSchema.index({ bookingId: 1 }, { unique: true });

export const BookingInventoryHoldSchema = new Schema(
  {
    bookingId: { ...id("Booking", true), unique: true },
    ashramId: id("Ashram", true),
    roomId: id("Room", true),
    dates: [Date],
    units: { type: Number, required: true, min: 1 },
    state: {
      type: String,
      enum: ["held", "confirmed", "released", "expired"],
      default: "held",
      index: true,
    },
    expiresAt: Date,
    confirmedAt: Date,
    releasedAt: Date,
    releaseReason: String,
  },
  opts("booking_inventory"),
);
BookingInventoryHoldSchema.index({ state: 1, expiresAt: 1 });
BookingInventoryHoldSchema.index({ roomId: 1, dates: 1, state: 1 });
