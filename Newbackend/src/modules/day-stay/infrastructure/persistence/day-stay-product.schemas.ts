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

export const DAY_STAY_PRODUCT_TYPES = [
  "freshen_up",
  "day_rest",
] as const;

export type DayStayProductType = (typeof DAY_STAY_PRODUCT_TYPES)[number];

export const DayStayProductSchema = new Schema(
  {
    productCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    productType: {
      type: String,
      enum: DAY_STAY_PRODUCT_TYPES,
      required: true,
      index: true,
    },
    displayName: { type: String, required: true, trim: true },
    durationMinutes: {
      type: Number,
      required: true,
      min: [1, "Duration must be greater than 0 minutes"],
    },
    active: { type: Boolean, default: true, index: true },
    sortOrder: { type: Number, default: 0 },
    description: { type: String, trim: true },
    applicablePropertyIds: [{ type: SchemaTypes.ObjectId, ref: "Ashram" }],
    metadata: { type: SchemaTypes.Mixed, default: {} },
    createdBy: id("User"),
    updatedBy: id("User"),
  },
  opts("day_stay_products"),
);

DayStayProductSchema.index({ active: 1, sortOrder: 1 });
DayStayProductSchema.index({ productType: 1, active: 1 });
