import { Inject, Injectable, Logger } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";
import { whatsappConfig } from "../../config/whatsapp.config";
import { WhatsAppIntegrationError } from "../../errors/whatsapp.errors";
import type {
  WhatsAppProviderRequest,
  WhatsAppProviderResult,
} from "../../types/whatsapp.types";
import {
  maskWhatsAppNumber,
  normalizeWhatsAppNumber,
} from "../../utils/whatsapp-phone.util";

interface AkNexusSendTextPayload {
  number: string;
  type: "text";
  message: string;
  instance_id: string;
  access_token: string;
}

@Injectable()
export class AkNexusWhatsAppClient {
  private readonly logger = new Logger(AkNexusWhatsAppClient.name);

  constructor(
    @Inject(whatsappConfig.KEY)
    private readonly config: ConfigType<typeof whatsappConfig>,
  ) {}

  async sendMessage(
    request: WhatsAppProviderRequest,
  ): Promise<WhatsAppProviderResult> {
    const { apiBaseUrl, sendPath, apiToken, accountId, timeoutMs } =
      this.config.akNexus;
    if (!apiBaseUrl || !apiToken || !accountId)
      throw new WhatsAppIntegrationError(
        "AK NEXUS base URL, access token, and instance ID are required",
        "CONFIGURATION_INVALID",
      );

    const number = normalizeWhatsAppNumber(request.to);
    if (!number)
      throw new WhatsAppIntegrationError(
        "WhatsApp recipient number is invalid",
        "INVALID_RECIPIENT",
      );
    const payload: AkNexusSendTextPayload = {
      number,
      type: "text",
      message: request.message,
      instance_id: accountId,
      access_token: apiToken,
    };
    const endpoint = `${apiBaseUrl.replace(/\/+$/, "")}/${sendPath}`;
    const requestId = request.correlationId || request.idempotencyKey;
    const diagnostics = {
      provider: "ak_nexus",
      requestId,
      endpoint,
      method: "POST",
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
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        signal: abort.signal,
      });
      await response.text();
      if (!response.ok) {
        const retryable =
          response.status === 408 ||
          response.status === 425 ||
          response.status === 429 ||
          response.status >= 500;
        this.logger.warn(
          JSON.stringify({
            event: "whatsapp.provider_response",
            ...diagnostics,
            httpStatus: response.status,
            providerStatus: retryable ? "transient_error" : "rejected",
          }),
        );
        throw new WhatsAppIntegrationError(
          retryable
            ? "AK NEXUS is temporarily unavailable"
            : "AK NEXUS rejected the WhatsApp message",
          retryable ? "PROVIDER_UNAVAILABLE" : "PROVIDER_REJECTED",
          retryable,
          response.status,
        );
      }
      this.logger.log(
        JSON.stringify({
          event: "whatsapp.provider_accepted",
          ...diagnostics,
          httpStatus: response.status,
          providerStatus: "accepted",
        }),
      );
      return { status: "accepted", provider: "ak_nexus" };
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
          ? "AK NEXUS request timed out"
          : "AK NEXUS request failed",
        "PROVIDER_UNAVAILABLE",
        true,
        undefined,
        { cause: error },
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
