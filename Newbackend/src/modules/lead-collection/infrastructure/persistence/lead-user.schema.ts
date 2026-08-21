import { Schema } from "mongoose";
import {
  LEAD_USER_COLLECTION,
  LEAD_USER_ROLES,
  LEAD_USER_STATUSES,
} from "../../domain/lead-collection.constants";

export const LeadUserSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, unique: true, trim: true },
    email: { type: String, trim: true, lowercase: true, default: "" },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: LEAD_USER_ROLES, default: "field_agent" },
    status: {
      type: String,
      enum: LEAD_USER_STATUSES,
      default: "active",
      index: true,
    },
    region: { type: String, trim: true, default: "" },
    state: { type: String, trim: true, default: "", index: true },
    district: { type: String, trim: true, default: "", index: true },
    employeeCode: { type: String, trim: true, default: "" },
    notes: { type: String, trim: true, default: "" },
    lastLoginAt: { type: Date, default: null },
    tokenVersion: { type: Number, default: 0 },
    createdByAdminId: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
    },
    createdByAdminName: { type: String, immutable: true, default: "" },
  },
  {
    timestamps: true,
    collection: LEAD_USER_COLLECTION,
    optimisticConcurrency: true,
  },
);

LeadUserSchema.index({ status: 1, createdAt: -1 });
LeadUserSchema.index({ name: 1 });
