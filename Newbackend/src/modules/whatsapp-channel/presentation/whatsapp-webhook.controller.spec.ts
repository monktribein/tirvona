import { UnauthorizedException } from "@nestjs/common";
import { WhatsAppWebhookController } from "./whatsapp-webhook.controller";

/**
 * Controller-level coverage for the one property that must hold regardless
 * of `WHATSAPP_CONVERSATION_ENABLED`: an unsigned or wrongly-signed delivery
 * is rejected before `receive()` is ever called. `WhatsAppWebhookService`'s
 * own spec covers `verifySignature`'s HMAC logic in detail; this file proves
 * the controller actually calls it and stops on a false result — the
 * conversation flag has no way to skip that check, because it is read inside
 * `receive()`, which this test shows is unreachable without a valid signature
 * first.
 */
const buildController = (overrides: Record<string, any> = {}) => {
  const webhook = {
    verifySubscription: jest.fn(() => "challenge-echo"),
    verifySignature: jest.fn(() => true),
    extractMessages: jest.fn((): any[] => []),
    receive: jest.fn(async () => "queued"),
    ...overrides,
  };
  const controller = new WhatsAppWebhookController(webhook as any);
  return { controller, webhook };
};

const request = (body: unknown = {}) =>
  ({ rawBody: Buffer.from(JSON.stringify(body)), body }) as any;

describe("signature enforcement is independent of the conversation flag", () => {
  it("rejects the delivery and never calls receive() when the signature is invalid", async () => {
    const { controller, webhook } = buildController({
      verifySignature: jest.fn(() => false),
    });
    await expect(
      controller.handle(request({}), "sha256=wrong"),
    ).rejects.toThrow(UnauthorizedException);
    expect(webhook.receive).not.toHaveBeenCalled();
  });

  it("processes messages once the signature is valid, whatever the conversation flag ends up doing with them", async () => {
    // Whether the message is actually run through the conversation engine or
    // recorded as "ignored" is WhatsAppWebhookService.receive()'s decision —
    // the controller's only job is to gate on the signature and forward.
    const { controller, webhook } = buildController();
    const message = {
      messageId: "wamid.1",
      phone: "919876543210",
      profileName: "Asha",
      messageType: "text",
      text: "Hi",
      replyId: "",
      sentAt: new Date(),
    };
    webhook.extractMessages.mockReturnValue([message]);
    await controller.handle(request({ entry: [] }), "sha256=valid");
    expect(webhook.receive).toHaveBeenCalledWith(message);
  });

  it("still returns 200 to Meta even if one message in the batch fails to record", async () => {
    // A thrown error here must not cost the delivery its 2xx, or Meta
    // redelivers the whole batch including messages already recorded.
    const { controller, webhook } = buildController();
    webhook.extractMessages.mockReturnValue([
      {
        messageId: "wamid.bad",
        phone: "919876543210",
        profileName: "",
        messageType: "text",
        text: "hi",
        replyId: "",
        sentAt: new Date(),
      },
    ]);
    webhook.receive.mockRejectedValue(new Error("db unavailable"));
    await expect(
      controller.handle(request({}), "sha256=valid"),
    ).resolves.toEqual({ success: true });
  });
});

describe("subscription handshake", () => {
  it("rejects verification failure with 403", async () => {
    const { controller } = buildController({
      verifySubscription: jest.fn(() => null),
    });
    expect(() => controller.verify("subscribe", "wrong", "123")).toThrow();
  });

  it("echoes Meta's challenge on success", () => {
    const { controller } = buildController();
    expect(controller.verify("subscribe", "right", "123")).toBe(
      "challenge-echo",
    );
  });
});
