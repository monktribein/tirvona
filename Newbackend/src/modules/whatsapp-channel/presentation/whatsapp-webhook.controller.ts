import {
  Controller,
  ForbiddenException,
  Get,
  Header,
  Headers,
  HttpCode,
  Logger,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import type { RawBodyRequest } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import { Public } from "../../../common/decorators/public.decorator";
import { WhatsAppWebhookService } from "../application/whatsapp-webhook.service";

/**
 * How many delivery-status callbacks (sent / delivered / read / failed for
 * our own outbound messages) this delivery carried. Counted only so the log
 * can tell an empty delivery from a status-only one; nothing acts on them.
 */
const countStatuses = (payload: any): number => {
  let count = 0;
  for (const entry of payload?.entry ?? [])
    for (const change of entry?.changes ?? [])
      count += change?.value?.statuses?.length ?? 0;
  return count;
};

/**
 * Meta's WhatsApp Cloud API webhook.
 *
 * Public (no JWT) because Meta is the caller. Authentication is the
 * `X-Hub-Signature-256` HMAC over the raw body on POST, and the verify token
 * on GET — exactly the arrangement the Razorpay webhook already uses, so the
 * two public webhooks in this codebase behave the same way.
 *
 * Configure this URL in Meta → WhatsApp → Configuration → Webhook, subscribe
 * to the `messages` field, and set the same verify token here as
 * WHATSAPP_WEBHOOK_VERIFY_TOKEN plus the app secret as WHATSAPP_APP_SECRET.
 */
@Controller("whatsapp")
export class WhatsAppWebhookController {
  private readonly logger = new Logger(WhatsAppWebhookController.name);

  constructor(private readonly webhook: WhatsAppWebhookService) {}

  /**
   * Subscription handshake. Meta expects the raw `hub.challenge` value back
   * as plain text — a JSON-wrapped body fails verification.
   */
  @Public()
  @Get("webhook")
  @Header("content-type", "text/plain")
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  verify(
    @Query("hub.mode") mode = "",
    @Query("hub.verify_token") token = "",
    @Query("hub.challenge") challenge = "",
  ): string {
    const result = this.webhook.verifySubscription(mode, token, challenge);
    if (result === null)
      throw new ForbiddenException("WhatsApp webhook verification failed");
    return result;
  }

  /**
   * Inbound message delivery.
   *
   * Answers 200 as soon as the messages are recorded and queued. Meta retries
   * any delivery it does not get a prompt 2xx for, so no conversation work
   * happens here — a slow handler would turn one guest message into several
   * webhook deliveries.
   *
   * The throttle limit is deliberately high: every delivery arrives from
   * Meta's own IPs, so a tight limit here would drop genuine traffic for every
   * customer at once. Per-guest abuse is rate limited by phone further in,
   * where it can be applied to the right person.
   */
  @Public()
  @Post("webhook")
  @HttpCode(200)
  @Throttle({ default: { limit: 600, ttl: 60_000 } })
  async handle(
    @Req() request: RawBodyRequest<Request>,
    @Headers("x-hub-signature-256") signature = "",
  ): Promise<{ success: true }> {
    if (!this.webhook.verifySignature(request.rawBody, signature)) {
      this.logger.warn(
        JSON.stringify({ event: "whatsapp.webhook_signature_rejected" }),
      );
      throw new UnauthorizedException("Invalid WhatsApp webhook signature");
    }

    const messages = this.webhook.extractMessages(request.body);
    // Meta delivers message and status callbacks on the same URL, and only
    // the first kind is a conversation. Recording the count of each makes an
    // "it returns 200 but nothing happens" report answerable from the log:
    // zero extracted messages means the delivery carried no guest message.
    this.logger.log(
      JSON.stringify({
        event: "whatsapp.webhook_received",
        messageCount: messages.length,
        statusCount: countStatuses(request.body),
      }),
    );

    for (const message of messages) {
      try {
        await this.webhook.receive(message);
      } catch (error) {
        // One bad message must not cost the whole delivery its 2xx, or Meta
        // redelivers every message in the batch — including the ones already
        // recorded. The error class alone is logged; guest content is not.
        this.logger.error(
          JSON.stringify({
            event: "whatsapp.inbound_receive_failed",
            messageId: message.messageId,
            errorType: error instanceof Error ? error.name : "UnknownError",
          }),
        );
      }
    }
    return { success: true };
  }
}
