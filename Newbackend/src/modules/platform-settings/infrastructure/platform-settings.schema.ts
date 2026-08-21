import { Schema } from "mongoose";
import {
  DEFAULT_PLATFORM_FEE_SCOPES,
  PLATFORM_FEE_SCOPE_VALUES,
} from "../domain/platform-fee";
export const PlatformSettingsSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, default: "main" },
    platformFee: {
      enabled: { type: Boolean, default: true },
      type: { type: String, enum: ["flat", "percentage"], default: "flat" },
      value: { type: Number, default: 49, min: 0 },
      label: { type: String, default: "Tirvona Platform Fee" },
      appliesTo: {
        type: [String],
        enum: PLATFORM_FEE_SCOPE_VALUES,
        default: () => [...DEFAULT_PLATFORM_FEE_SCOPES],
      },
    },
    gstRate: { type: Number, default: 5, min: 0 },
    platformFeeGstRate: { type: Number, default: 18, min: 0, max: 100 },
    bookingCommissionPercent: { type: Number, default: 10, min: 0, max: 100 },
    notificationSound: {
      enabled: { type: Boolean, default: false },
      url: { type: String, default: "" },
      fileName: { type: String, default: "" },
      volume: { type: Number, default: 0.7, min: 0, max: 1 },
    },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  {
    timestamps: true,
    collection: "platform_settings",
    optimisticConcurrency: true,
  },
);
