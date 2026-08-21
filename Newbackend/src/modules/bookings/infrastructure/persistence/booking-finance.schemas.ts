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

export const BookingPaymentSchema = new Schema(
  {
    bookingId: id("Booking", true),
    userId: id("User", true),
    ashramId: id("Ashram", true),
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "INR" },
    purpose: {
      type: String,
      enum: ["booking", "additional_charge"],
      default: "booking",
    },
    method: {
      type: String,
      enum: ["razorpay", "upi", "cards", "net_banking", "cash", "demo"],
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "success", "failed", "refunded", "partially_refunded"],
      default: "pending",
      index: true,
    },
    transactionId: { type: String, sparse: true, index: true },
    gateway: {
      orderId: { type: String, index: true },
      paymentId: { type: String, unique: true, sparse: true },
      signature: { type: String, select: false },
      provider: String,
    },
    paidAt: Date,
    failureReason: String,
    idempotencyKey: { type: String, sparse: true, unique: true },
  },
  opts("booking_payments"),
);
BookingPaymentSchema.index({ bookingId: 1, status: 1 });
BookingPaymentSchema.index({ ashramId: 1, status: 1, paidAt: -1 });

export const BookingPaymentEventSchema = new Schema(
  {
    provider: { type: String, required: true },
    eventId: { type: String, required: true },
    eventType: { type: String, required: true },
    bookingId: id("Booking"),
    paymentId: id("BookingPayment"),
    signatureVerified: { type: Boolean, default: false },
    payload: { type: SchemaTypes.Mixed, select: false },
    status: {
      type: String,
      enum: ["received", "processed", "failed", "ignored"],
      default: "received",
    },
    processingError: String,
    processedAt: Date,
  },
  opts("booking_payment_events"),
);
BookingPaymentEventSchema.index({ provider: 1, eventId: 1 }, { unique: true });

export const BookingTransactionSchema = new Schema(
  {
    bookingId: id("Booking"),
    paymentId: id("BookingPayment"),
    ashramId: id("Ashram"),
    ownerId: id("User"),
    type: {
      type: String,
      enum: [
        "booking",
        "refund",
        "commission",
        "settlement",
        "tax",
        "donation",
        "addon",
        "adjustment",
      ],
      required: true,
    },
    direction: { type: String, enum: ["credit", "debit"], required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: "INR" },
    reference: { type: String, required: true, unique: true },
    description: String,
    meta: { type: SchemaTypes.Mixed, default: {} },
    recordedBy: id("User"),
    occurredAt: { type: Date, default: Date.now, index: true },
  },
  opts("booking_transactions"),
);
BookingTransactionSchema.index({ ashramId: 1, type: 1, occurredAt: -1 });
BookingTransactionSchema.index({ bookingId: 1, occurredAt: 1 });

export const BookingLedgerSchema = new Schema(
  {
    account: { type: String, required: true },
    bookingId: id("Booking"),
    ashramId: id("Ashram"),
    ownerId: id("User"),
    transactionId: id("BookingTransaction"),
    debit: { type: Number, default: 0 },
    credit: { type: Number, default: 0 },
    balanceAfter: Number,
    currency: { type: String, default: "INR" },
    reference: { type: String, required: true },
    occurredAt: { type: Date, default: Date.now },
  },
  opts("booking_ledger"),
);
BookingLedgerSchema.index({ account: 1, occurredAt: 1 });
BookingLedgerSchema.index({ bookingId: 1 });

export const BookingCommissionSchema = new Schema(
  {
    bookingId: { ...id("Booking", true), unique: true },
    ashramId: id("Ashram", true),
    ownerId: id("User", true),
    grossAmount: Number,
    commissionPercent: Number,
    commissionAmount: Number,
    ownerEarning: Number,
    taxWithheld: { type: Number, default: 0 },
    settlementStatus: {
      type: String,
      enum: ["pending", "processing", "settled", "on_hold", "reversed"],
      default: "pending",
      index: true,
    },
    settlementId: id("BookingSettlement"),
    payoutId: id("PayoutRequest"),
    reversedAt: Date,
    reversalReason: String,
  },
  opts("booking_commissions"),
);
BookingCommissionSchema.index({
  ownerId: 1,
  settlementStatus: 1,
  createdAt: 1,
});
BookingCommissionSchema.index({ payoutId: 1, settlementStatus: 1 });

export const BookingSettlementSchema = new Schema(
  {
    settlementReference: { type: String, required: true, unique: true },
    ownerId: id("User", true),
    ashramIds: [{ type: SchemaTypes.ObjectId, ref: "Ashram" }],
    commissionIds: [{ type: SchemaTypes.ObjectId, ref: "BookingCommission" }],
    grossAmount: Number,
    commissionAmount: Number,
    taxAmount: Number,
    payoutAmount: Number,
    currency: { type: String, default: "INR" },
    status: {
      type: String,
      enum: ["pending", "processing", "paid", "failed", "reversed"],
      default: "pending",
    },
    payoutReference: String,
    initiatedBy: id("User"),
    paidAt: Date,
    failureReason: String,
  },
  opts("booking_settlements"),
);
BookingSettlementSchema.index({ ownerId: 1, status: 1, createdAt: -1 });

export const BookingRefundSchema = new Schema(
  {
    refundReference: { type: String, required: true, unique: true },
    bookingId: id("Booking", true),
    paymentId: id("BookingPayment", true),
    requestedBy: id("User", true),
    amount: { type: Number, required: true },
    percentage: Number,
    reason: String,
    policySnapshot: SchemaTypes.Mixed,
    status: {
      type: String,
      enum: ["pending", "processing", "success", "failed", "cancelled"],
      default: "pending",
    },
    gatewayRefundId: String,
    processedAt: Date,
    failureReason: String,
  },
  opts("booking_refunds"),
);
BookingRefundSchema.index({ bookingId: 1, createdAt: -1 });

export const BookingInvoiceSchema = new Schema(
  {
    invoiceNumber: { type: String, required: true, unique: true },
    bookingId: { ...id("Booking", true), unique: true },
    customerId: id("User", true),
    ashramId: id("Ashram", true),
    lineItems: [
      {
        description: String,
        quantity: Number,
        unitAmount: Number,
        totalAmount: Number,
        taxRate: Number,
        taxAmount: Number,
      },
    ],
    subtotal: Number,
    taxAmount: Number,
    discountAmount: Number,
    donationAmount: Number,
    totalAmount: Number,
    currency: { type: String, default: "INR" },
    billingSnapshot: SchemaTypes.Mixed,
    issuedAt: { type: Date, default: Date.now },
    documentUrl: String,
  },
  opts("booking_invoices"),
);
export const BookingReceiptSchema = new Schema(
  {
    receiptNumber: { type: String, required: true, unique: true },
    bookingId: id("Booking", true),
    paymentId: id("BookingPayment", true),
    amount: Number,
    currency: { type: String, default: "INR" },
    method: String,
    issuedAt: { type: Date, default: Date.now },
    documentUrl: String,
  },
  opts("booking_receipts"),
);
export const BookingTaxRecordSchema = new Schema(
  {
    bookingId: id("Booking", true),
    invoiceId: id("BookingInvoice"),
    ashramId: id("Ashram", true),
    taxableAmount: Number,
    gstPercent: Number,
    cgst: Number,
    sgst: Number,
    igst: Number,
    totalTax: Number,
    placeOfSupply: String,
    taxPeriod: String,
  },
  opts("booking_tax_records"),
);
BookingTaxRecordSchema.index({ ashramId: 1, taxPeriod: 1 });
