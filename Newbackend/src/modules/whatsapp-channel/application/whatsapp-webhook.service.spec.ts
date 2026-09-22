import { createHmac } from "node:crypto";
import { WhatsAppWebhookService } from "./whatsapp-webhook.service";

const APP_SECRET = "test-app-secret";
const VERIFY_TOKEN = "test-verify-token";

const config = (overrides: Record<string, unknown> = {}) =>
  ({
    enabled: true,
    dryRun: false,
    testMode: false,
    testRecipients: [],
    conversation: {
      enabled: true,
      verifyToken: VERIFY_TOKEN,
      appSecret: APP_SECRET,
      nluEnabled: false,
      ...(overrides.conversation as object),
    },
  }) as any;

const build = (overrides: Record<string, unknown> = {}) => {
  const rows: any[] = [];
  const events = {
    rows,
    create: jest.fn(async (row: any): Promise<any> => {
      if (rows.some((existing: any) => existing.messageId === row.messageId)) {
        const error: any = new Error("duplicate key");
        error.code = 11000;
        throw error;
      }
      const created: any = { ...row, _id: `event-${rows.length + 1}` };
      rows.push(created);
      return created;
    }),
    updateOne: jest.fn(async () => ({ modifiedCount: 1 })),
  };
  const queue = {
    add: jest.fn(
      async (
        _name: string,
        _data: unknown,
        _options: Record<string, unknown>,
      ) => ({ id: "job-1" }),
    ),
  };
  const service = new WhatsAppWebhookService(
    config(overrides),
    events as any,
    queue as any,
  );
  return { service, events, queue };
};

const sign = (body: string, secret = APP_SECRET): string =>
  `sha256=${createHmac("sha256", secret).update(Buffer.from(body)).digest("hex")}`;

describe("subscription verification", () => {
  it("echoes the challenge for the right token", () => {
    const { service } = build();
    expect(service.verifySubscription("subscribe", VERIFY_TOKEN, "12345")).toBe(
      "12345",
    );
  });

  it("refuses a wrong token", () => {
    const { service } = build();
    expect(service.verifySubscription("subscribe", "wrong", "12345")).toBeNull();
  });

  it("refuses a token of a different length without throwing", () => {
    // timingSafeEqual throws on mismatched lengths, so the length has to be
    // checked first or a short token crashes the public endpoint.
    const { service } = build();
    expect(service.verifySubscription("subscribe", "x", "12345")).toBeNull();
  });

  it("refuses a mode that is not subscribe", () => {
    const { service } = build();
    expect(
      service.verifySubscription("unsubscribe", VERIFY_TOKEN, "12345"),
    ).toBeNull();
  });

  it("refuses everything when no verify token is configured", () => {
    const { service } = build({ conversation: { verifyToken: "" } });
    expect(service.verifySubscription("subscribe", "", "12345")).toBeNull();
  });
});

describe("payload signature verification", () => {
  const body = JSON.stringify({ object: "whatsapp_business_account" });

  it("accepts a correctly signed body", () => {
    const { service } = build();
    expect(service.verifySignature(Buffer.from(body), sign(body))).toBe(true);
  });

  it("rejects a body signed with the wrong secret", () => {
    const { service } = build();
    expect(
      service.verifySignature(Buffer.from(body), sign(body, "other-secret")),
    ).toBe(false);
  });

  it("rejects a tampered body", () => {
    const { service } = build();
    const signature = sign(body);
    expect(
      service.verifySignature(Buffer.from(`${body} `), signature),
    ).toBe(false);
  });

  it("rejects a signature without the sha256 prefix", () => {
    const { service } = build();
    const bare = createHmac("sha256", APP_SECRET)
      .update(Buffer.from(body))
      .digest("hex");
    expect(service.verifySignature(Buffer.from(body), bare)).toBe(false);
  });

  it("rejects when the raw body is unavailable", () => {
    const { service } = build();
    expect(service.verifySignature(undefined, sign(body))).toBe(false);
  });

  it("rejects everything when no app secret is configured", () => {
    // Falling open here would let anyone who knows the URL forge a message
    // from any phone number.
    const { service } = build({ conversation: { appSecret: "" } });
    expect(service.verifySignature(Buffer.from(body), sign(body))).toBe(false);
  });
});

describe("message extraction", () => {
  const envelope = (messages: any[], contacts: any[] = []) => ({
    entry: [{ changes: [{ value: { messages, contacts } }] }],
  });

  it("reads a text message and the sender profile", () => {
    const { service } = build();
    const [message] = service.extractMessages(
      envelope(
        [
          {
            id: "wamid.1",
            from: "919876543210",
            type: "text",
            timestamp: "1789603200",
            text: { body: "room chahiye" },
          },
        ],
        [{ wa_id: "919876543210", profile: { name: "Asha" } }],
      ),
    );
    expect(message).toMatchObject({
      messageId: "wamid.1",
      phone: "919876543210",
      profileName: "Asha",
      messageType: "text",
      text: "room chahiye",
      replyId: "",
    });
  });

  it("reads the id behind a tapped list row", () => {
    const { service } = build();
    const [message] = service.extractMessages(
      envelope([
        {
          id: "wamid.2",
          from: "919876543210",
          type: "interactive",
          interactive: {
            type: "list_reply",
            list_reply: { id: "menu:stay", title: "Book a stay" },
          },
        },
      ]),
    );
    expect(message.replyId).toBe("menu:stay");
    expect(message.text).toBe("Book a stay");
  });

  it("reads the id behind a tapped button", () => {
    const { service } = build();
    const [message] = service.extractMessages(
      envelope([
        {
          id: "wamid.3",
          from: "919876543210",
          type: "interactive",
          interactive: {
            type: "button_reply",
            button_reply: { id: "confirm:yes", title: "Haan" },
          },
        },
      ]),
    );
    expect(message.replyId).toBe("confirm:yes");
  });

  it("ignores delivery status callbacks", () => {
    // These arrive on the same webhook and belong to the transactional
    // pipeline; treating one as a guest message would start a conversation.
    const { service } = build();
    expect(
      service.extractMessages({
        entry: [{ changes: [{ value: { statuses: [{ id: "x", status: "read" }] } }] }],
      }),
    ).toEqual([]);
  });

  it("ignores a malformed entry rather than throwing", () => {
    const { service } = build();
    expect(service.extractMessages({})).toEqual([]);
    expect(service.extractMessages({ entry: [{}] })).toEqual([]);
    expect(
      service.extractMessages(envelope([{ type: "text" }])),
    ).toEqual([]);
  });
});

describe("idempotency", () => {
  const message = {
    messageId: "wamid.dup",
    phone: "919876543210",
    profileName: "Asha",
    messageType: "text",
    text: "hi",
    replyId: "",
    sentAt: new Date(),
  };

  it("queues a message the first time", async () => {
    const { service, queue } = build();
    await expect(service.receive(message)).resolves.toBe("queued");
    expect(queue.add).toHaveBeenCalledTimes(1);
  });

  it("processes a message through to the queue when WHATSAPP_CONVERSATION_ENABLED is true", async () => {
    // Pins the exact regression this guards against: with the flag on, "Hi"
    // must reach the inbound queue, not be logged as
    // {"event":"whatsapp.inbound_skipped","reason":"conversation_disabled"}.
    const { service, queue, events } = build({
      conversation: { enabled: true },
    });
    await service.receive({ ...message, text: "Hi" });
    expect(queue.add).toHaveBeenCalledTimes(1);
    expect(events.updateOne).toHaveBeenCalledWith(
      { _id: "event-1" },
      { $set: expect.objectContaining({ status: "queued" }) },
    );
    expect(events.updateOne).not.toHaveBeenCalledWith(
      expect.anything(),
      { $set: expect.objectContaining({ status: "ignored" }) },
    );
  });

  it("does not queue a redelivery of the same message", async () => {
    // Meta redelivers freely. A second job would run the action again, which
    // for a confirmation tap would mean a second booking.
    const { service, queue } = build();
    await service.receive(message);
    await expect(service.receive(message)).resolves.toBe("duplicate");
    expect(queue.add).toHaveBeenCalledTimes(1);
  });

  it("uses a stable job id so BullMQ dedupes too", async () => {
    const { service, queue } = build();
    await service.receive(message);
    expect(queue.add.mock.calls[0][2]).toMatchObject({
      jobId: "wa-inbound-wamid.dup",
    });
  });

  it("records the delivery but runs nothing when the conversation is off", async () => {
    // The flag must not leave a backlog that flushes at customers when it is
    // later switched on.
    const { service, queue, events } = build({
      conversation: { enabled: false },
    });
    await service.receive(message);
    expect(queue.add).not.toHaveBeenCalled();
    expect(events.create).toHaveBeenCalledTimes(1);
    expect(events.updateOne).toHaveBeenCalledWith(
      { _id: "event-1" },
      { $set: expect.objectContaining({ status: "ignored" }) },
    );
  });
});
