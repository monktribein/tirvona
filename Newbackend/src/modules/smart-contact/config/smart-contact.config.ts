/**
 * Configuration for the Smart Contact QR subsystem.
 *
 * Read straight from `process.env` rather than the platform's `environment()`
 * factory, for the same reason Lead Collection does it: every value is
 * namespaced `SMART_CONTACT_*`, so the module can be lifted into the NEP Smart
 * Identity & Contact Engine (spec §43) without dragging the platform config
 * surface along. Nothing here is validated by `validateEnvironment`, and
 * nothing here belongs in it.
 *
 * Fallbacks keep a fresh checkout working with no extra .env entries — the
 * data still lands in its own database, just on the same cluster.
 */

export interface SmartContactConfig {
  mongoUri: string;
  mongoDbName: string;
  /**
   * Origin the QR codes encode. This is the single most consequential value in
   * the module: it is baked into printed artwork and, per spec §2, can never
   * change afterwards. Kept separate from `CLIENT_URL` precisely so that
   * moving the marketing site cannot silently invalidate printed cards.
   */
  publicBaseUrl: string;
  /** Path segment before the slug — `/c` per the spec §5 recommendation. */
  publicPathPrefix: string;
  /** Origin the admin console calls for QR/vCard downloads. */
  apiBaseUrl: string;
  qrDarkColor: string;
  qrLightColor: string;
  qrAccentColor: string;
  qrLogoUrl: string;
  qrDefaultPngSize: number;
  qrPrintPngSize: number;
  /** Where a visitor is sent when a profile is no longer active (spec §22). */
  inactiveContactEmail: string;
  /** Retention window for raw analytics events, in days. 0 disables expiry. */
  eventRetentionDays: number;
  /** Salt for the per-visitor session hash. Never stored alongside the hash. */
  sessionHashSalt: string;
}

const DEFAULT_DB_NAME = "tirvona_smart_contact";

const trimSlashes = (value: string): string => value.replace(/\/+$/, "");

const positiveInt = (raw: string | undefined, fallback: number): number => {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
};

export const smartContactConfig = (): SmartContactConfig => ({
  mongoUri:
    process.env.SMART_CONTACT_MONGODB_URI ||
    process.env.MONGODB_URI ||
    "mongodb://127.0.0.1:27017/tirvona",
  // Always an explicit dbName. Mongoose lets `dbName` override the database in
  // the URI path, which is what keeps Smart Contact data out of the platform
  // database even when both share one connection string.
  mongoDbName: process.env.SMART_CONTACT_MONGODB_DB_NAME || DEFAULT_DB_NAME,
  publicBaseUrl: trimSlashes(
    process.env.SMART_CONTACT_PUBLIC_BASE_URL || "https://www.tirvona.com",
  ),
  publicPathPrefix: `/${(process.env.SMART_CONTACT_PUBLIC_PATH_PREFIX || "c")
    .replace(/^\/+|\/+$/g, "")}`,
  apiBaseUrl: trimSlashes(
    process.env.SMART_CONTACT_API_BASE_URL ||
      process.env.API_PUBLIC_URL ||
      "http://localhost:5000",
  ),
  qrDarkColor: process.env.SMART_CONTACT_QR_DARK_COLOR || "#0B192C",
  qrLightColor: process.env.SMART_CONTACT_QR_LIGHT_COLOR || "#FFFFFF",
  qrAccentColor: process.env.SMART_CONTACT_QR_ACCENT_COLOR || "#D4AF37",
  qrLogoUrl: process.env.SMART_CONTACT_QR_LOGO_URL || "",
  qrDefaultPngSize: positiveInt(process.env.SMART_CONTACT_QR_PNG_SIZE, 1000),
  qrPrintPngSize: positiveInt(process.env.SMART_CONTACT_QR_PRINT_PNG_SIZE, 2000),
  inactiveContactEmail:
    process.env.SMART_CONTACT_INACTIVE_EMAIL || "partners@tirvona.com",
  eventRetentionDays: Math.max(
    0,
    Number(process.env.SMART_CONTACT_EVENT_RETENTION_DAYS) || 730,
  ),
  sessionHashSalt:
    process.env.SMART_CONTACT_SESSION_SALT ||
    process.env.JWT_SECRET ||
    "development-only-smart-contact-salt",
});

/** The permanent URL a QR encodes for a given slug (spec §2). */
export const buildProfileUrl = (
  config: SmartContactConfig,
  slug: string,
): string => `${config.publicBaseUrl}${config.publicPathPrefix}/${slug}`;

/** The vCard download URL for a given slug (spec §9). */
export const buildVcardUrl = (
  config: SmartContactConfig,
  slug: string,
): string => `${config.apiBaseUrl}/api/v1/smart-contact/${slug}/vcard`;
