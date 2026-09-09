import type { WHATSAPP_TEMPLATE } from "../constants/whatsapp.constants";
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
}

export interface WhatsAppProviderResult {
  status: "accepted" | "skipped";
  provider: string;
  providerMessageId?: string;
  reason?: string;
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
}
