
export const LEAD_CONNECTION = "leadCollection";

export const LEAD_USER_MODEL = "LeadCollectionUser";
export const LEAD_MODEL = "LeadCollectionLead";
export const LEAD_REGION_MODEL = "LeadCollectionRegion";
export const LEAD_ATTENDANCE_MODEL = "LeadCollectionAttendance";
export const LEAD_LOCATION_PING_MODEL = "LeadCollectionLocationPing";

export const LEAD_USER_COLLECTION = "lead_users";
export const LEAD_COLLECTION_NAME = "leads";
export const LEAD_REGION_COLLECTION = "lead_regions";
export const LEAD_ATTENDANCE_COLLECTION = "lead_attendances";
export const LEAD_LOCATION_PING_COLLECTION = "lead_location_pings";

export const LEAD_USER_ROLES = [
  "field_agent",
  "field_supervisor",
  "lead_executive",
  "document_verifier",
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

/**
 * GPS quality gates. A phone reports its own accuracy radius in metres, and a
 * fix worse than this is a cell-tower or wifi estimate rather than a satellite
 * one - plotting it would draw a route through streets the agent never walked.
 */
export const LEAD_TRACKING = {
  /** Fixes less certain than this are discarded outright. */
  maxAccuracyMetres: 100,
  /** Below this, two fixes are the same place: GPS jitter, not movement. */
  minMovementMetres: 10,
  /** Faster than this between two fixes is a bad fix, not a journey. */
  maxSpeedKmph: 150,
  /** Staying inside this radius for the dwell minutes below is a stop. */
  stopRadiusMetres: 120,
  /** How long an agent must linger before it counts as a visited location. */
  stopMinutes: 5,
  /** A gap longer than this breaks the timeline rather than drawing a line. */
  maxGapMinutes: 45,
  /** Points accepted in one batch upload. */
  maxBatchSize: 100,
  /** How long raw points are retained before Mongo expires them. */
  retentionDays: 180,
} as const;
