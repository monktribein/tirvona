import { Inject, Injectable, Logger } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";
import { whatsappConfig } from "../../config/whatsapp.config";
import { META_CLOUD_PROVIDER_NAME } from "../../constants/whatsapp.constants";
import {
  WhatsAppDeliveryUnconfirmedError,
  WhatsAppIntegrationError,
} from "../../errors/whatsapp.errors";
import type {
  WhatsAppFollowUpImage,
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

export interface MetaTransactionalTemplate {
  name: string;
  language: string;
  parameterFormat: "positional" | "named";
  /** Ordered body parameters, already flattened and never empty. */
  parameters: ReadonlyArray<{ name: string; text: string }>;
  /** Uploaded media id for a template approved with an image header. */
  headerImageId?: string;
}

export interface MetaTransactionalTemplatePayload {
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
          parameters: Array<{
            type: "text";
            text: string;
            parameter_name?: string;
          }>;
        }
      | {
          type: "header";
          parameters: Array<{ type: "image"; image: { id: string } }>;
        }
    >;
  };
}

/**
 * Connection failures that prove the request never reached Meta, so trying
 * again cannot duplicate a message. Any other failure without a response is
 * ambiguous: Meta may have accepted the message before the connection died.
 */
const NOT_SENT_CAUSES = new Set([
  "ECONNREFUSED",
  "ENOTFOUND",
  "EAI_AGAIN",
  "ENETUNREACH",
  "EHOSTUNREACH",
  "UND_ERR_CONNECT_TIMEOUT",
]);

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

  /**
   * Sends one approved transactional template. Kept apart from the
   * authentication request so the working OTP path is left exactly as it is.
   *
   * A request that leaves without a confirming response raises
   * WhatsAppDeliveryUnconfirmedError instead of a retryable error, because
   * Meta may already have delivered it.
   */
  async sendTransactionalTemplate(
    request: WhatsAppProviderRequest,
    template: MetaTransactionalTemplate,
  ): Promise<WhatsAppProviderResult> {
    const {
      graphBaseUrl,
      apiVersion,
      accessToken,
      phoneNumberId,
      businessAccountId,
      timeoutMs,
    } = this.config.metaCloud;
    if (!apiVersion || !accessToken || !phoneNumberId || !businessAccountId)
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
    if (!template.name)
      throw new WhatsAppIntegrationError(
        "Meta transactional template is not configured",
        "TEMPLATE_UNCONFIGURED",
      );

    const endpoint = `${graphBaseUrl}/${apiVersion}/${phoneNumberId}/messages`;
    const payload: MetaTransactionalTemplatePayload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: number,
      type: "template",
      template: {
        name: template.name,
        language: { code: template.language },
        components: [
          ...(template.headerImageId
            ? [
                {
                  type: "header" as const,
                  parameters: [
                    {
                      type: "image" as const,
                      image: { id: template.headerImageId },
                    },
                  ],
                },
              ]
            : []),
          ...(template.parameters.length
            ? [
                {
                  type: "body" as const,
                  parameters: template.parameters.map((parameter) => ({
                    type: "text" as const,
                    text: parameter.text,
                    ...(template.parameterFormat === "named"
                      ? { parameter_name: parameter.name }
                      : {}),
                  })),
                },
              ]
            : []),
        ],
      },
    };
    // Parameter values carry guest details, so only their count is logged.
    const diagnostics = {
      provider: META_CLOUD_PROVIDER_NAME,
      requestId: request.correlationId || request.idempotencyKey,
      method: "POST",
      metaEvent: request.metaEvent,
      templateName: template.name,
      templateLanguage: template.language,
      parameterCount: template.parameters.length,
      // Whether an image header is attached; the media id is never logged.
      headerImage: Boolean(template.headerImageId),
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
      const causeCode = (error as { cause?: { code?: unknown } } | undefined)
        ?.cause?.code;
      const neverSent =
        !timedOut &&
        typeof causeCode === "string" &&
        NOT_SENT_CAUSES.has(causeCode);
      this.logger.error(
        JSON.stringify({
          event: "whatsapp.provider_error",
          ...diagnostics,
          httpStatus: null,
          providerStatus: neverSent
            ? "network_error"
            : timedOut
              ? "timeout_unconfirmed"
              : "unconfirmed",
        }),
      );
      if (neverSent)
        throw new WhatsAppIntegrationError(
          "Meta WhatsApp request failed before reaching Meta",
          "PROVIDER_UNAVAILABLE",
          true,
          undefined,
          { cause: error },
        );
      throw new WhatsAppDeliveryUnconfirmedError(META_CLOUD_PROVIDER_NAME, {
        cause: error,
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Uploads image bytes to the Cloud API and returns the media id. Uploading
   * sends nothing to the guest, so a failed upload is safe to report as an
   * ordinary error. The bytes and the returned id are never logged.
   */
  async uploadMedia(
    request: Pick<WhatsAppProviderRequest, "correlationId" | "idempotencyKey">,
    image: WhatsAppFollowUpImage,
  ): Promise<string> {
    const { graphBaseUrl, apiVersion, accessToken, phoneNumberId, businessAccountId, timeoutMs } =
      this.config.metaCloud;
    if (!apiVersion || !accessToken || !phoneNumberId || !businessAccountId)
      throw new WhatsAppIntegrationError(
        "Meta WhatsApp Cloud API configuration is incomplete",
        "CONFIGURATION_INVALID",
      );
    const diagnostics = {
      provider: META_CLOUD_PROVIDER_NAME,
      requestId: request.correlationId || request.idempotencyKey,
      mimeType: image.mimeType,
      bytes: image.data.length,
    } as const;
    const form = new FormData();
    form.append("messaging_product", "whatsapp");
    form.append("type", image.mimeType);
    form.append(
      "file",
      new Blob([new Uint8Array(image.data)], { type: image.mimeType }),
      image.filename,
    );

    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), timeoutMs);
    try {
      const response = await fetch(
        `${graphBaseUrl}/${apiVersion}/${phoneNumberId}/media`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, accept: "application/json" },
          body: form,
          signal: abort.signal,
        },
      );
      const body = (await response.json().catch(() => ({}))) as { id?: unknown };
      if (!response.ok) {
        const error = this.classify(response.status);
        this.logger.warn(
          JSON.stringify({
            event: "whatsapp.media_upload",
            ...diagnostics,
            httpStatus: response.status,
            providerStatus: "rejected",
            code: error.code,
          }),
        );
        throw error;
      }
      if (typeof body.id !== "string" || !body.id)
        throw new WhatsAppIntegrationError(
          "Meta did not return a media id for the uploaded image",
          "PROVIDER_REJECTED",
        );
      this.logger.log(
        JSON.stringify({
          event: "whatsapp.media_upload",
          ...diagnostics,
          httpStatus: response.status,
          providerStatus: "accepted",
        }),
      );
      return body.id;
    } catch (error) {
      if (error instanceof WhatsAppIntegrationError) throw error;
      this.logger.error(
        JSON.stringify({
          event: "whatsapp.media_upload",
          ...diagnostics,
          httpStatus: null,
          providerStatus: abort.signal.aborted ? "timeout" : "network_error",
        }),
      );
      throw new WhatsAppIntegrationError(
        "Meta media upload failed",
        abort.signal.aborted ? "PROVIDER_TIMEOUT" : "PROVIDER_UNAVAILABLE",
        true,
        undefined,
        { cause: error },
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Sends an uploaded image as a standalone message. Meta delivers a
   * non-template message only inside the 24-hour customer service window; a
   * send outside it is still accepted here and fails later on Meta's side.
   * A request left without a response raises WhatsAppDeliveryUnconfirmedError.
   */
  async sendImageMessage(
    request: WhatsAppProviderRequest,
    mediaId: string,
    caption?: string,
  ): Promise<WhatsAppProviderResult> {
    const { graphBaseUrl, apiVersion, accessToken, phoneNumberId, businessAccountId, timeoutMs } =
      this.config.metaCloud;
    if (!apiVersion || !accessToken || !phoneNumberId || !businessAccountId)
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
    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: number,
      type: "image",
      image: { id: mediaId, ...(caption ? { caption } : {}) },
    };
    // The caption carries booking details and the media id reaches the QR, so
    // neither is logged.
    const diagnostics = {
      provider: META_CLOUD_PROVIDER_NAME,
      requestId: request.correlationId || request.idempotencyKey,
      messageKind: "follow_up_image",
      maskedNumber: maskWhatsAppNumber(number),
    } as const;

    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), timeoutMs);
    try {
      const response = await fetch(
        `${graphBaseUrl}/${apiVersion}/${phoneNumberId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "content-type": "application/json",
            accept: "application/json",
          },
          body: JSON.stringify(payload),
          signal: abort.signal,
        },
      );
      const body = (await response.json().catch(() => ({}))) as MetaCloudResponse;
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
      const messageId = body.messages?.[0]?.id;
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
        providerMessageId: typeof messageId === "string" ? messageId : undefined,
      };
    } catch (error) {
      if (error instanceof WhatsAppIntegrationError) throw error;
      const timedOut = abort.signal.aborted;
      const causeCode = (error as { cause?: { code?: unknown } } | undefined)?.cause?.code;
      const neverSent =
        !timedOut && typeof causeCode === "string" && NOT_SENT_CAUSES.has(causeCode);
      this.logger.error(
        JSON.stringify({
          event: "whatsapp.provider_error",
          ...diagnostics,
          httpStatus: null,
          providerStatus: neverSent ? "network_error" : "unconfirmed",
        }),
      );
      if (neverSent)
        throw new WhatsAppIntegrationError(
          "Meta WhatsApp request failed before reaching Meta",
          "PROVIDER_UNAVAILABLE",
          true,
          undefined,
          { cause: error },
        );
      throw new WhatsAppDeliveryUnconfirmedError(META_CLOUD_PROVIDER_NAME, {
        cause: error,
      });
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
