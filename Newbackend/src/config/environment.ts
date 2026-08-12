import { setServers } from "node:dns";

const integer = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value ?? fallback);
  return Number.isInteger(parsed) ? parsed : fallback;
};

const boolean = (value: string | undefined, fallback: boolean): boolean =>
  value === undefined ? fallback : value.toLowerCase() === "true";

const csv = (value: string | undefined, fallback: string): string[] =>
  (value ?? fallback)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

export interface Environment {
  nodeEnv: string;
  host: string;
  port: number;
  frontendUrl: string;
  corsOrigins: string[];
  trustProxy: boolean;
  swaggerEnabled: boolean;
  logLevel: string;
  dnsServers: string[];
  throttleTtlMs: number;
  throttleLimit: number;
  mongoUri: string;
  mongoDbName: string;
  mongoUsername: string;
  mongoPassword: string;
  mongoMinPoolSize: number;
  mongoMaxPoolSize: number;
  mongoServerSelectionTimeoutMs: number;
  mongoSocketTimeoutMs: number;
  redisUrl: string;
  queuePrefix: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  jwtIssuer: string;
  jwtAudience: string;
  encryptionKey: string;
  parkingQrSecret: string;
  razorpayKeyId: string;
  razorpayKeySecret: string;
  razorpayWebhookSecret: string;
  cloudinaryCloudName: string;
  cloudinaryApiKey: string;
  cloudinaryApiSecret: string;
  cloudinaryFolder: string;
  resendApiKey: string;
  resendFromEmail: string;
  resendReplyTo: string;
  msg91AuthKey: string;
  msg91OtpTemplateId: string;
  msg91TemplateId: string;
  msg91SenderId: string;
  msg91Route: string;
  msg91CountryCode: string;
  otpSmsEnabled: boolean;
  otpLength: number;
  otpExpiryMinutes: number;
  otpMaxAttempts: number;
  otpResendCooldownSeconds: number;
  googleClientId: string;
  googleClientSecret: string;
}

/**
 * Point Node's resolver at DNS_SERVERS before anything opens a connection.
 *
 * An Atlas URI is an SRV record, so a resolver that cannot answer SRV queries
 * fails the connection outright — a machine whose resolver is a local proxy
 * answers ECONNREFUSED and Mongoose only reports "Unable to connect". Every
 * entry point that reaches the database has to apply this, not just main.ts:
 * a standalone script gets the same resolver and the same failure.
 *
 * Safe to call more than once, and a no-op when DNS_SERVERS is unset.
 */
export const applyDnsServersFromEnvironment = (): string[] => {
  const servers = csv(process.env.DNS_SERVERS, "");
  if (servers.length > 0) setServers(servers);
  return servers;
};

/**
 * The dev fallback covers all three local apps — the main site on 5173, the
 * leadTirvona field app on 5174, and the SmarID Smart Contact page on 5175 —
 * so a fresh checkout does not fail CORS on the lead login or on a scanned
 * contact page. Production ignores this entirely: CORS_ORIGINS is required
 * there and validated against wildcards.
 */
export const corsOriginsFromEnvironment = (): string[] =>
  csv(
    process.env.CORS_ORIGINS,
    process.env.FRONTEND_URL ??
    process.env.CLIENT_URL ??
    "http://localhost:5173,http://localhost:5174,http://localhost:5175",
  );

export const parkingQrSecretFromEnvironment = (): string =>
  process.env.PARKING_QR_SECRET ||
  process.env.ENCRYPTION_KEY ||
  process.env.JWT_SECRET ||
  "development-only-parking-qr-secret";

export const environment = (): Environment => ({
  nodeEnv: process.env.NODE_ENV ?? "development",
  host: process.env.HOST ?? "0.0.0.0",
  port: integer(process.env.PORT, 5000),
  frontendUrl:
    process.env.FRONTEND_URL ??
    process.env.CLIENT_URL ??
    "http://localhost:5173",
  corsOrigins: corsOriginsFromEnvironment(),
  trustProxy: boolean(process.env.TRUST_PROXY, false),
  swaggerEnabled: boolean(
    process.env.SWAGGER_ENABLED,
    process.env.NODE_ENV !== "production",
  ),
  logLevel: process.env.LOG_LEVEL ?? "info",
  dnsServers: csv(process.env.DNS_SERVERS, ""),
  throttleTtlMs: integer(process.env.THROTTLE_TTL_MS, 60_000),
  throttleLimit: integer(process.env.THROTTLE_LIMIT, 120),
  mongoUri: process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/tirvona",
  mongoDbName: process.env.MONGODB_DB_NAME ?? "",
  mongoUsername: process.env.MONGODB_USERNAME ?? "",
  mongoPassword: process.env.MONGODB_PASSWORD ?? "",
  mongoMinPoolSize: integer(process.env.MONGODB_MIN_POOL_SIZE, 1),
  mongoMaxPoolSize: integer(process.env.MONGODB_MAX_POOL_SIZE, 20),
  mongoServerSelectionTimeoutMs: integer(
    process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS,
    10_000,
  ),
  mongoSocketTimeoutMs: integer(process.env.MONGODB_SOCKET_TIMEOUT_MS, 45_000),
  redisUrl: process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
  queuePrefix: process.env.QUEUE_PREFIX ?? "tirvona",
  jwtSecret: process.env.JWT_SECRET ?? "",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "30d",
  jwtIssuer: process.env.JWT_ISSUER ?? "tirvona-api",
  jwtAudience: process.env.JWT_AUDIENCE ?? "tirvona-clients",
  encryptionKey: process.env.ENCRYPTION_KEY ?? "",
  parkingQrSecret: parkingQrSecretFromEnvironment(),
  razorpayKeyId: process.env.RAZORPAY_KEY_ID ?? "",
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET ?? "",
  razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET ?? "",
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME ?? "",
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY ?? "",
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET ?? "",
  cloudinaryFolder: process.env.CLOUDINARY_FOLDER ?? "tirvona",
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  resendFromEmail:
    process.env.RESEND_FROM_EMAIL ??
    `${process.env.EMAIL_FROM_NAME ?? "Tirvona"} <${process.env.EMAIL_FROM_EMAIL ?? "notifications@tirvona.com"}>`,
  resendReplyTo: process.env.EMAIL_REPLY_TO ?? "support@tirvona.com",
  msg91AuthKey: process.env.MSG91_AUTH_KEY ?? "",
  msg91OtpTemplateId: process.env.MSG91_OTP_TEMPLATE_ID ?? "",
  msg91TemplateId: process.env.MSG91_TEMPLATE_ID ?? "",
  msg91SenderId: process.env.MSG91_SENDER_ID ?? "TRVONA",
  msg91Route: process.env.MSG91_ROUTE ?? "4",
  msg91CountryCode: process.env.MSG91_COUNTRY_CODE ?? "91",
  otpSmsEnabled: boolean(process.env.OTP_SMS_ENABLED, false),
  otpLength: integer(process.env.OTP_LENGTH, 6),
  otpExpiryMinutes: integer(process.env.OTP_EXPIRY_MINUTES, 5),
  otpMaxAttempts: integer(process.env.OTP_MAX_ATTEMPTS, 5),
  otpResendCooldownSeconds: integer(
    process.env.OTP_RESEND_COOLDOWN_SECONDS,
    30,
  ),
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
});

const requireTogether = (
  input: Record<string, unknown>,
  names: string[],
): void => {
  const present = names.filter((name) => String(input[name] ?? "").trim());
  if (present.length > 0 && present.length < names.length)
    throw new Error(`${names.join(", ")} must be configured together`);
};

export function validateEnvironment(
  input: Record<string, unknown>,
): Record<string, unknown> {
  const nodeEnv = String(input.NODE_ENV ?? "development");
  if (!["development", "test", "production"].includes(nodeEnv))
    throw new Error("NODE_ENV must be development, test, or production");

  for (const name of [
    "PORT",
    "MONGODB_MIN_POOL_SIZE",
    "MONGODB_MAX_POOL_SIZE",
    "MONGODB_SERVER_SELECTION_TIMEOUT_MS",
    "MONGODB_SOCKET_TIMEOUT_MS",
    "THROTTLE_TTL_MS",
    "THROTTLE_LIMIT",
    "OTP_LENGTH",
    "OTP_EXPIRY_MINUTES",
    "OTP_MAX_ATTEMPTS",
    "OTP_RESEND_COOLDOWN_SECONDS",
  ]) {
    if (
      input[name] !== undefined &&
      (!Number.isInteger(Number(input[name])) || Number(input[name]) < 1)
    )
      throw new Error(`${name} must be a positive integer`);
  }

  if (input.CORS_ORIGINS) {
    for (const origin of String(input.CORS_ORIGINS).split(",")) {
      try {
        const url = new URL(origin.trim());
        if (!["http:", "https:"].includes(url.protocol)) throw new Error();
      } catch {
        throw new Error("CORS_ORIGINS must contain valid HTTP(S) URLs");
      }
    }
  }
  if (input.OTP_LENGTH !== undefined && Number(input.OTP_LENGTH) > 8)
    throw new Error("OTP_LENGTH must be between 1 and 8");

  for (const name of [
    "MONGODB_URI",
    "REDIS_URL",
    "FRONTEND_URL",
    "CLIENT_URL",
  ]) {
    if (input[name]) {
      try {
        new URL(String(input[name]));
      } catch {
        throw new Error(`${name} must be a valid URL`);
      }
    }
  }

  requireTogether(input, ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"]);
  requireTogether(input, ["MONGODB_USERNAME", "MONGODB_PASSWORD"]);
  requireTogether(input, [
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",
  ]);
  if (
    input.RESEND_API_KEY &&
    !input.RESEND_FROM_EMAIL &&
    !input.EMAIL_FROM_EMAIL
  )
    throw new Error(
      "RESEND_FROM_EMAIL or EMAIL_FROM_EMAIL is required when RESEND_API_KEY is set",
    );
  if (input.MSG91_AUTH_KEY)
    requireTogether(input, ["MSG91_AUTH_KEY", "MSG91_OTP_TEMPLATE_ID"]);

  if (nodeEnv === "production") {
    if (String(input.JWT_SECRET ?? "").length < 32)
      throw new Error(
        "JWT_SECRET must contain at least 32 characters in production",
      );
    if (String(input.PARKING_QR_SECRET ?? "").length < 32)
      throw new Error(
        "PARKING_QR_SECRET must contain at least 32 characters in production",
      );
    for (const name of ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"]) {
      if (!String(input[name] ?? "").trim())
        throw new Error(
          `${name} is required in production — payments cannot run in demo mode with real customers`,
        );
    }
    if (!input.MONGODB_URI)
      throw new Error("MONGODB_URI is required in production");
    if (!input.REDIS_URL)
      throw new Error("REDIS_URL is required in production");
    if (!String(input.CORS_ORIGINS ?? "").trim())
      throw new Error("CORS_ORIGINS is required in production");
    if (String(input.CORS_ORIGINS).includes("*"))
      throw new Error("Wildcard CORS origins are not allowed in production");
  }
  return input;
}
