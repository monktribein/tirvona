
export interface SmartContactConfig {
  mongoUri: string;
  mongoDbName: string;
  publicBaseUrl: string;
  publicPathPrefix: string;
  apiBaseUrl: string;
  qrDarkColor: string;
  qrLightColor: string;
  qrAccentColor: string;
  qrLogoUrl: string;
  qrDefaultPngSize: number;
  qrPrintPngSize: number;
  inactiveContactEmail: string;
  eventRetentionDays: number;
  sessionHashSalt: string;
}

const DEFAULT_DB_NAME = "tirvona_smart_contact";

const trimSlashes = (value: string): string => value.replace(/\/+$/, "");

const positiveInt = (raw: string | undefined, fallback: number): number => {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
};

const normalisePrefix = (raw: string | undefined): string => {
  const cleaned = (raw ?? "c").replace(/^\/+|\/+$/g, "");
  return cleaned ? `/${cleaned}` : "";
};

export const smartContactConfig = (): SmartContactConfig => ({
  mongoUri:
    process.env.SMART_CONTACT_MONGODB_URI ||
    process.env.MONGODB_URI ||
    "mongodb://127.0.0.1:27017/tirvona",
  mongoDbName: process.env.SMART_CONTACT_MONGODB_DB_NAME || DEFAULT_DB_NAME,
  publicBaseUrl: trimSlashes(
    process.env.SMART_CONTACT_PUBLIC_BASE_URL || "https://www.tirvona.com",
  ),
  publicPathPrefix: normalisePrefix(process.env.SMART_CONTACT_PUBLIC_PATH_PREFIX),
  apiBaseUrl: trimSlashes(
    process.env.SMART_CONTACT_API_BASE_URL ||
      process.env.API_PUBLIC_URL ||
      "http://localhost:5000",
  ),
  qrDarkColor: process.env.SMART_CONTACT_QR_DARK_COLOR || "#0B192C",
  qrLightColor: process.env.SMART_CONTACT_QR_LIGHT_COLOR || "#FFFFFF",
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

export const buildProfileUrl = (
  config: SmartContactConfig,
  slug: string,
): string =>
  `${config.publicBaseUrl}${config.publicPathPrefix}/${slug}`.replace(
    /([^:]\/)\/+/g,
    "$1",
  );

export const buildVcardUrl = (
  config: SmartContactConfig,
  slug: string,
): string => `${config.apiBaseUrl}/api/v1/smart-contact/${slug}/vcard`;
