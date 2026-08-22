
export const SMART_CONTACT_CONNECTION = "smartContact";

export const SMART_CONTACT_PROFILE_MODEL = "SmartContactProfile";
export const SMART_CONTACT_QR_MODEL = "SmartContactQrCode";
export const SMART_CONTACT_EVENT_MODEL = "SmartContactEvent";
export const SMART_CONTACT_AUDIT_MODEL = "SmartContactAudit";

export const SMART_CONTACT_PROFILE_COLLECTION = "smart_contact_profiles";
export const SMART_CONTACT_QR_COLLECTION = "smart_contact_qr_codes";
export const SMART_CONTACT_EVENT_COLLECTION = "smart_contact_events";
export const SMART_CONTACT_AUDIT_COLLECTION = "smart_contact_audit_logs";

export const SMART_CONTACT_STATUSES = [
  "DRAFT",
  "ACTIVE",
  "SUSPENDED",
  "ARCHIVED",
] as const;
export type SmartContactStatus = (typeof SMART_CONTACT_STATUSES)[number];

export const PUBLICLY_RESOLVABLE_STATUSES: readonly SmartContactStatus[] = [
  "ACTIVE",
  "SUSPENDED",
  "ARCHIVED",
];

export const SMART_CONTACT_EVENT_TYPES = [
  "PROFILE_VIEW",
  "QR_SCAN",
  "SAVE_CONTACT",
  "VCARD_DOWNLOAD",
  "ID_CARD_DOWNLOAD",
  "CALL_CLICK",
  "WHATSAPP_CLICK",
  "EMAIL_CLICK",
  "WEBSITE_CLICK",
  "DIRECTIONS_CLICK",
] as const;
export type SmartContactEventType =
  (typeof SMART_CONTACT_EVENT_TYPES)[number];

export const CLIENT_REPORTABLE_EVENT_TYPES: readonly SmartContactEventType[] = [
  "SAVE_CONTACT",
  "CALL_CLICK",
  "WHATSAPP_CLICK",
  "EMAIL_CLICK",
  "WEBSITE_CLICK",
  "DIRECTIONS_CLICK",
];

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

export const SMART_CONTACT_BRANDS = ["tirvona", "mission-ftc", "nep"] as const;
export type SmartContactBrand = (typeof SMART_CONTACT_BRANDS)[number];

export const SMART_CONTACT_CATEGORIES = [
  "employee",
  "partner",
  "district-partner",
  "other",
] as const;
export type SmartContactCategory =
  (typeof SMART_CONTACT_CATEGORIES)[number];

export const SMART_CONTACT_DEVICE_TYPES = [
  "android",
  "ios",
  "desktop",
  "other",
] as const;
export type SmartContactDeviceType =
  (typeof SMART_CONTACT_DEVICE_TYPES)[number];

export const SMART_CONTACT_ADMIN_ROLES = [
  "tirvona_admin",
  "hr_admin",
  "partner_manager",
] as const;

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
  "PROFILE_DELETED",
] as const;
export type SmartContactAuditAction =
  (typeof SMART_CONTACT_AUDIT_ACTIONS)[number];

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

export const RESERVED_SLUGS: readonly string[] = [
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
