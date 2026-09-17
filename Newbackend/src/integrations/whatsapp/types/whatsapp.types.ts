import type { WHATSAPP_TEMPLATE } from "../constants/whatsapp.constants";
import type { MetaTransactionalEvent } from "../constants/whatsapp-meta-templates.constants";
import type {
  WhatsAppParkingContext,
  WhatsAppStayContext,
} from "../utils/whatsapp-message.builder";

export type WhatsAppTemplateKey =
  (typeof WHATSAPP_TEMPLATE)[keyof typeof WHATSAPP_TEMPLATE];

export type WhatsAppTemplateValue = string | number | boolean;

export interface WhatsAppTemplateDefinition {
  name: string;
  language: string;
}

export interface WhatsAppProviderRequest {
  to: string;
  messageType: WhatsAppTemplateKey;
  message: string;
  idempotencyKey: string;
  correlationId?: string;
  /**
   * The unrendered variables behind `message`. Text providers ignore this and
   * send `message`; template providers such as MSG91 map it onto the approved
   * template's components.
   */
  templateVariables?: Readonly<Record<string, WhatsAppTemplateValue>>;
  /**
   * The logical transactional event behind the message. Meta Cloud sends it
   * only once an approved template is configured for this event; every other
   * provider ignores it.
   */
  metaEvent?: MetaTransactionalEvent;
  /**
   * An image sent as a separate message after the template is accepted, e.g.
   * the parking pass QR. Meta Cloud only; other providers ignore it.
   */
  followUpImage?: WhatsAppFollowUpImage;
}

export interface WhatsAppFollowUpImage {
  /** Image bytes. Never logged. */
  data: Buffer;
  mimeType: "image/png";
  filename: string;
  /** Free text shown under the image. Never logged. */
  caption?: string;
}

export interface WhatsAppFollowUpResult {
  status: "accepted" | "skipped" | "failed" | "unconfirmed";
  providerMessageId?: string;
  reason?: string;
}

export interface WhatsAppProviderResult {
  status: "accepted" | "skipped";
  provider: string;
  providerMessageId?: string;
  reason?: string;
  /** Outcome of `followUpImage`, when one was requested. */
  followUp?: WhatsAppFollowUpResult;
}

export interface WhatsAppAartiContext {
  guestName?: string;
  reference?: string;
  sessionName?: string;
  displayCode?: string;
  scheduledAt?: Date | string;
  amountPaid?: number;
  refundAmount?: number;
  currency?: string;
  contactPhone?: string;
  passCount?: number;
  checkedInAt?: Date | string;
  checkedInCount?: number;
}

export interface WhatsAppEventContext {
  guestName?: string;
  reference?: string;
  eventName?: string;
  venue?: string;
  displayCode?: string;
  startsAt?: Date | string;
  amountPaid?: number;
  currency?: string;
  seats?: number;
  contactPhone?: string;
  checkedInAt?: Date | string;
  checkedInCount?: number;
}

export type WhatsAppDomain =
  | "booking"
  | "parking"
  | "community"
  | "aarti"
  | "event";

export interface WhatsAppOutboxNotification {
  domain: WhatsAppDomain;
  notificationId: string;
  event: string;
  phone: string;
  recipientName?: string;
  title: string;
  message: string;
  reference?: string;
  correlationId?: string;
  /**
   * Booking or parking details loaded by the worker. When present the message
   * is composed from these instead of echoing the row's raw title and message.
   */
  stay?: WhatsAppStayContext;
  parking?: WhatsAppParkingContext;
  aarti?: WhatsAppAartiContext;
  /** Event-registration pass details; `event` above is the outbox event name. */
  eventPass?: WhatsAppEventContext;
  /** String payload stored on the outbox row, e.g. refund amount and number. */
  data?: Readonly<Record<string, string>>;
  /** When the outbox row was written, i.e. when the transition happened. */
  occurredAt?: Date | string;
  /**
   * PNG of the parking pass QR, rendered from the stored credential. Sent as a
   * follow-up image after the parking confirmation template.
   */
  parkingQrImage?: Buffer;
}
