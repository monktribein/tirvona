import { Schema, SchemaTypes } from "mongoose";
import {
  LEAD_COLLECTION_NAME,
  LEAD_INTERESTS,
  LEAD_MEETING_MODES,
  LEAD_STATUSES,
} from "../../domain/lead-collection.constants";

export const LeadSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, index: true },

    location: {
      address: { type: String, trim: true, default: "" },
      city: { type: String, trim: true, default: "", index: true },
      district: { type: String, trim: true, default: "", index: true },
      state: { type: String, trim: true, default: "" },
      coordinates: {
        lat: { type: Number, default: null },
        lng: { type: Number, default: null },
      },
    },

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

    images: { type: [String], default: [] },

    status: {
      type: String,
      enum: LEAD_STATUSES,
      default: "pending",
      index: true,
    },

    capturedBy: {
      type: SchemaTypes.ObjectId,
      ref: "LeadCollectionUser",
      default: null,
      index: true,
    },
    capturedByName: { type: String, default: "" },
    capturedAt: { type: Date, default: Date.now },

    assignedAgentId: {
      type: SchemaTypes.ObjectId,
      ref: "LeadCollectionUser",
      default: null,
      index: true,
    },
    assignedAgentName: { type: String, default: "" },
    assignedAgentCode: { type: String, default: "" },

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
LeadSchema.index({ geo: "2dsphere" }, { sparse: true });
