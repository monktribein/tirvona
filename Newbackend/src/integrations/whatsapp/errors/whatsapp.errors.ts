export type WhatsAppErrorCode =
  | "CONFIGURATION_INVALID"
  | "TEMPLATE_UNCONFIGURED"
  | "TEMPLATE_REJECTED"
  | "INVALID_RECIPIENT"
  | "INVALID_REQUEST"
  | "PROVIDER_REJECTED"
  | "PROVIDER_TIMEOUT"
  | "PROVIDER_RATE_LIMITED"
  | "PROVIDER_UNAVAILABLE"
  | "DELIVERY_UNCONFIRMED";

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

/**
 * Raised when a transactional request left for the provider but no response
 * confirmed it: a timeout or a connection dropped after sending. The provider
 * may already have delivered the message, so it is neither retried nor handed
 * to a fallback provider, either of which could put a second copy on the
 * guest's phone.
 */
export class WhatsAppDeliveryUnconfirmedError extends WhatsAppIntegrationError {
  constructor(
    readonly provider: string,
    options?: ErrorOptions,
  ) {
    super(
      "WhatsApp delivery could not be confirmed",
      "DELIVERY_UNCONFIRMED",
      false,
      undefined,
      options,
    );
    this.name = "WhatsAppDeliveryUnconfirmedError";
  }
}
