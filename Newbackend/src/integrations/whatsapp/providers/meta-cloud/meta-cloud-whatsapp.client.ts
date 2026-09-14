import { Inject, Injectable, Logger } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";
import { whatsappConfig } from "../../config/whatsapp.config";
import { META_CLOUD_PROVIDER_NAME } from "../../constants/whatsapp.constants";
import { WhatsAppIntegrationError } from "../../errors/whatsapp.errors";
import type {
  WhatsAppProviderRequest,
  WhatsAppProviderResult,
} from "../../types/whatsapp.types";
import {
  maskWhatsAppNumber,
  normalizeWhatsAppNumber,
} from "../../utils/whatsapp-phone.util";

interface MetaCloudResponse {
  messages?: Array<{ id?: unknown }>;
}

export interface MetaAuthenticationTemplatePayload {
  messaging_product: "whatsapp";
  recipient_type: "individual";
  to: string;
  type: "template";
  template: {
    name: string;
    language: { code: string };
    components: Array<
      | {
          type: "body";
          parameters: Array<{ type: "text"; text: string }>;
        }
      | {
          type: "button";
          sub_type: "url";
          index: "0";
          parameters: Array<{ type: "text"; text: string }>;
        }
    >;
  };
}

/** HTTP transport for Meta's WhatsApp Cloud API. */
@Injectable()
export class MetaCloudWhatsAppClient {
  private readonly logger = new Logger(MetaCloudWhatsAppClient.name);

  constructor(
    @Inject(whatsappConfig.KEY)
    private readonly config: ConfigType<typeof whatsappConfig>,
  ) {}

  async sendAuthenticationTemplate(
    request: WhatsAppProviderRequest,
    otp: string,
  ): Promise<WhatsAppProviderResult> {
    const {
      graphBaseUrl,
      apiVersion,
      accessToken,
      phoneNumberId,
      businessAccountId,
      timeoutMs,
      authTemplate,
    } = this.config.metaCloud;
    if (
      !apiVersion ||
      !accessToken ||
      !phoneNumberId ||
      !businessAccountId
    )
      throw new WhatsAppIntegrationError(
        "Meta WhatsApp Cloud API configuration is incomplete",
        "CONFIGURATION_INVALID",
      );

    const number = normalizeWhatsAppNumber(request.to);
    if (!number)
      throw new WhatsAppIntegrationError(
        "WhatsApp recipient number is invalid",
        "INVALID_RECIPIENT",
      );
    if (!/^\d{4,8}$/.test(otp))
      throw new WhatsAppIntegrationError(
        "Meta authentication template requires a valid OTP",
        "TEMPLATE_REJECTED",
      );

    const endpoint = `${graphBaseUrl}/${apiVersion}/${phoneNumberId}/messages`;
    const payload: MetaAuthenticationTemplatePayload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: number,
      type: "template",
      template: {
        name: authTemplate.name,
        language: { code: authTemplate.language },
        components: [
          {
            type: "body",
            parameters: [{ type: "text", text: otp }],
          },
          {
            type: "button",
            sub_type: "url",
            index: "0",
            parameters: [{ type: "text", text: otp }],
          },
        ],
      },
    };
    const diagnostics = {
      provider: META_CLOUD_PROVIDER_NAME,
      requestId: request.correlationId || request.idempotencyKey,
      method: "POST",
      templateName: authTemplate.name,
      templateLanguage: authTemplate.language,
      maskedNumber: maskWhatsAppNumber(number),
      numberLength: number.length,
    } as const;

    this.logger.log(
      JSON.stringify({
        event: "whatsapp.provider_request",
        ...diagnostics,
        providerStatus: "pending",
      }),
    );

    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), timeoutMs);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify(payload),
        signal: abort.signal,
      });
      const responseText = await response.text();
      let providerResponse: MetaCloudResponse = {};
      try {
        providerResponse = JSON.parse(responseText) as MetaCloudResponse;
      } catch {
        providerResponse = {};
      }

      if (!response.ok) {
        const error = this.classify(response.status);
        this.logger.warn(
          JSON.stringify({
            event: "whatsapp.provider_response",
            ...diagnostics,
            httpStatus: response.status,
            providerStatus: error.retryable ? "transient_error" : "rejected",
            code: error.code,
          }),
        );
        throw error;
      }

      const messageId = providerResponse.messages?.[0]?.id;
      this.logger.log(
        JSON.stringify({
          event: "whatsapp.provider_accepted",
          ...diagnostics,
          httpStatus: response.status,
          providerStatus: "accepted",
        }),
      );
      return {
        status: "accepted",
        provider: META_CLOUD_PROVIDER_NAME,
        providerMessageId:
          typeof messageId === "string" ? messageId : undefined,
      };
    } catch (error) {
      if (error instanceof WhatsAppIntegrationError) throw error;
      const timedOut = abort.signal.aborted;
      this.logger.error(
        JSON.stringify({
          event: "whatsapp.provider_error",
          ...diagnostics,
          httpStatus: null,
          providerStatus: timedOut ? "timeout" : "network_error",
        }),
      );
      throw new WhatsAppIntegrationError(
        timedOut
          ? "Meta WhatsApp request timed out"
          : "Meta WhatsApp request failed",
        timedOut ? "PROVIDER_TIMEOUT" : "PROVIDER_UNAVAILABLE",
        true,
        undefined,
        { cause: error },
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private classify(httpStatus: number): WhatsAppIntegrationError {
    if (httpStatus === 401 || httpStatus === 403)
      return new WhatsAppIntegrationError(
        "Meta rejected the configured WhatsApp credentials",
        "CONFIGURATION_INVALID",
        false,
        httpStatus,
      );
    if (httpStatus === 429)
      return new WhatsAppIntegrationError(
        "Meta WhatsApp rate limit reached",
        "PROVIDER_RATE_LIMITED",
        true,
        httpStatus,
      );
    if (httpStatus === 408 || httpStatus === 425)
      return new WhatsAppIntegrationError(
        "Meta WhatsApp request timed out",
        "PROVIDER_TIMEOUT",
        true,
        httpStatus,
      );
    if (httpStatus >= 500)
      return new WhatsAppIntegrationError(
        "Meta WhatsApp is temporarily unavailable",
        "PROVIDER_UNAVAILABLE",
        true,
        httpStatus,
      );
    if (httpStatus === 400)
      return new WhatsAppIntegrationError(
        "Meta rejected the WhatsApp template request",
        "INVALID_REQUEST",
        false,
        httpStatus,
      );
    return new WhatsAppIntegrationError(
      "Meta rejected the WhatsApp message",
      "PROVIDER_REJECTED",
      false,
      httpStatus,
    );
  }
}
