import api from "../lib/api";
import type { FoodScope } from "./foodPartner.service";

/** All amounts are integer paise, as the API sends them. */
export type FoodPaymentMethod = "bank_transfer" | "upi" | "cash";

export interface FoodWalletSummary {
  vendorId: string;
  businessName: string;
  hasBankDetails: boolean;
  /** Handed-over, paid orders the kitchen has earned. */
  deliveredOrders: number;
  foodValuePaise: number;
  commissionPaise: number;
  gstOnCommissionPaise: number;
  /** Food value minus commission and GST on it: everything Tirvona owes in total. */
  earnedPaise: number;
  /** Everything Tirvona has paid so far (voided payments left out). */
  receivedPaise: number;
  /** Earned minus received. Below zero means Tirvona paid ahead of what was earned. */
  remainingPaise: number;
  lastPayment: { amountPaise: number; paidAt: string; method: FoodPaymentMethod } | null;
}

export interface FoodWalletPayment {
  id: string;
  /** "wallet": entered by hand. "settlement": paid through the older settlement flow. */
  source: "wallet" | "settlement";
  paymentNumber: string;
  amountPaise: number;
  method: FoodPaymentMethod;
  reference: string;
  /** Image of the receipt. Null for cash. */
  receiptUrl: string | null;
  paidAt: string;
  note: string;
  status: "recorded" | "voided";
  voidReason: string;
  /** Only sent to Super Admin and Finance. */
  recordedByName?: string;
}

export interface FoodWallet {
  summary: FoodWalletSummary;
  payments: FoodWalletPayment[];
}

export interface FoodWalletEarning {
  orderId: string;
  orderNumber: string;
  outletName: string;
  earnedAt: string;
  foodValuePaise: number;
  commissionPaise: number;
  gstOnCommissionPaise: number;
  netPaise: number;
}

export interface FoodWalletEarningsPage {
  data: FoodWalletEarning[];
  total: number;
  page: number;
  limit: number;
}

export interface FoodWalletOverviewRow extends FoodWalletSummary {
  status: string;
}

export interface FoodWalletOverview {
  rows: FoodWalletOverviewRow[];
  totals: { restaurants: number; owedPaise: number; advancePaise: number; receivedPaise: number };
}

export interface RecordFoodPaymentInput {
  amountPaise: number;
  method: FoodPaymentMethod;
  reference?: string;
  /** Required for bank transfer and UPI; cash has none. */
  receiptUrl?: string;
  paidAt?: string;
  note?: string;
  /** One per opened form, so a double click or a retry records a single payment. */
  idempotencyKey?: string;
}

export const foodWalletService = {
  /** Owner: the caller's own wallet. Admin: the given restaurant's. */
  async wallet(scope: FoodScope, vendorId?: string): Promise<FoodWallet> {
    const url = scope === "admin" ? `/v1/food/admin/vendors/${vendorId}/wallet` : "/v1/food/vendor/wallet";
    const res = await api.get(url);
    return res.data;
  },

  async earnings(scope: FoodScope, vendorId: string | undefined, page: number, limit: number): Promise<FoodWalletEarningsPage> {
    const url = scope === "admin" ? `/v1/food/admin/vendors/${vendorId}/wallet/orders` : "/v1/food/vendor/wallet/orders";
    const res = await api.get(url, { params: { page, limit } });
    return res.data;
  },

  // ---- Super Admin / Finance
  async overview(): Promise<FoodWalletOverview> {
    const res = await api.get("/v1/food/admin/wallets");
    return res.data;
  },

  async recordPayment(vendorId: string, input: RecordFoodPaymentInput): Promise<FoodWallet & { paymentId: string }> {
    const res = await api.post(`/v1/food/admin/vendors/${vendorId}/payments`, input);
    return res.data;
  },

  async voidPayment(paymentId: string, reason: string): Promise<FoodWallet> {
    const res = await api.post(`/v1/food/admin/payments/${paymentId}/void`, { reason });
    return res.data;
  },
};
