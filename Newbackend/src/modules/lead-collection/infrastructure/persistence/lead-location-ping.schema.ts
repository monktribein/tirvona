import { Schema } from "mongoose";
import {
  LEAD_LOCATION_PING_COLLECTION,
  LEAD_TRACKING,
  LEAD_USER_MODEL,
} from "../../domain/lead-collection.constants";

/**
 * One accepted GPS fix. Points are kept raw and the day's route, distance and
 * stops are derived on read, so there is no rollup document to drift out of
 * step with the points it summarises.
 *
 * `date` repeats the day in the same YYYY-MM-DD string form the attendance
 * collection uses, so a day can be fetched by equality rather than by a range
 * scan over `recordedAt`.
 */
export const LeadLocationPingSchema = new Schema(
  {
    agentId: {
      type: Schema.Types.ObjectId,
      ref: LEAD_USER_MODEL,
      required: true,
      index: true,
    },
    agentName: { type: String, trim: true, default: "" },
    state: { type: String, trim: true, default: "", index: true },
    district: { type: String, trim: true, default: "", index: true },

    date: { type: String, required: true, index: true },

    lat: { type: Number, required: true, min: -90, max: 90 },
    lng: { type: Number, required: true, min: -180, max: 180 },
    /** Reported radius of uncertainty, in metres. */
    accuracy: { type: Number, default: null },
    /** Device-reported speed in m/s, when the platform supplies one. */
    speed: { type: Number, default: null },
    heading: { type: Number, default: null },
    altitude: { type: Number, default: null },

    /** When the fix was taken on the device, not when the server received it. */
    recordedAt: { type: Date, required: true },
    /** Metres from the previous accepted fix, so distance never re-derives. */
    metresFromPrevious: { type: Number, default: 0, min: 0 },

    source: {
      type: String,
      enum: ["foreground", "background", "manual"],
      default: "foreground",
    },
  },
  {
    timestamps: true,
    collection: LEAD_LOCATION_PING_COLLECTION,
  },
);

// The only read pattern: one agent's points for one day, in order.
LeadLocationPingSchema.index({ agentId: 1, date: 1, recordedAt: 1 });
// The live map reads the newest point per agent across a district.
LeadLocationPingSchema.index({ district: 1, recordedAt: -1 });
// A device that retries an upload must not double-count its distance.
LeadLocationPingSchema.index(
  { agentId: 1, recordedAt: 1 },
  { unique: true, name: "agent_fix_unique" },
);
// Raw location is personal data; it expires rather than accumulating forever.
LeadLocationPingSchema.index(
  { recordedAt: 1 },
  { expireAfterSeconds: LEAD_TRACKING.retentionDays * 24 * 60 * 60 },
);
