/**
 * Shared vocabulary for the Lead Collection subsystem.
 *
 * Lead Collection is a self-contained product: field agents walk into an
 * ashram, capture what they see, and a super admin later converts the record
 * into a real listing. Nothing in this folder reads or writes the platform's
 * own collections, so every name it needs lives here rather than being
 * borrowed from `modules/users` or `modules/ashrams`.
 */

/** Mongoose connection token for the dedicated lead database. */
export const LEAD_CONNECTION = "leadCollection";

/** Model tokens, prefixed so they cannot collide with platform models. */
export const LEAD_USER_MODEL = "LeadCollectionUser";
export const LEAD_MODEL = "LeadCollectionLead";
export const LEAD_REGION_MODEL = "LeadCollectionRegion";

/** Physical collections inside the lead database. */
export const LEAD_USER_COLLECTION = "lead_users";
export const LEAD_COLLECTION_NAME = "leads";
export const LEAD_REGION_COLLECTION = "lead_regions";

/**
 * Roles inside the lead product. Deliberately disjoint from `USER_ROLES` —
 * a lead agent is not a platform user and holds no platform privileges.
 */
export const LEAD_USER_ROLES = [
  "field_agent",
  "field_supervisor",
  "lead_executive",
  "document_verifier",
] as const;
export type LeadUserRole = (typeof LEAD_USER_ROLES)[number];

export const LEAD_USER_STATUSES = ["active", "suspended"] as const;

/** Lifecycle of a captured lead, from field capture to admin decision. */
export const LEAD_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "converted",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

/** Owner sentiment recorded during the visit. */
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
