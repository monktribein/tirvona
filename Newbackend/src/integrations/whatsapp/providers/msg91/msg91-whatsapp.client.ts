import { Inject, Injectable, Logger } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";
import { whatsappConfig } from "../../config/whatsapp.config";
import { MSG91_PROVIDER_NAME } from "../../constants/whatsapp.constants";
import { WhatsAppIntegrationError } from "../../errors/whatsapp.errors";
import type {
  WhatsAppProviderRequest,
  WhatsAppProviderResult,
} from "../../types/whatsapp.types";
import {
  maskWhatsAppNumber,
  normalizeWhatsAppNumber,
} from "../../utils/whatsapp-phone.util";

interface Msg91TextComponent {
  type: "text";
  value: string;
}

interface Msg91ButtonComponent {
  type: "text";
  subtype: "url";
  value: string;
}

export type Msg91TemplateComponents = Record<
  string,
  Msg91TextComponent | Msg91ButtonComponent
>;

export interface Msg91TemplatePayload {
  integrated_number: string;
  content_type: "template";
  payload: {
    messaging_product: "whatsapp";
    type: "template";
    template: {
      name: string;
      language: { code: string; policy: "deterministic" };
      namespace: string | null;
      to_and_components: Array<{
        to: string[];
        components: Msg91TemplateComponents;
      }>;
    };
  };
}

interface Msg91SendResponse {
  status?: unknown;
  type?: unknown;
  message?: unknown;
  request_id?: unknown;
  data?: { request_id?: unknown };
}

/**
 * Speaks the MSG91 WhatsApp outbound HTTP API and nothing else, so the
 * transport can be replaced without touching OTP or send semantics.
 */
@Injectable()
export class Msg91WhatsAppClient {
  private readonly logger = new Logger(Msg91WhatsAppClient.name);

  constructor(
    @Inject(whatsappConfig.KEY)
    private readonly config: ConfigType<typeof whatsappConfig>,
  ) {}

  async sendTemplate(
    request: WhatsAppProviderRequest,
    template: { name: string; components: Msg91TemplateComponents },
  ): Promise<WhatsAppProviderResult> {
    const {
      apiBaseUrl,
      sendPath,
      authKey,
      integratedNumber,
      namespace,
      templateLanguage,
      timeoutMs,
    } = this.config.msg91;

    if (!apiBaseUrl || !authKey || !integratedNumber)
      throw new WhatsAppIntegrationError(
        "MSG91 base URL, auth key, and integrated number are required",
        "CONFIGURATION_INVALID",
      );
    if (!template.name)
      throw new WhatsAppIntegrationError(
        "MSG91 WhatsApp template name is not configured",
        "TEMPLATE_UNCONFIGURED",
      );

    const number = normalizeWhatsAppNumber(request.to);
    if (!number)
      throw new WhatsAppIntegrationError(
        "WhatsApp recipient number is invalid",
        "INVALID_RECIPIENT",
      );

    const payload: Msg91TemplatePayload = {
      integrated_number: integratedNumber,
      content_type: "template",
      payload: {
        messaging_product: "whatsapp",
        type: "template",
        template: {
          name: template.name,
          language: { code: templateLanguage, policy: "deterministic" },
          namespace: namespace || null,
          to_and_components: [{ to: [number], components: template.components }],
        },
      },
    };

    const endpoint = `${apiBaseUrl.replace(/\/+$/, "")}/${sendPath.replace(/^\/+/, "")}`;
    const requestId = request.correlationId || request.idempotencyKey;
    // Carries neither the auth key, the template values, nor the raw number.
    const diagnostics = {
      provider: MSG91_PROVIDER_NAME,
      requestId,
      endpoint,
      method: "POST",
      templateName: template.name,
      templateLanguage,
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
          authkey: authKey,
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify(payload),
        signal: abort.signal,
      });
      const responseText = await response.text();
      let providerResponse: Msg91SendResponse = {};
      try {
        providerResponse = JSON.parse(responseText) as Msg91SendResponse;
      } catch {
        providerResponse = {};
      }

      const providerStatus = String(
        providerResponse.status ?? providerResponse.type ?? "",
      )
        .trim()
        .toLowerCase();
      const providerRejected = ["error", "fail", "failed", "failure"].includes(
        providerStatus,
      );

      if (!response.ok || providerRejected) {
        const error = this.classify(response.status, providerRejected);
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

      const providerMessageId =
        typeof providerResponse.request_id === "string"
          ? providerResponse.request_id
          : typeof providerResponse.data?.request_id === "string"
            ? providerResponse.data.request_id
            : undefined;

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
        provider: MSG91_PROVIDER_NAME,
        providerMessageId,
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
        timedOut ? "MSG91 request timed out" : "MSG91 request failed",
        timedOut ? "PROVIDER_TIMEOUT" : "PROVIDER_UNAVAILABLE",
        true,
        undefined,
        { cause: error },
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  /** Maps an HTTP failure onto the error taxonomy the router logs and reports. */
  private classify(
    httpStatus: number,
    providerRejected: boolean,
  ): WhatsAppIntegrationError {
    if (httpStatus === 401 || httpStatus === 403)
      return new WhatsAppIntegrationError(
        "MSG91 rejected the configured credentials",
        "CONFIGURATION_INVALID",
        false,
        httpStatus,
      );
    if (httpStatus === 429)
      return new WhatsAppIntegrationError(
        "MSG91 rate limit reached",
        "PROVIDER_RATE_LIMITED",
        true,
        httpStatus,
      );
    if (httpStatus === 408 || httpStatus === 425)
      return new WhatsAppIntegrationError(
        "MSG91 timed out",
        "PROVIDER_TIMEOUT",
        true,
        httpStatus,
      );
    if (httpStatus >= 500)
      return new WhatsAppIntegrationError(
        "MSG91 is temporarily unavailable",
        "PROVIDER_UNAVAILABLE",
        true,
        httpStatus,
      );
    if (httpStatus === 400 && !providerRejected)
      return new WhatsAppIntegrationError(
        "MSG91 rejected the request payload",
        "INVALID_REQUEST",
        false,
        httpStatus,
      );
    return new WhatsAppIntegrationError(
      "MSG91 rejected the WhatsApp message",
      "PROVIDER_REJECTED",
      false,
      httpStatus,
    );
  }
}
