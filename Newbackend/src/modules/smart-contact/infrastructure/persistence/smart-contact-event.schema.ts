import { Schema, Types } from "mongoose";
import { smartContactConfig } from "../../config/smart-contact.config";
import {
  SMART_CONTACT_DEVICE_TYPES,
  SMART_CONTACT_EVENT_COLLECTION,
  SMART_CONTACT_EVENT_TYPES,
} from "../../domain/smart-contact.constants";

export const SmartContactEventSchema = new Schema(
  {
    profileId: {
      type: Types.ObjectId,
      required: true,
      index: true,
      immutable: true,
    },
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
    source: { type: String, trim: true, default: "" },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: SMART_CONTACT_EVENT_COLLECTION,
  },
);

SmartContactEventSchema.index({ profileId: 1, createdAt: -1 });
SmartContactEventSchema.index({ profileId: 1, eventType: 1, createdAt: -1 });
SmartContactEventSchema.index({ profileId: 1, sessionHash: 1 });

const retentionDays = smartContactConfig().eventRetentionDays;
if (retentionDays > 0) {
  SmartContactEventSchema.index(
    { createdAt: 1 },
    { expireAfterSeconds: retentionDays * 24 * 60 * 60 },
  );
}
