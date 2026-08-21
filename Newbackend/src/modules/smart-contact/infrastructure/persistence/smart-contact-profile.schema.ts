import { Schema } from "mongoose";
import { randomUUID } from "node:crypto";
import {
  SMART_CONTACT_BRANDS,
  SMART_CONTACT_CATEGORIES,
  SMART_CONTACT_PROFILE_COLLECTION,
  SMART_CONTACT_STATUSES,
  SLUG_MAX_LENGTH,
  SLUG_MIN_LENGTH,
  SLUG_PATTERN,
} from "../../domain/smart-contact.constants";

export const SmartContactProfileSchema = new Schema(
  {
    uuid: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      default: () => randomUUID(),
    },
    employeeId: { type: String, trim: true, default: "", index: true },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      minlength: SLUG_MIN_LENGTH,
      maxlength: SLUG_MAX_LENGTH,
      match: SLUG_PATTERN,
    },

    firstName: { type: String, required: true, trim: true, maxlength: 80 },
    lastName: { type: String, trim: true, default: "", maxlength: 80 },
    displayName: { type: String, required: true, trim: true, maxlength: 160 },

    organization: { type: String, trim: true, default: "Tirvona" },
    designation: { type: String, trim: true, default: "", maxlength: 120 },
    department: { type: String, trim: true, default: "", maxlength: 120 },
    roleLine: { type: String, trim: true, default: "", maxlength: 160 },

    primaryPhone: { type: String, trim: true, default: "" },
    secondaryPhone: { type: String, trim: true, default: "" },
    whatsappPhone: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, lowercase: true, default: "" },
    website: { type: String, trim: true, default: "" },

    addressLine1: { type: String, trim: true, default: "", maxlength: 200 },
    addressLine2: { type: String, trim: true, default: "", maxlength: 200 },
    city: { type: String, trim: true, default: "" },
    district: { type: String, trim: true, default: "" },
    state: { type: String, trim: true, default: "" },
    postalCode: { type: String, trim: true, default: "" },
    country: { type: String, trim: true, default: "India" },

    photoUrl: { type: String, trim: true, default: "" },
    photoAssetId: { type: String, trim: true, default: "" },

    brandId: {
      type: String,
      enum: SMART_CONTACT_BRANDS,
      default: "tirvona",
      index: true,
    },
    category: {
      type: String,
      enum: SMART_CONTACT_CATEGORIES,
      default: "employee",
      index: true,
    },
    status: {
      type: String,
      enum: SMART_CONTACT_STATUSES,
      default: "DRAFT",
      index: true,
    },

    createdById: { type: String, trim: true, default: "", immutable: true },
    createdByName: { type: String, trim: true, default: "", immutable: true },
    updatedById: { type: String, trim: true, default: "" },
    updatedByName: { type: String, trim: true, default: "" },
  },
  {
    timestamps: true,
    collection: SMART_CONTACT_PROFILE_COLLECTION,
    optimisticConcurrency: true,
  },
);

SmartContactProfileSchema.index({ slug: 1, status: 1 });
SmartContactProfileSchema.index({ status: 1, createdAt: -1 });
SmartContactProfileSchema.index({ category: 1, status: 1 });
SmartContactProfileSchema.index({
  displayName: 1,
  email: 1,
  employeeId: 1,
});
