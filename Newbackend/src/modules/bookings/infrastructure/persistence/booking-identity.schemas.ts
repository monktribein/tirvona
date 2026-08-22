import { Schema, SchemaTypes } from "mongoose";
import {
  MAX_PROPERTY_SEQUENCE,
  MIN_PROPERTY_SEQUENCE,
  PROPERTY_CODE_PATTERN,
  PROPERTY_TYPE_CODE_VALUES,
} from "../../domain/identity-code";

export const BookingIdentityCounterSchema = new Schema(
  {
    _id: { type: String, required: true },
    sequence: { type: Number, required: true, default: 0, min: 0 },
  },
  { collection: "booking_identity_counters", versionKey: false, _id: false },
);

export const BookingIdentityPropertySchema = new Schema(
  {
    ashramId: {
      type: SchemaTypes.ObjectId,
      ref: "Ashram",
      required: true,
      unique: true,
      immutable: true,
    },
    clusterCode: {
      type: String,
      required: true,
      immutable: true,
      uppercase: true,
      match: /^[A-Z]{2}$/,
    },
    propertyTypeCode: {
      type: String,
      required: true,
      immutable: true,
      uppercase: true,
      enum: PROPERTY_TYPE_CODE_VALUES,
    },
    propertySequence: {
      type: Number,
      required: true,
      immutable: true,
      min: MIN_PROPERTY_SEQUENCE,
      max: MAX_PROPERTY_SEQUENCE,
    },
    propertyCode: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      uppercase: true,
      match: PROPERTY_CODE_PATTERN,
    },
    registeredCity: { type: String, immutable: true },
    registeredDistrict: { type: String, immutable: true },
    registeredPropertyType: { type: String, immutable: true },
    issuedAt: { type: Date, default: Date.now, immutable: true },
  },
  { timestamps: true, collection: "booking_identity_properties" },
);

BookingIdentityPropertySchema.index(
  { clusterCode: 1, propertyTypeCode: 1, propertySequence: 1 },
  { unique: true },
);
