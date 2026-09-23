import { Inject, Injectable, Logger } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";
import { whatsappConfig } from "../../../integrations/whatsapp/config/whatsapp.config";
import { MetaCloudWhatsAppClient } from "../../../integrations/whatsapp/providers/meta-cloud/meta-cloud-whatsapp.client";
import type {
  MetaListRow,
  MetaReplyButton,
} from "../../../integrations/whatsapp/providers/meta-cloud/meta-cloud-whatsapp.client";
import { WhatsAppDeliveryUnconfirmedError } from "../../../integrations/whatsapp/errors/whatsapp.errors";
import { maskWhatsAppNumber } from "../../../integrations/whatsapp/utils/whatsapp-phone.util";
import {
  WHATSAPP_TEST_MODE_BLOCK_REASON,
  isAllowedTestRecipient,
} from "../../../integrations/whatsapp/utils/whatsapp-test-recipients.util";
import { CUSTOMER_SERVICE_WINDOW_MS } from "../domain/whatsapp-channel.constants";

/**
 * Sends conversational replies.
 *
 * This is deliberately separate from the transactional pipeline. Booking
 * confirmations, cancellations, refund updates and reminders are raised as
 * outbox rows by the domain services and delivered by the existing
 * NotificationWorker over approved templates; nothing here duplicates them.
 * A reply from this service only ever answers something the guest just sent.
 *
 * Every send is gated on Meta's 24-hour customer service window. Outside it a
 * free-form message is rejected by Meta, so it is not attempted at all — a
 * guest who has gone quiet can only be reached by an approved template, which
 * is the transactional pipeline's job.
 */
@Injectable()
export class WhatsAppReplyService {
  private readonly logger = new Logger(WhatsAppReplyService.name);

  constructor(
    @Inject(whatsappConfig.KEY)
    private readonly config: ConfigType<typeof whatsappConfig>,
    private readonly meta: MetaCloudWhatsAppClient,
  ) {}

  /**
   * True when a free-form reply is still legal for this conversation.
   * `lastInboundAt` is the guest's own last message, which is what opens the
   * window.
   */
  withinWindow(lastInboundAt: number): boolean {
    return Date.now() - lastInboundAt < CUSTOMER_SERVICE_WINDOW_MS;
  }

  /**
   * Applies the same delivery gates the transactional path already respects,
   * so turning WhatsApp on for conversations cannot bypass dry-run or the
   * test-recipient allow-list.
   */
  private blockedReason(phone: string): string | null {
    if (!this.config.enabled) return "whatsapp_disabled";
    if (!this.config.conversation.enabled) return "conversation_disabled";
    if (this.config.dryRun) return "dry_run";
    if (
      !isAllowedTestRecipient(
        {
          testMode: this.config.testMode,
          testRecipients: this.config.testRecipients,
        },
        phone,
      )
    )
      return WHATSAPP_TEST_MODE_BLOCK_REASON;
    return null;
  }

  private async send(
    phone: string,
    correlationId: string,
    message: Parameters<
      MetaCloudWhatsAppClient["sendConversationalMessage"]
    >[1],
  ): Promise<void> {
    const blocked = this.blockedReason(phone);
    if (blocked) {
      this.logger.log(
        JSON.stringify({
          event: "whatsapp.reply_skipped",
          reason: blocked,
          messageKind: message.kind,
          correlationId,
        }),
      );
      return;
    }
    // Logged before the call, so a reply that was attempted can be told apart
    // from one that was never generated at all. The provider logs the HTTP
    // result under the same correlation id.
    this.logger.log(
      JSON.stringify({
        event: "whatsapp.reply_sending",
        messageKind: message.kind,
        correlationId,
        maskedNumber: maskWhatsAppNumber(phone),
      }),
    );
    try {
      await this.meta.sendConversationalMessage(
        { to: phone, correlationId, idempotencyKey: correlationId },
        message,
      );
    } catch (error) {
      // An unconfirmed send may already be in the guest's chat. Retrying would
      // put a second copy there, so it is recorded and dropped — the same rule
      // the transactional path follows.
      if (error instanceof WhatsAppDeliveryUnconfirmedError) {
        this.logger.warn(
          JSON.stringify({
            event: "whatsapp.reply_unconfirmed",
            messageKind: message.kind,
            correlationId,
          }),
        );
        return;
      }
      throw error;
    }
  }

  async text(
    phone: string,
    correlationId: string,
    body: string,
    previewUrl = false,
  ): Promise<void> {
    await this.send(phone, correlationId, { kind: "text", body, previewUrl });
  }

  async buttons(
    phone: string,
    correlationId: string,
    body: string,
    buttons: MetaReplyButton[],
    extras: { header?: string; footer?: string } = {},
  ): Promise<void> {
    await this.send(phone, correlationId, {
      kind: "buttons",
      body,
      buttons,
      ...extras,
    });
  }

  async list(
    phone: string,
    correlationId: string,
    body: string,
    button: string,
    rows: MetaListRow[],
    extras: { header?: string; footer?: string; sectionTitle?: string } = {},
  ): Promise<void> {
    await this.send(phone, correlationId, {
      kind: "list",
      body,
      button,
      rows,
      ...extras,
    });
  }
}
