import { Schema, SchemaTypes } from "../../../database/orm";
import {
  API_KEY_STATUSES,
  PARTNER_ENVIRONMENTS,
  PARTNER_PERMISSIONS,
  PARTNER_STATUSES,
  WEBHOOK_DELIVERY_STATUSES,
  WEBHOOK_ALL_EVENT_TYPES,
  WEBHOOK_EVENT_TYPES,
  WEBHOOK_STATUSES,
} from "../domain/partner.constants";

const id = (ref: string, required = false) => ({
  type: SchemaTypes.ObjectId,
  ref,
  required,
  default: required ? undefined : null,
});

const opts = (collection: string) => ({
  timestamps: true,
  collection,
  optimisticConcurrency: true,
});

/**
 * 1. Partner Schema
 */
export const PartnerSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    contactEmail: { type: String, required: true, lowercase: true, trim: true },
    contactPhone: { type: String, trim: true },
    description: { type: String, trim: true },
    environment: {
      type: String,
      enum: PARTNER_ENVIRONMENTS,
      default: "sandbox",
      required: true,
    },
    status: {
      type: String,
      enum: PARTNER_STATUSES,
      default: "active",
      index: true,
    },
    allowedPermissions: [
      {
        type: String,
        enum: PARTNER_PERMISSIONS,
      },
    ],
    // Scope partner to specific ashrams/properties if applicable (empty = platform-wide allowed)
    scopedAshramIds: [{ type: SchemaTypes.ObjectId, ref: "Ashram" }],
    rateLimitPerMinute: { type: Number, default: 120 },
    createdBy: id("User"),
    updatedBy: id("User"),
  },
  opts("partners"),
);

PartnerSchema.index({ status: 1, environment: 1 });

/**
 * 2. Partner API Key Schema
 */
export const PartnerApiKeySchema = new Schema(
  {
    partnerId: id("Partner", true),
    name: { type: String, required: true, trim: true },
    keyPrefix: { type: String, required: true, index: true }, // e.g. tv_test_abc123 or tv_live_xyz789
    secretHash: { type: String, required: true, unique: true }, // SHA-256 of the complete API key secret
    environment: {
      type: String,
      enum: PARTNER_ENVIRONMENTS,
      required: true,
    },
    permissions: [
      {
        type: String,
        enum: PARTNER_PERMISSIONS,
      },
    ],
    status: {
      type: String,
      enum: API_KEY_STATUSES,
      default: "active",
      index: true,
    },
    expiresAt: { type: Date, default: null },
    lastUsedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
    revokedBy: id("User"),
    createdBy: id("User"),
  },
  opts("partner_api_keys"),
);

PartnerApiKeySchema.index({ partnerId: 1, status: 1 });
PartnerApiKeySchema.index({ secretHash: 1, status: 1 });

/**
 * 3. Webhook Subscription Schema
 */
export const PartnerWebhookSchema = new Schema(
  {
    partnerId: id("Partner", true),
    url: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    subscribedEvents: [
      {
        type: String,
        enum: WEBHOOK_EVENT_TYPES,
        required: true,
      },
    ],
    status: {
      type: String,
      enum: WEBHOOK_STATUSES,
      default: "active",
      index: true,
    },
    // Encrypted signing secret (AES-256-GCM)
    secretCiphertext: { type: String, required: true, select: false },
    secretIv: { type: String, required: true, select: false },
    secretTag: { type: String, required: true, select: false },
    secretLast4: { type: String, required: true },
    createdBy: id("User"),
    updatedBy: id("User"),
  },
  opts("partner_webhooks"),
);

PartnerWebhookSchema.index({ partnerId: 1, status: 1 });

/**
 * 4. Partner Webhook Event Outbox Schema
 */
export const PartnerWebhookEventSchema = new Schema(
  {
    eventId: { type: String, required: true, unique: true }, // uuid v4
    partnerId: id("Partner", true),
    webhookId: id("PartnerWebhook", true),
    eventType: {
      type: String,
      enum: WEBHOOK_ALL_EVENT_TYPES,
      required: true,
      index: true,
    },
    payload: { type: SchemaTypes.Mixed, required: true },
    status: {
      type: String,
      enum: WEBHOOK_DELIVERY_STATUSES,
      default: "pending",
      index: true,
    },
    attempts: { type: Number, default: 0 },
    nextAttemptAt: { type: Date, default: Date.now },
    lastAttemptAt: { type: Date, default: null },
    lastError: { type: String, default: null },
  },
  opts("partner_webhook_events"),
);

PartnerWebhookEventSchema.index({ status: 1, nextAttemptAt: 1 });
PartnerWebhookEventSchema.index({ partnerId: 1, eventType: 1 });

/**
 * 5. Webhook Delivery Log Schema
 */
export const PartnerWebhookDeliveryLogSchema = new Schema(
  {
    eventId: { type: String, required: true, index: true },
    webhookId: id("PartnerWebhook", true),
    partnerId: id("Partner", true),
    url: { type: String, required: true },
    eventType: { type: String, required: true },
    status: {
      type: String,
      enum: WEBHOOK_DELIVERY_STATUSES,
      required: true,
    },
    attemptNumber: { type: Number, required: true },
    responseStatusCode: { type: Number, default: null },
    responseBody: { type: String, default: null },
    errorMessage: { type: String, default: null },
    durationMs: { type: Number, default: 0 },
    deliveredAt: { type: Date, default: Date.now },
  },
  opts("partner_webhook_delivery_logs"),
);

PartnerWebhookDeliveryLogSchema.index({ webhookId: 1, deliveredAt: -1 });
PartnerWebhookDeliveryLogSchema.index({ partnerId: 1, deliveredAt: -1 });
