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
} from "../../types/whatsapp.types";
import type { WhatsAppProvider } from "../whatsapp-provider.interface";
import { MetaCloudWhatsAppClient } from "./meta-cloud-whatsapp.client";

/** Sends authentication OTPs through Meta's approved Cloud API template. */
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

  async sendMessage(
    request: WhatsAppProviderRequest,
  ): Promise<WhatsAppProviderResult> {
    if (!this.supports(request.messageType))
      throw new WhatsAppIntegrationError(
        "Meta Cloud provider supports authentication OTPs only",
        "TEMPLATE_UNCONFIGURED",
      );
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
