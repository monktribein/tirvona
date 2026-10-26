import { Schema } from "../../../database/orm";
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
    totalRoomsOverride: {
      enabled: { type: Boolean, default: false },
      totalRooms: { type: Number, default: null },
      registeredRooms: { type: Number, default: null },
      onlineRooms: { type: Number, default: null },
      offlineRooms: { type: Number, default: null },
      availableRooms: { type: Number, default: null },
      bookedRooms: { type: Number, default: null },
      occupiedRooms: { type: Number, default: null },
      blockedRooms: { type: Number, default: null },
      heldRooms: { type: Number, default: null },
    },
    // Assistant menu overrides (row key "assistant"). Not in the generated table layout on purpose:
    // the driver keeps it in the overflow column, so no migration is needed. See AssistantConfigService.
    assistantConfig: { type: Schema.Types.Mixed },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  {
    timestamps: true,
    collection: "platform_settings",
    optimisticConcurrency: true,
  },
);
