import { Inject, Injectable, Logger } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";
import { createHmac, timingSafeEqual } from "node:crypto";
import { payoutConfig } from "../config/payout.config";
import type {
  PayoutProvider,
  ProviderBeneficiary,
  ProviderPayoutRequest,
  ProviderPayoutResult,
} from "../domain/payout.types";
import { PayoutProviderError } from "../errors/payout.errors";

@Injectable()
export class RazorpayXPayoutProvider implements PayoutProvider {
  private readonly logger = new Logger(RazorpayXPayoutProvider.name);

  constructor(
    @Inject(payoutConfig.KEY)
    private readonly config: ConfigType<typeof payoutConfig>,
  ) {}

  isConfigured(): boolean {
    return Boolean(
      this.config.enabled &&
        this.config.keyId &&
        this.config.keySecret &&
        this.config.sourceAccountNumber,
    );
  }

  private configured(): void {
    if (!this.isConfigured())
      throw new PayoutProviderError("RazorpayX payouts are not configured", false);
  }

  private async request<T>(
    method: "GET" | "POST",
    path: string,
    body?: unknown,
    idempotencyKey?: string,
  ): Promise<T> {
    this.configured();
    const endpoint = `${this.config.baseUrl}${path}`;
    for (let attempt = 1; attempt <= this.config.maxAttempts; attempt += 1) {
      const abort = new AbortController();
      const timeout = setTimeout(() => abort.abort(), this.config.timeoutMs);
      try {
        this.logger.log(
          JSON.stringify({
            event: "payout.provider_request",
            provider: "razorpayx",
            method,
            path,
            attempt,
          }),
        );
        const response = await fetch(endpoint, {
          method,
          headers: {
            authorization: `Basic ${Buffer.from(`${this.config.keyId}:${this.config.keySecret}`).toString("base64")}`,
            "content-type": "application/json",
            ...(idempotencyKey
              ? { "x-payout-idempotency": idempotencyKey }
              : {}),
          },
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: abort.signal,
        });
        const payload = (await response.json().catch(() => ({}))) as T & {
          error?: { description?: string };
        };
        if (response.ok) {
          this.logger.log(
            JSON.stringify({
              event: "payout.provider_response",
              provider: "razorpayx",
              path,
              httpStatus: response.status,
              accepted: true,
            }),
          );
          return payload;
        }
        const retryable =
          response.status === 408 ||
          response.status === 409 ||
          response.status === 425 ||
          response.status === 429 ||
          response.status >= 500;
        if (retryable && attempt < this.config.maxAttempts) continue;
        throw new PayoutProviderError(
          payload.error?.description || "RazorpayX rejected the payout request",
          retryable,
          response.status,
        );
      } catch (error) {
        if (error instanceof PayoutProviderError) throw error;
        if (attempt < this.config.maxAttempts) continue;
        throw new PayoutProviderError(
          abort.signal.aborted
            ? "RazorpayX request timed out"
            : "RazorpayX is unavailable",
          true,
        );
      } finally {
        clearTimeout(timeout);
      }
    }
    throw new PayoutProviderError("RazorpayX is unavailable", true);
  }

  async createContact(input: ProviderBeneficiary): Promise<string> {
    const result = await this.request<{ id: string }>("POST", "/contacts", {
      name: input.name,
      email: input.email || undefined,
      contact: input.phone || undefined,
      type: "vendor",
      reference_id: input.referenceId,
      notes: { source: "tirvona_payout" },
    });
    return result.id;
  }

  async createFundAccount(
    contactId: string,
    input: ProviderBeneficiary,
  ): Promise<string> {
    const result = await this.request<{ id: string }>("POST", "/fund_accounts", {
      contact_id: contactId,
      account_type: "bank_account",
      bank_account: {
        name: input.name,
        ifsc: input.ifsc,
        account_number: input.accountNumber,
      },
    });
    return result.id;
  }

  async createPayout(input: ProviderPayoutRequest): Promise<ProviderPayoutResult> {
    const result = await this.request<any>(
      "POST",
      "/payouts",
      {
        account_number: this.config.sourceAccountNumber,
        fund_account_id: input.fundAccountId,
        amount: input.amountPaise,
        currency: "INR",
        mode: input.mode,
        purpose: "payout",
        queue_if_low_balance: true,
        reference_id: input.referenceId.slice(0, 40),
        narration: "Tirvona Payout",
        notes: { payout_reference: input.referenceId.slice(0, 40) },
      },
      input.idempotencyKey,
    );
    return this.result(result);
  }

  async fetchPayout(id: string): Promise<ProviderPayoutResult> {
    return this.result(await this.request<any>("GET", `/payouts/${id}`));
  }

  verifyWebhook(rawBody: Buffer, signature: string): boolean {
    if (!this.config.webhookSecret || !signature) return false;
    const expected = createHmac("sha256", this.config.webhookSecret)
      .update(rawBody)
      .digest("hex");
    const actual = Buffer.from(signature);
    const wanted = Buffer.from(expected);
    return actual.length === wanted.length && timingSafeEqual(actual, wanted);
  }

  private result(payload: any): ProviderPayoutResult {
    return {
      id: String(payload.id ?? ""),
      status: String(payload.status ?? "pending"),
      utr: payload.utr ? String(payload.utr) : undefined,
      failureReason: payload.status_details?.description
        ? String(payload.status_details.description)
        : undefined,
    };
  }
}
