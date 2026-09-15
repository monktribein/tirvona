import { Inject, Injectable, Logger } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";
import { whatsappConfig } from "../../config/whatsapp.config";
import {
  META_CLOUD_PROVIDER_NAME,
  WHATSAPP_TEMPLATE,
} from "../../constants/whatsapp.constants";
import {
  WhatsAppDeliveryUnconfirmedError,
  WhatsAppIntegrationError,
} from "../../errors/whatsapp.errors";
import type {
  WhatsAppFollowUpResult,
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
    const template = request.metaEvent
      ? this.transactionalTemplateFor(request.metaEvent)
      : undefined;
    return (
      request.messageType !== WHATSAPP_TEMPLATE.AUTH_OTP &&
      Boolean(template?.name) &&
      // A template approved with an image header cannot be sent without one,
      // so such a message keeps its existing delivery path instead.
      (!template?.headerImage || Boolean(request.followUpImage))
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
    const base = {
      name: template.name,
      language: template.language,
      parameterFormat: this.config.metaCloud.parameterFormat ?? "positional",
      parameters: template.bodyVariables.map((name) => ({
        name,
        text: metaParameterText(request.templateVariables?.[name]),
      })),
    } as const;

    if (template.headerImage) {
      if (!request.followUpImage)
        throw new WhatsAppIntegrationError(
          "Meta template needs a header image that this notification does not carry",
          "TEMPLATE_UNCONFIGURED",
        );
      // The image travels inside the approved template, so it reaches the
      // guest outside the 24-hour window. It is uploaded before anything is
      // sent, so a failed upload leaves no message behind and is safe to retry.
      const headerImageId = await this.client.uploadMedia(
        request,
        request.followUpImage,
      );
      const result = await this.client.sendTransactionalTemplate(request, {
        ...base,
        headerImageId,
      });
      return result.status === "accepted"
        ? { ...result, followUp: { status: "accepted", reason: "template_header" } }
        : result;
    }

    const result = await this.client.sendTransactionalTemplate(request, base);
    if (result.status !== "accepted" || !request.followUpImage) return result;
    return { ...result, followUp: await this.sendFollowUpImage(request) };
  }

  /**
   * Uploads and sends the follow-up image once the template is accepted. It
   * never throws: the template is already on its way, and an error here would
   * make the job retry and deliver the template a second time. The outcome is
   * returned for the worker to record instead.
   */
  private async sendFollowUpImage(
    request: WhatsAppProviderRequest,
  ): Promise<WhatsAppFollowUpResult> {
    const image = request.followUpImage;
    if (!image) return { status: "skipped", reason: "no_image" };
    let outcome: WhatsAppFollowUpResult;
    try {
      const mediaId = await this.client.uploadMedia(request, image);
      const sent = await this.client.sendImageMessage(
        request,
        mediaId,
        image.caption,
      );
      outcome = {
        status: "accepted",
        ...(sent.providerMessageId
          ? { providerMessageId: sent.providerMessageId }
          : {}),
      };
    } catch (error) {
      outcome =
        error instanceof WhatsAppDeliveryUnconfirmedError
          ? { status: "unconfirmed", reason: "image_response_unconfirmed" }
          : {
              status: "failed",
              reason:
                error instanceof WhatsAppIntegrationError
                  ? error.code
                  : "UNEXPECTED",
            };
    }
    this.logger.log(
      JSON.stringify({
        event: "whatsapp.follow_up_image_result",
        provider: META_CLOUD_PROVIDER_NAME,
        messageType: request.messageType,
        metaEvent: request.metaEvent,
        requestId: request.correlationId || request.idempotencyKey,
        status: outcome.status,
        reason: outcome.reason,
      }),
    );
    return outcome;
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
