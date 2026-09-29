/**
 * Marketplace persistence. Everything lives in the main Tirvona MongoDB.
 *
 * Reused collections (shared with the legacy CommerceModule, never duplicated):
 *  - `marketplaceproducts`   -> MpProduct   (legacy Prasad products + vendor listings)
 *  - `marketplacecategories` -> MpCategory
 * Both are declared `strict: false` so legacy fields written by the old
 * module are preserved untouched.
 *
 * The legacy `status` field on products is kept as the PUBLIC VISIBILITY flag
 * the old endpoints already filter on: "active" = publicly listed, anything
 * else = hidden. MpProduct keeps it in sync (see ProductService.syncVisibility),
 * so an unapproved vendor product never leaks through the legacy API.
 *
 * New collections are prefixed `marketplace_`.
 */
import { Schema, SchemaTypes } from "mongoose";
import {
  APPROVAL_STATUSES,
  BUSINESS_TYPES,
  DOCUMENT_STATUSES,
  FULFILLMENT_STATUSES,
  LEDGER_ENTRY_TYPES,
  LISTING_STATUSES,
  MASTER_ORDER_STATUSES,
  PAYMENT_STATUSES,
  PAYOUT_STATUSES,
  REVIEW_STATUSES,
  SETTLEMENT_STATUSES,
  VENDOR_DOCUMENT_TYPES,
  VENDOR_STATUSES,
} from "../domain/marketplace.constants";

const id = (ref: string, extra: Record<string, unknown> = {}) => ({ type: SchemaTypes.ObjectId, ref, ...extra });
const opts = (collection: string, strict = true) => ({ timestamps: true, collection, strict });

const AddressShape = {
  line1: String,
  line2: String,
  landmark: String,
  city: String,
  state: String,
  pincode: String,
  country: { type: String, default: "India" },
};

// ------------------------------------------------------------------ vendor
export const VendorProfileSchema = new Schema(
  {
    userId: id("User", { required: true, unique: true }),
    storeName: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    legalBusinessName: { type: String, trim: true },
    businessType: { type: String, enum: BUSINESS_TYPES, default: "individual" },
    description: String,
    contactEmail: { type: String, lowercase: true, trim: true },
    contactPhone: { type: String, trim: true },
    address: AddressShape,
    logoUrl: String,
    gstin: { type: String, uppercase: true, trim: true },
    status: { type: String, enum: VENDOR_STATUSES, default: "draft", index: true },
    verificationStatus: {
      type: String,
      enum: ["unverified", "pending", "verified", "rejected"],
      default: "unverified",
    },
    submittedAt: Date,
    rejectionReason: String,
    approvedAt: Date,
    approvedBy: id("User"),
    suspendedAt: Date,
    suspendedBy: id("User"),
    suspensionReason: String,
    deactivatedAt: Date,
    /** Admin-only override; null = use category/global commission. */
    commissionPercent: { type: Number, min: 0, max: 100, default: null },
    /** True for the house vendor that owns migrated legacy Prasad products. */
    isPlatformVendor: { type: Boolean, default: false },
    // Short-lived mutex serialising payout requests for this vendor.
    payoutLockToken: { type: String, select: false },
    payoutLockExpiresAt: { type: Date, select: false },
    deletedAt: { type: Date, default: null },
  },
  opts("marketplace_vendors"),
);
VendorProfileSchema.index({ status: 1, createdAt: -1 });

export const VendorDocumentSchema = new Schema(
  {
    vendorId: id("MpVendor", { required: true, index: true }),
    type: { type: String, enum: VENDOR_DOCUMENT_TYPES, required: true },
    fileUrl: { type: String, required: true },
    fileName: String,
    documentNumberMasked: String,
    status: { type: String, enum: DOCUMENT_STATUSES, default: "pending", index: true },
    reviewNote: String,
    reviewedBy: id("User"),
    reviewedAt: Date,
    deletedAt: { type: Date, default: null },
  },
  opts("marketplace_vendor_documents"),
);

export const VendorBankAccountSchema = new Schema(
  {
    vendorId: id("MpVendor", { required: true, index: true }),
    accountHolderName: { type: String, required: true, trim: true },
    bankName: { type: String, trim: true },
    ifsc: { type: String, required: true, uppercase: true, trim: true },
    // AES-256-GCM (payouts BankAccountCrypto). Never returned by the API.
    accountNumberEncrypted: { type: SchemaTypes.Mixed, select: false },
    accountNumberLast4: { type: String, required: true },
    fingerprint: { type: String, select: false },
    verificationStatus: { type: String, enum: ["pending", "verified", "rejected"], default: "pending" },
    isDefault: { type: Boolean, default: false },
    providerContactId: { type: String, select: false },
    providerFundAccountId: { type: String, select: false },
    deletedAt: { type: Date, default: null },
  },
  opts("marketplace_vendor_bank_accounts"),
);
VendorBankAccountSchema.index({ vendorId: 1, fingerprint: 1 }, { unique: true, partialFilterExpression: { deletedAt: null } });

// ---------------------------------------------------------------- catalog
export const CategorySchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, lowercase: true, trim: true },
    description: String,
    parentId: id("MpCategory", { default: null, index: true }),
    image: String,
    status: { type: String, default: "active", index: true }, // active | inactive (legacy values tolerated)
    sortOrder: { type: Number, default: 0 },
    displayOrder: Number, // legacy ordering field, kept in sync with sortOrder
    commissionPercent: { type: Number, min: 0, max: 100, default: null },
    /** "vendor_marketplace" for marketplace categories; unset on retired Prasad categories. */
    scope: { type: String, index: true },
  },
  opts("marketplacecategories", false),
);

export const ProductSchema = new Schema(
  {
    vendorId: id("MpVendor", { index: true }),
    categoryId: id("MpCategory", { index: true }),
    category: String, // legacy free-text category, kept for the old API
    name: { type: String, required: true, trim: true },
    slug: String, // the collection already has a unique slug_1 index
    description: String,
    shortDescription: String,
    sku: { type: String, trim: true, uppercase: true },
    price: { type: Number, required: true, min: 0 }, // list price (MRP)
    salePrice: { type: Number, min: 0 }, // selling price when discounted
    gstPercent: { type: Number, min: 0, max: 28, default: null },
    images: [String],
    specifications: [{ key: String, value: String, _id: false }],
    weight: String,
    dimensions: { length: Number, width: Number, height: Number, unit: String },
    metadata: SchemaTypes.Mixed,
    listingStatus: { type: String, enum: LISTING_STATUSES, default: "draft", index: true },
    approvalStatus: { type: String, enum: APPROVAL_STATUSES, default: "not_submitted", index: true },
    rejectionReason: String,
    submittedAt: Date,
    approvedAt: Date,
    approvedBy: id("User"),
    adminDisabled: { type: Boolean, default: false },
    adminDisabledReason: String,
    // `stock` is THE available-quantity counter, shared with the legacy
    // checkout (which decrements it directly), so both systems stay in step.
    stock: { type: Number, default: 0, min: 0 },
    inventory: {
      trackInventory: { type: Boolean, default: true },
      reserved: { type: Number, default: 0, min: 0 }, // held by unpaid orders
      sold: { type: Number, default: 0, min: 0 },
      lowStockThreshold: { type: Number, default: 5, min: 0 },
    },
    // legacy fields (read by the old CommerceModule)
    status: { type: String, index: true }, // PUBLIC VISIBILITY: "active" = listed
    rating: Number,
    reviewCount: Number,
    isFeatured: Boolean,
    deletedAt: { type: Date, default: null },
  },
  opts("marketplaceproducts", false),
);
ProductSchema.index({ vendorId: 1, sku: 1 }, { unique: true, partialFilterExpression: { sku: { $type: "string" }, vendorId: { $type: "objectId" } } });
ProductSchema.index({ approvalStatus: 1, listingStatus: 1, categoryId: 1 });

// ----------------------------------------------------------------- orders
const OrderItemSchema = new Schema(
  {
    productId: id("MpProduct", { required: true }),
    categoryId: id("MpCategory"),
    // snapshots at purchase time
    name: { type: String, required: true },
    slug: String,
    sku: String,
    image: String,
    unitPrice: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
    gstPercent: Number,
    subtotal: Number,
    gstAmount: Number,
    lineTotal: Number,
    commissionPercent: Number,
    commissionAmount: Number,
    inventoryTracked: { type: Boolean, default: true },
  },
  { _id: true },
);

export const MasterOrderSchema = new Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    customerId: id("User", { required: true, index: true }),
    vendorOrderIds: [id("MpVendorOrder")],
    shippingAddress: { fullName: String, phone: String, ...AddressShape },
    pricing: {
      itemsSubtotal: Number,
      gstAmount: Number,
      shippingFee: Number,
      commissionAmount: Number,
      totalAmount: Number,
      amountPaid: { type: Number, default: 0 },
      amountRefunded: { type: Number, default: 0 },
      currency: { type: String, default: "INR" },
    },
    status: { type: String, enum: MASTER_ORDER_STATUSES, default: "pending_payment", index: true },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: "pending", index: true },
    gateway: {
      provider: String,
      orderId: { type: String, index: true },
      paymentId: String,
      demo: Boolean,
    },
    reservationExpiresAt: Date,
    idempotencyKey: String,
    notes: String,
    cancelledAt: Date,
    cancelReason: String,
    reconciliationNote: String,
  },
  opts("marketplace_master_orders"),
);
MasterOrderSchema.index({ customerId: 1, idempotencyKey: 1 }, { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } });
MasterOrderSchema.index({ status: 1, reservationExpiresAt: 1 });

export const VendorOrderSchema = new Schema(
  {
    masterOrderId: id("MpMasterOrder", { required: true, index: true }),
    vendorOrderNumber: { type: String, required: true, unique: true },
    vendorId: id("MpVendor", { required: true, index: true }),
    customerId: id("User", { required: true }),
    vendorSnapshot: { storeName: String, slug: String },
    items: [OrderItemSchema],
    subtotal: Number,
    gstAmount: Number,
    shippingFee: Number,
    total: Number,
    commissionAmount: Number,
    vendorEarning: Number,
    fulfillmentStatus: { type: String, enum: FULFILLMENT_STATUSES, default: "pending_payment", index: true },
    settlementStatus: { type: String, enum: SETTLEMENT_STATUSES, default: "unsettled", index: true },
    tracking: { carrier: String, trackingNumber: String, trackingUrl: String },
    statusHistory: [
      { from: String, to: String, at: Date, actorId: SchemaTypes.ObjectId, actorRole: String, note: String, _id: false },
    ],
    confirmedAt: Date,
    shippedAt: Date,
    deliveredAt: Date,
    settlementEligibleAt: Date,
    cancelledAt: Date,
    cancelReason: String,
    returnReason: String,
    refundAmount: Number,
    refundId: String,
    refundError: String,
  },
  opts("marketplace_vendor_orders"),
);
VendorOrderSchema.index({ vendorId: 1, fulfillmentStatus: 1, createdAt: -1 });

// ---------------------------------------------------------------- finance
export const LedgerEntrySchema = new Schema(
  {
    vendorId: id("MpVendor", { required: true, index: true }),
    type: { type: String, enum: LEDGER_ENTRY_TYPES, required: true },
    amount: { type: Number, required: true, min: 0 },
    availableAt: { type: Date, default: null },
    vendorOrderId: id("MpVendorOrder"),
    masterOrderId: id("MpMasterOrder"),
    payoutId: id("MpPayout"),
    /** Unique per financial event: prevents duplicate credits/commission/payout debits. */
    idempotencyKey: { type: String, required: true, unique: true },
    description: String,
    actorId: id("User"),
  },
  opts("marketplace_ledger_entries"),
);
LedgerEntrySchema.index({ vendorId: 1, createdAt: -1 });
LedgerEntrySchema.index({ vendorOrderId: 1 });

export const PayoutSchema = new Schema(
  {
    vendorId: id("MpVendor", { required: true, index: true }),
    payoutNumber: { type: String, required: true, unique: true },
    amount: { type: Number, required: true, min: 1 },
    status: { type: String, enum: PAYOUT_STATUSES, default: "requested", index: true },
    bankAccountId: id("MpVendorBankAccount", { required: true }),
    bankSnapshot: { accountHolderName: String, bankName: String, ifsc: String, accountNumberLast4: String },
    mode: { type: String, enum: ["IMPS", "NEFT", "RTGS"], default: "IMPS" },
    provider: String,
    providerPayoutId: String,
    utr: String,
    failureReason: String,
    reviewedBy: id("User"),
    reviewedAt: Date,
    paidAt: Date,
    statusHistory: [{ from: String, to: String, at: Date, actorId: SchemaTypes.ObjectId, note: String, _id: false }],
  },
  opts("marketplace_payouts"),
);

export const MarketplaceSettingsSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    defaultCommissionPercent: { type: Number, min: 0, max: 100, default: 0 },
    settlementHoldDays: { type: Number, min: 0, max: 90, default: 0 },
    returnWindowDays: { type: Number, min: 0, max: 90, default: 0 },
    defaultGstPercent: { type: Number, min: 0, max: 28, default: 5 },
    shippingFee: { type: Number, min: 0, default: 60 },
    freeShippingAbove: { type: Number, min: 0, default: 999 },
    reservationMinutes: { type: Number, min: 5, max: 60, default: 15 },
    minimumPayoutAmount: { type: Number, min: 1, default: 100 },
    updatedBy: id("User"),
  },
  opts("marketplace_settings"),
);

export const ReviewSchema = new Schema(
  {
    productId: id("MpProduct", { required: true, index: true }),
    vendorId: id("MpVendor", { required: true, index: true }),
    customerId: id("User", { required: true }),
    vendorOrderId: id("MpVendorOrder", { required: true }),
    rating: { type: Number, required: true, min: 1, max: 5 },
    title: String,
    comment: String,
    isVerifiedPurchase: { type: Boolean, default: true },
    status: { type: String, enum: REVIEW_STATUSES, default: "published", index: true },
  },
  opts("marketplace_reviews"),
);
ReviewSchema.index({ customerId: 1, productId: 1, vendorOrderId: 1 }, { unique: true });

export const MARKETPLACE_MODELS = [
  { name: "MpVendor", schema: VendorProfileSchema },
  { name: "MpVendorDocument", schema: VendorDocumentSchema },
  { name: "MpVendorBankAccount", schema: VendorBankAccountSchema },
  { name: "MpCategory", schema: CategorySchema },
  { name: "MpProduct", schema: ProductSchema },
  { name: "MpMasterOrder", schema: MasterOrderSchema },
  { name: "MpVendorOrder", schema: VendorOrderSchema },
  { name: "MpLedgerEntry", schema: LedgerEntrySchema },
  { name: "MpPayout", schema: PayoutSchema },
  { name: "MpSettings", schema: MarketplaceSettingsSchema },
  { name: "MpReview", schema: ReviewSchema },
];
