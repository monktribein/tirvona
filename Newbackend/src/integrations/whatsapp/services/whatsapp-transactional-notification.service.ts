import {
  Inject,
  Injectable,
  Logger,
  Optional,
  type OnModuleInit,
} from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";
import { whatsappConfig } from "../config/whatsapp.config";
import {
  WHATSAPP_DOMAIN_EVENT_TEMPLATE,
  WHATSAPP_OUTBOX_EVENT_TEMPLATE,
  WHATSAPP_OUTBOX_FALLBACK_TEMPLATE,
  WHATSAPP_TEMPLATE,
} from "../constants/whatsapp.constants";
import type {
  WhatsAppFollowUpImage,
  WhatsAppOutboxNotification,
  WhatsAppProviderResult,
  WhatsAppTemplateKey,
  WhatsAppTemplateValue,
} from "../types/whatsapp.types";
import { WhatsAppTemplateService } from "./whatsapp-template.service";
import {
  isAllowedTestRecipient,
  WHATSAPP_TEST_MODE_BLOCK_REASON,
} from "../utils/whatsapp-test-recipients.util";
import {
  META_TRANSACTIONAL_EVENT,
  metaTransactionalEventFor,
  whatsappSuppressionReasonFor,
  WHATSAPP_BOOKING_TYPE_LABEL,
  type MetaTransactionalEvent,
} from "../constants/whatsapp-meta-templates.constants";
import {
  buildAartiMessage,
  buildEventMessage,
  buildParkingMessage,
  buildStayMessage,
  formatDate,
  formatDateTime,
  formatMoney,
} from "../utils/whatsapp-message.builder";

type StayMessageKind = Parameters<typeof buildStayMessage>[0];

/** First value that reads as a finite number; outbox data stores strings. */
const numberOr = (...values: unknown[]): number | undefined => {
  for (const value of values) {
    if (value === undefined || value === null || value === "") continue;
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

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
export class WhatsAppTransactionalNotificationService implements OnModuleInit {
  private readonly logger = new Logger(
    WhatsAppTransactionalNotificationService.name,
  );

  constructor(
    private readonly templates: WhatsAppTemplateService,
    @Optional()
    @Inject(whatsappConfig.KEY)
    private readonly config?: ConfigType<typeof whatsappConfig>,
  ) {}

  onModuleInit(): void {
    if (!this.config?.testMode) return;
    // Only the count is logged; the allow-listed numbers themselves are not.
    this.logger.warn(
      JSON.stringify({
        event: "whatsapp.test_mode_enabled",
        scope: "transactional_notifications",
        allowedRecipients: this.config.testRecipients.length,
      }),
    );
  }

  /**
   * In test mode a transactional message may only reach an allow-listed
   * number, whichever provider would carry it. Returns the skip result for a
   * blocked recipient, or null when the send may proceed.
   */
  private testModeBlock(phone: string): WhatsAppProviderResult | null {
    if (isAllowedTestRecipient(this.config, phone)) return null;
    return {
      status: "skipped",
      provider: "none",
      reason: WHATSAPP_TEST_MODE_BLOCK_REASON,
    };
  }

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
      const kind =
        key === "checked_in"
          ? "checked_in"
          : key === "checked_out"
            ? "checked_out"
            : key === "expired" || key === "no_show"
              ? "expired"
              : key.includes("cancel") || key === "refund"
                ? "cancelled"
                : key.includes("remind")
                  ? "reminder"
                  : "confirmed";
      return buildParkingMessage(kind, notification.parking, fallback);
    }

    if (notification.aarti) {
      const key = notification.event.toLowerCase();
      return buildAartiMessage(
        key === "checked_in"
          ? "checked_in"
          : key.includes("cancel") || key.includes("refund")
            ? "cancelled"
            : "confirmed",
        notification.aarti,
        fallback,
      );
    }

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

    // Named fields for Meta's approved transactional templates. The keys above
    // keep their meaning for MSG91 and the text provider.
    const { data, occurredAt } = notification;
    const refundAmount = data?.refundAmount ?? data?.amount;
    set("booking_type", WHATSAPP_BOOKING_TYPE_LABEL[notification.domain]);
    set(
      "customer_name",
      stay?.guestName ??
        aarti?.guestName ??
        eventPass?.guestName ??
        notification.recipientName,
    );
    set("refund_status", this.refundStatus(notification));
    set("payment_reference", data?.refundNumber);
    set("expiry_time", formatDateTime(occurredAt));
    if (stay) {
      set("property_name", stay.ashramName);
      set("check_in_date", formatDate(stay.checkInDate));
      set("check_out_date", formatDate(stay.checkOutDate));
      set("amount_paid", formatMoney(stay.amountPaid, currency));
      if (stay.totalAmount !== undefined)
        set(
          "amount_due",
          formatMoney(
            Math.max(0, stay.totalAmount - (stay.amountPaid ?? 0)),
            currency,
          ),
        );
      set("payment_deadline", formatDateTime(stay.reservationExpiresAt));
      set("check_in_code", stay.checkInCode);
      set("check_in_time", formatDateTime(stay.checkedInAt ?? occurredAt));
      set("check_out_time", formatDateTime(stay.checkedOutAt ?? occurredAt));
      set(
        "service_details",
        stay.roomNumbers?.length
          ? `Room ${stay.roomNumbers.join(", ")}`
          : stay.roomName,
      );
      if (stay.amountPaid)
        set(
          "settlement_details",
          `Amount paid ${formatMoney(stay.amountPaid, currency)}`,
        );
      set(
        "refund_amount",
        formatMoney(numberOr(refundAmount, stay.refundAmount), currency),
      );
    }
    if (parking) {
      set(
        "parking_location",
        [parking.locationName, parking.locationCity].filter(Boolean).join(", "),
      );
      set("entry_time", formatDateTime(parking.entryAt));
      set("exit_time", formatDateTime(parking.exitAt));
      set("amount_paid", formatMoney(parking.amountPaid, currency));
      set("gate_code", parking.displayCode);
      set("check_in_time", formatDateTime(parking.checkedInAt ?? occurredAt));
      set(
        "check_out_time",
        formatDateTime(parking.checkedOutAt ?? occurredAt),
      );
      set(
        "service_details",
        [
          parking.slotNumber && `Bay ${parking.slotNumber}`,
          parking.locationName,
          parking.vehicleNumber && `Vehicle ${parking.vehicleNumber}`,
        ]
          .filter(Boolean)
          .join(", "),
      );
      set(
        "settlement_details",
        parking.overstayAmount
          ? `Overstay charge ${formatMoney(parking.overstayAmount, currency)}`
          : "No overstay charges",
      );
      set(
        "refund_amount",
        formatMoney(numberOr(refundAmount, parking.refundAmount), currency),
      );
    }
    if (aarti) {
      set("service_name", aarti.sessionName);
      set("scheduled_at", formatDateTime(aarti.scheduledAt));
      set("devotees", aarti.passCount);
      set("amount_paid", formatMoney(aarti.amountPaid, currency));
      set("entry_code", aarti.displayCode);
      set("check_in_time", formatDateTime(aarti.checkedInAt ?? occurredAt));
      set(
        "service_details",
        aarti.checkedInCount
          ? `${aarti.checkedInCount} devotee(s) admitted`
          : aarti.sessionName,
      );
      set(
        "refund_amount",
        formatMoney(numberOr(refundAmount, aarti.refundAmount), currency),
      );
    }
    if (eventPass) {
      set("event_name", eventPass.eventName);
      set("start_time", formatDateTime(eventPass.startsAt));
      set("venue", eventPass.venue);
      set("seats", eventPass.seats);
      set("entry_code", eventPass.displayCode);
      set(
        "check_in_time",
        formatDateTime(eventPass.checkedInAt ?? occurredAt),
      );
    }
    return variables;
  }

  /**
   * The parking pass QR sent after the parking confirmation template. Only the
   * confirmation carries it, and only when the worker rendered it from the
   * stored credential.
   */
  private parkingQrFollowUp(
    notification: WhatsAppOutboxNotification,
    metaEvent: MetaTransactionalEvent | undefined,
  ): WhatsAppFollowUpImage | undefined {
    if (
      metaEvent !== META_TRANSACTIONAL_EVENT.PARKING_CONFIRMED ||
      !notification.parkingQrImage?.length
    )
      return undefined;
    const reference = notification.parking?.reference;
    const gateCode = notification.parking?.displayCode;
    return {
      data: notification.parkingQrImage,
      mimeType: "image/png",
      filename: `tirvona-parking-pass${reference ? `-${reference}` : ""}.png`,
      caption: [
        `Tirvona parking pass${reference ? ` ${reference}` : ""}`,
        "Show this QR code at the parking entry gate.",
        gateCode ? `Gate code: ${gateCode}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    };
  }

  /** The refund state a guest reads, derived from the transition itself. */
  private refundStatus(
    notification: WhatsAppOutboxNotification,
  ): string | undefined {
    const key = notification.event.toLowerCase();
    if (key === "refund_approved") return "Approved";
    if (key === "refund_failed") return "Failed";
    if (key === "refund_completed") return "Completed";
    if (!key.includes("cancel") && key !== "refund") return undefined;
    // Event registrations take no payment, so nothing is refundable.
    if (notification.domain === "event") return "Not applicable";
    const amount = numberOr(
      notification.data?.refundAmount,
      notification.stay?.refundAmount,
      notification.parking?.refundAmount,
      notification.aarti?.refundAmount,
    );
    return amount && amount > 0 ? "Refund initiated" : "No refund due";
  }

  async sendOutboxEvent(
    notification: WhatsAppOutboxNotification,
  ): Promise<WhatsAppProviderResult | null> {
    const suppressed = whatsappSuppressionReasonFor(
      notification.domain,
      notification.event,
    );
    if (suppressed)
      return { status: "skipped", provider: "none", reason: suppressed };
    const blocked = this.testModeBlock(notification.phone);
    if (blocked) return blocked;
    const templateKey = this.templateKeyFor(
      notification.domain,
      notification.event,
    );
    const metaEvent = metaTransactionalEventFor(
      notification.domain,
      notification.event,
    );
    const followUpImage = this.parkingQrFollowUp(notification, metaEvent);
    // The composed body is the whole message, so no separate title is passed
    // or the renderer would print the heading twice.
    const body = this.composeBody(notification);
    return this.templates.send({
      to: notification.phone,
      templateKey,
      variables: this.outboxVariables(notification, body),
      idempotencyKey: `${notification.domain}:${notification.notificationId}:whatsapp`,
      correlationId: notification.correlationId,
      ...(metaEvent ? { metaEvent } : {}),
      ...(followUpImage ? { followUpImage } : {}),
    });
  }

  private send(
    templateKey: WhatsAppTemplateKey,
    input: TransactionalInput,
  ): Promise<WhatsAppProviderResult> {
    const blocked = this.testModeBlock(input.phone);
    if (blocked) return Promise.resolve(blocked);
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
