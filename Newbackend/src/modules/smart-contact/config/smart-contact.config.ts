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

/**
 * Turns a configured prefix into a leading-slash segment, or an empty string
 * when the segment is being dropped entirely.
 *
 * The empty case is the one worth being careful about: a bare "/" here would
 * concatenate into `https://host//slug`, which is a different URL from
 * `https://host/slug` and would 404 on most hosts. Collapsing it to "" keeps
 * `buildProfileUrl` correct either way.
 */
const normalisePrefix = (raw: string | undefined): string => {
  const cleaned = (raw ?? "c").replace(/^\/+|\/+$/g, "");
  return cleaned ? `/${cleaned}` : "";
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
  // Normalised to either "/c" or "" — never a bare "/", which would produce a
  // double slash once the slug is appended. Setting the prefix to "/" is how
  // someone would try to drop the segment entirely and serve profiles from the
  // site root; that is supported here, but see the warning on `buildProfileUrl`
  // before doing it.
  publicPathPrefix: normalisePrefix(process.env.SMART_CONTACT_PUBLIC_PATH_PREFIX),
  apiBaseUrl: trimSlashes(
    process.env.SMART_CONTACT_API_BASE_URL ||
      process.env.API_PUBLIC_URL ||
      "http://localhost:5000",
  ),
  qrDarkColor: process.env.SMART_CONTACT_QR_DARK_COLOR || "#0B192C",
  qrLightColor: process.env.SMART_CONTACT_QR_LIGHT_COLOR || "#FFFFFF",
  // Saffron Gold, matching --accent in frontend/src/index.css. Not the older
  // #D4AF37: the brand palette moved and printed artwork has to agree with the
  // website it sends people to.
  qrAccentColor: process.env.SMART_CONTACT_QR_ACCENT_COLOR || "#E58C28",
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

/**
 * The permanent URL a QR encodes for a given slug (spec §2).
 *
 * A note on dropping the `/c` segment and serving profiles from the site root
 * (`SMART_CONTACT_PUBLIC_PATH_PREFIX=/`): it works, and it shortens the URL,
 * but it puts every slug into the same namespace as the website's own pages.
 * `/offers`, `/parking`, `/temples` and every route added in future then
 * compete with profile slugs, and the host can no longer route by prefix — it
 * would need an explicit list of every SPA route kept in sync forever, and one
 * new page silently shadows a representative's card. The `/c` segment costs
 * two characters and removes that entire class of failure.
 */
export const buildProfileUrl = (
  config: SmartContactConfig,
  slug: string,
): string =>
  // The `replace` is deliberate belt-and-braces, not redundancy. A doubled
  // slash here is uniquely expensive: `https://host//slug` is a different URL
  // that 404s, and once it has been written into a QR row's immutable
  // `destinationUrl` — or printed — it cannot be corrected. Collapsing runs of
  // slashes in the path (never in the `https://` scheme) means no combination
  // of base URL and prefix can produce one.
  `${config.publicBaseUrl}${config.publicPathPrefix}/${slug}`.replace(
    /([^:]\/)\/+/g,
    "$1",
  );

/** The vCard download URL for a given slug (spec §9). */
export const buildVcardUrl = (
  config: SmartContactConfig,
  slug: string,
): string => `${config.apiBaseUrl}/api/v1/smart-contact/${slug}/vcard`;
