import { Schema, SchemaTypes } from "mongoose";
import {
  CIRCUIT_DIFFICULTIES,
  CIRCUIT_SEASONS,
  CIRCUIT_STATUSES,
  CIRCUIT_TYPES,
  STOP_TYPES,
} from "../../domain/pilgrimage.constants";

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

export const PilgrimageCircuitSchema = new Schema(
  {
    ashramId: { ...id("Ashram", true), index: true },
    ownerId: { ...id("User", true), index: true },
    name: { type: String, required: true, trim: true },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    circuitType: {
      type: String,
      enum: CIRCUIT_TYPES,
      default: "other",
      index: true,
    },
    summary: { type: String, default: "", trim: true },
    description: { type: String, default: "" },
    highlights: [{ type: String, trim: true }],
    images: [{ type: String, trim: true }],
    coverImage: { type: String, default: "" },
    startCity: { type: String, default: "", index: true },
    endCity: { type: String, default: "" },
    state: { type: String, default: "", index: true },
    region: { type: String, default: "" },
    durationDays: { type: Number, required: true, min: 1, max: 60 },
    totalDistanceKm: { type: Number, default: 0, min: 0 },
    difficulty: {
      type: String,
      enum: CIRCUIT_DIFFICULTIES,
      default: "moderate",
      index: true,
    },
    bestSeasons: [{ type: String, enum: CIRCUIT_SEASONS }],
    idealFor: [{ type: String, trim: true }],
    travelTips: { type: String, default: "" },
    // Approved circuits double as planner templates; this is the ashram's
    // opt-in, so a niche or private route need not feed the public planner.
    usableAsPlannerTemplate: { type: Boolean, default: true, index: true },
    isFeatured: { type: Boolean, default: false, index: true },
    status: {
      type: String,
      enum: CIRCUIT_STATUSES,
      default: "draft",
      index: true,
    },
    submittedAt: Date,
    approvedAt: Date,
    approvedBy: id("User"),
    rejectionReason: { type: String, default: "" },
    stopCount: { type: Number, default: 0, min: 0 },
    viewCount: { type: Number, default: 0 },
  },
  opts("pilgrimage_circuits"),
);
PilgrimageCircuitSchema.index({ status: 1, isFeatured: -1, createdAt: -1 });
PilgrimageCircuitSchema.index({ ashramId: 1, status: 1 });
PilgrimageCircuitSchema.index({ status: 1, durationDays: 1 });
PilgrimageCircuitSchema.index({ ownerId: 1, status: 1, createdAt: -1 });

export const PilgrimageStopSchema = new Schema(
  {
    circuitId: { ...id("PilgrimageCircuitListing", true), index: true },
    ashramId: id("Ashram", true),
    dayNumber: { type: Number, required: true, min: 1, max: 60, index: true },
    order: { type: Number, required: true, min: 0 },
    name: { type: String, required: true, trim: true },
    stopType: { type: String, enum: STOP_TYPES, default: "temple" },
    templeSlug: { type: String, default: "", lowercase: true, trim: true },
    linkedAshramId: id("Ashram"),
    city: { type: String, default: "", trim: true },
    state: { type: String, default: "", trim: true },
    latitude: { type: Number, default: 0 },
    longitude: { type: Number, default: 0 },
    googleMapsUrl: { type: String, default: "" },
    distanceFromPreviousKm: { type: Number, default: 0, min: 0 },
    travelMinutes: { type: Number, default: 0, min: 0 },
    suggestedDurationMinutes: { type: Number, default: 60, min: 0 },
    arrivalTime: { type: String, default: "" },
    notes: { type: String, default: "" },
    images: [{ type: String, trim: true }],
    isOvernightStop: { type: Boolean, default: false },
  },
  opts("pilgrimage_stops"),
);
PilgrimageStopSchema.index({ circuitId: 1, dayNumber: 1, order: 1 });

export const PilgrimageItinerarySchema = new Schema(
  {
    userId: { ...id("User", true), index: true },
    circuitId: id("PilgrimageCircuitListing"),
    title: { type: String, required: true, trim: true },
    startDate: { type: Date, default: null },
    travellers: { type: Number, default: 1, min: 1, max: 50 },
    pace: {
      type: String,
      enum: ["relaxed", "balanced", "packed"],
      default: "balanced",
    },
    days: [
      {
        dayNumber: Number,
        date: Date,
        title: String,
        stops: [
          {
            name: String,
            stopType: String,
            city: String,
            notes: String,
            suggestedDurationMinutes: Number,
          },
        ],
      },
    ],
    notes: { type: String, default: "" },
    status: {
      type: String,
      enum: ["draft", "saved", "archived"],
      default: "saved",
      index: true,
    },
  },
  opts("pilgrimage_itineraries"),
);
PilgrimageItinerarySchema.index({ userId: 1, createdAt: -1 });

export const PilgrimageSettingSchema = new Schema(
  {
    scope: {
      type: String,
      enum: ["platform", "ashram", "circuit"],
      required: true,
      index: true,
    },
    ashramId: id("Ashram"),
    circuitId: id("PilgrimageCircuitListing"),
    maxDurationDays: { type: Number, default: null },
    maxStopsPerCircuit: { type: Number, default: null },
    defaultPaceStopsPerDay: { type: Number, default: null },
    updatedBy: id("User"),
  },
  opts("pilgrimage_settings"),
);
PilgrimageSettingSchema.index({ scope: 1, ashramId: 1, circuitId: 1 });

export const PilgrimageAshramRefSchema = new Schema(
  { ownerId: { type: SchemaTypes.ObjectId, ref: "User", index: true } },
  { strict: false, timestamps: true, collection: "ashrams" },
);
