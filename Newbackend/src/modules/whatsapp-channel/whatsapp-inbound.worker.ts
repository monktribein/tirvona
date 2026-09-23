import { Injectable, Logger } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { InjectModel } from "@nestjs/mongoose";
import type { Job } from "bullmq";
import type { Model } from "mongoose";
import { ConversationService } from "./application/conversation.service";
import type { InboundJob } from "./application/whatsapp-webhook.service";
import { WHATSAPP_CHANNEL_MODEL, WHATSAPP_INBOUND_QUEUE } from "./domain/whatsapp-channel.constants";

/**
 * Runs one inbound WhatsApp message.
 *
 * Processing is off the request path so the webhook can answer Meta
 * immediately — Meta redelivers anything it does not get a prompt 2xx for,
 * and a redelivery of a message that is already being handled would risk a
 * second booking.
 *
 * The job carries only the ids; the message itself is re-read from the
 * recorded event, so a retry always works from what was actually received.
 */
@Processor(WHATSAPP_INBOUND_QUEUE)
@Injectable()
export class WhatsAppInboundWorker extends WorkerHost {
  private readonly logger = new Logger(WhatsAppInboundWorker.name);

  constructor(
    private readonly conversation: ConversationService,
    @InjectModel(WHATSAPP_CHANNEL_MODEL.InboundEvent)
    private readonly events: Model<any>,
  ) {
    super();
  }

  async process(job: Job<InboundJob>): Promise<void> {
    const event = await this.events.findById(job.data.eventId).lean();
    if (!event) {
      this.logger.warn(
        JSON.stringify({
          event: "whatsapp.inbound_event_missing",
          messageId: job.data.messageId,
        }),
      );
      return;
    }

    // A message already handled is not handled again, even if BullMQ retries
    // the job after a failure late in processing.
    if ((event as any).status === "processed") {
      this.logger.log(
        JSON.stringify({
          event: "whatsapp.inbound_already_processed",
          messageId: job.data.messageId,
        }),
      );
      return;
    }

    const startedAt = Date.now();
    this.logger.log(
      JSON.stringify({
        event: "whatsapp.inbound_job_started",
        messageId: job.data.messageId,
        queueJobId: job.id,
        attempt: job.attemptsMade + 1,
      }),
    );

    try {
      const outcome = await this.conversation.handle({
        messageId: (event as any).messageId,
        phone: (event as any).phone,
        profileName: "",
        messageType: (event as any).messageType,
        text: (event as any).text ?? "",
        replyId: (event as any).replyId ?? "",
        sentAt: (event as any).sentAt ?? new Date(),
      });

      // A turn the conversation could not complete is recorded as failed even
      // though it did not throw. It is not retried: the guest was already sent
      // an apology, and replaying the message would only repeat it.
      const failed = outcome.status === "failed";
      await this.events.updateOne(
        { _id: job.data.eventId },
        {
          $set: {
            status: failed ? "failed" : "processed",
            processedAt: new Date(),
            ...(failed ? { processingError: outcome.errorType ?? "UnknownError" } : {}),
          },
        },
      );
      this.logger.log(
        JSON.stringify({
          event: "whatsapp.inbound_job_finished",
          messageId: job.data.messageId,
          queueJobId: job.id,
          outcome: outcome.status,
          errorType: outcome.errorType,
          durationMs: Date.now() - startedAt,
        }),
      );
    } catch (error) {
      // Only the error class is recorded — an error message can carry guest
      // details, and this row is read by support.
      await this.events.updateOne(
        { _id: job.data.eventId },
        {
          $set: {
            status: "failed",
            processingError:
              error instanceof Error ? error.name : "UnknownError",
          },
        },
      );
      this.logger.error(
        JSON.stringify({
          event: "whatsapp.inbound_job_threw",
          messageId: job.data.messageId,
          queueJobId: job.id,
          attempt: job.attemptsMade + 1,
          errorType: error instanceof Error ? error.name : "UnknownError",
          durationMs: Date.now() - startedAt,
        }),
      );
      throw error;
    }
  }
}
