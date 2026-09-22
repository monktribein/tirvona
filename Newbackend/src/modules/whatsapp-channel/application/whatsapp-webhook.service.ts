import { Inject, Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { InjectQueue } from "@nestjs/bullmq";
import type { ConfigType } from "@nestjs/config";
import type { Queue } from "bullmq";
import type { Model } from "mongoose";
import { createHmac, timingSafeEqual } from "node:crypto";
import { whatsappConfig } from "../../../integrations/whatsapp/config/whatsapp.config";
import { maskWhatsAppNumber } from "../../../integrations/whatsapp/utils/whatsapp-phone.util";
import {
  WHATSAPP_CHANNEL_MODEL,
  WHATSAPP_INBOUND_QUEUE,
} from "../domain/whatsapp-channel.constants";

/** One normalized inbound message, whatever shape Meta delivered it in. */
export interface InboundMessage {
  messageId: string;
  phone: string;
  profileName: string;
  messageType: string;
  /** Plain text, or the title of the row/button the guest tapped. */
  text: string;
  /** Reply id of a tapped list row or button, e.g. "menu:stay". */
  replyId: string;
  sentAt: Date;
}

export interface InboundJob {
  messageId: string;
  eventId: string;
}

/**
 * Receives and verifies Meta's inbound webhook deliveries.
 *
 * Mirrors `PaymentsWebhookService`: verify the signature over the exact raw
 * body, record the delivery under a unique key, and let a duplicate key error
 * mark a redelivery as already handled. Nothing is executed in the request —
 * the message is enqueued and the controller answers immediately, because
 * Meta retries anything it does not get a prompt 2xx for and a slow handler
 * turns one guest message into several.
 */
@Injectable()
export class WhatsAppWebhookService {
  private readonly logger = new Logger(WhatsAppWebhookService.name);

  constructor(
    @Inject(whatsappConfig.KEY)
    private readonly config: ConfigType<typeof whatsappConfig>,
    @InjectModel(WHATSAPP_CHANNEL_MODEL.InboundEvent)
    private readonly events: Model<any>,
    @InjectQueue(WHATSAPP_INBOUND_QUEUE)
    private readonly queue: Queue<InboundJob>,
  ) {}

  /**
   * Answers Meta's subscription handshake.
   *
   * The token is compared in constant time even though it is not a signature:
   * the endpoint is public, so a naive comparison would leak the token one
   * character at a time to anyone willing to time the responses.
   */
  verifySubscription(
    mode: string,
    token: string,
    challenge: string,
  ): string | null {
    const expected = this.config.conversation.verifyToken;
    if (!expected) {
      this.logger.error(
        JSON.stringify({
          event: "whatsapp.webhook_verify_unconfigured",
          reason: "WHATSAPP_WEBHOOK_VERIFY_TOKEN is not set",
        }),
      );
      return null;
    }
    if (mode !== "subscribe") return null;
    const left = Buffer.from(String(token ?? ""));
    const right = Buffer.from(expected);
    if (left.length !== right.length || !timingSafeEqual(left, right)) {
      this.logger.warn(
        JSON.stringify({ event: "whatsapp.webhook_verify_rejected" }),
      );
      return null;
    }
    this.logger.log(
      JSON.stringify({ event: "whatsapp.webhook_verify_accepted" }),
    );
    return String(challenge ?? "");
  }

  /**
   * Verifies `X-Hub-Signature-256` as sha256=HMAC(rawBody, appSecret).
   *
   * The raw body is used rather than a re-serialized object because any
   * difference in key order or whitespace changes the digest. `rawBody: true`
   * is already enabled in main.ts for Razorpay, so it is available here.
   *
   * With no app secret configured nothing is trusted — an unverified inbound
   * message could otherwise be forged by anyone who knows the URL.
   */
  verifySignature(rawBody: Buffer | undefined, signature: string): boolean {
    const secret = this.config.conversation.appSecret;
    if (!secret || !rawBody || !signature) return false;
    const provided = String(signature);
    if (!provided.startsWith("sha256=")) return false;
    const expected = createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");
    const left = Buffer.from(provided.slice("sha256=".length));
    const right = Buffer.from(expected);
    return left.length === right.length && timingSafeEqual(left, right);
  }

  /**
   * Flattens Meta's nested `entry[].changes[].value.messages[]` envelope into
   * the messages this channel acts on.
   *
   * Status callbacks (sent / delivered / read / failed for our own outbound
   * messages) arrive on the same webhook and are deliberately ignored here:
   * they belong to the existing transactional pipeline, not to a conversation.
   */
  extractMessages(payload: any): InboundMessage[] {
    const messages: InboundMessage[] = [];
    for (const entry of payload?.entry ?? []) {
      for (const change of entry?.changes ?? []) {
        const value = change?.value;
        if (!value?.messages?.length) continue;
        const contacts: any[] = value.contacts ?? [];
        for (const raw of value.messages) {
          const phone = String(raw?.from ?? "");
          if (!raw?.id || !phone) continue;
          const contact = contacts.find((c) => String(c?.wa_id) === phone);
          messages.push({
            messageId: String(raw.id),
            phone,
            profileName: String(contact?.profile?.name ?? ""),
            ...this.readBody(raw),
            sentAt: new Date(Number(raw.timestamp ?? 0) * 1000 || Date.now()),
          });
        }
      }
    }
    return messages;
  }

  /**
   * Reads the guest's actual input out of whichever message shape Meta used.
   *
   * A tapped list row or button carries both a stable id we chose and the
   * title the guest saw; the id is what routes, and the title is kept only so
   * the transcript reads like the conversation the guest had.
   */
  private readBody(raw: any): {
    messageType: string;
    text: string;
    replyId: string;
  } {
    const type = String(raw?.type ?? "unsupported");
    if (type === "text")
      return {
        messageType: "text",
        text: String(raw?.text?.body ?? ""),
        replyId: "",
      };
    if (type === "interactive") {
      const interactive = raw.interactive ?? {};
      const reply = interactive.list_reply ?? interactive.button_reply ?? {};
      return {
        messageType: "interactive",
        text: String(reply.title ?? ""),
        replyId: String(reply.id ?? ""),
      };
    }
    if (type === "button")
      return {
        messageType: "button",
        text: String(raw?.button?.text ?? ""),
        replyId: String(raw?.button?.payload ?? ""),
      };
    if (type === "location")
      return {
        messageType: "location",
        text: String(raw?.location?.name ?? raw?.location?.address ?? ""),
        replyId: "",
      };
    return { messageType: type, text: "", replyId: "" };
  }

  /**
   * Records one message and queues it for processing.
   *
   * The insert happens before anything is enqueued, so a Meta redelivery of
   * the same `messages[].id` is rejected by the unique index and returns
   * without queueing a second job. That is what stops a redelivery creating a
   * second booking, payment order or cancellation.
   */
  async receive(message: InboundMessage): Promise<"queued" | "duplicate"> {
    let event: any;
    try {
      event = await this.events.create({
        messageId: message.messageId,
        phone: message.phone,
        messageType: message.messageType,
        text: message.text,
        replyId: message.replyId,
        sentAt: message.sentAt,
        status: "received",
      });
    } catch (error: any) {
      if (error?.code === 11000) {
        this.logger.log(
          JSON.stringify({
            event: "whatsapp.inbound_duplicate_ignored",
            messageId: message.messageId,
          }),
        );
        return "duplicate";
      }
      throw error;
    }

    // With the conversation off the delivery is still recorded, so switching
    // the flag on later never replays a backlog at customers.
    if (!this.config.conversation.enabled) {
      await this.events.updateOne(
        { _id: event._id },
        { $set: { status: "ignored", processedAt: new Date() } },
      );
      this.logger.log(
        JSON.stringify({
          event: "whatsapp.inbound_skipped",
          reason: "conversation_disabled",
          messageId: message.messageId,
        }),
      );
      return "queued";
    }

    const jobId = `wa-inbound-${message.messageId}`;
    await this.queue.add(
      "handle",
      { messageId: message.messageId, eventId: String(event._id) },
      {
        jobId,
        attempts: 3,
        backoff: { type: "exponential", delay: 2_000 },
        removeOnComplete: 1000,
        removeOnFail: 1000,
      },
    );
    await this.events.updateOne(
      { _id: event._id },
      { $set: { status: "queued", queueJobId: jobId } },
    );
    this.logger.log(
      JSON.stringify({
        event: "whatsapp.inbound_queued",
        messageId: message.messageId,
        messageType: message.messageType,
        maskedNumber: maskWhatsAppNumber(message.phone),
        queueJobId: jobId,
      }),
    );
    return "queued";
  }
}
