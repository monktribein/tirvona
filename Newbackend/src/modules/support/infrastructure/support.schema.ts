import { Schema, SchemaTypes } from "mongoose";
export const SupportTicketSchema = new Schema(
  {
    userId: { type: SchemaTypes.ObjectId, ref: "User", required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    category: {
      type: String,
      enum: [
        "booking_issue",
        "payment_failed",
        "refund_request",
        "ashram_complaint",
        "other",
      ],
      required: true,
    },
    status: {
      type: String,
      enum: ["open", "in_progress", "resolved"],
      default: "open",
      index: true,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },
    assignedTo: { type: SchemaTypes.ObjectId, ref: "User" },
    messages: [
      {
        senderId: { type: SchemaTypes.ObjectId, ref: "User", required: true },
        text: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: true,
    collection: "booking_support_tickets",
    optimisticConcurrency: true,
  },
);
SupportTicketSchema.index({ userId: 1, createdAt: -1 });
SupportTicketSchema.index({ status: 1, createdAt: -1 });
