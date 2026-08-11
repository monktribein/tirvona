import { Schema, SchemaTypes } from "mongoose";
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

export const BookingCouponSchema = new Schema(
  {
    ownerId: id("User", true),
    ashramId: id("Ashram"),
    applicableAshrams: [{ type: SchemaTypes.ObjectId, ref: "Ashram" }],
    applicableCities: [String],
    applicableStates: [String],
    applicableRoomCategories: [String],
    offerTitle: { type: String, required: true },
    shortTitle: String,
    subtitle: String,
    offerType: String,
    description: { type: String, required: true },
    fullHtmlDescription: String,
    highlights: [String],
    termsAndConditions: [String],
    bannerImage: String,
    thumbnailImage: String,
    desktopBanner: String,
    mobileBanner: String,
    galleryImages: [String],
    promoCode: { type: String, required: true, uppercase: true, trim: true },
    discountType: {
      type: String,
      enum: [
        "Percentage",
        "Flat Amount",
        "Free Upgrade",
        "Free Meal",
        "Free Prasad",
        "Free Donation Coupon",
      ],
      default: "Percentage",
    },
    discountValue: { type: Number, required: true, min: 0 },
    maximumDiscount: Number,
    minimumBookingAmount: Number,
    validFrom: Date,
    validTill: { type: Date, required: true },
    maximumRedemptions: { type: Number, default: 100 },
    remainingRedemptions: { type: Number, default: 100 },
    perUserLimit: { type: Number, default: 1 },
    priority: Number,
    featured: Boolean,
    status: {
      type: String,
      enum: ["draft", "scheduled", "active", "expired", "disabled"],
      default: "active",
      index: true,
    },
    viewsCount: Number,
    clicksCount: Number,
    redemptionsCount: Number,
    revenueGenerated: Number,
    // An offer that has already been redeemed cannot be removed outright — a
    // booking's `appliedOfferId` and every redemption row still point at it, and
    // those references are immutable. Deleting one archives it instead: it
    // leaves every listing, public and administrative, but the financial trail
    // survives. Offers that were never redeemed are removed for real.
    deletedAt: { type: Date, default: null, index: true },
    deletedBy: id("User"),
    createdBy: id("User"),
    updatedBy: id("User"),
  },
  opts("booking_coupons"),
);
BookingCouponSchema.index({ promoCode: 1 }, { unique: true });
BookingCouponSchema.index({ status: 1, validTill: 1 });
BookingCouponSchema.index({ ownerId: 1, createdAt: -1 });
BookingCouponSchema.index({ ashramId: 1, status: 1 });
BookingCouponSchema.index({ applicableAshrams: 1, status: 1 });

export const BookingOfferRedemptionSchema = new Schema(
  {
    couponId: id("BookingCoupon", true),
    bookingId: { ...id("Booking", true), unique: true },
    userId: id("User", true),
    ashramId: id("Ashram", true),
    promoCode: String,
    bookingAmount: Number,
    discountAmount: Number,
    status: {
      type: String,
      enum: ["reserved", "redeemed", "released", "reversed"],
      default: "reserved",
    },
    reservedAt: Date,
    redeemedAt: Date,
    releasedAt: Date,
  },
  opts("booking_offer_redemptions"),
);
BookingOfferRedemptionSchema.index({ couponId: 1, userId: 1, status: 1 });

export const BookingNotificationSchema = new Schema(
  {
    userId: id("User", true),
    bookingId: id("Booking"),
    ashramId: id("Ashram"),
    event: { type: String, required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    channel: {
      type: String,
      enum: ["in_app", "email", "sms", "push", "socket"],
      default: "in_app",
    },
    status: {
      type: String,
      enum: ["queued", "sent", "failed", "skipped"],
      default: "queued",
      index: true,
    },
    providerMessageId: String,
    deliveryError: String,
    sentAt: Date,
    readAt: Date,
    meta: { type: SchemaTypes.Mixed, default: {} },
  },
  opts("booking_notifications"),
);
BookingNotificationSchema.index({ userId: 1, createdAt: -1 });
BookingNotificationSchema.index({ bookingId: 1, event: 1 });

export const BookingReviewSchema = new Schema(
  {
    customerId: id("User", true),
    ashramId: id("Ashram", true),
    // Optional: a review may come from a past guest (carrying the booking it
    // relates to) or from a visitor who has not stayed. `verifiedStay` is what
    // distinguishes them on screen, so the absence of a booking is a normal
    // state rather than incomplete data.
    bookingId: id("Booking"),
    verifiedStay: { type: Boolean, default: false, index: true },
    rating: {
      overall: { type: Number, required: true, min: 1, max: 5 },
      // Sub-scores are optional so a short review is not a form-filling chore;
      // the overall score is the one every review must carry.
      cleanliness: { type: Number, min: 1, max: 5 },
      service: { type: Number, min: 1, max: 5 },
      location: { type: Number, min: 1, max: 5 },
      valueForMoney: { type: Number, min: 1, max: 5 },
    },
    comment: { type: String, required: true },
    reply: { managerId: id("User"), comment: String, timestamp: Date },
    status: {
      type: String,
      enum: ["pending", "approved", "hidden"],
      default: "approved",
    },
  },
  opts("booking_reviews"),
);
// Sparse, because most reviews now carry no booking at all and a plain unique
// index would permit only ONE such document across the whole collection.
// PARTIAL, not sparse. The schema stores `bookingId: null` for a visitor
// review, and a sparse index only skips documents where the field is ABSENT —
// an explicit null is still indexed, so two visitor reviews collided on a
// duplicate null and the second one anywhere on the platform failed.
// Restricting the index to real ObjectIds keeps "one review per booking" while
// leaving null-booking reviews unconstrained.
BookingReviewSchema.index(
  { bookingId: 1 },
  {
    unique: true,
    partialFilterExpression: { bookingId: { $type: "objectId" } },
  },
);
// One review per person per ashram, which is what stops a single account from
// burying a property under repeat posts.
BookingReviewSchema.index({ customerId: 1, ashramId: 1 }, { unique: true });
BookingReviewSchema.index({ ashramId: 1, status: 1, createdAt: -1 });
BookingReviewSchema.index({ status: 1, createdAt: -1 });

export const BookingPolicySchema = new Schema(
  {
    scope: { type: String, enum: ["platform", "ashram"], required: true },
    ashramId: id("Ashram"),
    holdMinutes: Number,
    cancellationFreeHours: Number,
    refundBeforeWindowPercent: Number,
    refundInsideWindowPercent: Number,
    taxPercent: Number,
    platformCommissionPercent: Number,
    platformFeePercent: Number,
    checkInEarlyMinutes: Number,
    noShowAfterMinutes: Number,
    isActive: { type: Boolean, default: true },
    updatedBy: id("User"),
  },
  opts("booking_policies"),
);
BookingPolicySchema.index({ scope: 1, ashramId: 1 }, { unique: true });
export const BookingHolidaySchema = new Schema(
  {
    name: { type: String, required: true },
    ashramId: id("Ashram"),
    startDate: Date,
    endDate: Date,
    multiplier: { type: Number, default: 1 },
    isClosed: { type: Boolean, default: false },
    type: String,
    isActive: { type: Boolean, default: true },
    createdBy: id("User"),
  },
  opts("booking_holidays"),
);
BookingHolidaySchema.index({
  ashramId: 1,
  startDate: 1,
  endDate: 1,
  isActive: 1,
});
export const BookingAuditLogSchema = new Schema(
  {
    userId: id("User"),
    action: { type: String, required: true },
    module: { type: String, default: "BOOKING_ENGINE", index: true },
    bookingId: id("Booking"),
    ashramId: id("Ashram"),
    before: SchemaTypes.Mixed,
    after: SchemaTypes.Mixed,
    details: SchemaTypes.Mixed,
    requestId: String,
    ipAddress: String,
    userAgent: String,
    occurredAt: { type: Date, default: Date.now },
    timestamp: { type: Date, default: Date.now },
  },
  opts("booking_audit_logs"),
);
BookingAuditLogSchema.index({ ashramId: 1, occurredAt: -1 });
BookingAuditLogSchema.index({ bookingId: 1, occurredAt: -1 });
export const BookingReportSchema = new Schema(
  {
    reportType: { type: String, required: true },
    ashramId: id("Ashram"),
    ownerId: id("User"),
    range: { from: Date, to: Date },
    parameters: SchemaTypes.Mixed,
    status: {
      type: String,
      enum: ["queued", "processing", "completed", "failed"],
      default: "queued",
    },
    resultUrl: String,
    generatedAt: Date,
    expiresAt: Date,
    requestedBy: id("User"),
  },
  opts("booking_reports"),
);
BookingReportSchema.index({ requestedBy: 1, createdAt: -1 });
BookingReportSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
