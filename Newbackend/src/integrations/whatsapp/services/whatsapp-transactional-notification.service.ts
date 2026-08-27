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
import {
  buildParkingMessage,
  buildStayMessage,
} from "../utils/whatsapp-message.builder";

type StayMessageKind = Parameters<typeof buildStayMessage>[0];

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

  /** Maps an outbox event onto the shape of message it should read as. */
  private stayKindFor(event: string): StayMessageKind | null {
    const key = event.toLowerCase();
    if (key.includes("confirm")) return "confirmed";
    if (key.includes("held") || key.includes("hold")) return "held";
    if (key.includes("expired")) return "expired";
    if (key.includes("cancel")) return "cancelled";
    if (key.includes("payment_success") || key === "payment_success")
      return "payment_success";
    if (key.includes("payment_failed")) return "payment_failed";
    if (key.includes("refund")) return "refund";
    if (key.includes("checkin") || key.includes("check_in"))
      return "checkin_reminder";
    return null;
  }

  /**
   * Composes the body a guest actually reads. Falls back to the row's title and
   * message only when the worker could not load the booking behind it.
   */
  private composeBody(notification: WhatsAppOutboxNotification): string {
    const fallback = {
      title: notification.title,
      message: notification.message,
    };

    if (notification.parking) {
      const key = notification.event.toLowerCase();
      const kind = key.includes("cancel")
        ? "cancelled"
        : key.includes("remind")
          ? "reminder"
          : "confirmed";
      return buildParkingMessage(kind, notification.parking, fallback);
    }

    if (notification.stay) {
      const kind = this.stayKindFor(notification.event);
      if (kind) return buildStayMessage(kind, notification.stay, fallback);
    }

    // No booking context reached us, so fall back to the notification row's
    // own wording with the title bolded as a heading.
    return notification.title
      ? [`*${notification.title}*`, "", notification.message].join("\n")
      : notification.message;
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
      // The composed body is the whole message, so no separate title is passed
      // or the renderer would print the heading twice.
      message: this.composeBody(notification),
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
