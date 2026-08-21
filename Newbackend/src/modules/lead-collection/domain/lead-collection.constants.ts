
export const LEAD_CONNECTION = "leadCollection";

export const LEAD_USER_MODEL = "LeadCollectionUser";
export const LEAD_MODEL = "LeadCollectionLead";
export const LEAD_REGION_MODEL = "LeadCollectionRegion";

export const LEAD_USER_COLLECTION = "lead_users";
export const LEAD_COLLECTION_NAME = "leads";
export const LEAD_REGION_COLLECTION = "lead_regions";

export const LEAD_USER_ROLES = [
  "field_agent",
  "field_supervisor",
  "lead_executive",
] as const;
export type LeadUserRole = (typeof LEAD_USER_ROLES)[number];

export const LEAD_USER_STATUSES = ["active", "suspended"] as const;

export const LEAD_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "converted",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_INTERESTS = [
  "Interested",
  "Not Interested",
  "Follow-up Required",
] as const;

export const LEAD_MEETING_MODES = ["Call", "In-person"] as const;

export const DEFAULT_LEAD_REGIONS = [
  { state: "Uttar Pradesh", district: "Mathura" },
  { state: "Uttar Pradesh", district: "Vrindavan" },
  { state: "Uttarakhand", district: "Dehradun" },
  { state: "Uttarakhand", district: "Haridwar" },
] as const;
