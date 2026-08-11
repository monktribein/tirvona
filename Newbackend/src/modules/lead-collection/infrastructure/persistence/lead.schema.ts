import { Schema, SchemaTypes } from "mongoose";
import {
  LEAD_COLLECTION_NAME,
  LEAD_INTERESTS,
  LEAD_MEETING_MODES,
  LEAD_STATUSES,
} from "../../domain/lead-collection.constants";

/**
 * `leads` — one field visit to one prospective ashram.
 *
 * The shape mirrors what the leadTirvona capture form already submits, so the
 * field app can post its payload unchanged. Coordinates are kept as the
 * form's `{ lat, lng }` pair *and* mirrored into a GeoJSON `Point`: the pair
 * is what a human reads back in the console, the Point is what a `2dsphere`
 * index can answer "leads near here" against.
 */
export const LeadSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, index: true },

    location: {
      address: { type: String, trim: true, default: "" },
      city: { type: String, trim: true, default: "", index: true },
      state: { type: String, trim: true, default: "" },
      coordinates: {
        lat: { type: Number, default: null },
        lng: { type: Number, default: null },
      },
    },

    // GeoJSON mirror of `location.coordinates`, maintained by the service on
    // every write. Absent (rather than null) when the agent captured no fix —
    // a `2dsphere` index rejects a Point with null coordinates.
    geo: {
      type: {
        type: String,
        enum: ["Point"],
      },
      coordinates: { type: [Number] },
    },

    roomInventory: {
      totalRooms: { type: Number, default: null },
      roomPrice: { type: Number, default: null },
      onlineRooms: { type: Number, default: null },
      offlineRooms: { type: Number, default: null },
    },

    contact: {
      ownerName: { type: String, trim: true, default: "" },
      phone: { type: String, trim: true, default: "" },
    },

    notes: { type: String, trim: true, default: "" },
    interest: {
      type: String,
      enum: LEAD_INTERESTS,
      default: "Interested",
      index: true,
    },

    meeting: {
      requested: { type: Boolean, default: false },
      time: { type: String, trim: true, default: "" },
      mode: { type: String, enum: [...LEAD_MEETING_MODES, ""], default: "" },
    },

    // Cloudinary URLs, or base64 data URLs when the agent captured offline.
    images: { type: [String], default: [] },

    status: {
      type: String,
      enum: LEAD_STATUSES,
      default: "pending",
      index: true,
    },

    // Attribution. `capturedBy` is a lead_users id inside this same database,
    // so it is a real ref and can be populated.
    capturedBy: {
      type: SchemaTypes.ObjectId,
      ref: "LeadCollectionUser",
      default: null,
      index: true,
    },
    // Denormalised so the console can show who captured a lead even after the
    // agent account is deleted.
    capturedByName: { type: String, default: "" },
    capturedAt: { type: Date, default: Date.now },

    // Review trail. Platform-user ids as plain strings — see lead-user.schema.
    reviewedByAdminId: { type: String, default: "" },
    reviewedByAdminName: { type: String, default: "" },
    reviewedAt: { type: Date, default: null },
    reviewNote: { type: String, trim: true, default: "" },
  },
  {
    timestamps: true,
    collection: LEAD_COLLECTION_NAME,
    optimisticConcurrency: true,
  },
);

LeadSchema.index({ status: 1, createdAt: -1 });
LeadSchema.index({ capturedBy: 1, createdAt: -1 });
LeadSchema.index({ "location.city": 1, status: 1 });
// Sparse: leads captured without a GPS fix carry no `geo` at all.
LeadSchema.index({ geo: "2dsphere" }, { sparse: true });
