import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "../../../database/orm-nest";
import type { Model } from "../../../database/orm";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";
import { randomUUID } from "node:crypto";
import { PARTNER_WEBHOOK_QUEUE, type WebhookEventType } from "../domain/partner.constants";

export interface WebhookDispatchJobData {
  eventId: string;
  webhookId: string;
  partnerId: string;
  eventType: WebhookEventType;
}

@Injectable()
export class PartnerWebhookDispatcherService {
  private readonly logger = new Logger(PartnerWebhookDispatcherService.name);

  constructor(
    @InjectModel("PartnerWebhook") private readonly webhookModel: Model<any>,
    @InjectModel("PartnerWebhookEvent") private readonly eventModel: Model<any>,
    @InjectQueue(PARTNER_WEBHOOK_QUEUE) private readonly webhookQueue: Queue<WebhookDispatchJobData>,
  ) {}

  /**
   * Asynchronously publishes an event to all subscribed and active webhooks.
   * Uses persistent outbox pattern in MongoDB and enqueues BullMQ delivery jobs.
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

      for (const webhook of activeWebhooks) {
        const eventId = randomUUID();

        // 1. Persist event in outbox
        await this.eventModel.create({
          eventId,
          partnerId: webhook.partnerId,
          webhookId: webhook._id,
          eventType,
          payload,
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
            attempts: 5,
            backoff: {
              type: "exponential",
              delay: 15_000, // 15s, 30s, 60s, 120s, 240s...
            },
            removeOnComplete: 1000,
            removeOnFail: 5000,
          },
        );

        this.logger.log(`Enqueued partner webhook event ${eventType} [${eventId}] for webhook ${webhook._id}`);
      }
    } catch (error: any) {
      // Must not throw or block the main application caller
      this.logger.error(`Failed to publish partner webhook event ${eventType}: ${error.message || String(error)}`);
    }
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
