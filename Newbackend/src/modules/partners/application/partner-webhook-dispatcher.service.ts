import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "../../../database/orm-nest";
import type { Model } from "../../../database/orm";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";
import { randomUUID } from "node:crypto";
import {
  PARTNER_WEBHOOK_QUEUE,
  WEBHOOK_EVENT_PERMISSION,
  WEBHOOK_TEST_EVENT,
  type WebhookDeliveredEventType,
  type WebhookEventType,
} from "../domain/partner.constants";

export interface WebhookDispatchJobData {
  eventId: string;
  webhookId: string;
  partnerId: string;
  eventType: WebhookDeliveredEventType;
}

/**
 * What a partner receives as the HTTP body of every webhook (the signed bytes):
 *
 *   { "id": "<uuid>", "type": "booking.created", "apiVersion": "v1",
 *     "createdAt": "<ISO>", "data": { ... } }
 *
 * `id` is stable across retries so receivers can de-duplicate.
 */
export interface WebhookEnvelope {
  id: string;
  type: WebhookDeliveredEventType;
  apiVersion: "v1";
  createdAt: string;
  data: Record<string, any>;
}

const buildEnvelope = (
  id: string,
  type: WebhookDeliveredEventType,
  data: Record<string, any>,
): WebhookEnvelope => ({
  id,
  type,
  apiVersion: "v1",
  createdAt: new Date().toISOString(),
  data: JSON.parse(JSON.stringify(data ?? {})), // dates -> ISO strings, drops undefined
});

@Injectable()
export class PartnerWebhookDispatcherService {
  private readonly logger = new Logger(PartnerWebhookDispatcherService.name);

  constructor(
    @InjectModel("Partner") private readonly partnerModel: Model<any>,
    @InjectModel("PartnerWebhook") private readonly webhookModel: Model<any>,
    @InjectModel("PartnerWebhookEvent") private readonly eventModel: Model<any>,
    @InjectQueue(PARTNER_WEBHOOK_QUEUE) private readonly webhookQueue: Queue<WebhookDispatchJobData>,
  ) {}

  /**
   * Publishes an event to every active webhook that subscribed to it, for partners that are
   * active, hold the matching read permission, and are allowed to see the booking's property.
   * Persistent outbox in the database + a BullMQ delivery job per webhook.
   */
  async publishEvent(eventType: WebhookEventType, payload: any, partnerIdFilter?: string): Promise<void> {
    try {
      const query: Record<string, any> = {
        status: "active",
        subscribedEvents: eventType,
      };

      if (partnerIdFilter) {
        query.partnerId = partnerIdFilter;
      }

      const activeWebhooks = await this.webhookModel.find(query).lean();
      if (!activeWebhooks || activeWebhooks.length === 0) {
        return;
      }

      const partnerIds = Array.from(new Set(activeWebhooks.map((w: any) => String(w.partnerId))));
      const partners = await this.partnerModel.find({ _id: { $in: partnerIds } }).lean();
      const partnerById = new Map<string, any>(partners.map((p: any) => [String(p._id), p]));
      const requiredPermission = WEBHOOK_EVENT_PERMISSION[eventType];
      const ashramId = payload?.ashramId ? String(payload.ashramId) : null;

      for (const webhook of activeWebhooks) {
        const partner = partnerById.get(String(webhook.partnerId));
        if (!partner || partner.status !== "active") continue;
        if (!(partner.allowedPermissions ?? []).includes(requiredPermission)) continue;

        // A partner scoped to specific properties never hears about other properties' bookings.
        const scope = (partner.scopedAshramIds ?? []).map(String);
        if (scope.length > 0 && (!ashramId || !scope.includes(ashramId))) continue;

        await this.stageAndEnqueue(webhook, eventType, payload, {
          attempts: 5,
          backoffMs: 15_000, // 15s, 30s, 60s, 120s, 240s...
        });
      }
    } catch (error: any) {
      // Must not throw or block the main application caller
      this.logger.error(`Failed to publish partner webhook event ${eventType}: ${error.message || String(error)}`);
    }
  }

  /**
   * Sends one signed "webhook.test" event to a single endpoint (admin console "Send test").
   * Uses the exact same signing and delivery path as real events.
   */
  async sendTestEvent(webhookId: string): Promise<string | null> {
    const webhook = await this.webhookModel.findById(webhookId).lean();
    if (!webhook) return null;
    return this.stageAndEnqueue(
      webhook,
      WEBHOOK_TEST_EVENT,
      {
        message: "This is a test event from the Tirvona Developer Console.",
        webhookId: String(webhook._id),
        partnerId: String(webhook.partnerId),
      },
      { attempts: 1, backoffMs: 0 },
    );
  }

  private async stageAndEnqueue(
    webhook: any,
    eventType: WebhookDeliveredEventType,
    data: Record<string, any>,
    retry: { attempts: number; backoffMs: number },
  ): Promise<string> {
    const eventId = randomUUID();

    // 1. Persist the event (the exact envelope that will be signed and sent) in the outbox
    await this.eventModel.create({
      eventId,
      partnerId: webhook.partnerId,
      webhookId: webhook._id,
      eventType,
      payload: buildEnvelope(eventId, eventType, data),
      status: "pending",
      attempts: 0,
      nextAttemptAt: new Date(),
    });

    // 2. Enqueue in BullMQ with deduplication ID
    await this.webhookQueue.add(
      "deliver-webhook",
      {
        eventId,
        webhookId: String(webhook._id),
        partnerId: String(webhook.partnerId),
        eventType,
      },
      {
        jobId: `partner-wh-${eventId}`,
        attempts: retry.attempts,
        ...(retry.attempts > 1 ? { backoff: { type: "exponential", delay: retry.backoffMs } } : {}),
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    );

    this.logger.log(`Enqueued partner webhook event ${eventType} [${eventId}] for webhook ${webhook._id}`);
    return eventId;
  }

  /**
   * Manual retry of a failed webhook event.
   */
  async retryEvent(eventId: string): Promise<boolean> {
    const event = await this.eventModel.findOne({ eventId });
    if (!event) return false;

    event.status = "pending";
    event.nextAttemptAt = new Date();
    await event.save();

    await this.webhookQueue.add(
      "deliver-webhook",
      {
        eventId: event.eventId,
        webhookId: String(event.webhookId),
        partnerId: String(event.partnerId),
        eventType: event.eventType,
      },
      {
        jobId: `partner-wh-${event.eventId}-manual-${Date.now()}`,
        attempts: 3,
        backoff: { type: "exponential", delay: 10_000 },
      },
    );

    return true;
  }
}
