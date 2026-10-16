import { Injectable, Logger } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { InjectModel } from "../../../database/orm-nest";
import type { Model } from "../../../database/orm";
import type { Job } from "bullmq";
import { createHmac } from "node:crypto";
import { PARTNER_WEBHOOK_QUEUE } from "../domain/partner.constants";
import { PartnerCryptoService } from "./partner-crypto.service";
import { validateWebhookUrl } from "./ssrf-validator.util";
import type { WebhookDispatchJobData } from "./partner-webhook-dispatcher.service";

@Processor(PARTNER_WEBHOOK_QUEUE)
@Injectable()
export class PartnerWebhookWorker extends WorkerHost {
  private readonly logger = new Logger(PartnerWebhookWorker.name);

  constructor(
    @InjectModel("PartnerWebhook") private readonly webhookModel: Model<any>,
    @InjectModel("PartnerWebhookEvent") private readonly eventModel: Model<any>,
    @InjectModel("PartnerWebhookDeliveryLog")
    private readonly deliveryLogModel: Model<any>,
    private readonly cryptoService: PartnerCryptoService,
  ) {
    super();
  }

  async process(job: Job<WebhookDispatchJobData>): Promise<void> {
    const { eventId, webhookId, eventType } = job.data;
    const attemptNumber = job.attemptsMade + 1;
    const startedAt = Date.now();

    const [event, webhook] = await Promise.all([
      this.eventModel.findOne({ eventId }),
      this.webhookModel
        .findById(webhookId)
        .select("+secretCiphertext +secretIv +secretTag"),
    ]);

    if (!event || !webhook) {
      this.logger.warn(`Webhook event ${eventId} or webhook ${webhookId} no longer exists. Skipping.`);
      return;
    }

    if (webhook.status !== "active") {
      this.logger.log(`Webhook ${webhookId} is inactive. Skipping delivery.`);
      return;
    }

    // SSRF verification before each delivery attempt
    try {
      await validateWebhookUrl(webhook.url);
    } catch (ssrfError: any) {
      const msg = `SSRF protection blocked webhook delivery: ${ssrfError.message}`;
      this.logger.error(msg);
      await this.recordFailure(event, webhook, attemptNumber, 0, null, msg, Date.now() - startedAt);
      return; // Do not retry SSRF blocked targets
    }

    // Decrypt signing secret
    const signingSecret = this.cryptoService.decryptSecret({
      ciphertext: webhook.secretCiphertext,
      iv: webhook.secretIv,
      tag: webhook.secretTag,
    });

    const timestamp = Math.floor(Date.now() / 1000);
    const rawPayloadString = JSON.stringify(event.payload);

    // Compute HMAC-SHA256 signature
    const signaturePayload = `t=${timestamp}.${rawPayloadString}`;
    const signature = createHmac("sha256", signingSecret)
      .update(signaturePayload)
      .digest("hex");
    const signatureHeader = `t=${timestamp},v1=${signature}`;

    let responseStatusCode: number | null = null;
    let responseBody: string | null = null;
    let errorMessage: string | null = null;
    let success = false;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10_000); // 10s HTTP timeout

      const response = await fetch(webhook.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Tirvona-Webhook-Worker/1.0",
          "X-Tirvona-Delivery-Id": eventId,
          "X-Tirvona-Event": eventType,
          "X-Tirvona-Signature": signatureHeader,
        },
        body: rawPayloadString,
        signal: controller.signal,
        redirect: "error", // Prevent following redirects to avoid SSRF bypass
      });

      clearTimeout(timeoutId);

      responseStatusCode = response.status;
      const text = await response.text();
      responseBody = text.slice(0, 1000); // Cap response preview

      if (response.ok) {
        success = true;
      } else {
        errorMessage = `Webhook returned HTTP ${response.status}`;
      }
    } catch (fetchError: any) {
      errorMessage = fetchError.name === "AbortError" ? "Delivery timed out (10s)" : fetchError.message || String(fetchError);
    }

    const durationMs = Date.now() - startedAt;

    if (success) {
      await this.recordSuccess(event, webhook, attemptNumber, responseStatusCode ?? 200, responseBody, durationMs);
    } else {
      await this.recordFailure(event, webhook, attemptNumber, responseStatusCode, responseBody, errorMessage, durationMs);
      // Re-throw so BullMQ handles backoff retries if attempts remain
      throw new Error(`Webhook delivery failed: ${errorMessage}`);
    }
  }

  private async recordSuccess(
    event: any,
    webhook: any,
    attemptNumber: number,
    responseStatusCode: number,
    responseBody: string | null,
    durationMs: number,
  ) {
    event.status = "success";
    event.attempts = attemptNumber;
    event.lastAttemptAt = new Date();
    event.lastError = null;
    await event.save();

    await this.deliveryLogModel.create({
      eventId: event.eventId,
      webhookId: webhook._id,
      partnerId: webhook.partnerId,
      url: webhook.url,
      eventType: event.eventType,
      status: "success",
      attemptNumber,
      responseStatusCode,
      responseBody,
      durationMs,
      deliveredAt: new Date(),
    });
  }

  private async recordFailure(
    event: any,
    webhook: any,
    attemptNumber: number,
    responseStatusCode: number | null,
    responseBody: string | null,
    errorMessage: string | null,
    durationMs: number,
  ) {
    event.status = "failed";
    event.attempts = attemptNumber;
    event.lastAttemptAt = new Date();
    event.lastError = errorMessage;
    await event.save();

    await this.deliveryLogModel.create({
      eventId: event.eventId,
      webhookId: webhook._id,
      partnerId: webhook.partnerId,
      url: webhook.url,
      eventType: event.eventType,
      status: "failed",
      attemptNumber,
      responseStatusCode,
      responseBody,
      errorMessage,
      durationMs,
      deliveredAt: new Date(),
    });
  }
}
