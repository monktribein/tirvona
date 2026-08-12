/**
 * Shared vocabulary for Smart Contact QR.
 *
 * The module is the Tirvona-branded implementation of what the specification
 * calls the NEP Smart Identity & Contact Engine, so nothing here names a
 * platform concept: no ashram, no booking, no platform user. Everything the
 * module needs is declared in this folder, which is what makes lifting it into
 * its own service later a move rather than a rewrite.
 */

/** Mongoose connection token for the dedicated Smart Contact database. */
export const SMART_CONTACT_CONNECTION = "smartContact";

/** Model tokens, prefixed so they cannot collide with platform models. */
export const SMART_CONTACT_PROFILE_MODEL = "SmartContactProfile";
export const SMART_CONTACT_QR_MODEL = "SmartContactQrCode";
export const SMART_CONTACT_EVENT_MODEL = "SmartContactEvent";
export const SMART_CONTACT_AUDIT_MODEL = "SmartContactAudit";

/** Physical collections inside the Smart Contact database (spec §29–§31). */
export const SMART_CONTACT_PROFILE_COLLECTION = "smart_contact_profiles";
export const SMART_CONTACT_QR_COLLECTION = "smart_contact_qr_codes";
export const SMART_CONTACT_EVENT_COLLECTION = "smart_contact_events";
export const SMART_CONTACT_AUDIT_COLLECTION = "smart_contact_audit_logs";

/**
 * Profile lifecycle (spec §19).
 *
 * `ARCHIVED` exists so a profile can leave the console without its URL ever
 * 404-ing — spec §22 is explicit that a circulating visiting card must never
 * become a dead link. Only `ACTIVE` renders a contact page; every other state
 * renders the "no longer active" notice, and only `DRAFT` is invisible.
 */
export const SMART_CONTACT_STATUSES = [
  "DRAFT",
  "ACTIVE",
  "SUSPENDED",
  "ARCHIVED",
] as const;
export type SmartContactStatus = (typeof SMART_CONTACT_STATUSES)[number];

/** Statuses whose public page still resolves, in one form or another. */
export const PUBLICLY_RESOLVABLE_STATUSES: readonly SmartContactStatus[] = [
  "ACTIVE",
  "SUSPENDED",
  "ARCHIVED",
];

/** Analytics event types (spec §32). */
export const SMART_CONTACT_EVENT_TYPES = [
  "PROFILE_VIEW",
  "QR_SCAN",
  "SAVE_CONTACT",
  "VCARD_DOWNLOAD",
  "CALL_CLICK",
  "WHATSAPP_CLICK",
  "EMAIL_CLICK",
  "WEBSITE_CLICK",
  "DIRECTIONS_CLICK",
] as const;
export type SmartContactEventType =
  (typeof SMART_CONTACT_EVENT_TYPES)[number];

/**
 * Event types a public, unauthenticated caller may report.
 *
 * `PROFILE_VIEW`, `QR_SCAN` and `VCARD_DOWNLOAD` are omitted deliberately: the
 * server records those itself when it serves the page and the .vcf, so
 * accepting them from the browser would let anyone inflate the two numbers the
 * conversion rate is computed from.
 */
export const CLIENT_REPORTABLE_EVENT_TYPES: readonly SmartContactEventType[] = [
  "SAVE_CONTACT",
  "CALL_CLICK",
  "WHATSAPP_CLICK",
  "EMAIL_CLICK",
  "WEBSITE_CLICK",
  "DIRECTIONS_CLICK",
];

/** QR asset placements (spec §17, §28). */
export const SMART_CONTACT_QR_SOURCES = [
  "business-card",
  "id-card",
  "brochure",
  "exhibition",
  "event",
  "poster",
  "digital",
  "other",
] as const;
export type SmartContactQrSource =
  (typeof SMART_CONTACT_QR_SOURCES)[number];

export const SMART_CONTACT_QR_FORMATS = ["svg", "png", "pdf"] as const;
export type SmartContactQrFormat =
  (typeof SMART_CONTACT_QR_FORMATS)[number];

export const SMART_CONTACT_QR_STATUSES = ["ACTIVE", "RETIRED"] as const;

/** Brand namespaces (spec §19 "Branding", §43). */
export const SMART_CONTACT_BRANDS = ["tirvona", "mission-ftc", "nep"] as const;
export type SmartContactBrand = (typeof SMART_CONTACT_BRANDS)[number];

/** Audience buckets the console filters on (spec §18). */
export const SMART_CONTACT_CATEGORIES = [
  "employee",
  "partner",
  "district-partner",
  "other",
] as const;
export type SmartContactCategory =
  (typeof SMART_CONTACT_CATEGORIES)[number];

/** Device buckets for analytics (spec §27). */
export const SMART_CONTACT_DEVICE_TYPES = [
  "android",
  "ios",
  "desktop",
  "other",
] as const;
export type SmartContactDeviceType =
  (typeof SMART_CONTACT_DEVICE_TYPES)[number];

/**
 * Roles allowed to administer Smart Contact profiles (spec §36).
 *
 * `super_admin` is not listed because `RolesGuard` already lets it through
 * every gate. The remaining three are Smart Contact's own vocabulary: naming
 * them here costs nothing today and means granting one later is a change to
 * the platform's role catalogue alone, never to this module.
 */
export const SMART_CONTACT_ADMIN_ROLES = [
  "tirvona_admin",
  "hr_admin",
  "partner_manager",
] as const;

/** Audit actions recorded against a profile (spec §37). */
export const SMART_CONTACT_AUDIT_ACTIONS = [
  "PROFILE_CREATED",
  "PROFILE_UPDATED",
  "PHONE_CHANGED",
  "EMAIL_CHANGED",
  "PHOTO_CHANGED",
  "DESIGNATION_CHANGED",
  "SLUG_CHANGED",
  "QR_GENERATED",
  "QR_RETIRED",
  "PROFILE_ACTIVATED",
  "PROFILE_DISABLED",
  "PROFILE_ARCHIVED",
  "PROFILE_RESTORED",
] as const;
export type SmartContactAuditAction =
  (typeof SMART_CONTACT_AUDIT_ACTIONS)[number];

/**
 * Fields whose change is worth its own audit line rather than being folded
 * into a generic `PROFILE_UPDATED` (spec §37).
 */
export const AUDITED_FIELD_ACTIONS: Readonly<
  Record<string, SmartContactAuditAction>
> = {
  primaryPhone: "PHONE_CHANGED",
  secondaryPhone: "PHONE_CHANGED",
  whatsappPhone: "PHONE_CHANGED",
  email: "EMAIL_CHANGED",
  photoUrl: "PHOTO_CHANGED",
  designation: "DESIGNATION_CHANGED",
  slug: "SLUG_CHANGED",
};

/**
 * Slugs that must never be handed to a profile.
 *
 * This list carries real weight now that profiles are served from the site
 * root: `https://www.tirvona.com/{slug}` shares a namespace with every page of
 * the website. A profile given the slug `parking` would have its URL routed to
 * the parking page instead — and since the slug is printed on cards, that
 * profile would be permanently unreachable with no way to fix it.
 *
 * Two groups below. The platform routes must stay in step with the top-level
 * paths in `frontend/src/App.tsx`; `frontend/scripts/check-spa-routes.mjs`
 * guards the host's side of the same list at build time.
 */
export const RESERVED_SLUGS: readonly string[] = [
  // Infrastructure and anything that could impersonate a Tirvona-operated page
  "api",
  "app",
  "assets",
  "sc-assets",
  "c",
  "health",
  "index",
  "logout",
  "new",
  "null",
  "public",
  "robots",
  "settings",
  "sitemap",
  "smart-contact",
  "static",
  "tirvona",
  "undefined",
  "www",
  // Top-level routes of the public SPA
  "about",
  "admin",
  "ashram",
  "blog",
  "booking",
  "books",
  "cancellation-policy",
  "careers",
  "circuits",
  "contact",
  "cookie-policy",
  "dashboard",
  "destinations",
  "events",
  "faq",
  "govt-guidelines",
  "handicrafts",
  "help",
  "local",
  "local-guides",
  "login",
  "marketplace",
  "offers",
  "owner",
  "owner-guide",
  "parking",
  "partner",
  "pilgrimage-circuits",
  "press",
  "privacy",
  "profile",
  "puja-items",
  "refund-policy",
  "register",
  "religious-products",
  "reset-password",
  "restaurants",
  "search",
  "services",
  "shops",
  "staff",
  "stay-policies",
  "support",
  "temples",
  "terms",
  "transport",
  "travel-guides",
  "video",
  "volunteer",
];

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SLUG_MIN_LENGTH = 3;
export const SLUG_MAX_LENGTH = 60;
