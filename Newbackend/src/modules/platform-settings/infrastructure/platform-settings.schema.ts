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
      /**
       * Booking systems this fee is levied on.
       *
       * A row saved before this field existed has no value here at all, which
       * `platformFeeScopesOf` reads as the historic behaviour (ashram bookings
       * only). An explicitly empty array means the Super Admin turned every
       * system off and is honoured as such — the two cases are not the same.
       */
      appliesTo: {
        type: [String],
        enum: PLATFORM_FEE_SCOPE_VALUES,
        default: () => [...DEFAULT_PLATFORM_FEE_SCOPES],
      },
    },
    gstRate: { type: Number, default: 5, min: 0 },
    // GST charged on the platform fee. The stay itself is untaxed, so this is
    // the only rate that reaches a booking total; `gstRate` above is legacy.
    platformFeeGstRate: { type: Number, default: 18, min: 0, max: 100 },
    bookingCommissionPercent: { type: Number, default: 10, min: 0, max: 100 },
    // The alert tone every dashboard plays when a notification arrives. It is
    // one platform-wide setting rather than a per-user preference because the
    // Super Admin sets the house sound for every role at once; the GET is
    // public so an unauthenticated shell can preload it before login.
    notificationSound: {
      enabled: { type: Boolean, default: false },
      url: { type: String, default: "" },
      fileName: { type: String, default: "" },
      // Clamped to 0–1 to match the HTMLAudioElement volume range.
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
