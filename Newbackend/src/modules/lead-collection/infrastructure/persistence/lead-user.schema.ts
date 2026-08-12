import { Schema } from "mongoose";
import {
  LEAD_USER_COLLECTION,
  LEAD_USER_ROLES,
  LEAD_USER_STATUSES,
} from "../../domain/lead-collection.constants";

/**
 * `lead_users` — the only account table in the lead database.
 *
 * These are field agents, created by a super admin from the console; there is
 * no self-registration, no OTP, and no Google path. The record carries just
 * enough to sign in and to attribute a captured lead to whoever walked in.
 */
export const LeadUserSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    // Phone is the login handle — an agent in the field has one reliably, an
    // email address they often do not.
    phone: { type: String, required: true, unique: true, trim: true },
    email: { type: String, trim: true, lowercase: true, default: "" },
    // `select: false` so a stray `.find()` in a listing endpoint can never
    // serialise the hash out to the console.
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
    // Bumped on suspension and on every password reset, so tokens already in
    // an agent's pocket stop working the moment access is revoked.
    tokenVersion: { type: Number, default: 0 },
    // A platform user id. Stored as a plain string, not a ref: the platform
    // `users` collection lives in another database and must not be populated
    // from here.
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
