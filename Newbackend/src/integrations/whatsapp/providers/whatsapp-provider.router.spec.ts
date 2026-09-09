import { WhatsAppIntegrationError } from "../errors/whatsapp.errors";
import type { WhatsAppProviderRequest } from "../types/whatsapp.types";
import { WhatsAppProviderRouter } from "./whatsapp-provider.router";

const request: WhatsAppProviderRequest = {
  to: "+919876543210",
  messageType: "auth_otp",
  message: "Your Tirvona verification code is 123456.",
  idempotencyKey: "auth-otp:1",
  templateVariables: { otp: "123456", expires_in_minutes: 5 },
};

const msg91Stub = (overrides: Partial<Record<string, unknown>> = {}) => ({
  isAvailable: jest.fn().mockReturnValue(true),
  supports: jest.fn().mockReturnValue(true),
  sendMessage: jest
    .fn()
    .mockResolvedValue({ status: "accepted", provider: "msg91" }),
  ...overrides,
});

const akNexusStub = () => ({
  sendMessage: jest
    .fn()
    .mockResolvedValue({ status: "accepted", provider: "ak_nexus" }),
});

const routerWith = (
  msg91: ReturnType<typeof msg91Stub>,
  akNexus: ReturnType<typeof akNexusStub>,
) => new WhatsAppProviderRouter(msg91 as never, akNexus as never);

describe("WhatsAppProviderRouter", () => {
  it("uses MSG91 and never calls the fallback when MSG91 succeeds", async () => {
    const msg91 = msg91Stub();
    const akNexus = akNexusStub();

    await expect(routerWith(msg91, akNexus).sendMessage(request)).resolves
      .toMatchObject({ status: "accepted", provider: "msg91" });

    expect(msg91.sendMessage).toHaveBeenCalledTimes(1);
    expect(akNexus.sendMessage).not.toHaveBeenCalled();
  });

  it("falls back to the existing REST provider when MSG91 errors", async () => {
    const msg91 = msg91Stub({
      sendMessage: jest
        .fn()
        .mockRejectedValue(
          new WhatsAppIntegrationError("boom", "PROVIDER_REJECTED"),
        ),
    });
    const akNexus = akNexusStub();

    await expect(routerWith(msg91, akNexus).sendMessage(request)).resolves
      .toMatchObject({ status: "accepted", provider: "ak_nexus" });

    expect(msg91.sendMessage).toHaveBeenCalledTimes(1);
    expect(akNexus.sendMessage).toHaveBeenCalledTimes(1);
    expect(akNexus.sendMessage).toHaveBeenCalledWith(request);
  });

  it("falls back when MSG91 times out", async () => {
    const msg91 = msg91Stub({
      sendMessage: jest
        .fn()
        .mockRejectedValue(
          new WhatsAppIntegrationError(
            "MSG91 request timed out",
            "PROVIDER_TIMEOUT",
            true,
          ),
        ),
    });
    const akNexus = akNexusStub();

    await expect(routerWith(msg91, akNexus).sendMessage(request)).resolves
      .toMatchObject({ provider: "ak_nexus" });
    expect(akNexus.sendMessage).toHaveBeenCalledTimes(1);
  });

  it("goes straight to the existing provider when MSG91 is disabled", async () => {
    const msg91 = msg91Stub({ isAvailable: jest.fn().mockReturnValue(false) });
    const akNexus = akNexusStub();

    await expect(routerWith(msg91, akNexus).sendMessage(request)).resolves
      .toMatchObject({ provider: "ak_nexus" });

    expect(msg91.sendMessage).not.toHaveBeenCalled();
    expect(akNexus.sendMessage).toHaveBeenCalledTimes(1);
  });

  it("goes straight to the existing provider when MSG91 credentials are missing", async () => {
    // isAvailable() is the provider's own credential check, so a
    // misconfigured MSG91 is skipped rather than failing the send.
    const msg91 = msg91Stub({ isAvailable: jest.fn().mockReturnValue(false) });
    const akNexus = akNexusStub();

    await expect(routerWith(msg91, akNexus).sendMessage(request)).resolves
      .toMatchObject({ provider: "ak_nexus" });
    expect(msg91.sendMessage).not.toHaveBeenCalled();
  });

  it("skips MSG91 when it has no approved template for the message type", async () => {
    const msg91 = msg91Stub({ supports: jest.fn().mockReturnValue(false) });
    const akNexus = akNexusStub();

    await expect(routerWith(msg91, akNexus).sendMessage(request)).resolves
      .toMatchObject({ provider: "ak_nexus" });
    expect(msg91.sendMessage).not.toHaveBeenCalled();
  });

  it("prefers MSG91 when both providers would succeed", async () => {
    const msg91 = msg91Stub();
    const akNexus = akNexusStub();

    const result = await routerWith(msg91, akNexus).sendMessage(request);

    expect(result.provider).toBe("msg91");
    expect(akNexus.sendMessage).not.toHaveBeenCalled();
  });

  it("treats a MSG91 dry-run skip as terminal so no duplicate is sent", async () => {
    const msg91 = msg91Stub({
      sendMessage: jest.fn().mockResolvedValue({
        status: "skipped",
        provider: "msg91",
        reason: "dry_run",
      }),
    });
    const akNexus = akNexusStub();

    await expect(routerWith(msg91, akNexus).sendMessage(request)).resolves
      .toMatchObject({ status: "skipped", reason: "dry_run" });
    expect(akNexus.sendMessage).not.toHaveBeenCalled();
  });

  it("reports a final error and logs both failures when both providers fail", async () => {
    const msg91 = msg91Stub({
      sendMessage: jest
        .fn()
        .mockRejectedValue(
          new WhatsAppIntegrationError("msg91 down", "PROVIDER_UNAVAILABLE", true),
        ),
    });
    const akNexus = {
      sendMessage: jest
        .fn()
        .mockRejectedValue(
          new WhatsAppIntegrationError("ak down", "PROVIDER_REJECTED"),
        ),
    };
    const router = routerWith(msg91, akNexus as never);
    const logger = (router as unknown as { logger: { error: jest.Mock } })
      .logger;
    jest.spyOn(logger, "error").mockImplementation(() => undefined);

    await expect(router.sendMessage(request)).rejects.toMatchObject({
      name: "WhatsAppAllProvidersFailedError",
      failures: [
        { provider: "msg91" },
        { provider: "ak_nexus" },
      ],
    });

    const logged = logger.error.mock.calls.map((call) => String(call[0]));
    expect(logged.some((line) => line.includes("[WhatsApp] MSG91 failed"))).toBe(
      true,
    );
    expect(
      logged.some((line) =>
        line.includes("[WhatsApp] Existing REST provider failed"),
      ),
    ).toBe(true);
    expect(
      logged.some((line) =>
        line.includes("[WhatsApp] All WhatsApp providers failed"),
      ),
    ).toBe(true);
  });

  it("never logs the OTP or the raw recipient number", async () => {
    const msg91 = msg91Stub({
      sendMessage: jest
        .fn()
        .mockRejectedValue(
          new WhatsAppIntegrationError("boom", "PROVIDER_REJECTED"),
        ),
    });
    const router = routerWith(msg91, akNexusStub());
    const logger = (
      router as unknown as {
        logger: { log: jest.Mock; warn: jest.Mock; error: jest.Mock };
      }
    ).logger;
    const lines: string[] = [];
    for (const level of ["log", "warn", "error"] as const)
      jest.spyOn(logger, level).mockImplementation((line: unknown) => {
        lines.push(String(line));
      });

    await router.sendMessage(request);

    expect(lines.join("\n")).not.toContain("123456");
    expect(lines.join("\n")).not.toContain("9876543210");
  });
});
