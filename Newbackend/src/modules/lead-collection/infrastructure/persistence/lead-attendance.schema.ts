import { Schema } from "mongoose";
import {
  LEAD_ATTENDANCE_COLLECTION,
  LEAD_USER_MODEL,
} from "../../domain/lead-collection.constants";

export const LeadAttendanceSchema = new Schema(
  {
    agentId: {
      type: Schema.Types.ObjectId,
      ref: LEAD_USER_MODEL,
      required: true,
      index: true,
    },
    agentName: { type: String, required: true, trim: true },
    agentPhone: { type: String, trim: true, default: "" },
    role: { type: String, trim: true, default: "field_agent" },
    state: { type: String, trim: true, default: "", index: true },
    district: { type: String, trim: true, default: "", index: true },
    date: { type: String, required: true, index: true }, // Format: YYYY-MM-DD
    
    // Check-In
    checkedIn: { type: Boolean, default: false },
    checkInTime: { type: Date, default: null },
    checkInFormattedTime: { type: String, default: "" },
    checkInCoords: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
      accuracy: { type: Number, default: null },
    },
    checkInAddress: { type: String, default: "" },
    checkInMapsUrl: { type: String, default: "" },

    // Check-Out
    checkedOut: { type: Boolean, default: false },
    checkOutTime: { type: Date, default: null },
    checkOutFormattedTime: { type: String, default: "" },
    checkOutCoords: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
      accuracy: { type: Number, default: null },
    },
    checkOutAddress: { type: String, default: "" },
    checkOutMapsUrl: { type: String, default: "" },

    // Metrics
    totalWorkingMinutes: { type: Number, default: 0 },
    formattedWorkingHours: { type: String, default: "" },
    status: {
      type: String,
      enum: ["checked_in", "checked_out", "present", "half_day", "absent"],
      default: "checked_in",
      index: true,
    },
    notes: { type: String, default: "" },
  },
  {
    timestamps: true,
    collection: LEAD_ATTENDANCE_COLLECTION,
    optimisticConcurrency: true,
  },
);

LeadAttendanceSchema.index({ agentId: 1, date: 1 }, { unique: true });
LeadAttendanceSchema.index({ date: 1, district: 1 });
LeadAttendanceSchema.index({ createdAt: -1 });
