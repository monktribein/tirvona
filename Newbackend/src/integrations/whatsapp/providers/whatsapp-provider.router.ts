import { Injectable, Logger } from "@nestjs/common";
import {
  AK_NEXUS_PROVIDER_NAME,
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
import { Msg91WhatsAppProvider } from "./msg91/msg91-whatsapp.provider";
import type { WhatsAppProvider } from "./whatsapp-provider.interface";

/**
 * Chooses which WhatsApp provider delivers a message.
 *
 * MSG91 is primary whenever it is enabled, credentialed, and has an approved
 * template for the message type. AK NEXUS remains the fallback and keeps
 * serving every send unchanged when MSG91 is off or unavailable.
 *
 * Each provider is attempted at most once per send, so no provider loop can
 * form here. The retry policy already owned by WhatsAppTemplateService stays
 * the only place that repeats a send.
 */
@Injectable()
export class WhatsAppProviderRouter implements WhatsAppProvider {
  private readonly logger = new Logger("WhatsApp");

  constructor(
    private readonly msg91: Msg91WhatsAppProvider,
    private readonly akNexus: AkNexusWhatsAppProvider,
  ) {}

  async sendMessage(
    request: WhatsAppProviderRequest,
  ): Promise<WhatsAppProviderResult> {
    const context = {
      messageType: request.messageType,
      requestId: request.correlationId || request.idempotencyKey,
    };

    if (!this.msg91Eligible(request, context))
      // MSG91 was never attempted, so the fallback behaves — and fails —
      // exactly as it did before MSG91 existed.
      return this.akNexus.sendMessage(request);

    this.logger.log(
      JSON.stringify({
        event: "whatsapp.provider_attempt",
        message: "[WhatsApp] Attempting MSG91 provider",
        provider: MSG91_PROVIDER_NAME,
        ...context,
      }),
    );

    try {
      const result = await this.msg91.sendMessage(request);
      this.logger.log(
        JSON.stringify({
          event: "whatsapp.provider_result",
          message: "[WhatsApp] MSG91 success",
          provider: MSG91_PROVIDER_NAME,
          status: result.status,
          reason: result.reason,
          ...context,
        }),
      );
      // A success — or a deliberate skip such as dry-run — is terminal. The
      // fallback is never called, so a second message can never go out.
      return result;
    } catch (msg91Error) {
      this.logFailure(MSG91_PROVIDER_NAME, msg91Error, context);
      this.logger.warn(
        JSON.stringify({
          event: "whatsapp.provider_fallback",
          message: "[WhatsApp] Falling back to existing REST provider",
          from: MSG91_PROVIDER_NAME,
          to: AK_NEXUS_PROVIDER_NAME,
          ...context,
        }),
      );

      try {
        const result = await this.akNexus.sendMessage(request);
        this.logger.log(
          JSON.stringify({
            event: "whatsapp.provider_result",
            message: "[WhatsApp] Existing REST provider success",
            provider: AK_NEXUS_PROVIDER_NAME,
            status: result.status,
            reason: result.reason,
            viaFallback: true,
            ...context,
          }),
        );
        return result;
      } catch (fallbackError) {
        this.logFailure(AK_NEXUS_PROVIDER_NAME, fallbackError, context);
        this.logger.error(
          JSON.stringify({
            event: "whatsapp.all_providers_failed",
            message: "[WhatsApp] All WhatsApp providers failed",
            providers: [MSG91_PROVIDER_NAME, AK_NEXUS_PROVIDER_NAME],
            ...context,
          }),
        );
        throw new WhatsAppAllProvidersFailedError(
          [
            { provider: MSG91_PROVIDER_NAME, error: msg91Error },
            { provider: AK_NEXUS_PROVIDER_NAME, error: fallbackError },
          ],
          this.asIntegrationError(fallbackError),
        );
      }
    }
  }

  private msg91Eligible(
    request: WhatsAppProviderRequest,
    context: { messageType: string; requestId: string },
  ): boolean {
    if (!this.msg91.isAvailable()) {
      this.logger.debug?.(
        JSON.stringify({
          event: "whatsapp.provider_skipped",
          message: "[WhatsApp] MSG91 disabled or not configured",
          provider: MSG91_PROVIDER_NAME,
          ...context,
        }),
      );
      return false;
    }
    if (!this.msg91.supports(request.messageType)) {
      this.logger.debug?.(
        JSON.stringify({
          event: "whatsapp.provider_skipped",
          message: "[WhatsApp] MSG91 has no approved template for this message",
          provider: MSG91_PROVIDER_NAME,
          ...context,
        }),
      );
      return false;
    }
    return true;
  }

  /** Logs why a provider failed without leaking credentials or message content. */
  private logFailure(
    provider: string,
    error: unknown,
    context: { messageType: string; requestId: string },
  ): void {
    const integrationError =
      error instanceof WhatsAppIntegrationError ? error : undefined;
    this.logger.error(
      JSON.stringify({
        event: "whatsapp.provider_failed",
        message:
          provider === MSG91_PROVIDER_NAME
            ? "[WhatsApp] MSG91 failed"
            : "[WhatsApp] Existing REST provider failed",
        provider,
        code: integrationError?.code ?? "UNEXPECTED",
        retryable: integrationError?.retryable ?? false,
        providerStatus: integrationError?.providerStatus,
        ...context,
      }),
    );
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
