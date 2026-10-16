export const PARTNER_PERMISSIONS = [
  "bookings.read",
  "inventory.read",
  "payments.read",
] as const;

export type PartnerPermission = (typeof PARTNER_PERMISSIONS)[number];

export const PARTNER_ENVIRONMENTS = ["sandbox", "production"] as const;
export type PartnerEnvironment = (typeof PARTNER_ENVIRONMENTS)[number];

export const PARTNER_STATUSES = ["active", "suspended", "revoked"] as const;
export type PartnerStatus = (typeof PARTNER_STATUSES)[number];

export const API_KEY_STATUSES = ["active", "revoked"] as const;
export type ApiKeyStatus = (typeof API_KEY_STATUSES)[number];

export const WEBHOOK_STATUSES = ["active", "inactive"] as const;
export type WebhookStatus = (typeof WEBHOOK_STATUSES)[number];

export const WEBHOOK_EVENT_TYPES = [
  "booking.created",
  "booking.status_changed",
  "booking.cancelled",
  "payment.succeeded",
  "payment.failed",
] as const;
export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];

export const WEBHOOK_DELIVERY_STATUSES = ["pending", "success", "failed"] as const;
export type WebhookDeliveryStatus = (typeof WEBHOOK_DELIVERY_STATUSES)[number];

export const PARTNER_WEBHOOK_QUEUE = "partner-webhooks";
