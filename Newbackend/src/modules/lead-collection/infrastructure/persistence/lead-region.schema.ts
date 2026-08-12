import { Schema } from "mongoose";
import { LEAD_REGION_COLLECTION } from "../../domain/lead-collection.constants";

/** District jurisdictions assignable to lead field agents. */
export const LeadRegionSchema = new Schema(
  {
    state: { type: String, required: true, trim: true },
    district: { type: String, required: true, trim: true },
    createdByAdminId: { type: String, required: true, immutable: true },
    createdByAdminName: { type: String, immutable: true, default: "" },
  },
  { timestamps: true, collection: LEAD_REGION_COLLECTION },
);

LeadRegionSchema.index({ state: 1, district: 1 }, { unique: true });
