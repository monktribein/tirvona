import { AkNexusWhatsAppProvider } from "./ak-nexus-whatsapp.provider";

const request = {
  to: "+919876543210",
  messageType: "auth_otp" as const,
  message: "Your Tirvona verification code is 123456.",
  idempotencyKey: "message:1",
};

describe("AkNexusWhatsAppProvider contract boundary", () => {
  it("does not call the client in dry-run mode", async () => {
    const client = { sendMessage: jest.fn() };
    const provider = new AkNexusWhatsAppProvider(
      client as never,
      { dryRun: true } as never,
    );
    await expect(provider.sendMessage(request)).resolves.toMatchObject({
      status: "skipped",
      reason: "dry_run",
    });
    expect(client.sendMessage).not.toHaveBeenCalled();
  });

  it("forwards non-dry-run messages to the AK NEXUS client", async () => {
    const client = {
      sendMessage: jest
        .fn()
        .mockResolvedValue({ status: "accepted", provider: "ak_nexus" }),
    };
    const provider = new AkNexusWhatsAppProvider(
      client as never,
      { dryRun: false } as never,
    );
    await expect(provider.sendMessage(request)).resolves.toMatchObject({
      status: "accepted",
    });
    expect(client.sendMessage).toHaveBeenCalledWith(request);
  });
});
