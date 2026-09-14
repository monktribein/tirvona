import { Injectable, Logger } from "@nestjs/common";
import {
  AK_NEXUS_PROVIDER_NAME,
  META_CLOUD_PROVIDER_NAME,
  MSG91_PROVIDER_NAME,
} from "../constants/whatsapp.constants";
import {
  WhatsAppAllProvidersFailedError,
  WhatsAppIntegrationError,
} from "../errors/whatsapp.errors";
import type {
  WhatsAppProviderRequest,
  WhatsAppProviderResult,
} from "../types/whatsapp.types";
import { AkNexusWhatsAppProvider } from "./ak-nexus/ak-nexus-whatsapp.provider";
import { MetaCloudWhatsAppProvider } from "./meta-cloud/meta-cloud-whatsapp.provider";
import { Msg91WhatsAppProvider } from "./msg91/msg91-whatsapp.provider";
import type { WhatsAppProvider } from "./whatsapp-provider.interface";

type LogContext = { messageType: string; requestId: string };

/**
 * Routes OTPs through Meta Cloud first while preserving MSG91 and AK NEXUS as
 * fallbacks. Non-OTP notifications follow the original MSG91 -> AK NEXUS path.
 * Each provider is attempted at most once per service-level retry.
 */
@Injectable()
export class WhatsAppProviderRouter implements WhatsAppProvider {
  private readonly logger = new Logger("WhatsApp");

  constructor(
    private readonly metaCloud: MetaCloudWhatsAppProvider,
    private readonly msg91: Msg91WhatsAppProvider,
    private readonly akNexus: AkNexusWhatsAppProvider,
  ) {}

  async sendMessage(
    request: WhatsAppProviderRequest,
  ): Promise<WhatsAppProviderResult> {
    const context: LogContext = {
      messageType: request.messageType,
      requestId: request.correlationId || request.idempotencyKey,
    };
    const failures: Array<{ provider: string; error: unknown }> = [];

    if (this.metaCloudEligible(request, context)) {
      const result = await this.attempt(
        META_CLOUD_PROVIDER_NAME,
        () => this.metaCloud.sendMessage(request),
        failures,
        context,
      );
      if (result) return result;
      this.logFallback(META_CLOUD_PROVIDER_NAME, MSG91_PROVIDER_NAME, context);
    }

    if (this.msg91Eligible(request, context)) {
      const result = await this.attempt(
        MSG91_PROVIDER_NAME,
        () => this.msg91.sendMessage(request),
        failures,
        context,
      );
      if (result) return result;
      this.logFallback(MSG91_PROVIDER_NAME, AK_NEXUS_PROVIDER_NAME, context);
    }

    try {
      const result = await this.akNexus.sendMessage(request);
      if (failures.length > 0)
        this.logSuccess(AK_NEXUS_PROVIDER_NAME, result, context, true);
      return result;
    } catch (error) {
      // Preserve the old behavior when neither template provider was attempted.
      if (failures.length === 0) throw error;
      failures.push({ provider: AK_NEXUS_PROVIDER_NAME, error });
      this.logFailure(AK_NEXUS_PROVIDER_NAME, error, context);
      this.logger.error(
        JSON.stringify({
          event: "whatsapp.all_providers_failed",
          message: "[WhatsApp] All WhatsApp providers failed",
          providers: failures.map((failure) => failure.provider),
          ...context,
        }),
      );
      throw new WhatsAppAllProvidersFailedError(
        failures,
        this.asIntegrationError(error),
      );
    }
  }

  private async attempt(
    provider: string,
    send: () => Promise<WhatsAppProviderResult>,
    failures: Array<{ provider: string; error: unknown }>,
    context: LogContext,
  ): Promise<WhatsAppProviderResult | undefined> {
    this.logAttempt(provider, context);
    try {
      const result = await send();
      this.logSuccess(provider, result, context);
      // Accepted and deliberate dry-run skips are both terminal, preventing a
      // fallback provider from sending the same OTP a second time.
      return result;
    } catch (error) {
      failures.push({ provider, error });
      this.logFailure(provider, error, context);
      return undefined;
    }
  }

  private metaCloudEligible(
    request: WhatsAppProviderRequest,
    context: LogContext,
  ): boolean {
    if (!this.metaCloud.isAvailable()) {
      this.logSkipped(
        META_CLOUD_PROVIDER_NAME,
        "Meta Cloud is not fully configured",
        context,
      );
      return false;
    }
    if (!this.metaCloud.supports(request.messageType)) {
      this.logSkipped(
        META_CLOUD_PROVIDER_NAME,
        "Meta Cloud does not handle this message type",
        context,
      );
      return false;
    }
    return true;
  }

  private msg91Eligible(
    request: WhatsAppProviderRequest,
    context: LogContext,
  ): boolean {
    if (!this.msg91.isAvailable()) {
      this.logSkipped(
        MSG91_PROVIDER_NAME,
        "MSG91 disabled or not configured",
        context,
      );
      return false;
    }
    if (!this.msg91.supports(request.messageType)) {
      this.logSkipped(
        MSG91_PROVIDER_NAME,
        "MSG91 has no approved template for this message",
        context,
      );
      return false;
    }
    return true;
  }

  private logAttempt(provider: string, context: LogContext): void {
    this.logger.log(
      JSON.stringify({
        event: "whatsapp.provider_attempt",
        message: `[WhatsApp] Attempting ${this.providerLabel(provider)} provider`,
        provider,
        ...context,
      }),
    );
  }

  private logSuccess(
    provider: string,
    result: WhatsAppProviderResult,
    context: LogContext,
    viaFallback = false,
  ): void {
    this.logger.log(
      JSON.stringify({
        event: "whatsapp.provider_result",
        message: `[WhatsApp] ${this.providerLabel(provider)} success`,
        provider,
        status: result.status,
        reason: result.reason,
        ...(viaFallback ? { viaFallback: true } : {}),
        ...context,
      }),
    );
  }

  private logFallback(from: string, to: string, context: LogContext): void {
    this.logger.warn(
      JSON.stringify({
        event: "whatsapp.provider_fallback",
        message:
          to === AK_NEXUS_PROVIDER_NAME
            ? "[WhatsApp] Falling back to existing REST provider"
            : `[WhatsApp] Falling back to ${this.providerLabel(to)} provider`,
        from,
        to,
        ...context,
      }),
    );
  }

  private logSkipped(
    provider: string,
    reason: string,
    context: LogContext,
  ): void {
    this.logger.debug?.(
      JSON.stringify({
        event: "whatsapp.provider_skipped",
        message: `[WhatsApp] ${reason}`,
        provider,
        ...context,
      }),
    );
  }

  /** Logs no credentials, message content, OTP, or raw recipient number. */
  private logFailure(
    provider: string,
    error: unknown,
    context: LogContext,
  ): void {
    const integrationError =
      error instanceof WhatsAppIntegrationError ? error : undefined;
    this.logger.error(
      JSON.stringify({
        event: "whatsapp.provider_failed",
        message: `[WhatsApp] ${this.providerLabel(provider)} failed`,
        provider,
        code: integrationError?.code ?? "UNEXPECTED",
        retryable: integrationError?.retryable ?? false,
        providerStatus: integrationError?.providerStatus,
        ...context,
      }),
    );
  }

  private providerLabel(provider: string): string {
    if (provider === META_CLOUD_PROVIDER_NAME) return "Meta Cloud";
    if (provider === MSG91_PROVIDER_NAME) return "MSG91";
    return "Existing REST provider";
  }

  private asIntegrationError(error: unknown): WhatsAppIntegrationError {
    return error instanceof WhatsAppIntegrationError
      ? error
      : new WhatsAppIntegrationError(
          "WhatsApp provider failed unexpectedly",
          "PROVIDER_UNAVAILABLE",
          true,
          undefined,
          { cause: error },
        );
  }
}
