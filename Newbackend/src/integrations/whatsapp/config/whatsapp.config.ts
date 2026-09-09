import { registerAs } from "@nestjs/config";
import {
  AK_NEXUS_PROVIDER_NAME,
  MSG91_DEFAULT_AUTH_OTP_TEMPLATE,
  MSG91_DEFAULT_TEMPLATE_LANGUAGE,
  WHATSAPP_TEMPLATE,
} from "../constants/whatsapp.constants";
import type {
  WhatsAppTemplateDefinition,
  WhatsAppTemplateKey,
} from "../types/whatsapp.types";

const bool = (value: string | undefined, fallback: boolean): boolean =>
  value === undefined ? fallback : value.toLowerCase() === "true";

const INTERNAL_DEFAULTS = {
  provider: AK_NEXUS_PROVIDER_NAME,
  retryMaxAttempts: 3,
  retryBaseDelayMs: 500,
  timeoutMs: 10_000,
  templateLanguage: "en_US",
  apiBaseUrl: "https://app.aknexus.in/api",
  sendPath: "send",
  msg91ApiBaseUrl: "https://control.msg91.com/api/v5",
  msg91SendPath: "whatsapp/whatsapp-outbound-message/bulk/",
  msg91TimeoutMs: 10_000,
} as const;

/**
 * Ordered names of the variables that fill an approved template's body, read
 * from a comma separated environment value.
 */
const bodyVars = (
  value: string | undefined,
  fallback: readonly string[],
): readonly string[] => {
  const parsed = (value ?? "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
  return parsed.length > 0 ? parsed : fallback;
};

const ENV_SUFFIX: Readonly<Record<WhatsAppTemplateKey, string>> = {
  [WHATSAPP_TEMPLATE.AUTH_OTP]: "AUTH_OTP",
  [WHATSAPP_TEMPLATE.BOOKING_CONFIRMATION]: "BOOKING_CONFIRMATION",
  [WHATSAPP_TEMPLATE.PAYMENT_SUCCESS]: "PAYMENT_SUCCESS",
  [WHATSAPP_TEMPLATE.PAYMENT_FAILURE]: "PAYMENT_FAILURE",
  [WHATSAPP_TEMPLATE.CANCELLATION]: "CANCELLATION",
  [WHATSAPP_TEMPLATE.REFUND]: "REFUND",
  [WHATSAPP_TEMPLATE.CHECKIN_REMINDER]: "CHECKIN_REMINDER",
  [WHATSAPP_TEMPLATE.CHECKIN_CONFIRMED]: "CHECKIN_CONFIRMED",
  [WHATSAPP_TEMPLATE.CHECKOUT_COMPLETED]: "CHECKOUT_COMPLETED",
  [WHATSAPP_TEMPLATE.AARTI_CONFIRMATION]: "AARTI_CONFIRMATION",
  [WHATSAPP_TEMPLATE.AARTI_CANCELLATION]: "AARTI_CANCELLATION",
  [WHATSAPP_TEMPLATE.EVENT_REGISTRATION]: "EVENT_REGISTRATION",
  [WHATSAPP_TEMPLATE.EVENT_CANCELLATION]: "EVENT_CANCELLATION",
  [WHATSAPP_TEMPLATE.GENERAL_NOTIFICATION]: "GENERAL_NOTIFICATION",
};

/**
 * The body variables each approved template is expected to carry, in order.
 * These are the defaults the template specs in the README were written
 * against; a differently approved template overrides them per environment.
 */
const DEFAULT_BODY_VARS: Readonly<
  Record<WhatsAppTemplateKey, readonly string[]>
> = {
  [WHATSAPP_TEMPLATE.AUTH_OTP]: ["otp"],
  [WHATSAPP_TEMPLATE.BOOKING_CONFIRMATION]: [
    "guest_name",
    "ashram_name",
    "reference",
    "check_in",
    "check_out",
    "code",
  ],
  [WHATSAPP_TEMPLATE.PAYMENT_SUCCESS]: ["guest_name", "amount", "reference"],
  [WHATSAPP_TEMPLATE.PAYMENT_FAILURE]: ["guest_name", "reference"],
  [WHATSAPP_TEMPLATE.CANCELLATION]: ["guest_name", "ashram_name", "reference"],
  [WHATSAPP_TEMPLATE.REFUND]: ["guest_name", "refund_amount", "reference"],
  [WHATSAPP_TEMPLATE.CHECKIN_REMINDER]: [
    "guest_name",
    "ashram_name",
    "check_in",
    "code",
  ],
  [WHATSAPP_TEMPLATE.CHECKIN_CONFIRMED]: [
    "guest_name",
    "ashram_name",
    "room_name",
    "check_out",
  ],
  [WHATSAPP_TEMPLATE.CHECKOUT_COMPLETED]: [
    "guest_name",
    "ashram_name",
    "reference",
  ],
  [WHATSAPP_TEMPLATE.AARTI_CONFIRMATION]: [
    "guest_name",
    "session_name",
    "reference",
    "code",
  ],
  [WHATSAPP_TEMPLATE.AARTI_CANCELLATION]: ["guest_name", "reference"],
  [WHATSAPP_TEMPLATE.EVENT_REGISTRATION]: [
    "guest_name",
    "event_name",
    "reference",
    "code",
  ],
  [WHATSAPP_TEMPLATE.EVENT_CANCELLATION]: ["guest_name", "reference"],
  [WHATSAPP_TEMPLATE.GENERAL_NOTIFICATION]: ["title", "message"],
};

export interface Msg91TemplateConfig {
  name: string;
  bodyVariables: readonly string[];
  copyCodeButton: boolean;
}

/**
 * Builds one MSG91 template entry. A template with no configured name is left
 * empty on purpose: the router then treats MSG91 as unable to carry that
 * message and the existing REST provider delivers it unchanged. Only
 * `tirvona_otp` ships with a default, because it is the one approved today.
 */
const msg91Template = (key: WhatsAppTemplateKey): Msg91TemplateConfig => {
  const suffix = ENV_SUFFIX[key];
  const defaultName =
    key === WHATSAPP_TEMPLATE.AUTH_OTP ? MSG91_DEFAULT_AUTH_OTP_TEMPLATE : "";
  return {
    name:
      process.env[`MSG91_WHATSAPP_TEMPLATE_${suffix}`]?.trim() || defaultName,
    bodyVariables: bodyVars(
      process.env[`MSG91_WHATSAPP_TEMPLATE_${suffix}_BODY_VARS`],
      DEFAULT_BODY_VARS[key],
    ),
    copyCodeButton: bool(
      process.env[`MSG91_WHATSAPP_TEMPLATE_${suffix}_COPY_CODE`],
      false,
    ),
  };
};

const msg91Templates = (): Record<WhatsAppTemplateKey, Msg91TemplateConfig> =>
  Object.fromEntries(
    (Object.keys(ENV_SUFFIX) as WhatsAppTemplateKey[]).map((key) => [
      key,
      msg91Template(key),
    ]),
  ) as Record<WhatsAppTemplateKey, Msg91TemplateConfig>;

const template = (name: string | undefined): WhatsAppTemplateDefinition => ({
  name: name?.trim() ?? "",
  language: INTERNAL_DEFAULTS.templateLanguage,
});

export const whatsappConfig = registerAs("whatsapp", () => ({
  enabled: bool(process.env.WHATSAPP_ENABLED, false),
  dryRun: bool(
    process.env.WHATSAPP_DRY_RUN,
    process.env.NODE_ENV !== "production",
  ),
  provider: INTERNAL_DEFAULTS.provider,
  retry: {
    maxAttempts: INTERNAL_DEFAULTS.retryMaxAttempts,
    baseDelayMs: INTERNAL_DEFAULTS.retryBaseDelayMs,
  },
  akNexus: {
    apiBaseUrl:
      process.env.AK_NEXUS_API_BASE_URL?.trim() ||
      INTERNAL_DEFAULTS.apiBaseUrl,
    sendPath: INTERNAL_DEFAULTS.sendPath,
    apiToken: process.env.AK_NEXUS_API_TOKEN?.trim() ?? "",
    accountId: process.env.AK_NEXUS_ACCOUNT_ID?.trim() ?? "",
    timeoutMs: INTERNAL_DEFAULTS.timeoutMs,
  },
  msg91: {
    // MSG91 is opt-in: with the flag off, or credentials missing, the router
    // skips it entirely and AK NEXUS keeps serving every send as before.
    enabled: bool(process.env.MSG91_WHATSAPP_ENABLED, false),
    apiBaseUrl:
      process.env.MSG91_WHATSAPP_API_BASE_URL?.trim() ||
      INTERNAL_DEFAULTS.msg91ApiBaseUrl,
    sendPath: INTERNAL_DEFAULTS.msg91SendPath,
    // Falls back to the auth key already used by the MSG91 SMS flow so a
    // single MSG91 account needs only one secret configured.
    authKey:
      process.env.MSG91_WHATSAPP_AUTH_KEY?.trim() ||
      process.env.MSG91_AUTH_KEY?.trim() ||
      "",
    integratedNumber:
      process.env.MSG91_WHATSAPP_INTEGRATED_NUMBER?.trim().replace(/\D/g, "") ??
      "",
    namespace: process.env.MSG91_WHATSAPP_NAMESPACE?.trim() ?? "",
    templateLanguage:
      process.env.MSG91_WHATSAPP_TEMPLATE_LANGUAGE?.trim() ||
      MSG91_DEFAULT_TEMPLATE_LANGUAGE,
    timeoutMs: INTERNAL_DEFAULTS.msg91TimeoutMs,
    templates: msg91Templates(),
  },
  templates: {
    [WHATSAPP_TEMPLATE.AUTH_OTP]: template(
      process.env.AK_NEXUS_WHATSAPP_TEMPLATE_AUTH_OTP,
    ),
    [WHATSAPP_TEMPLATE.BOOKING_CONFIRMATION]: template(
      process.env.AK_NEXUS_WHATSAPP_TEMPLATE_BOOKING_CONFIRMATION,
    ),
    [WHATSAPP_TEMPLATE.PAYMENT_SUCCESS]: template(
      process.env.AK_NEXUS_WHATSAPP_TEMPLATE_PAYMENT_SUCCESS,
    ),
    [WHATSAPP_TEMPLATE.PAYMENT_FAILURE]: template(
      process.env.AK_NEXUS_WHATSAPP_TEMPLATE_PAYMENT_FAILURE,
    ),
    [WHATSAPP_TEMPLATE.CANCELLATION]: template(
      process.env.AK_NEXUS_WHATSAPP_TEMPLATE_CANCELLATION,
    ),
    [WHATSAPP_TEMPLATE.REFUND]: template(
      process.env.AK_NEXUS_WHATSAPP_TEMPLATE_REFUND,
    ),
    [WHATSAPP_TEMPLATE.CHECKIN_REMINDER]: template(
      process.env.AK_NEXUS_WHATSAPP_TEMPLATE_CHECKIN_REMINDER,
    ),
    [WHATSAPP_TEMPLATE.CHECKIN_CONFIRMED]: template(
      process.env.AK_NEXUS_WHATSAPP_TEMPLATE_CHECKIN_CONFIRMED,
    ),
    [WHATSAPP_TEMPLATE.CHECKOUT_COMPLETED]: template(
      process.env.AK_NEXUS_WHATSAPP_TEMPLATE_CHECKOUT_COMPLETED,
    ),
    [WHATSAPP_TEMPLATE.AARTI_CONFIRMATION]: template(
      process.env.AK_NEXUS_WHATSAPP_TEMPLATE_AARTI_CONFIRMATION,
    ),
    [WHATSAPP_TEMPLATE.AARTI_CANCELLATION]: template(
      process.env.AK_NEXUS_WHATSAPP_TEMPLATE_AARTI_CANCELLATION,
    ),
    [WHATSAPP_TEMPLATE.EVENT_REGISTRATION]: template(
      process.env.AK_NEXUS_WHATSAPP_TEMPLATE_EVENT_REGISTRATION,
    ),
    [WHATSAPP_TEMPLATE.EVENT_CANCELLATION]: template(
      process.env.AK_NEXUS_WHATSAPP_TEMPLATE_EVENT_CANCELLATION,
    ),
    [WHATSAPP_TEMPLATE.GENERAL_NOTIFICATION]: template(
      process.env.AK_NEXUS_WHATSAPP_TEMPLATE_GENERAL_NOTIFICATION,
    ),
  } satisfies Record<WhatsAppTemplateKey, WhatsAppTemplateDefinition>,
}));

export type WhatsAppConfig = ReturnType<typeof whatsappConfig>;
