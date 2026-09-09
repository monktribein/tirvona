import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { InjectModel } from "@nestjs/mongoose";
import { Interval, SchedulerRegistry } from "@nestjs/schedule";
import type { Queue } from "bullmq";
import type { Model } from "mongoose";
import { AARTI_MODEL } from "../aarti/domain/aarti.constants";
import { EVENT_MODEL } from "../events/domain/event.constants";
import type { NotificationJob } from "./notification.worker";

const OUTBOX_POLL_NAME = "notification-outbox-poll";
const OUTBOX_POLL_INTERVAL_MS = 5_000;
const WHATSAPP_RECOVERY_WINDOW_MS = 60 * 60 * 1_000;
/**
 * Aarti and event rows were written but never dispatched before this poller
 * existed, so a backlog of stale `queued` rows can be sitting in the database.
 * Only rows raised inside this window are delivered; anything older is retired
 * as `skipped` so no guest is messaged about a long-past booking.
 */
const ACTIVATION_WINDOW_MS = 60 * 60 * 1_000;

interface EnqueueSummary {
  found: number;
  enqueued: number;
  alreadyRegistered: number;
}

@Injectable()
export class NotificationOutboxService implements OnApplicationBootstrap {
  private readonly logger = new Logger(NotificationOutboxService.name);
  private pollInProgress = false;
  private pollSequence = 0;

  constructor(
    @InjectQueue("notifications")
    private readonly queue: Queue<NotificationJob>,
    @InjectModel("BookingNotification") private readonly booking: Model<any>,
    @InjectModel("ParkingNotification") private readonly parking: Model<any>,
    @InjectModel("CommunityNotification") private readonly community: Model<any>,
    @InjectModel(AARTI_MODEL.Notification) private readonly aarti: Model<any>,
    @InjectModel(EVENT_MODEL.Notification) private readonly event: Model<any>,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    this.logger.log(
      JSON.stringify({
        event: "notification.outbox_scheduler_initialized",
        queue: "notifications",
        pollIntervalMs: OUTBOX_POLL_INTERVAL_MS,
        schedulerRegistered: this.schedulerRegistry.doesExist(
          "interval",
          OUTBOX_POLL_NAME,
        ),
        bookingCollection: this.booking.collection.collectionName,
      }),
    );
    await this.dispatch();
  }

  @Interval(OUTBOX_POLL_NAME, OUTBOX_POLL_INTERVAL_MS)
  async dispatch(): Promise<void> {
    if (this.pollInProgress) {
      this.logger.warn(
        JSON.stringify({
          event: "notification.outbox_poll_skipped",
          reason: "previous_poll_still_running",
        }),
      );
      return;
    }
    this.pollInProgress = true;
    const pollSequence = ++this.pollSequence;
    try {
      const booking = await this.enqueue("booking", this.booking);
      const bookingWhatsAppRecovery = await this.enqueueWhatsAppRecovery();
      const parking = await this.enqueue("parking", this.parking);
      const community = await this.enqueue("community", this.community);
      const aarti = await this.enqueue("aarti", this.aarti);
      const eventRegistration = await this.enqueue("event", this.event);
      this.logger.log(
        JSON.stringify({
          event: "notification.outbox_poll_completed",
          pollSequence,
          booking,
          bookingWhatsAppRecovery,
          parking,
          community,
          aarti,
          eventRegistration,
        }),
      );
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: "notification.outbox_poll_failed",
          pollSequence,
          errorType: error instanceof Error ? error.name : "UnknownError",
        }),
      );
    } finally {
      this.pollInProgress = false;
    }
  }

  private async enqueueWhatsAppRecovery(): Promise<EnqueueSummary> {
    const rows = await this.booking
      .find({
        status: "sent",
        event: "booking_confirmed",
        recipientPhone: { $exists: true, $ne: "" },
        "meta.whatsappStatus": { $ne: "sent" },
        createdAt: {
          $gte: new Date(Date.now() - WHATSAPP_RECOVERY_WINDOW_MS),
        },
      })
      .sort({ createdAt: 1 })
      .limit(100)
      .lean();
    const summary: EnqueueSummary = {
      found: rows.length,
      enqueued: 0,
      alreadyRegistered: 0,
    };
    for (const row of rows as any[]) {
      const jobId = `booking-${row._id}-whatsapp-recovery-v1`;
      const existingJob = await this.queue.getJob(jobId);
      if (!existingJob) {
        await this.queue.add(
          "deliver",
          {
            domain: "booking",
            notificationId: String(row._id),
            userId: String(row.userId),
            event: row.event,
            title: row.title,
            message: row.message,
            channel: row.channel,
            bookingId: row.bookingId ? String(row.bookingId) : undefined,
            phone: row.recipientPhone,
            correlationId:
              row.meta?.correlationId || `booking-${row._id}-whatsapp`,
            deliveryScope: "whatsapp_only",
          },
          {
            jobId,
            attempts: 5,
            backoff: { type: "exponential", delay: 5_000 },
            removeOnComplete: 1000,
            removeOnFail: 1000,
          },
        );
        summary.enqueued += 1;
      } else {
        summary.alreadyRegistered += 1;
      }
      await this.booking.updateOne(
        { _id: row._id, "meta.whatsappStatus": { $ne: "sent" } },
        { $set: { "meta.whatsappRecoveryJobId": jobId } },
      );
      this.logger.log(
        JSON.stringify({
          event: "notification.outbox_whatsapp_recovery_enqueued",
          eventType: row.event,
          notificationId: String(row._id),
          bookingId: row.bookingId ? String(row.bookingId) : undefined,
          correlationId:
            row.meta?.correlationId || `booking-${row._id}-whatsapp`,
          queueJobId: jobId,
          queueAction: existingJob ? "already_registered" : "enqueued",
        }),
      );
    }
    return summary;
  }

  /**
   * Retires `queued` rows older than the activation window for a domain that
   * was previously never dispatched, so switching the poller on cannot flush a
   * historical backlog at guests.
   */
  private async retireBacklog(model: Model<any>): Promise<number> {
    const result = await model.updateMany(
      {
        status: "queued",
        createdAt: { $lt: new Date(Date.now() - ACTIVATION_WINDOW_MS) },
      },
      {
        $set: {
          status: "skipped",
          "meta.whatsappStatus": "skipped",
          "meta.whatsappReason": "outside_activation_window",
        },
      },
    );
    return result.modifiedCount ?? 0;
  }

  private async enqueue(
    domain: "booking" | "parking" | "community" | "aarti" | "event",
    model: Model<any>,
  ): Promise<EnqueueSummary> {
    // Aarti and event rows are newly activated, so their backlog is retired
    // before anything is enqueued. Booking, parking and community have always
    // been dispatched and keep draining their queue exactly as before.
    if (domain === "aarti" || domain === "event") {
      const retired = await this.retireBacklog(model);
      if (retired > 0)
        this.logger.warn(
          JSON.stringify({
            event: "notification.outbox_backlog_retired",
            domain,
            retired,
            activationWindowMs: ACTIVATION_WINDOW_MS,
          }),
        );
    }
    const rows = await model
      .find({ status: "queued" })
      .sort({ createdAt: 1 })
      .limit(100)
      .lean();
    const summary: EnqueueSummary = {
      found: rows.length,
      enqueued: 0,
      alreadyRegistered: 0,
    };
    for (const row of rows as any[]) {
      const jobId = `${domain}-${row._id}`;
      const existingJob = await this.queue.getJob(jobId);
      if (!existingJob) {
        await this.queue.add(
          "deliver",
          {
            domain,
            notificationId: String(row._id),
            userId: String(row.userId),
            event: row.event,
            title: row.title,
            message: row.message,
            channel: row.channel,
            bookingId: row.bookingId
              ? String(row.bookingId)
              : row.registrationId
                ? String(row.registrationId)
                : undefined,
            phone: row.recipientPhone,
            correlationId: row.meta?.correlationId || jobId,
          },
          {
            jobId,
            attempts: 5,
            backoff: { type: "exponential", delay: 5_000 },
            removeOnComplete: 1000,
            removeOnFail: 1000,
          },
        );
        summary.enqueued += 1;
      } else {
        summary.alreadyRegistered += 1;
      }
      await model.updateOne(
        {
          _id: row._id,
          status: "queued",
        },
        { $set: { "meta.queueJobId": jobId } },
      );
      this.logger.log(
        JSON.stringify({
          event: "notification.outbox_enqueued",
          domain,
          eventType: row.event,
          notificationId: String(row._id),
          bookingId: row.bookingId ? String(row.bookingId) : undefined,
          correlationId: row.meta?.correlationId || jobId,
          hasRecipientPhone: Boolean(row.recipientPhone),
          queueJobId: jobId,
          queueAction: existingJob ? "already_registered" : "enqueued",
        }),
      );
    }
    return summary;
  }
}
