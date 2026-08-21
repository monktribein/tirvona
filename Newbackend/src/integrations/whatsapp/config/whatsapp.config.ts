import { registerAs } from "@nestjs/config";
import {
  AK_NEXUS_PROVIDER_NAME,
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
} as const;

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
    [WHATSAPP_TEMPLATE.GENERAL_NOTIFICATION]: template(
      process.env.AK_NEXUS_WHATSAPP_TEMPLATE_GENERAL_NOTIFICATION,
    ),
  } satisfies Record<WhatsAppTemplateKey, WhatsAppTemplateDefinition>,
}));

export type WhatsAppConfig = ReturnType<typeof whatsappConfig>;
