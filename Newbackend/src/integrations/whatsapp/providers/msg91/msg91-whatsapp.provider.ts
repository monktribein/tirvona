import { Inject, Injectable, Logger } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";
import { whatsappConfig } from "../../config/whatsapp.config";
import {
  MSG91_PROVIDER_NAME,
  WHATSAPP_TEMPLATE,
} from "../../constants/whatsapp.constants";
import { WhatsAppIntegrationError } from "../../errors/whatsapp.errors";
import type {
  WhatsAppProviderRequest,
  WhatsAppProviderResult,
  WhatsAppTemplateKey,
} from "../../types/whatsapp.types";
import type { WhatsAppProvider } from "../whatsapp-provider.interface";
import {
  Msg91WhatsAppClient,
  type Msg91TemplateComponents,
} from "./msg91-whatsapp.client";

/**
 * Delivers Tirvona WhatsApp messages through MSG91's approved templates.
 *
 * Only OTP is mapped today. Adding a notification type is a matter of giving
 * its template key an entry in the config's `msg91.templates` block; no code
 * here or above needs to change beyond that mapping.
 */
@Injectable()
export class Msg91WhatsAppProvider implements WhatsAppProvider {
  private readonly logger = new Logger(Msg91WhatsAppProvider.name);

  readonly name = MSG91_PROVIDER_NAME;

  constructor(
    private readonly client: Msg91WhatsAppClient,
    @Inject(whatsappConfig.KEY)
    private readonly config: ConfigType<typeof whatsappConfig>,
  ) {}

  /**
   * Whether MSG91 can be attempted at all. Missing credentials are a
   * configuration state, not an error, so the router simply skips to the
   * existing provider instead of failing the send.
   */
  isAvailable(): boolean {
    const { enabled, authKey, integratedNumber } = this.config.msg91;
    return Boolean(enabled && authKey && integratedNumber);
  }

  /** Whether MSG91 has an approved template mapped for this message type. */
  supports(messageType: WhatsAppTemplateKey): boolean {
    return Boolean(this.templateFor(messageType)?.name);
  }

  async sendMessage(
    request: WhatsAppProviderRequest,
  ): Promise<WhatsAppProviderResult> {
    if (this.config.dryRun) {
      this.logger.log(
        JSON.stringify({
          event: "whatsapp.dry_run",
          provider: MSG91_PROVIDER_NAME,
          messageType: request.messageType,
          idempotencyKey: request.idempotencyKey,
        }),
      );
      return {
        status: "skipped",
        provider: MSG91_PROVIDER_NAME,
        reason: "dry_run",
      };
    }

    const template = this.templateFor(request.messageType);
    if (!template?.name)
      throw new WhatsAppIntegrationError(
        `MSG91 has no approved template for ${request.messageType}`,
        "TEMPLATE_UNCONFIGURED",
      );

    return this.client.sendTemplate(request, {
      name: template.name,
      components: this.buildComponents(request, template),
    });
  }

  private templateFor(messageType: WhatsAppTemplateKey) {
    const templates = this.config.msg91.templates as Partial<
      Record<
        WhatsAppTemplateKey,
        {
          name: string;
          bodyVariables: readonly string[];
          copyCodeButton: boolean;
        }
      >
    >;
    return templates[messageType];
  }

  /**
   * Fills the approved template's ordered body placeholders (`body_1`, ...)
   * from the variables the caller already produced, so the code MSG91 sends is
   * the exact one Tirvona generated and stored.
   */
  private buildComponents(
    request: WhatsAppProviderRequest,
    template: { bodyVariables: readonly string[]; copyCodeButton: boolean },
  ): Msg91TemplateComponents {
    const variables = request.templateVariables ?? {};
    const components: Msg91TemplateComponents = {};

    template.bodyVariables.forEach((variableName, index) => {
      const value = variables[variableName];
      if (value === undefined)
        throw new WhatsAppIntegrationError(
          `MSG91 template variable ${variableName} is missing`,
          "TEMPLATE_REJECTED",
        );
      components[`body_${index + 1}`] = {
        type: "text",
        value: String(value),
      };
    });

    if (
      template.copyCodeButton &&
      request.messageType === WHATSAPP_TEMPLATE.AUTH_OTP
    ) {
      const otp = variables.otp;
      if (otp !== undefined)
        components.button_1 = {
          type: "text",
          subtype: "url",
          value: String(otp),
        };
    }

    return components;
  }
}
