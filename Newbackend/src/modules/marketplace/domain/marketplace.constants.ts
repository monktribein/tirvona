/**
 * Marketplace domain vocabulary: statuses and the allowed transitions
 * between them. Every status change in the services goes through
 * `assertTransition`, so the state machines live in exactly one place.
 */
import { BadRequestException } from "@nestjs/common";

export const MARKETPLACE_ADMIN_ROLES = ["super_admin", "marketplace_manager"] as const;
export const MARKETPLACE_FINANCE_ROLES = ["super_admin", "finance_manager"] as const;

// ---------------------------------------------------------------- vendors
export const VENDOR_STATUSES = [
  "draft",
  "pending_verification",
  "under_review",
  "approved",
  "active",
  "suspended",
  "rejected",
  "deactivated",
] as const;
export type VendorStatus = (typeof VENDOR_STATUSES)[number];

/** Admin list filter: every store still waiting on the seller or on Tirvona. */
export const AWAITING_APPROVAL_FILTER = "awaiting";
export const AWAITING_APPROVAL_STATUSES: VendorStatus[] = ["draft", "pending_verification", "under_review"];

/**
 * A Super Admin can approve a shop from any waiting state and it goes live
 * ("active") straight away. Documents, address and bank details are optional
 * at signup; a bank account is only needed later to request a payout.
 */
export const VENDOR_TRANSITIONS: Record<VendorStatus, VendorStatus[]> = {
  draft: ["pending_verification", "active", "rejected", "deactivated"],
  pending_verification: ["under_review", "active", "rejected", "deactivated"],
  under_review: ["active", "rejected"],
  approved: ["active", "suspended", "deactivated"], // legacy: stores approved before direct activation
  active: ["suspended", "deactivated"],
  suspended: ["active", "deactivated"],
  rejected: ["pending_verification", "active", "deactivated"],
  deactivated: [],
};

export const VENDOR_DOCUMENT_TYPES = [
  "identity",
  "business_registration",
  "gst",
  "pan",
  "address_proof",
  "other",
] as const;
export type VendorDocumentType = (typeof VENDOR_DOCUMENT_TYPES)[number];
/** Documents a vendor must upload before submitting for verification. */
export const REQUIRED_VENDOR_DOCUMENTS: VendorDocumentType[] = ["identity", "address_proof"];

export const DOCUMENT_STATUSES = ["pending", "verified", "rejected"] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export const BUSINESS_TYPES = [
  "individual",
  "proprietorship",
  "partnership",
  "llp",
  "private_limited",
  "trust",
  "society",
  "temple",
  "other",
] as const;

/**
 * The categories collection is shared with the retired Prasad catalog. Only
 * categories created for the vendor marketplace carry this scope, so the old
 * Prasad categories never appear in (or accept products for) the marketplace.
 */
export const VENDOR_CATEGORY_SCOPE = "vendor_marketplace";

// --------------------------------------------------------------- products
export const LISTING_STATUSES = ["draft", "active", "inactive", "out_of_stock", "archived"] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export const APPROVAL_STATUSES = ["not_submitted", "pending", "approved", "rejected"] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export const APPROVAL_TRANSITIONS: Record<ApprovalStatus, ApprovalStatus[]> = {
  not_submitted: ["pending"],
  pending: ["approved", "rejected", "not_submitted"],
  approved: ["pending"], // material edits send it back for review
  rejected: ["pending"],
};

/**
 * Product fields whose change needs Super Admin re-approval. Price, stock and
 * on/off toggles do not.
 */
export const MATERIAL_PRODUCT_FIELDS = [
  "name",
  "description",
  "shortDescription",
  "images",
  "categoryId",
  "specifications",
  "templeSource",
  "authenticityCertificate",
] as const;

// ----------------------------------------------------------------- orders
export const MASTER_ORDER_STATUSES = [
  "pending_payment",
  "confirmed",
  "partially_fulfilled",
  "completed",
  "cancelled",
  "expired",
  "failed",
] as const;
export type MasterOrderStatus = (typeof MASTER_ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = ["pending", "paid", "failed", "partially_refunded", "refunded"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const FULFILLMENT_STATUSES = [
  "pending_payment",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "return_requested",
  "returned",
  "refunded",
  "expired",
] as const;
export type FulfillmentStatus = (typeof FULFILLMENT_STATUSES)[number];

export const FULFILLMENT_TRANSITIONS: Record<FulfillmentStatus, FulfillmentStatus[]> = {
  pending_payment: ["confirmed", "cancelled", "expired"],
  confirmed: ["processing", "shipped", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: ["return_requested"],
  return_requested: ["returned", "delivered"], // admin rejects the return -> back to delivered
  returned: ["refunded"],
  cancelled: ["refunded"],
  refunded: [],
  expired: [],
};
/** Transitions a vendor may perform on its own vendor order. */
export const VENDOR_FULFILLMENT_ACTIONS: FulfillmentStatus[] = ["processing", "shipped", "delivered", "cancelled"];

export const SETTLEMENT_STATUSES = ["unsettled", "pending", "available", "reversed"] as const;
export type SettlementStatus = (typeof SETTLEMENT_STATUSES)[number];

// ---------------------------------------------------------------- finance
export const LEDGER_ENTRY_TYPES = [
  "sale_credit",
  "commission_debit",
  "refund_debit",
  "commission_reversal_credit",
  "adjustment_credit",
  "adjustment_debit",
  "payout_debit",
  "payout_reversal_credit",
] as const;
export type LedgerEntryType = (typeof LEDGER_ENTRY_TYPES)[number];
export const CREDIT_ENTRY_TYPES: LedgerEntryType[] = [
  "sale_credit",
  "commission_reversal_credit",
  "adjustment_credit",
  "payout_reversal_credit",
];

export const PAYOUT_STATUSES = ["requested", "under_review", "processing", "paid", "failed", "cancelled"] as const;
export type MarketplacePayoutStatus = (typeof PAYOUT_STATUSES)[number];
export const PAYOUT_TRANSITIONS: Record<MarketplacePayoutStatus, MarketplacePayoutStatus[]> = {
  requested: ["under_review", "processing", "cancelled", "failed"],
  under_review: ["processing", "paid", "cancelled", "failed"],
  processing: ["paid", "failed"],
  paid: [],
  failed: [],
  cancelled: [],
};

export const REVIEW_STATUSES = ["published", "hidden"] as const;

/** Throws a 400 unless `to` is a legal next state from `from`. */
export function assertTransition<S extends string>(
  table: Record<S, S[]>,
  from: S,
  to: S,
  entity: string,
): void {
  if (from === to) return;
  if (!table[from]?.includes(to)) {
    throw new BadRequestException(
      `${entity} cannot move from "${from.replace(/_/g, " ")}" to "${to.replace(/_/g, " ")}"`,
    );
  }
}

/**
 * Legacy product `status` = public visibility for the old CommerceModule
 * endpoints, which list anything whose status is not "suspended" and only
 * sell products whose status is "active".
 */
export const VISIBLE_STATUS = "active";
export const HIDDEN_STATUS = "suspended";
