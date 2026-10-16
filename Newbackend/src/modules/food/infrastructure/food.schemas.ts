import { Schema, SchemaTypes } from "../../../database/orm";
import {
  FOOD_DIETARY_TAGS,
  FOOD_FULFILMENT_TYPES,
  FOOD_LEDGER_ACCOUNTS,
  FOOD_LEDGER_ENTRY_TYPES,
  FOOD_MEAL_FAMILIES,
  FOOD_ORDER_STATUSES,
  FOOD_OUTLET_STATUSES,
  FOOD_PAYMENT_STATUSES,
  FOOD_REFUND_STATUSES,
  FOOD_SETTLEMENT_STATUSES,
  FOOD_VENDOR_STATUSES,
} from "../domain/food.constants";

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

/**
 * 1. food_vendors
 */
export const FoodVendorSchema = new Schema(
  {
    businessName: { type: String, required: true, trim: true },
    ownerUserId: id("User"),
    fssaiReference: { type: String, trim: true },
    fssaiExpiry: { type: Date },
    complianceStatus: {
      type: String,
      enum: FOOD_VENDOR_STATUSES,
      default: "active",
      index: true,
    },
    bankAccountNumber: { type: String, trim: true },
    bankIfscCode: { type: String, trim: true },
    bankAccountHolderName: { type: String, trim: true },
    bankName: { type: String, trim: true },
    contactName: { type: String, trim: true },
    contactPhone: { type: String, trim: true },
    contactEmail: { type: String, trim: true, lowercase: true },
    settlementProfileId: { type: String, trim: true },
    status: {
      type: String,
      enum: FOOD_VENDOR_STATUSES,
      default: "active",
      index: true,
    },
  },
  opts("food_vendors"),
);

/**
 * 2. food_outlets
 */
export const FoodOutletSchema = new Schema(
  {
    vendorId: id("FoodVendor", true),
    brandName: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    lat: { type: Number, default: 27.5706 }, // default Vrindavan approx
    lng: { type: Number, default: 77.7007 },
    openTime: { type: String, default: "08:00" },
    closeTime: { type: String, default: "22:00" },
    serviceZoneCodes: [{ type: String, trim: true }],
    status: {
      type: String,
      enum: FOOD_OUTLET_STATUSES,
      default: "active",
      index: true,
    },
    fulfilmentModes: [
      {
        type: String,
        enum: FOOD_FULFILMENT_TYPES,
      },
    ],
    contactPhone: { type: String, trim: true },
    capacityPerHour: { type: Number, default: 50 },
    commissionRateBps: { type: Number, default: 1250 }, // 12.5%
    minOrderPaise: { type: Number, default: 9900 },
    avgPrepMinutes: { type: Number, default: 20 },
    isPaused: { type: Boolean, default: false, index: true },
    rating: { type: Number, default: 4.8 },
    ratingCount: { type: Number, default: 24 },
    imageUrl: { type: String, trim: true },
    description: { type: String, trim: true },
  },
  opts("food_outlets"),
);

/**
 * 3. food_products
 */
export const FoodProductSchema = new Schema(
  {
    family: {
      type: String,
      enum: FOOD_MEAL_FAMILIES,
      required: true,
      index: true,
    },
    canonicalName: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    defaultImageUrl: { type: String, trim: true },
    approvedStatus: {
      type: String,
      enum: ["approved", "pending", "rejected"],
      default: "approved",
      index: true,
    },
    skuFamily: { type: String, trim: true, index: true },
  },
  opts("food_products"),
);

/**
 * 4. food_product_variants
 */
export const FoodProductVariantSchema = new Schema(
  {
    outletId: id("FoodOutlet", true),
    productId: id("FoodProduct", true),
    sku: { type: String, required: true, trim: true, index: true },
    label: { type: String, required: true, trim: true },
    contents: { type: String, trim: true },
    dietaryTags: [
      {
        type: String,
        enum: FOOD_DIETARY_TAGS,
      },
    ],
    pricePaise: { type: Number, required: true },
    prepMinutes: { type: Number, default: 15 },
    portion: { type: String, trim: true },
    isAvailable: { type: Boolean, default: true, index: true },
    dailyCapacity: { type: Number, default: 100 },
    cutOffTime: { type: String, trim: true },
    imageUrl: { type: String, trim: true },
  },
  opts("food_product_variants"),
);

/**
 * 5. food_carts
 */
export const FoodCartSchema = new Schema(
  {
    customerId: id("User"),
    sessionId: { type: String, trim: true, index: true },
    outletId: id("FoodOutlet", true),
    specialInstructions: { type: String, trim: true },
    expiresAt: { type: Date, index: true },
  },
  opts("food_carts"),
);

/**
 * 6. food_cart_items
 */
export const FoodCartItemSchema = new Schema(
  {
    cartId: id("FoodCart", true),
    variantId: id("FoodProductVariant", true),
    quantity: { type: Number, required: true, min: 1, default: 1 },
    customerNotes: { type: String, trim: true },
    addedPricePaise: { type: Number, required: true },
  },
  opts("food_cart_items"),
);

/**
 * 7. food_quotes
 */
export const FoodQuoteSchema = new Schema(
  {
    quoteId: { type: String, required: true, unique: true, index: true },
    quoteHash: { type: String, required: true },
    customerId: id("User"),
    sessionId: { type: String, trim: true },
    outletId: id("FoodOutlet", true),
    items: { type: SchemaTypes.Mixed, required: true },
    subtotalPaise: { type: Number, required: true },
    deliveryFeePaise: { type: Number, default: 0 },
    packagingFeePaise: { type: Number, default: 0 },
    taxPaise: { type: Number, default: 0 },
    discountPaise: { type: Number, default: 0 },
    totalPaise: { type: Number, required: true },
    fulfilmentType: {
      type: String,
      enum: FOOD_FULFILMENT_TYPES,
      required: true,
    },
    destinationAddress: { type: String, trim: true },
    stayBookingId: { type: String, trim: true },
    stayRoomNumber: { type: String, trim: true },
    expiresAt: { type: Date, required: true, index: true },
  },
  opts("food_quotes"),
);

/**
 * 8. food_orders
 */
export const FoodOrderSchema = new Schema(
  {
    orderNumber: { type: String, required: true, unique: true, index: true },
    quoteId: { type: String, trim: true },
    customerId: id("User"),
    sessionId: { type: String, trim: true },
    customerName: { type: String, required: true, trim: true },
    customerPhone: { type: String, required: true, trim: true },
    customerEmail: { type: String, trim: true, lowercase: true },
    outletId: id("FoodOutlet", true),
    bookingId: id("Booking"),
    stayRoomNumber: { type: String, trim: true },
    fulfilmentType: {
      type: String,
      enum: FOOD_FULFILMENT_TYPES,
      required: true,
    },
    deliveryAddress: { type: String, trim: true },
    deliveryInstructions: { type: String, trim: true },
    orderStatus: {
      type: String,
      enum: FOOD_ORDER_STATUSES,
      default: "DRAFT",
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: FOOD_PAYMENT_STATUSES,
      default: "PENDING",
      index: true,
    },
    rejectionReason: { type: String, trim: true },
    subtotalPaise: { type: Number, required: true },
    deliveryFeePaise: { type: Number, default: 0 },
    packagingFeePaise: { type: Number, default: 0 },
    taxPaise: { type: Number, default: 0 },
    discountPaise: { type: Number, default: 0 },
    totalPaise: { type: Number, required: true },
    vendorAcceptanceDeadline: { type: Date, index: true },
    vendorAcceptedAt: { type: Date },
    preparedAt: { type: Date },
    readyAt: { type: Date },
    outForDeliveryAt: { type: Date },
    deliveredAt: { type: Date },
    completedAt: { type: Date },
    cancelledAt: { type: Date },
    idempotencyKey: { type: String, trim: true, index: true },
  },
  opts("food_orders"),
);

/**
 * 9. food_order_items
 */
export const FoodOrderItemSchema = new Schema(
  {
    orderId: id("FoodOrder", true),
    variantId: id("FoodProductVariant"),
    sku: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPricePaise: { type: Number, required: true },
    totalPricePaise: { type: Number, required: true },
    dietaryTags: [{ type: String }],
    contents: { type: String, trim: true },
    portion: { type: String, trim: true },
    customerNotes: { type: String, trim: true },
  },
  opts("food_order_items"),
);

/**
 * 10. food_order_events (Immutable state change audit)
 */
export const FoodOrderEventSchema = new Schema(
  {
    orderId: id("FoodOrder", true),
    fromStatus: { type: String, trim: true },
    toStatus: { type: String, required: true, trim: true },
    actorType: {
      type: String,
      enum: ["customer", "vendor", "admin", "system"],
      required: true,
    },
    actorId: { type: String, trim: true },
    reason: { type: String, trim: true },
    metadata: { type: SchemaTypes.Mixed },
  },
  opts("food_order_events"),
);

/**
 * 11. food_payment_attempts
 */
export const FoodPaymentAttemptSchema = new Schema(
  {
    orderId: id("FoodOrder", true),
    gatewayProvider: { type: String, required: true, trim: true },
    gatewayOrderId: { type: String, trim: true, index: true },
    gatewayPaymentId: { type: String, trim: true, index: true },
    gatewaySignature: { type: String, trim: true },
    amountPaise: { type: Number, required: true },
    currency: { type: String, default: "INR" },
    status: {
      type: String,
      enum: ["pending", "success", "failed"],
      default: "pending",
      index: true,
    },
    webhookReference: { type: String, trim: true },
    idempotencyKey: { type: String, trim: true, index: true },
  },
  opts("food_payment_attempts"),
);

/**
 * 12. food_delivery_tasks
 */
export const FoodDeliveryTaskSchema = new Schema(
  {
    orderId: id("FoodOrder", true),
    outletId: id("FoodOutlet", true),
    fulfilmentMode: { type: String, required: true, trim: true },
    pickupAddress: { type: String, trim: true },
    destinationAddress: { type: String, trim: true },
    stayId: id("Ashram"),
    roomNumber: { type: String, trim: true },
    otpCode: { type: String, trim: true },
    proofUrl: { type: String, trim: true },
    status: { type: String, default: "pending", index: true },
    deliveredAt: { type: Date },
  },
  opts("food_delivery_tasks"),
);

/**
 * 13. food_refunds
 */
export const FoodRefundSchema = new Schema(
  {
    orderId: id("FoodOrder", true),
    paymentAttemptId: id("FoodPaymentAttempt"),
    amountPaise: { type: Number, required: true },
    reason: { type: String, required: true, trim: true },
    gatewayRefundId: { type: String, trim: true, index: true },
    status: {
      type: String,
      enum: FOOD_REFUND_STATUSES,
      default: "pending",
      index: true,
    },
    failureReason: { type: String, trim: true },
    initiatedBy: { type: String, trim: true },
    resolvedAt: { type: Date },
  },
  opts("food_refunds"),
);

/**
 * 14. food_ledger_entries (Immutable Double-Entry Accounting)
 */
export const FoodLedgerEntrySchema = new Schema(
  {
    entryId: { type: String, required: true, unique: true, index: true },
    orderId: id("FoodOrder"),
    entryType: {
      type: String,
      enum: FOOD_LEDGER_ENTRY_TYPES,
      required: true,
      index: true,
    },
    account: {
      type: String,
      enum: FOOD_LEDGER_ACCOUNTS,
      required: true,
      index: true,
    },
    debitPaise: { type: Number, default: 0 },
    creditPaise: { type: Number, default: 0 },
    description: { type: String, required: true, trim: true },
    referenceId: { type: String, trim: true },
    actorId: { type: String, trim: true },
  },
  opts("food_ledger_entries"),
);

/**
 * 15. food_settlements
 */
export const FoodSettlementSchema = new Schema(
  {
    outletId: id("FoodOutlet", true),
    vendorId: id("FoodVendor", true),
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    grossFoodValuePaise: { type: Number, required: true },
    commissionRateBps: { type: Number, required: true },
    commissionAmountPaise: { type: Number, required: true },
    taxOnCommissionPaise: { type: Number, default: 0 },
    deliveryRetainedPaise: { type: Number, default: 0 },
    adjustmentsPaise: { type: Number, default: 0 },
    netPayablePaise: { type: Number, required: true },
    orderCount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: FOOD_SETTLEMENT_STATUSES,
      default: "draft",
      index: true,
    },
    approvedBy: id("User"),
    approvedAt: { type: Date },
    payoutReference: { type: String, trim: true },
    paidAt: { type: Date },
  },
  opts("food_settlements"),
);

/**
 * 16. food_service_zones
 */
export const FoodServiceZoneSchema = new Schema(
  {
    zoneCode: { type: String, required: true, unique: true, trim: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    active: { type: Boolean, default: true, index: true },
    deliveryFeePaise: { type: Number, default: 3500 },
    minOrderPaise: { type: Number, default: 9900 },
    boundaryGeoJson: { type: SchemaTypes.Mixed },
  },
  opts("food_service_zones"),
);

/**
 * 17. food_vendor_documents
 */
export const FoodVendorDocumentSchema = new Schema(
  {
    vendorId: id("FoodVendor", true),
    docType: { type: String, required: true, trim: true },
    fileUrl: { type: String, required: true, trim: true },
    storagePath: { type: String, trim: true },
    expiryDate: { type: Date },
    verificationStatus: {
      type: String,
      enum: ["pending", "verified", "rejected"],
      default: "pending",
      index: true,
    },
    verifiedBy: id("User"),
    notes: { type: String, trim: true },
  },
  opts("food_vendor_documents"),
);

/**
 * 18. food_reviews_and_complaints
 */
export const FoodReviewAndComplaintSchema = new Schema(
  {
    orderId: id("FoodOrder", true),
    customerId: id("User"),
    outletId: id("FoodOutlet", true),
    rating: { type: Number, min: 1, max: 5 },
    tags: [{ type: String, trim: true }],
    comment: { type: String, trim: true },
    complaintCategory: { type: String, trim: true },
    complaintStatus: {
      type: String,
      enum: ["none", "open", "investigating", "resolved", "refunded"],
      default: "none",
      index: true,
    },
    resolutionNotes: { type: String, trim: true },
    resolvedBy: id("User"),
  },
  opts("food_reviews_and_complaints"),
);
