import { WhatsAppIntegrationError } from "../errors/whatsapp.errors";
import type { WhatsAppProvider } from "../providers/whatsapp-provider.interface";
import { WhatsAppTemplateService } from "./whatsapp-template.service";

const config = (overrides: Record<string, unknown> = {}) =>
  ({
    enabled: true,
    dryRun: false,
    provider: "ak_nexus",
    retry: { maxAttempts: 2, baseDelayMs: 1 },
    templates: {
      auth_otp: { name: "approved_otp", language: "en_US" },
    },
    ...overrides,
  }) as never;

describe("WhatsAppTemplateService", () => {
  it("never calls a provider while the integration is disabled", async () => {
    const provider = { sendMessage: jest.fn() } as WhatsAppProvider;
    const service = new WhatsAppTemplateService(
      provider,
      config({ enabled: false }),
    );

    await expect(
      service.send({
        to: "+919876543210",
        templateKey: "auth_otp",
        variables: { otp: "123456" },
        idempotencyKey: "otp:one",
      }),
    ).resolves.toMatchObject({ status: "skipped", reason: "integration_disabled" });
    expect(provider.sendMessage).not.toHaveBeenCalled();
  });

  it("passes only the provider-neutral template request to the adapter", async () => {
    const provider = {
      sendMessage: jest.fn().mockResolvedValue({
        status: "accepted",
        provider: "ak_nexus",
        providerMessageId: "provider-1",
      }),
    } as WhatsAppProvider;
    const service = new WhatsAppTemplateService(provider, config());

    await service.send({
      to: "+91 98765 43210",
      templateKey: "auth_otp",
      variables: { otp: "123456" },
      idempotencyKey: "otp:two",
    });

    expect(provider.sendMessage).toHaveBeenCalledWith({
      to: "919876543210",
      messageType: "auth_otp",
      message:
        "Your Tirvona verification code is 123456. It expires in 5 minutes. Do not share this code with anyone.",
      idempotencyKey: "otp:two",
    });
  });

  it("retries only errors explicitly marked retryable", async () => {
    const provider = {
      sendMessage: jest
        .fn()
        .mockRejectedValueOnce(
          new WhatsAppIntegrationError(
            "temporary outage",
            "PROVIDER_UNAVAILABLE",
            true,
          ),
        )
        .mockResolvedValueOnce({ status: "accepted", provider: "ak_nexus" }),
    } as WhatsAppProvider;
    const service = new WhatsAppTemplateService(provider, config());

    await expect(
      service.send({
        to: "+919876543210",
        templateKey: "auth_otp",
        variables: { otp: "123456" },
        idempotencyKey: "otp:retry",
      }),
    ).resolves.toMatchObject({ status: "accepted" });
    expect(provider.sendMessage).toHaveBeenCalledTimes(2);
  });

  it("normalizes a domestic Indian mobile to provider-safe country-code digits", async () => {
    const provider = {
      sendMessage: jest
        .fn()
        .mockResolvedValue({ status: "accepted", provider: "ak_nexus" }),
    } as WhatsAppProvider;
    const service = new WhatsAppTemplateService(provider, config());
    await expect(
      service.send({
        to: "98765 43210",
        templateKey: "auth_otp",
        variables: { otp: "123456", expires_in_minutes: 5 },
        idempotencyKey: "otp:india",
      }),
    ).resolves.toMatchObject({ status: "accepted" });
    expect(provider.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ to: "919876543210" }),
    );
  });

  it.each([
    ["+1 (415) 555-2671", "14155552671"],
    ["0044 20 7946 0958", "442079460958"],
  ])("accepts international number %s", async (phone, normalized) => {
    const provider = {
      sendMessage: jest
        .fn()
        .mockResolvedValue({ status: "accepted", provider: "ak_nexus" }),
    } as WhatsAppProvider;
    const service = new WhatsAppTemplateService(provider, config());
    await service.send({
      to: phone,
      templateKey: "auth_otp",
      variables: { otp: "123456" },
      idempotencyKey: `otp:${normalized}`,
    });
    expect(provider.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ to: normalized }),
    );
  });

  it("rejects malformed or ambiguous phone numbers before provider calls", async () => {
    const provider = { sendMessage: jest.fn() } as WhatsAppProvider;
    const service = new WhatsAppTemplateService(provider, config());
    await expect(
      service.send({
        to: "12345",
        templateKey: "auth_otp",
        variables: { otp: "123456" },
        idempotencyKey: "otp:invalid",
      }),
    ).rejects.toMatchObject({ code: "INVALID_RECIPIENT" });
    expect(provider.sendMessage).not.toHaveBeenCalled();
  });
});
