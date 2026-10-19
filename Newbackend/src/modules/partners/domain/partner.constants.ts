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

/** Events a partner can subscribe to plus the synthetic "webhook.test" ping sent from the admin console. */
export const WEBHOOK_TEST_EVENT = "webhook.test" as const;
export const WEBHOOK_ALL_EVENT_TYPES = [...WEBHOOK_EVENT_TYPES, WEBHOOK_TEST_EVENT] as const;
export type WebhookDeliveredEventType = (typeof WEBHOOK_ALL_EVENT_TYPES)[number];

/** Permission a partner needs before it may receive a given event. */
export const WEBHOOK_EVENT_PERMISSION: Record<WebhookEventType, PartnerPermission> = {
  "booking.created": "bookings.read",
  "booking.status_changed": "bookings.read",
  "booking.cancelled": "bookings.read",
  "payment.succeeded": "payments.read",
  "payment.failed": "payments.read",
};

export const WEBHOOK_DELIVERY_STATUSES = ["pending", "success", "failed"] as const;
export type WebhookDeliveryStatus = (typeof WEBHOOK_DELIVERY_STATUSES)[number];

export const PARTNER_WEBHOOK_QUEUE = "partner-webhooks";
