import { Inject, Injectable, Logger } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";
import { whatsappConfig } from "../config/whatsapp.config";
import {
  AK_NEXUS_PROVIDER_NAME,
  WHATSAPP_PROVIDER,
  WHATSAPP_TEMPLATE,
} from "../constants/whatsapp.constants";
import { WhatsAppIntegrationError } from "../errors/whatsapp.errors";
import type { WhatsAppProvider } from "../providers/whatsapp-provider.interface";
import type {
  WhatsAppProviderResult,
  WhatsAppTemplateKey,
  WhatsAppTemplateValue,
} from "../types/whatsapp.types";
import { normalizeWhatsAppNumber } from "../utils/whatsapp-phone.util";

export interface SendTemplateInput {
  to: string;
  templateKey: WhatsAppTemplateKey;
  variables: Readonly<Record<string, WhatsAppTemplateValue>>;
  idempotencyKey: string;
  correlationId?: string;
}

@Injectable()
export class WhatsAppTemplateService {
  private readonly logger = new Logger(WhatsAppTemplateService.name);

  constructor(
    @Inject(WHATSAPP_PROVIDER) private readonly provider: WhatsAppProvider,
    @Inject(whatsappConfig.KEY)
    private readonly config: ConfigType<typeof whatsappConfig>,
  ) {}

  async send(input: SendTemplateInput): Promise<WhatsAppProviderResult> {
    if (!this.config.enabled)
      return this.skipped("integration_disabled");

    const to = normalizeWhatsAppNumber(input.to);
    if (!to)
      throw new WhatsAppIntegrationError(
        "WhatsApp recipient must be a valid international phone number",
        "INVALID_RECIPIENT",
      );

    const message = this.renderMessage(input.templateKey, input.variables);

    const attempts = Math.max(1, this.config.retry.maxAttempts);
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        return await this.provider.sendMessage({
          to,
          messageType: input.templateKey,
          message,
          idempotencyKey: input.idempotencyKey,
          correlationId: input.correlationId,
        });
      } catch (error) {
        const retryable =
          error instanceof WhatsAppIntegrationError && error.retryable;
        this.logger.error(
          JSON.stringify({
            event: "whatsapp.send_failed",
            templateKey: input.templateKey,
            requestId: input.correlationId || input.idempotencyKey,
            attempt,
            retryable,
            code:
              error instanceof WhatsAppIntegrationError
                ? error.code
                : "UNEXPECTED",
          }),
        );
        if (!retryable || attempt === attempts) throw error;
        await this.delay(this.config.retry.baseDelayMs * 2 ** (attempt - 1));
      }
    }
    throw new WhatsAppIntegrationError(
      "WhatsApp provider exhausted retries",
      "PROVIDER_UNAVAILABLE",
      true,
    );
  }

  private renderMessage(
    templateKey: WhatsAppTemplateKey,
    variables: Readonly<Record<string, WhatsAppTemplateValue>>,
  ): string {
    const value = (key: string): string =>
      variables[key] === undefined ? "" : String(variables[key]).trim();
    const reference = value("reference");
    const suffix = reference ? ` (reference: ${reference})` : "";
    const suppliedMessage = value("message");
    const title = value("title");
    if (suppliedMessage)
      return title ? `${title}\n\n${suppliedMessage}` : suppliedMessage;

    switch (templateKey) {
      case WHATSAPP_TEMPLATE.AUTH_OTP: {
        const otp = value("otp");
        const expires = value("expires_in_minutes");
        if (!/^\d{4,8}$/.test(otp))
          throw new WhatsAppIntegrationError(
            "WhatsApp OTP must contain 4 to 8 digits",
            "CONFIGURATION_INVALID",
          );
        return `Your Tirvona verification code is ${otp}. It expires in ${expires || "5"} minutes. Do not share this code with anyone.`;
      }
      case WHATSAPP_TEMPLATE.BOOKING_CONFIRMATION:
        return `Your Tirvona booking${suffix} is confirmed.`;
      case WHATSAPP_TEMPLATE.PAYMENT_SUCCESS:
        return `Your Tirvona payment${suffix} was successful.`;
      case WHATSAPP_TEMPLATE.PAYMENT_FAILURE:
        return `Your Tirvona payment${suffix} could not be completed. Please try again.`;
      case WHATSAPP_TEMPLATE.CANCELLATION:
        return `Your Tirvona booking${suffix} has been cancelled.`;
      case WHATSAPP_TEMPLATE.REFUND:
        return `Your Tirvona refund${suffix} has been updated.`;
      case WHATSAPP_TEMPLATE.CHECKIN_REMINDER:
        return `Reminder: your Tirvona check-in${suffix} is coming up.`;
      case WHATSAPP_TEMPLATE.GENERAL_NOTIFICATION:
        return title
          ? `${title}${suffix}`
          : `You have a new update from Tirvona${suffix}.`;
    }
  }

  private skipped(reason: string): WhatsAppProviderResult {
    return {
      status: "skipped",
      provider: this.config.provider || AK_NEXUS_PROVIDER_NAME,
      reason,
    };
  }

  private async delay(milliseconds: number): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
  }
}
