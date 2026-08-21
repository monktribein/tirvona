
export const REFUND_STATUSES = [
  "pending",
  "under_review",
  "approved",
  "processing",
  "refunded",
  "failed",
  "rejected",
  "cancelled",
] as const;

export type RefundStatus = (typeof REFUND_STATUSES)[number];

export const REFUND_MODULES = [
  "ashram_booking",
  "parking_booking",
  "marketplace_order",
  "donation",
  "service_booking",
] as const;

export const REFUND_TRANSITIONS: Record<RefundStatus, RefundStatus[]> = {
  pending: ["under_review", "approved", "rejected", "cancelled"],
  under_review: ["approved", "rejected", "cancelled"],
  approved: ["processing", "cancelled", "failed"],
  processing: ["refunded", "failed"],
  failed: ["processing", "rejected", "cancelled"],
  refunded: [],
  rejected: [],
  cancelled: [],
};

const APPROVER_ROLES = ["super_admin", "national_admin", "finance_manager"];
const REVIEWER_ROLES = [...APPROVER_ROLES, "support"];
const POLICY_ROLES = ["super_admin", "national_admin"];

export const canApproveRefunds = (role?: string): boolean =>
  APPROVER_ROLES.includes(role ?? "");
export const canReviewRefunds = (role?: string): boolean =>
  REVIEWER_ROLES.includes(role ?? "");
export const canManagePolicies = (role?: string): boolean =>
  POLICY_ROLES.includes(role ?? "");

export const REFUND_STATUS_TONE: Record<RefundStatus, string> = {
  pending:
    "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-900/50",
  under_review:
    "bg-blue-50 text-[#0A4DA6] border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-900/50",
  approved:
    "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-900/50",
  processing:
    "bg-cyan-50 text-cyan-800 border-cyan-200 dark:bg-cyan-950/50 dark:text-cyan-300 dark:border-cyan-900/50",
  refunded:
    "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900/50",
  failed:
    "bg-orange-50 text-orange-800 border-orange-200 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-900/50",
  rejected:
    "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-900/50",
  cancelled:
    "bg-gray-100 text-gray-600 border-gray-200 dark:bg-slate-800 dark:text-gray-300 dark:border-slate-700",
};

export interface RefundCalculation {
  _id?: string;
  policySnapshot?: Record<string, any>;
  originalAmount?: number;
  amountPaid?: number;
  breakdown?: {
    baseAmount?: number;
    addOnsAmount?: number;
    donationAmount?: number;
    platformFee?: number;
    gstAmount?: number;
  };
  refundableComponents?: {
    base?: number;
    addOns?: number;
    donation?: number;
    platformFee?: number;
    gst?: number;
  };
  appliedWindow?: {
    label?: string;
    hoursBefore?: number;
    refundPercent?: number;
  } | null;
  hoursBeforeService?: number;
  refundPercent?: number;
  grossRefundable?: number;
  processingFee?: number;
  netRefundable?: number;
  nonRefundableAmount?: number;
  notes?: string[];
}

export interface RefundTransaction {
  _id: string;
  provider?: string;
  method?: string;
  gatewayPaymentId?: string;
  gatewayRefundId?: string;
  amount?: number;
  status?: string;
  attempt?: number;
  failureReason?: string;
  settledAt?: string;
  createdAt?: string;
}

export interface RefundHistoryEntry {
  _id: string;
  fromStatus?: string;
  toStatus: string;
  note?: string;
  actorRole?: string;
  occurredAt?: string;
}

export interface RefundRequest {
  _id: string;
  refundNumber: string;
  module: string;
  sourceId: string;
  sourceReference?: string;
  customerId?: { _id?: string; name?: string; email?: string } | string | null;
  ashramId?: { _id?: string; name?: string } | string | null;
  reason: string;
  customerNote?: string;
  requestedAmount?: number;
  status: RefundStatus;
  calculationId?: RefundCalculation | string | null;
  autoApproved?: boolean;
  rejectionReason?: string;
  approvedAt?: string;
  reviewedAt?: string;
  rejectedAt?: string;
  settledAt?: string;
  createdAt?: string;
  history?: RefundHistoryEntry[];
  transactions?: RefundTransaction[];
}

export interface RefundSummary {
  counts: Partial<Record<RefundStatus, number>>;
  openCount: number;
  settledCount: number;
  settledAmount: number;
}

export const refName = (
  value: RefundRequest["customerId"] | RefundRequest["ashramId"],
): string =>
  value && typeof value === "object" ? (value.name ?? "—") : "—";

export const refEmail = (value: RefundRequest["customerId"]): string =>
  value && typeof value === "object" ? ((value as any).email ?? "") : "";

export const calcOf = (
  request: RefundRequest | null,
): RefundCalculation | null =>
  request?.calculationId && typeof request.calculationId === "object"
    ? request.calculationId
    : null;

export const netAmountOf = (request: RefundRequest): number =>
  calcOf(request)?.netRefundable ?? request.requestedAmount ?? 0;
