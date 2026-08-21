import { Injectable } from "@nestjs/common";
import {
  WHATSAPP_OUTBOX_EVENT_TEMPLATE,
  WHATSAPP_OUTBOX_FALLBACK_TEMPLATE,
  WHATSAPP_TEMPLATE,
} from "../constants/whatsapp.constants";
import type {
  WhatsAppOutboxNotification,
  WhatsAppProviderResult,
  WhatsAppTemplateKey,
  WhatsAppTemplateValue,
} from "../types/whatsapp.types";
import { WhatsAppTemplateService } from "./whatsapp-template.service";

interface TransactionalInput {
  phone: string;
  idempotencyKey: string;
  correlationId?: string;
  recipientName?: string;
  reference?: string;
  title?: string;
  message?: string;
  amount?: number;
  date?: string;
}

@Injectable()
export class WhatsAppTransactionalNotificationService {
  constructor(private readonly templates: WhatsAppTemplateService) {}

  sendBookingConfirmation(input: TransactionalInput) {
    return this.send(WHATSAPP_TEMPLATE.BOOKING_CONFIRMATION, input);
  }
  sendPaymentSuccess(input: TransactionalInput) {
    return this.send(WHATSAPP_TEMPLATE.PAYMENT_SUCCESS, input);
  }
  sendPaymentFailure(input: TransactionalInput) {
    return this.send(WHATSAPP_TEMPLATE.PAYMENT_FAILURE, input);
  }
  sendCancellation(input: TransactionalInput) {
    return this.send(WHATSAPP_TEMPLATE.CANCELLATION, input);
  }
  sendRefund(input: TransactionalInput) {
    return this.send(WHATSAPP_TEMPLATE.REFUND, input);
  }
  sendCheckinReminder(input: TransactionalInput) {
    return this.send(WHATSAPP_TEMPLATE.CHECKIN_REMINDER, input);
  }

  sendOutboxEvent(
    notification: WhatsAppOutboxNotification,
  ): Promise<WhatsAppProviderResult | null> {
    const templateKey = (WHATSAPP_OUTBOX_EVENT_TEMPLATE[
      notification.event.toLowerCase()
    ] ?? WHATSAPP_OUTBOX_FALLBACK_TEMPLATE) as WhatsAppTemplateKey;
    return this.send(templateKey, {
      phone: notification.phone,
      recipientName: notification.recipientName,
      reference: notification.reference,
      title: notification.title,
      message: notification.message,
      idempotencyKey: `${notification.domain}:${notification.notificationId}:whatsapp`,
      correlationId: notification.correlationId,
    });
  }

  private send(
    templateKey: WhatsAppTemplateKey,
    input: TransactionalInput,
  ): Promise<WhatsAppProviderResult> {
    const variables: Record<string, WhatsAppTemplateValue> = {};
    if (input.recipientName) variables.recipient_name = input.recipientName;
    if (input.reference) variables.reference = input.reference;
    if (input.title) variables.title = input.title;
    if (input.message) variables.message = input.message;
    if (input.amount !== undefined) variables.amount = input.amount;
    if (input.date) variables.date = input.date;
    return this.templates.send({
      to: input.phone,
      templateKey,
      variables,
      idempotencyKey: input.idempotencyKey,
      correlationId: input.correlationId,
    });
  }
}
