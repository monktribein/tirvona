import { Schema, Types } from "mongoose";
import {
  SMART_CONTACT_QR_COLLECTION,
  SMART_CONTACT_QR_FORMATS,
  SMART_CONTACT_QR_SOURCES,
  SMART_CONTACT_QR_STATUSES,
} from "../../domain/smart-contact.constants";

export const SmartContactQrCodeSchema = new Schema(
  {
    profileId: {
      type: Types.ObjectId,
      required: true,
      index: true,
      immutable: true,
    },
    qrIdentifier: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    destinationUrl: { type: String, required: true, trim: true, immutable: true },
    source: {
      type: String,
      enum: SMART_CONTACT_QR_SOURCES,
      default: "business-card",
      index: true,
    },
    formats: {
      type: [{ type: String, enum: SMART_CONTACT_QR_FORMATS }],
      default: ["svg", "png"],
    },
    status: {
      type: String,
      enum: SMART_CONTACT_QR_STATUSES,
      default: "ACTIVE",
      index: true,
    },
    label: { type: String, trim: true, default: "", maxlength: 120 },
    createdById: { type: String, trim: true, default: "", immutable: true },
    createdByName: { type: String, trim: true, default: "", immutable: true },
  },
  {
    timestamps: true,
    collection: SMART_CONTACT_QR_COLLECTION,
  },
);

SmartContactQrCodeSchema.index({ profileId: 1, status: 1, createdAt: -1 });
