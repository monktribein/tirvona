import { Schema, Types } from "mongoose";
import {
  SMART_CONTACT_AUDIT_ACTIONS,
  SMART_CONTACT_AUDIT_COLLECTION,
} from "../../domain/smart-contact.constants";

export const SmartContactAuditSchema = new Schema(
  {
    profileId: {
      type: Types.ObjectId,
      required: true,
      index: true,
      immutable: true,
    },
    action: {
      type: String,
      enum: SMART_CONTACT_AUDIT_ACTIONS,
      required: true,
      index: true,
    },
    field: { type: String, trim: true, default: "" },
    oldValue: { type: String, default: "" },
    newValue: { type: String, default: "" },
    actorId: { type: String, trim: true, default: "", immutable: true },
    actorName: { type: String, trim: true, default: "", immutable: true },
    ip: { type: String, trim: true, default: "" },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: SMART_CONTACT_AUDIT_COLLECTION,
  },
);

SmartContactAuditSchema.index({ profileId: 1, createdAt: -1 });
