import { Injectable } from "@nestjs/common";
import {
  WHATSAPP_DOMAIN_EVENT_TEMPLATE,
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
  buildAartiMessage,
  buildEventMessage,
  buildParkingMessage,
  buildStayMessage,
  formatDateTime,
  formatMoney,
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
  sendCheckinConfirmed(input: TransactionalInput) {
    return this.send(WHATSAPP_TEMPLATE.CHECKIN_CONFIRMED, input);
  }
  sendCheckoutCompleted(input: TransactionalInput) {
    return this.send(WHATSAPP_TEMPLATE.CHECKOUT_COMPLETED, input);
  }

  /** Maps an outbox event onto the shape of message it should read as. */
  private stayKindFor(event: string): StayMessageKind | null {
    const key = event.toLowerCase();
    if (key.includes("checked_in") || key === "checkin") return "checked_in";
    if (key.includes("checked_out") || key === "checkout") return "checked_out";
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

    if (notification.aarti)
      return buildAartiMessage(
        notification.event.toLowerCase().includes("cancel") ||
          notification.event.toLowerCase().includes("refund")
          ? "cancelled"
          : "confirmed",
        notification.aarti,
        fallback,
      );

    if (notification.eventPass)
      return buildEventMessage(
        notification.event.toLowerCase().includes("cancel")
          ? "cancelled"
          : "confirmed",
        notification.eventPass,
        fallback,
      );

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

  /**
   * Resolves the template for an outbox row. Aarti and event registrations
   * reuse generic event names, so their domain is consulted first.
   */
  templateKeyFor(domain: string, event: string): WhatsAppTemplateKey {
    const key = event.toLowerCase();
    const domainMap = WHATSAPP_DOMAIN_EVENT_TEMPLATE[domain];
    return (domainMap?.[key] ??
      WHATSAPP_OUTBOX_EVENT_TEMPLATE[key] ??
      WHATSAPP_OUTBOX_FALLBACK_TEMPLATE) as WhatsAppTemplateKey;
  }

  /**
   * The structured fields an approved WhatsApp template fills its numbered
   * placeholders from. The text provider ignores these and sends the composed
   * body instead, so both providers describe the same notification.
   */
  private outboxVariables(
    notification: WhatsAppOutboxNotification,
    body: string,
  ): Record<string, WhatsAppTemplateValue> {
    const { stay, parking, aarti, eventPass } = notification;
    const currency =
      stay?.currency ??
      parking?.currency ??
      aarti?.currency ??
      eventPass?.currency;
    const variables: Record<string, WhatsAppTemplateValue> = {
      title: notification.title,
      message: body,
    };
    const set = (key: string, value: WhatsAppTemplateValue | undefined) => {
      if (value !== undefined && value !== null && String(value).trim())
        variables[key] = value;
    };

    set("guest_name", notification.recipientName);
    set(
      "reference",
      notification.reference ??
        stay?.reference ??
        parking?.reference ??
        aarti?.reference ??
        eventPass?.reference,
    );

    if (stay) {
      set("guest_name", stay.guestName ?? notification.recipientName);
      set("ashram_name", stay.ashramName);
      set(
        "location",
        [stay.ashramCity, stay.ashramState].filter(Boolean).join(", "),
      );
      set("room_name", stay.roomName);
      set("check_in", formatDateTime(stay.checkInDate));
      set("check_out", formatDateTime(stay.checkOutDate));
      set("guests", stay.guestsCount);
      set("rooms", stay.roomsCount);
      set("code", stay.checkInCode);
      set("amount", formatMoney(stay.amountPaid, currency));
      set("total_amount", formatMoney(stay.totalAmount, currency));
      set("refund_amount", formatMoney(stay.amountPaid, currency));
    }
    if (parking) {
      set("location", parking.locationName);
      set("vehicle_number", parking.vehicleNumber);
      set("check_in", formatDateTime(parking.entryAt));
      set("check_out", formatDateTime(parking.exitAt));
      set("code", parking.displayCode);
      set("pass_url", parking.passUrl);
      set("amount", formatMoney(parking.amountPaid, currency));
    }
    if (aarti) {
      set("guest_name", aarti.guestName ?? notification.recipientName);
      set("session_name", aarti.sessionName);
      set("code", aarti.displayCode);
      set("check_in", formatDateTime(aarti.scheduledAt));
      set("amount", formatMoney(aarti.amountPaid, currency));
      set("refund_amount", formatMoney(aarti.refundAmount, currency));
    }
    if (eventPass) {
      set("guest_name", eventPass.guestName ?? notification.recipientName);
      set("event_name", eventPass.eventName);
      set("location", eventPass.venue);
      set("code", eventPass.displayCode);
      set("check_in", formatDateTime(eventPass.startsAt));
      set("amount", formatMoney(eventPass.amountPaid, currency));
    }
    return variables;
  }

  sendOutboxEvent(
    notification: WhatsAppOutboxNotification,
  ): Promise<WhatsAppProviderResult | null> {
    const templateKey = this.templateKeyFor(
      notification.domain,
      notification.event,
    );
    // The composed body is the whole message, so no separate title is passed
    // or the renderer would print the heading twice.
    const body = this.composeBody(notification);
    return this.templates.send({
      to: notification.phone,
      templateKey,
      variables: this.outboxVariables(notification, body),
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
