import { Inject, Injectable, Logger } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";
import { whatsappConfig } from "../../config/whatsapp.config";
import {
  META_CLOUD_PROVIDER_NAME,
  WHATSAPP_TEMPLATE,
} from "../../constants/whatsapp.constants";
import { WhatsAppIntegrationError } from "../../errors/whatsapp.errors";
import type {
  WhatsAppProviderRequest,
  WhatsAppProviderResult,
  WhatsAppTemplateKey,
  WhatsAppTemplateValue,
} from "../../types/whatsapp.types";
import type { MetaTransactionalEvent } from "../../constants/whatsapp-meta-templates.constants";
import type { WhatsAppProvider } from "../whatsapp-provider.interface";
import { MetaCloudWhatsAppClient } from "./meta-cloud-whatsapp.client";

/**
 * Meta rejects body parameters that are empty or contain newlines, tabs or more
 * than four consecutive spaces. Values are flattened, and a missing value is
 * shown as a dash rather than failing the whole send.
 */
export const metaParameterText = (
  value: WhatsAppTemplateValue | undefined,
): string => {
  const text = value === undefined || value === null ? "" : String(value);
  const flat = text
    .replace(/[\r\n\t]+/g, " ")
    .replace(/ {4,}/g, "   ")
    .trim();
  return flat ? flat.slice(0, 1024) : "-";
};

/**
 * Sends authentication OTPs through Meta's approved Cloud API template, and
 * transactional notifications only for events whose approved template name
 * has been configured.
 */
@Injectable()
export class MetaCloudWhatsAppProvider implements WhatsAppProvider {
  private readonly logger = new Logger(MetaCloudWhatsAppProvider.name);

  readonly name = META_CLOUD_PROVIDER_NAME;

  constructor(
    private readonly client: MetaCloudWhatsAppClient,
    @Inject(whatsappConfig.KEY)
    private readonly config: ConfigType<typeof whatsappConfig>,
  ) {}

  isAvailable(): boolean {
    const { apiVersion, accessToken, phoneNumberId, businessAccountId } =
      this.config.metaCloud;
    return Boolean(
      apiVersion && accessToken && phoneNumberId && businessAccountId,
    );
  }

  supports(messageType: WhatsAppTemplateKey): boolean {
    return messageType === WHATSAPP_TEMPLATE.AUTH_OTP;
  }

  /**
   * Whether a transactional message can go through Meta: it must carry a
   * logical event and that event must have an approved template configured.
   */
  supportsTransactional(request: WhatsAppProviderRequest): boolean {
    return (
      request.messageType !== WHATSAPP_TEMPLATE.AUTH_OTP &&
      Boolean(
        request.metaEvent &&
          this.transactionalTemplateFor(request.metaEvent)?.name,
      )
    );
  }

  private transactionalTemplateFor(event: MetaTransactionalEvent) {
    return this.config.metaCloud.transactionalTemplates?.[event];
  }

  private async sendTransactional(
    request: WhatsAppProviderRequest,
  ): Promise<WhatsAppProviderResult> {
    const template = request.metaEvent
      ? this.transactionalTemplateFor(request.metaEvent)
      : undefined;
    if (!template?.name)
      throw new WhatsAppIntegrationError(
        "Meta Cloud has no approved template for this notification",
        "TEMPLATE_UNCONFIGURED",
      );
    if (this.config.dryRun) {
      this.logger.log(
        JSON.stringify({
          event: "whatsapp.dry_run",
          provider: META_CLOUD_PROVIDER_NAME,
          messageType: request.messageType,
          metaEvent: request.metaEvent,
          idempotencyKey: request.idempotencyKey,
        }),
      );
      return {
        status: "skipped",
        provider: META_CLOUD_PROVIDER_NAME,
        reason: "dry_run",
      };
    }
    return this.client.sendTransactionalTemplate(request, {
      name: template.name,
      language: template.language,
      parameterFormat: this.config.metaCloud.parameterFormat ?? "positional",
      parameters: template.bodyVariables.map((name) => ({
        name,
        text: metaParameterText(request.templateVariables?.[name]),
      })),
    });
  }

  async sendMessage(
    request: WhatsAppProviderRequest,
  ): Promise<WhatsAppProviderResult> {
    if (!this.supports(request.messageType))
      return this.sendTransactional(request);
    if (this.config.dryRun) {
      this.logger.log(
        JSON.stringify({
          event: "whatsapp.dry_run",
          provider: META_CLOUD_PROVIDER_NAME,
          messageType: request.messageType,
          idempotencyKey: request.idempotencyKey,
        }),
      );
      return {
        status: "skipped",
        provider: META_CLOUD_PROVIDER_NAME,
        reason: "dry_run",
      };
    }

    const otp = request.templateVariables?.otp;
    if (otp === undefined)
      throw new WhatsAppIntegrationError(
        "Meta authentication template OTP is missing",
        "TEMPLATE_REJECTED",
      );
    return this.client.sendAuthenticationTemplate(request, String(otp));
  }
}
