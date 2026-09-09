export type WhatsAppErrorCode =
  | "CONFIGURATION_INVALID"
  | "TEMPLATE_UNCONFIGURED"
  | "TEMPLATE_REJECTED"
  | "INVALID_RECIPIENT"
  | "INVALID_REQUEST"
  | "PROVIDER_REJECTED"
  | "PROVIDER_TIMEOUT"
  | "PROVIDER_RATE_LIMITED"
  | "PROVIDER_UNAVAILABLE";

export class WhatsAppIntegrationError extends Error {
  constructor(
    message: string,
    readonly code: WhatsAppErrorCode,
    readonly retryable = false,
    readonly providerStatus?: number,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "WhatsAppIntegrationError";
  }
}

/**
 * Raised when every configured WhatsApp provider failed for a single send.
 * Each provider's own error is preserved on `failures` so the original context
 * survives for debugging without any of it reaching the caller's response.
 */
export class WhatsAppAllProvidersFailedError extends WhatsAppIntegrationError {
  constructor(
    readonly failures: ReadonlyArray<{ provider: string; error: unknown }>,
    lastError: WhatsAppIntegrationError,
  ) {
    super(
      "All WhatsApp providers failed to deliver the message",
      lastError.code,
      lastError.retryable,
      lastError.providerStatus,
      { cause: lastError },
    );
    this.name = "WhatsAppAllProvidersFailedError";
  }
}
