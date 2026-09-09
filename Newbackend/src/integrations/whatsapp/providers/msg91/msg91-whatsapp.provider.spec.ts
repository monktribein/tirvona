import type { WhatsAppProviderRequest } from "../../types/whatsapp.types";
import { Msg91WhatsAppProvider } from "./msg91-whatsapp.provider";

const request: WhatsAppProviderRequest = {
  to: "+919876543210",
  messageType: "auth_otp",
  message: "Your Tirvona verification code is 123456.",
  idempotencyKey: "auth-otp:1",
  templateVariables: { otp: "123456", expires_in_minutes: 5 },
};

const config = (overrides: Record<string, unknown> = {}) =>
  ({
    dryRun: false,
    msg91: {
      enabled: true,
      authKey: "auth-key",
      integratedNumber: "919000000000",
      templates: {
        auth_otp: {
          name: "tirvona_otp",
          bodyVariables: ["otp"],
          copyCodeButton: false,
        },
      },
      ...overrides,
    },
  }) as never;

describe("Msg91WhatsAppProvider", () => {
  it("is unavailable when disabled or missing credentials", () => {
    const client = { sendTemplate: jest.fn() };
    expect(
      new Msg91WhatsAppProvider(
        client as never,
        config({ enabled: false }),
      ).isAvailable(),
    ).toBe(false);
    expect(
      new Msg91WhatsAppProvider(
        client as never,
        config({ authKey: "" }),
      ).isAvailable(),
    ).toBe(false);
    expect(
      new Msg91WhatsAppProvider(
        client as never,
        config({ integratedNumber: "" }),
      ).isAvailable(),
    ).toBe(false);
    expect(
      new Msg91WhatsAppProvider(client as never, config()).isAvailable(),
    ).toBe(true);
  });

  it("reports which message types have an approved template", () => {
    const provider = new Msg91WhatsAppProvider(
      { sendTemplate: jest.fn() } as never,
      config(),
    );
    expect(provider.supports("auth_otp")).toBe(true);
    expect(provider.supports("booking_confirmation")).toBe(false);
  });

  it("does not call the client in dry-run mode", async () => {
    const client = { sendTemplate: jest.fn() };
    const provider = new Msg91WhatsAppProvider(client as never, {
      ...(config() as unknown as object),
      dryRun: true,
    } as never);

    await expect(provider.sendMessage(request)).resolves.toMatchObject({
      status: "skipped",
      reason: "dry_run",
    });
    expect(client.sendTemplate).not.toHaveBeenCalled();
  });

  it("sends the OTP Tirvona generated through the approved template", async () => {
    const client = {
      sendTemplate: jest
        .fn()
        .mockResolvedValue({ status: "accepted", provider: "msg91" }),
    };
    const provider = new Msg91WhatsAppProvider(client as never, config());

    await expect(provider.sendMessage(request)).resolves.toMatchObject({
      status: "accepted",
      provider: "msg91",
    });
    expect(client.sendTemplate).toHaveBeenCalledWith(request, {
      name: "tirvona_otp",
      components: { body_1: { type: "text", value: "123456" } },
    });
  });

  it("fills ordered body placeholders when the template takes more variables", async () => {
    const client = {
      sendTemplate: jest
        .fn()
        .mockResolvedValue({ status: "accepted", provider: "msg91" }),
    };
    const provider = new Msg91WhatsAppProvider(
      client as never,
      config({
        templates: {
          auth_otp: {
            name: "tirvona_otp",
            bodyVariables: ["otp", "expires_in_minutes"],
            copyCodeButton: true,
          },
        },
      }),
    );

    await provider.sendMessage(request);

    expect(client.sendTemplate.mock.calls[0][1].components).toEqual({
      body_1: { type: "text", value: "123456" },
      body_2: { type: "text", value: "5" },
      button_1: { type: "text", subtype: "url", value: "123456" },
    });
  });

  it("fails with a template error when a required variable is missing", async () => {
    const provider = new Msg91WhatsAppProvider(
      { sendTemplate: jest.fn() } as never,
      config(),
    );

    await expect(
      provider.sendMessage({ ...request, templateVariables: {} }),
    ).rejects.toMatchObject({ code: "TEMPLATE_REJECTED" });
  });

  it("fails with TEMPLATE_UNCONFIGURED for an unmapped message type", async () => {
    const provider = new Msg91WhatsAppProvider(
      { sendTemplate: jest.fn() } as never,
      config(),
    );

    await expect(
      provider.sendMessage({ ...request, messageType: "refund" }),
    ).rejects.toMatchObject({ code: "TEMPLATE_UNCONFIGURED" });
  });
});
