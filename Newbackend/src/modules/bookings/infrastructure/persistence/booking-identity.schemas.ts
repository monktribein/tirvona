import { Schema, SchemaTypes } from "mongoose";
import {
  MAX_PROPERTY_SEQUENCE,
  MIN_PROPERTY_SEQUENCE,
  PROPERTY_CODE_PATTERN,
  PROPERTY_TYPE_CODE_VALUES,
} from "../../domain/identity-code";

/**
 * Storage for the Ashram Booking Unique Identity Code.
 *
 * Two collections, both new and both inside this module's `booking_*`
 * namespace. Nothing here writes to `ashrams` or to any collection owned by
 * another module: the property register below is what lets a permanent
 * registration number hang off an ashram without that ashram's document — or
 * the module that owns it — being touched at all.
 */

/**
 * A single monotonic counter, one document per allocation scope.
 *
 * `_id` is the scope key built by `propertyCounterKey` / `visitorCounterKey`,
 * which is what makes allocation a one-document `$inc`: MongoDB applies that
 * atomically, so two concurrent callers can never observe the same value, with
 * or without a transaction around them.
 *
 * No `timestamps` and no `optimisticConcurrency` — a version check would turn
 * every concurrent `$inc` into a write conflict, which is precisely the
 * serialisation this document is designed to avoid.
 */
export const BookingIdentityCounterSchema = new Schema(
  {
    _id: { type: String, required: true },
    sequence: { type: Number, required: true, default: 0, min: 0 },
  },
  { collection: "booking_identity_counters", versionKey: false, _id: false },
);

/**
 * The permanent registration of one property within a cluster/type register.
 *
 * Every field is `immutable`, so Mongoose strips any later attempt to rewrite
 * one from the update. That is the guarantee the identity code depends on: a
 * code already printed on a guest's booking keeps resolving to the same
 * property forever, even if the ashram is subsequently renamed, re-typed, or
 * moved to another city.
 *
 * Two unique indexes, because there are two distinct claims to protect:
 * `ashramId` (a property is registered exactly once) and the
 * cluster+type+sequence triple (a registration number is issued exactly once
 * inside its register). Either one alone would leave the other free to
 * duplicate under a race.
 */
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
    // Kept for support and audit: the address and type the code was derived
    // from, as they read at the moment of registration. The ashram record can
    // change afterwards; this cannot, and explains why an old code looks the
    // way it does.
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
