import { Schema, Types } from "mongoose";
import { smartContactConfig } from "../../config/smart-contact.config";
import {
  SMART_CONTACT_DEVICE_TYPES,
  SMART_CONTACT_EVENT_COLLECTION,
  SMART_CONTACT_EVENT_TYPES,
} from "../../domain/smart-contact.constants";

/**
 * `smart_contact_events` — the raw analytics log (spec §31).
 *
 * Deliberately append-only and deliberately not personal. There is no IP
 * column: spec §26 asks for approximate geography, and §38 forbids exposing
 * anything more than business data, so the request IP is consumed to derive a
 * country/state/city and a salted `sessionHash`, then discarded. What lands
 * here cannot be re-identified even if the collection leaks.
 *
 * `sessionHash` is what makes "unique visitors" (spec §24) countable without
 * storing an identity — it is a salted digest of IP + user agent, stable for
 * one visitor across a session and useless as a lookup key for anything else.
 */
export const SmartContactEventSchema = new Schema(
  {
    profileId: {
      type: Types.ObjectId,
      required: true,
      index: true,
      immutable: true,
    },
    // Null when the visitor reached the page by typing the URL or following a
    // link rather than scanning a specific printed asset.
    qrId: { type: Types.ObjectId, default: null, index: true },
    eventType: {
      type: String,
      enum: SMART_CONTACT_EVENT_TYPES,
      required: true,
      index: true,
    },
    sessionHash: { type: String, required: true, index: true },
    deviceType: {
      type: String,
      enum: SMART_CONTACT_DEVICE_TYPES,
      default: "other",
    },
    browser: { type: String, trim: true, default: "" },
    os: { type: String, trim: true, default: "" },
    country: { type: String, trim: true, default: "" },
    state: { type: String, trim: true, default: "" },
    city: { type: String, trim: true, default: "" },
    referrer: { type: String, trim: true, default: "" },
    // `?src=business-card` and friends (spec §28).
    source: { type: String, trim: true, default: "" },
  },
  {
    // `updatedAt` would be meaningless on an append-only log.
    timestamps: { createdAt: true, updatedAt: false },
    collection: SMART_CONTACT_EVENT_COLLECTION,
  },
);

// Every analytics query is "one profile, one date range, grouped by type".
SmartContactEventSchema.index({ profileId: 1, createdAt: -1 });
SmartContactEventSchema.index({ profileId: 1, eventType: 1, createdAt: -1 });
// Backs the unique-visitor distinct count without a collection scan.
SmartContactEventSchema.index({ profileId: 1, sessionHash: 1 });

// Raw events expire on their own rather than accumulating forever; the console
// reads aggregates, and nothing in the product needs a three-year-old scan
// record. Set SMART_CONTACT_EVENT_RETENTION_DAYS=0 to keep events indefinitely.
const retentionDays = smartContactConfig().eventRetentionDays;
if (retentionDays > 0) {
  SmartContactEventSchema.index(
    { createdAt: 1 },
    { expireAfterSeconds: retentionDays * 24 * 60 * 60 },
  );
}
