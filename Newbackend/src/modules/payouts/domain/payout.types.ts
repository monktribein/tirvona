import type { PayoutMode, PayoutStatus } from "./payout.constants";

export interface ProviderBeneficiary {
  name: string;
  email?: string;
  phone?: string;
  accountNumber: string;
  ifsc: string;
  referenceId: string;
}

export interface ProviderPayoutRequest {
  fundAccountId: string;
  amountPaise: number;
  mode: PayoutMode;
  referenceId: string;
  idempotencyKey: string;
}

export interface ProviderPayoutResult {
  id: string;
  status: string;
  utr?: string;
  failureReason?: string;
}

export interface PayoutProvider {
  isConfigured(): boolean;
  createContact(input: ProviderBeneficiary): Promise<string>;
  createFundAccount(contactId: string, input: ProviderBeneficiary): Promise<string>;
  createPayout(input: ProviderPayoutRequest): Promise<ProviderPayoutResult>;
  fetchPayout(id: string): Promise<ProviderPayoutResult>;
  verifyWebhook(rawBody: Buffer, signature: string): boolean;
}

export const mapProviderStatus = (status: string): PayoutStatus => {
  const normalized = String(status).toLowerCase();
  if (normalized === "processed") return "paid";
  if (["failed", "reversed", "cancelled", "rejected"].includes(normalized))
    return "failed";
  if (["initiated", "processing"].includes(normalized)) return "processing";
  return "pending";
};
