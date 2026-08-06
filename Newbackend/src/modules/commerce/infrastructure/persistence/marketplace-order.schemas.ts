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

export const MARKETPLACE_ORDER_STATUSES = [
  "pending_payment",
  "confirmed",
  "packed",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
] as const;

export const MARKETPLACE_PAYMENT_STATUSES = [
  "pending",
  "paid",
  "failed",
  "refunded",
] as const;

/**
 * A saved delivery address, reusable across orders.
 *
 * Kept in its own collection rather than embedded on the user so the address
 * book can grow, be soft-deleted, and be indexed independently — and so the
 * marketplace domain owns its own data rather than writing into `users`.
 */
export const MarketplaceAddressSchema = new Schema(
  {
    customerId: id("User", true),
    label: { type: String, default: "Home", trim: true },
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    line1: { type: String, required: true, trim: true },
    line2: { type: String, default: "", trim: true },
    landmark: { type: String, default: "", trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    pincode: { type: String, required: true, trim: true },
    country: { type: String, default: "India", trim: true },
    isDefault: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  opts("marketplace_addresses"),
);
MarketplaceAddressSchema.index({ customerId: 1, isDeleted: 1, isDefault: -1 });

/**
 * A marketplace order.
 *
 * Line prices are a SERVER-SIDE snapshot taken from the product catalogue at
 * checkout — never a figure supplied by the client — so a tampered request
 * cannot buy a ₹899 box for ₹1. The snapshot is stored rather than referenced
 * so a later price change never rewrites the customer's history.
 */
export const MarketplaceOrderSchema = new Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    customerId: id("User", true),
    items: [
      {
        productId: id("MarketplaceProduct", true),
        name: { type: String, required: true },
        slug: String,
        image: String,
        unitPrice: { type: Number, required: true, min: 0 },
        quantity: { type: Number, required: true, min: 1 },
        lineTotal: { type: Number, required: true, min: 0 },
      },
    ],
    // Denormalised copy, not a reference: editing a saved address later must
    // never silently change where a past order was shipped.
    shippingAddress: {
      fullName: String,
      phone: String,
      line1: String,
      line2: String,
      landmark: String,
      city: String,
      state: String,
      pincode: String,
      country: { type: String, default: "India" },
    },
    addressId: id("MarketplaceAddress"),
    pricing: {
      itemsTotal: { type: Number, required: true, min: 0 },
      shippingFee: { type: Number, default: 0, min: 0 },
      gstAmount: { type: Number, default: 0, min: 0 },
      gstPercent: { type: Number, default: 5 },
      totalAmount: { type: Number, required: true, min: 0 },
      amountPaid: { type: Number, default: 0, min: 0 },
      currency: { type: String, default: "INR" },
    },
    orderStatus: {
      type: String,
      enum: MARKETPLACE_ORDER_STATUSES,
      default: "pending_payment",
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: MARKETPLACE_PAYMENT_STATUSES,
      default: "pending",
      index: true,
    },
    paymentMode: {
      type: String,
      enum: ["online", "cod"],
      default: "online",
    },
    gateway: {
      provider: String,
      orderId: { type: String, index: true, sparse: true },
      paymentId: String,
    },
    notes: { type: String, default: "" },
    cancelledAt: Date,
    cancelReason: String,
  },
  opts("marketplace_orders"),
);
MarketplaceOrderSchema.index({ customerId: 1, createdAt: -1 });
MarketplaceOrderSchema.index({ orderStatus: 1, createdAt: -1 });

/**
 * One row per gateway event, so a retried webhook or a double-submitted
 * checkout cannot be applied twice. `eventId` is unique for exactly that.
 */
export const MarketplacePaymentSchema = new Schema(
  {
    orderId: id("MarketplaceOrder", true),
    customerId: id("User", true),
    eventId: { type: String, required: true, unique: true },
    provider: { type: String, default: "razorpay" },
    gatewayOrderId: String,
    gatewayPaymentId: String,
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "INR" },
    status: {
      type: String,
      enum: ["created", "captured", "failed", "refunded"],
      default: "created",
      index: true,
    },
    rawStatus: String,
  },
  opts("marketplace_payments"),
);
MarketplacePaymentSchema.index({ orderId: 1, createdAt: -1 });

export const MARKETPLACE_ORDER_MODELS = [
  { name: "MarketplaceAddress", schema: MarketplaceAddressSchema },
  { name: "MarketplaceOrderRecord", schema: MarketplaceOrderSchema },
  { name: "MarketplacePayment", schema: MarketplacePaymentSchema },
];
