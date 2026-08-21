import type { WHATSAPP_TEMPLATE } from "../constants/whatsapp.constants";

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
}

export interface WhatsAppProviderResult {
  status: "accepted" | "skipped";
  provider: string;
  providerMessageId?: string;
  reason?: string;
}

export interface WhatsAppOutboxNotification {
  domain: "booking" | "parking" | "community";
  notificationId: string;
  event: string;
  phone: string;
  recipientName?: string;
  title: string;
  message: string;
  reference?: string;
  correlationId?: string;
}
