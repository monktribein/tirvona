export type WhatsAppErrorCode =
  | "CONFIGURATION_INVALID"
  | "TEMPLATE_UNCONFIGURED"
  | "INVALID_RECIPIENT"
  | "PROVIDER_REJECTED"
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
