import api from "../lib/api";

export type WalletTxnCategory =
  | "refund"
  | "admin_credit"
  | "payment"
  | "withdrawal"
  | "withdrawal_reversal";

export type WithdrawalStatus =
  | "pending"
  | "approved"
  | "paid"
  | "rejected"
  | "cancelled";

export interface WalletBalances {
  balance: number;
  heldAmount: number;
  pendingWithdrawal: number;
  totalCredited: number;
  totalSpent: number;
  totalWithdrawn: number;
  currency: string;
  updatedAt: string | null;
}

export interface WalletTransaction {
  _id: string;
  type: "credit" | "debit";
  category: WalletTxnCategory;
  amount: number;
  balanceAfter: number;
  module: string;
  reference: string;
  description: string;
  actorRole?: string;
  createdAt: string;
}

export interface WalletWithdrawal {
  _id: string;
  requestNumber: string;
  amount: number;
  method: "bank" | "upi";
  accountHolderName?: string;
  accountNumber?: string;
  ifsc?: string;
  bankName?: string;
  upiId?: string;
  customerNote?: string;
  status: WithdrawalStatus;
  adminNote?: string;
  rejectionReason?: string;
  payoutReference?: string;
  reviewedAt?: string;
  paidAt?: string;
  createdAt: string;
  userId?: { _id: string; name?: string; email?: string; phone?: string } | string;
  reviewedBy?: { name?: string } | string | null;
  paidBy?: { name?: string } | string | null;
}

export interface WalletSummary {
  wallet: WalletBalances;
  recent: WalletTransaction[];
  openWithdrawal: WalletWithdrawal | null;
}

export interface Paged<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface WithdrawalInput {
  amount: number;
  method: "bank" | "upi";
  accountHolderName?: string;
  accountNumber?: string;
  ifsc?: string;
  bankName?: string;
  upiId?: string;
  note?: string;
}

/** What a payment-order call reports about the wallet share it applied. */
export interface WalletSplit {
  applied: number;
  gatewayAmount: number;
  total?: number;
}

const clean = (params: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== ""),
  );

export const walletService = {
  summary: () => api.get("/wallet", { skipToast: true }),
  transactions: (params: { page?: number; limit?: number; type?: string; category?: string } = {}) =>
    api.get("/wallet/transactions", { params: clean(params), skipToast: true }),
  withdrawals: () => api.get("/wallet/withdrawals", { skipToast: true }),
  requestWithdrawal: (data: WithdrawalInput) => api.post("/wallet/withdrawals", data),
  cancelWithdrawal: (id: string) => api.post(`/wallet/withdrawals/${id}/cancel`, {}),
};

export const walletAdminService = {
  overview: () => api.get("/wallet/admin/overview", { skipToast: true }),
  wallets: (params: { page?: number; limit?: number; search?: string; sort?: string; hasBalance?: boolean } = {}) =>
    api.get("/wallet/admin/wallets", { params: clean(params), skipToast: true }),
  wallet: (userId: string, params: { page?: number; limit?: number; type?: string; category?: string } = {}) =>
    api.get(`/wallet/admin/wallets/${userId}`, { params: clean(params), skipToast: true }),
  customers: (search: string) =>
    api.get("/wallet/admin/customers", { params: { search }, skipToast: true }),
  credit: (data: { userId: string; amount: number; note?: string; idempotencyKey?: string }) =>
    api.post("/wallet/admin/credit", data),
  withdrawals: (params: { page?: number; limit?: number; status?: string; search?: string } = {}) =>
    api.get("/wallet/admin/withdrawals", { params: clean(params), skipToast: true }),
  approve: (id: string, note?: string) =>
    api.post(`/wallet/admin/withdrawals/${id}/approve`, { note }),
  reject: (id: string, reason: string) =>
    api.post(`/wallet/admin/withdrawals/${id}/reject`, { reason }),
  markPaid: (id: string, payoutReference: string, note?: string) =>
    api.post(`/wallet/admin/withdrawals/${id}/paid`, { payoutReference, note }),
};

export const WALLET_CATEGORY_LABEL: Record<WalletTxnCategory, string> = {
  refund: "Refund",
  admin_credit: "Credit from Tirvona",
  payment: "Booking payment",
  withdrawal: "Bank transfer",
  withdrawal_reversal: "Transfer returned",
};

export const WALLET_MODULE_LABEL: Record<string, string> = {
  ashram_booking: "Stay",
  day_stay: "Day stay",
  parking: "Parking",
  aarti: "Aarti",
  marketplace: "Marketplace",
  withdrawal: "Transfer",
  admin: "Tirvona",
};

export const WITHDRAWAL_STATUS_LABEL: Record<WithdrawalStatus, string> = {
  pending: "Pending review",
  approved: "Approved · transfer in progress",
  paid: "Transferred",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

export const WITHDRAWAL_STATUS_TONE: Record<WithdrawalStatus, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900",
  approved: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900",
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900",
  rejected: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900",
  cancelled: "bg-gray-50 text-gray-600 border-gray-200 dark:bg-slate-800 dark:text-gray-300 dark:border-slate-700",
};

/**
 * " ₹X has been added to your Tirvona wallet." when a cancel response says
 * its refund went to the wallet; "" otherwise. Reads the stay, parking and
 * aarti cancel responses alike.
 */
export const walletRefundText = (data: any): string => {
  const amount = Number(data?.refundAmount ?? data?.refund?.refundAmount ?? 0);
  return data?.refundMethod === "wallet" && amount > 0
    ? ` ₹${amount.toLocaleString("en-IN")} has been added to your Tirvona wallet.`
    : "";
};

/** Tells every wallet view (navbar, wallet page, checkouts) to refresh. */
export const notifyWalletChanged = () =>
  window.dispatchEvent(new Event("tirvona:wallet-changed"));
