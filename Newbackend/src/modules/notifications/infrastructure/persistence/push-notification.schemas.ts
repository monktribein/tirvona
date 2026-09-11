import { Schema, SchemaTypes } from "mongoose";

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

/** One admin/ashram-owner broadcast — the audience is resolved and fanned
 * out into UserNotification rows (and FCM pushes) at send time. */
export const PushCampaignSchema = new Schema(
  {
    senderId: id("User", true),
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true, trim: true },
    imageUrl: String,
    deepLink: String,
    audienceType: {
      type: String,
      enum: ["users", "role", "ashram"],
      required: true,
    },
    targetRoles: { type: [String], default: [] },
    targetUserIds: { type: [SchemaTypes.ObjectId], ref: "User", default: [] },
    targetAshramIds: { type: [SchemaTypes.ObjectId], ref: "Ashram", default: [] },
    recipientCount: { type: Number, default: 0 },
    sentCount: { type: Number, default: 0 },
    failedCount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["sent", "partial", "failed"],
      default: "sent",
    },
  },
  opts("push_campaigns"),
);
PushCampaignSchema.index({ senderId: 1, createdAt: -1 });

/** A recipient's own inbox row — what `GET /notifications` reads. Written
 * once per recipient when a campaign is sent, independent of whether the
 * device push itself succeeds. */
export const UserNotificationSchema = new Schema(
  {
    userId: id("User", true),
    campaignId: id("PushCampaign"),
    title: { type: String, required: true },
    body: { type: String, required: true },
    imageUrl: String,
    deepLink: String,
    read: { type: Boolean, default: false, index: true },
    readAt: Date,
  },
  opts("user_notifications"),
);
UserNotificationSchema.index({ userId: 1, createdAt: -1 });
UserNotificationSchema.index({ userId: 1, read: 1 });
