import { ConversationService } from "./conversation.service";
import type { InboundMessage } from "./whatsapp-webhook.service";

const PHONE = "919876543210";

/** A WhatsApp-only guest identity — no matching website account. */
const guestCustomer = {
  kind: "guest" as const,
  userId: null,
  whatsappCustomerId: "wa-1",
  displayId: "WAPP-20260916-ABC123",
  phone: PHONE,
  name: "Ramesh",
  role: "whatsapp_customer",
  language: "hinglish" as const,
  status: "active" as const,
};

/** An identity resolved to an existing, registered website account. */
const accountCustomer = {
  kind: "account" as const,
  userId: "user-1",
  whatsappCustomerId: null,
  displayId: null,
  phone: PHONE,
  name: "Priya Sharma",
  role: "customer",
  language: null,
  status: "active" as const,
};

const message = (overrides: Partial<InboundMessage> = {}): InboundMessage => ({
  messageId: `wamid.${Math.random()}`,
  phone: PHONE,
  profileName: "Ramesh",
  messageType: "text",
  text: "",
  replyId: "",
  sentAt: new Date(),
  ...overrides,
});

const build = (overrides: Record<string, any> = {}) => {
  let stored: any = null;
  const sessions = {
    get: jest.fn(async () => stored),
    save: jest.fn(async (session: any) => {
      stored = session;
    }),
    clear: jest.fn(async () => {
      stored = null;
    }),
    start: jest.fn((input: any) => ({
      ...input,
      flow: null,
      step: null,
      data: {},
      lastInboundAt: Date.now(),
      startedAt: Date.now(),
      messageCount: 0,
    })),
    withinRateLimit: jest.fn(async () => true),
    acquireLock: jest.fn(async () => async () => undefined),
    seed: (session: any) => {
      stored = session;
    },
    current: () => stored,
    ...overrides.sessions,
  };

  const identity = {
    normalize: jest.fn((value: string) => value.replace(/\D/g, "")),
    resolveIdentity: jest.fn(async () => guestCustomer),
    setLanguage: jest.fn(async () => undefined),
    setName: jest.fn(async () => undefined),
    ...overrides.identity,
  };

  const reply = {
    text: jest.fn(async () => undefined),
    buttons: jest.fn(async () => undefined),
    list: jest.fn(async () => undefined),
    withinWindow: jest.fn(() => true),
    ...overrides.reply,
  };

  const actions = {
    searchStays: jest.fn(async () => []),
    roomsFor: jest.fn(async () => []),
    propertyDetails: jest.fn(async () => ({
      id: "ashram-1",
      name: "Shanti Ashram",
      city: "Vrindavan",
      state: "UP",
      address: "",
      description: "",
      amenities: [],
      nearby: [],
      policies: {},
      addOns: [],
    })),
    listOffers: jest.fn(async () => []),
    applyPromo: jest.fn(async () => ({ ok: false, reason: "no such code" })),
    refundStatuses: jest.fn(async () => []),
    refundStatusFor: jest.fn(async () => null),
    quoteStay: jest.fn(async () => ({ pricing: { totalAmount: 2400 }, nights: 2 })),
    createStayBooking: jest.fn(async () => ({
      _id: "booking-1",
      bookingId: "TRV-1",
      reservationExpiresAt: new Date(Date.now() + 600_000),
    })),
    createPaymentLink: jest.fn(async () => ({
      expiresAt: new Date(Date.now() + 600_000),
      url: "https://tirvona.com/pay",
      amount: 2400,
      reference: "TRV-1",
    })),
    myStayBookings: jest.fn(async () => []),
    getBooking: jest.fn(async () => null),
    cancelBooking: jest.fn(async () => ({
      booking: { bookingId: "TRV-1" },
      refundAmount: 0,
    })),
    previewCancellationRefund: jest.fn(async () => 0),
    availabilityForRoom: jest.fn(async () => []),
    ...overrides.actions,
  };

  const config = { get: jest.fn(() => "https://tirvona.com") };

  const service = new ConversationService(
    identity as any,
    sessions as any,
    reply as any,
    actions as any,
    config as any,
  );
  return { service, sessions, identity, reply, actions };
};

const allText = (reply: any): string =>
  reply.text.mock.calls.map((call: any[]) => call[2]).join("\n");

const seedSession = (sessions: any, overrides: Record<string, any> = {}) =>
  sessions.seed({
    phone: PHONE,
    userId: null,
    whatsappCustomerId: "wa-1",
    displayId: "WAPP-20260916-ABC123",
    flow: null,
    step: null,
    language: "hinglish",
    data: {},
    lastInboundAt: Date.now(),
    startedAt: Date.now(),
    messageCount: 1,
    ...overrides,
  });

describe("greeting and menu", () => {
  it("greets and shows the menu as an interactive list", async () => {
    // Meta caps buttons at three; the menu has eight items so it must be a list.
    const { service, reply } = build();
    await service.handle(message({ text: "hi" }));
    expect(reply.list).toHaveBeenCalled();
    const rows = reply.list.mock.calls[0][4];
    expect(rows.length).toBeGreaterThan(3);
    expect(rows.length).toBeLessThanOrEqual(10);
  });

  it("tells a brand new WhatsApp-only guest their WAPP id once", async () => {
    const { service, reply } = build({
      identity: { resolveIdentity: jest.fn(async () => ({ ...guestCustomer, name: "" })) },
    });
    await service.handle(message({ text: "hi" }));
    expect(allText(reply)).toContain("WAPP-20260916-ABC123");
  });

  it("never mentions a WAPP id for an identity matched to a website account", async () => {
    // An existing customer already has their own identity; showing them a
    // WAPP id would be confusing and is not what they were given.
    const { service, reply } = build({
      identity: { resolveIdentity: jest.fn(async () => ({ ...accountCustomer, name: "" })) },
    });
    await service.handle(message({ text: "hi" }));
    expect(allText(reply)).not.toMatch(/WAPP-/);
  });

  it("greets in the language the guest used", async () => {
    const { service, reply } = build();
    await service.handle(message({ text: "नमस्ते" }));
    expect(allText(reply)).toContain("नमस्ते");
  });
});

describe("resolving to an existing website account", () => {
  it("books under the matched account's own identity, not a WAPP id", async () => {
    const engine = build({
      identity: { resolveIdentity: jest.fn(async () => accountCustomer) },
    });
    engine.sessions.seed({
      phone: PHONE,
      userId: "user-1",
      whatsappCustomerId: null,
      displayId: null,
      flow: "stay_booking",
      step: "confirm",
      language: "en",
      data: {
        location: "Vrindavan",
        ashramId: "ashram-1",
        roomId: "room-1",
        checkInDate: "2026-10-01",
        checkOutDate: "2026-10-03",
        guests: 2,
      },
      lastInboundAt: Date.now(),
      startedAt: Date.now(),
      messageCount: 5,
    });
    await engine.service.handle(message({ replyId: "confirm:yes" }));
    // createStayBooking receives the resolved identity as-is; it is the
    // action layer's job (and booking-customer.spec.ts's) to turn an
    // "account" identity into a BookingActor keyed by userId, never by a
    // WhatsApp customer id.
    expect(engine.actions.createStayBooking).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "account", userId: "user-1" }),
      expect.anything(),
    );
  });

  it("does not try to persist a language preference for a matched account", async () => {
    // There is no per-channel language field on `User`; only a WhatsApp-only
    // guest identity has one to update.
    const { service, identity } = build({
      identity: { resolveIdentity: jest.fn(async () => accountCustomer) },
    });
    await service.handle(message({ text: "मुझे कमरा चाहिए" }));
    expect(identity.setLanguage).not.toHaveBeenCalled();
  });

  it("still updates the guest's own persisted language for a WhatsApp-only identity", async () => {
    const { service, identity } = build({
      identity: { resolveIdentity: jest.fn(async () => ({ ...guestCustomer, language: "en" })) },
    });
    await service.handle(message({ text: "मुझे कमरा चाहिए" }));
    expect(identity.setLanguage).toHaveBeenCalledWith("wa-1", "hi");
  });

  it("shows help with no customer ID line for a matched account", async () => {
    const { service, reply } = build({
      identity: { resolveIdentity: jest.fn(async () => accountCustomer) },
    });
    await service.handle(message({ text: "help" }));
    const text = allText(reply);
    expect(text).not.toMatch(/WAPP-/);
    expect(text).not.toMatch(/customer ID/i);
  });

  it("shows help with the WAPP id for a WhatsApp-only guest", async () => {
    const { service, reply } = build();
    await service.handle(message({ text: "help" }));
    expect(allText(reply)).toContain("WAPP-20260916-ABC123");
  });

  it("re-stamps a running session when the number gains a website account", async () => {
    // A guest who registers on the website mid-conversation flips from
    // "guest" to "account". The live session must follow, or it keeps
    // pointing at the WhatsApp customer id that no longer identifies them.
    const engine = build({
      identity: { resolveIdentity: jest.fn(async () => accountCustomer) },
    });
    seedSession(engine.sessions, {
      userId: null,
      whatsappCustomerId: "wa-1",
      displayId: "WAPP-20260916-ABC123",
      messageCount: 4,
    });
    await engine.service.handle(message({ text: "hi" }));
    expect(engine.sessions.current()).toMatchObject({
      userId: "user-1",
      whatsappCustomerId: null,
      displayId: null,
    });
  });
});

describe("stay booking flow — slot filling", () => {
  it("asks only for what the opening message did not give", async () => {
    // "Mujhe kal Prem Mandir ke paas 2 din ke liye room chahiye, 3 log hain"
    // supplies place, dates and guests, so the only thing left is the search.
    const { service, actions } = build({
      actions: { searchStays: jest.fn(async () => []) },
    });
    await service.handle(
      message({
        text: "Mujhe kal Prem Mandir ke paas 2 din ke liye room chahiye, 3 log hain",
      }),
    );
    expect(actions.searchStays).toHaveBeenCalledWith(
      expect.objectContaining({ place: "Prem Mandir", guests: 3 }),
    );
  });

  it("asks for the place when the request gave none", async () => {
    const { service, reply } = build();
    await service.handle(message({ text: "room chahiye" }));
    expect(allText(reply)).toMatch(/jagah|place|जगह/i);
  });

  it("accepts a correction to a detail already given", async () => {
    const { service, sessions, actions } = build();
    seedSession(sessions, {
      flow: "stay_booking",
      data: {
        location: "Prem Mandir",
        checkInDate: "2026-10-01",
        checkOutDate: "2026-10-03",
        guests: 2,
      },
      messageCount: 3,
    });
    await service.handle(message({ text: "actually 4 log hain" }));
    expect(actions.searchStays).toHaveBeenCalledWith(
      expect.objectContaining({ guests: 4 }),
    );
  });

  it("reads a bare number as the answer to the question it asked", async () => {
    // "2" after "how many guests?" is a guest count, not a stay length.
    const engine = build();
    seedSession(engine.sessions, {
      flow: "stay_booking",
      data: {
        location: "Vrindavan",
        checkInDate: "2026-10-01",
        checkOutDate: "2026-10-03",
      },
      messageCount: 3,
    });
    await engine.service.handle(message({ text: "2" }));
    expect(engine.actions.searchStays).toHaveBeenCalledWith(
      expect.objectContaining({ guests: 2 }),
    );
  });

  it("says so plainly when nothing is available, naming what was searched", async () => {
    const { service, reply } = build({
      actions: { searchStays: jest.fn(async () => []) },
    });
    await service.handle(
      message({ text: "kal se 2 din ke liye Vrindavan me room chahiye 2 log" }),
    );
    const text = allText(reply);
    expect(text).toMatch(/nahi mili|not find|नहीं मिली/i);
    expect(text).toContain("Vrindavan");
  });

  it("sends a payment link and no confirmation of its own", async () => {
    // The official confirmation is raised by the booking service's outbox and
    // delivered by the existing worker. A second one here would double it.
    const engine = build();
    seedSession(engine.sessions, {
      flow: "stay_booking",
      step: "confirm",
      data: {
        location: "Vrindavan",
        ashramId: "ashram-1",
        roomId: "room-1",
        checkInDate: "2026-10-01",
        checkOutDate: "2026-10-03",
        guests: 2,
      },
      messageCount: 5,
    });
    await engine.service.handle(message({ replyId: "confirm:yes" }));
    expect(engine.actions.createStayBooking).toHaveBeenCalled();
    const text = allText(engine.reply);
    expect(text).toContain("https://tirvona.com/pay");
    expect(text).not.toMatch(/confirmed|पुष्टि/i);
  });

  it("clears the flow after booking so the next message starts fresh", async () => {
    const engine = build();
    seedSession(engine.sessions, {
      flow: "stay_booking",
      step: "confirm",
      data: {
        ashramId: "a",
        roomId: "r",
        checkInDate: "2026-10-01",
        checkOutDate: "2026-10-03",
        guests: 2,
      },
      messageCount: 5,
    });
    await engine.service.handle(message({ replyId: "confirm:yes" }));
    expect(engine.sessions.current().flow).toBeNull();
  });
});

describe("stay booking flow — date and time combined in one message (the reported bug)", () => {
  it("does not repeat the checkout question after a lone date answers it", async () => {
    // The exact reported sequence: bot asks checkout, guest answers with a
    // single unmarked date, and it must be read as the checkout answer —
    // not silently dropped and re-asked, and not written back onto check-in.
    const engine = build();
    const checkInDate = new Date();
    checkInDate.setUTCDate(checkInDate.getUTCDate() + 3); // any fixed future day
    seedSession(engine.sessions, {
      flow: "stay_booking",
      data: {
        location: "Vrindavan",
        checkInDate: checkInDate.toISOString().slice(0, 10),
      },
      messageCount: 2,
    });
    await engine.service.handle(message({ text: "Tomorrow" }));
    const state = engine.sessions.current().data;
    // "Tomorrow" is relative to today, same as the deterministic parser
    // resolves it everywhere else — it must land on checkout, not check-in.
    expect(state.checkInDate).toBe(checkInDate.toISOString().slice(0, 10));
    expect(state.checkOutDate).toBeDefined();
    expect(new Date(state.checkOutDate).getTime()).toBeGreaterThan(Date.now());
    // Guests is still missing, so the bot moves on to that — not back to
    // check-in, and not the same checkout question again.
    expect(allText(engine.reply)).not.toMatch(/check.?in/i);
  });

  it("extracts both check-in and check-out date+time from one Hinglish message and does not re-ask either", async () => {
    const engine = build();
    seedSession(engine.sessions, {
      flow: "stay_booking",
      data: { location: "Vrindavan" },
      messageCount: 2,
    });
    await engine.service.handle(
      message({ text: "Kal 4 baje checkin aur agle din 11 baje checkout" }),
    );
    const state = engine.sessions.current().data;
    expect(state.checkInTime).toBe("16:00");
    expect(state.checkOutTime).toBe("11:00");
    expect(new Date(state.checkOutDate).getTime()).toBeGreaterThan(
      new Date(state.checkInDate).getTime(),
    );
    // Only guests is left — the bot must not ask about dates again.
    expect(allText(engine.reply)).toMatch(/guest|log|मेहमान/i);
    expect(allText(engine.reply)).not.toMatch(/check.?in date|check.?out date/i);
  });

  it("combines a full sentence with location, dates and guests in one shot", async () => {
    const { service, actions } = build({
      actions: { searchStays: jest.fn(async () => []) },
    });
    await service.handle(
      message({
        text: "Vrindavan mein kal 4 baje se parson 11 baje tak room chahiye, 2 log",
      }),
    );
    expect(actions.searchStays).toHaveBeenCalledWith(
      expect.objectContaining({ place: "Vrindavan", guests: 2 }),
    );
  });
});

describe("stay booking flow — corrections preserve everything else", () => {
  it("updates only the checkout time when asked to", async () => {
    const engine = build();
    seedSession(engine.sessions, {
      flow: "stay_booking",
      step: "confirm",
      data: {
        location: "Vrindavan",
        ashramId: "ashram-1",
        roomId: "room-1",
        checkInDate: "2026-10-01",
        checkOutDate: "2026-10-03",
        checkOutTime: "11:00",
        guests: 2,
      },
      messageCount: 6,
    });
    await engine.service.handle(message({ text: "Checkout 12 baje kar do" }));
    const state = engine.sessions.current().data;
    expect(state.checkOutTime).toBe("12:00");
    expect(state.checkInDate).toBe("2026-10-01");
    expect(state.checkOutDate).toBe("2026-10-03");
    expect(state.guests).toBe(2);
  });

  it("updates only the location, keeping valid dates and guests", async () => {
    const engine = build({
      actions: { searchStays: jest.fn(async () => []) },
    });
    seedSession(engine.sessions, {
      flow: "stay_booking",
      data: {
        location: "Vrindavan",
        checkInDate: "2026-10-01",
        checkOutDate: "2026-10-03",
        guests: 2,
      },
      messageCount: 4,
    });
    await engine.service.handle(message({ text: "Actually Mathura mein chahiye" }));
    expect(engine.actions.searchStays).toHaveBeenCalledWith(
      expect.objectContaining({ place: "Mathura", guests: 2 }),
    );
  });

  it("clears a previously picked ashram when the location actually changes", async () => {
    const engine = build({
      actions: { searchStays: jest.fn(async () => []) },
    });
    seedSession(engine.sessions, {
      flow: "stay_booking",
      data: {
        location: "Vrindavan",
        ashramId: "ashram-1",
        checkInDate: "2026-10-01",
        checkOutDate: "2026-10-03",
        guests: 2,
      },
      messageCount: 4,
    });
    await engine.service.handle(message({ text: "Mathura mein chahiye" }));
    expect(engine.sessions.current().data.ashramId).toBeUndefined();
  });
});

describe("stay booking flow — discovery (browse before booking)", () => {
  it("shows results for a bare location with no dates, rather than asking for a date", async () => {
    const { service, reply, actions } = build({
      actions: {
        searchStays: jest.fn(async () => [
          { _id: "ashram-1", name: "Shanti Ashram", address: { city: "Vrindavan" } },
        ]),
      },
    });
    await service.handle(message({ text: "Vrindavan mein chahiye" }));
    expect(actions.searchStays).toHaveBeenCalledWith({ place: "Vrindavan" });
    expect(reply.list).toHaveBeenCalled();
    expect(allText(reply)).not.toMatch(/check.?in|kab|कब/i);
  });

  it("shows a general list for a plain listing request with no location", async () => {
    const { service, actions, reply } = build({
      actions: {
        searchStays: jest.fn(async () => [
          { _id: "ashram-1", name: "Shanti Ashram", address: { city: "Vrindavan" } },
        ]),
      },
    });
    await service.handle(message({ text: "Mujhe asharam ka list do" }));
    expect(actions.searchStays).toHaveBeenCalledWith({ place: undefined });
    expect(reply.list).toHaveBeenCalled();
  });

  it("moves into the booking flow once a discovered ashram is picked, asking only for what is missing", async () => {
    const engine = build();
    seedSession(engine.sessions, {
      flow: "stay_booking",
      data: { location: "Vrindavan" },
      messageCount: 2,
    });
    await engine.service.handle(message({ replyId: "stay:ashram-1" }));
    expect(engine.sessions.current().data.ashramId).toBe("ashram-1");
    // No dates yet, so it asks for check-in — it does not jump to rooms.
    expect(allText(engine.reply)).toMatch(/check.?in|कब|kab/i);
  });

  it("goes straight to rooms when a dated search result is picked (dates already known)", async () => {
    const engine = build({
      actions: {
        roomsFor: jest.fn(async () => [{ _id: "room-1", name: "Deluxe" }]),
      },
    });
    seedSession(engine.sessions, {
      flow: "stay_booking",
      data: {
        location: "Vrindavan",
        checkInDate: "2026-10-01",
        checkOutDate: "2026-10-03",
        guests: 2,
      },
      messageCount: 3,
    });
    await engine.service.handle(message({ replyId: "stay:ashram-1" }));
    expect(engine.reply.list).toHaveBeenCalled();
    const rows = engine.reply.list.mock.calls[0][4];
    expect(rows[0].id).toBe("room:room-1");
  });

  it("resolves 'isme booking karni hai' to the one result just shown", async () => {
    const engine = build();
    seedSession(engine.sessions, {
      flow: "stay_booking",
      data: {
        location: "Vrindavan",
        _shownResults: [{ id: "ashram-1", name: "Shanti Ashram" }],
      },
      messageCount: 3,
    });
    await engine.service.handle(message({ text: "Isme booking karni hai" }));
    expect(engine.sessions.current().data.ashramId).toBe("ashram-1");
  });

  it("asks the guest to tap when more than one result was shown", async () => {
    const engine = build();
    seedSession(engine.sessions, {
      flow: "stay_booking",
      data: {
        location: "Vrindavan",
        _shownResults: [
          { id: "ashram-1", name: "Shanti Ashram" },
          { id: "ashram-2", name: "Radha Niwas" },
        ],
      },
      messageCount: 3,
    });
    await engine.service.handle(message({ text: "Isme booking karni hai" }));
    expect(engine.sessions.current().data.ashramId).toBeUndefined();
    expect(allText(engine.reply)).toMatch(/tap|list/i);
  });
});

describe("stay booking flow — availability query", () => {
  it("shows real open dates when a room is already known", async () => {
    const engine = build({
      actions: {
        availabilityForRoom: jest.fn(async () => [
          { date: "2026-10-05", available: true, isClosed: false },
          { date: "2026-10-06", available: true, isClosed: false },
        ]),
      },
    });
    seedSession(engine.sessions, {
      flow: "stay_booking",
      data: { location: "Vrindavan", ashramId: "ashram-1", roomId: "room-1" },
      messageCount: 3,
    });
    await engine.service.handle(message({ text: "Kaunsi date available hai?" }));
    expect(engine.actions.availabilityForRoom).toHaveBeenCalledWith("room-1");
    const text = allText(engine.reply);
    expect(text).toMatch(/available/i);
  });

  it("browses by location first when only a location is known", async () => {
    const engine = build({
      actions: {
        searchStays: jest.fn(async () => [
          { _id: "ashram-1", name: "Shanti Ashram" },
        ]),
      },
    });
    seedSession(engine.sessions, {
      flow: "stay_booking",
      data: { location: "Vrindavan" },
      messageCount: 2,
    });
    await engine.service.handle(message({ text: "Kab date available hai?" }));
    expect(engine.actions.searchStays).toHaveBeenCalledWith({ place: "Vrindavan" });
  });

  it("asks only for location when nothing at all is known yet", async () => {
    const { service, reply, actions } = build();
    await service.handle(message({ text: "Kaunsi date available hai?" }));
    expect(actions.searchStays).not.toHaveBeenCalled();
    expect(allText(reply)).toMatch(/jagah|place|जगह/i);
  });
});

describe("stay booking flow — loop protection", () => {
  it("does not repeat the exact same question verbatim twice in a row", async () => {
    // The bot has already picked a specific ashram (so it is past the
    // browse/discovery step) and asked for check-in; a reply it cannot parse
    // at all must not produce the identical question a second time.
    const engine = build();
    seedSession(engine.sessions, {
      flow: "stay_booking",
      data: {
        location: "Vrindavan",
        ashramId: "ashram-1",
        _lastAskedSlot: "checkInDate",
        _lastAskedRepeat: 0,
      },
      messageCount: 2,
    });
    await engine.service.handle(message({ text: "hmm not sure yet" }));
    const first = allText(engine.reply);
    expect(first).toMatch(/sorry|माफ़/i);
  });

  it("still answers normally the first time a slot is asked", async () => {
    const engine = build();
    seedSession(engine.sessions, {
      flow: "stay_booking",
      data: {},
      messageCount: 1,
    });
    await engine.service.handle(message({ text: "gibberish xyz" }));
    // First time asking for location — the plain question, not the
    // "sorry, I didn't catch that" rephrasing.
    expect(allText(engine.reply)).not.toMatch(/sorry|माफ़/i);
  });

  it("stops repeating once the guest's reply actually supplies the slot", async () => {
    const engine = build();
    seedSession(engine.sessions, {
      flow: "stay_booking",
      data: { location: "Vrindavan", _lastAskedSlot: "checkInDate", _lastAskedRepeat: 1 },
      messageCount: 3,
    });
    await engine.service.handle(message({ text: "kal" }));
    expect(engine.sessions.current().data.checkInDate).toBeDefined();
    expect(allText(engine.reply)).not.toMatch(/sorry|माफ़/i);
  });
});

describe("payment claims", () => {
  it("never treats the guest saying they paid as payment", async () => {
    // Only the verified Razorpay webhook can confirm a payment.
    const { service, reply, actions } = build();
    await service.handle(message({ text: "payment ho gaya" }));
    expect(actions.createStayBooking).not.toHaveBeenCalled();
    expect(allText(reply)).toMatch(/confirm nahi|isn't confirmed|नहीं हुआ/i);
  });
});

describe("cancellation", () => {
  const booking = {
    _id: "booking-1",
    bookingId: "TRV-1",
    status: "confirmed",
    paymentStatus: "fully_paid",
    checkInDate: new Date(Date.now() + 5 * 86_400_000),
    pricing: { amountPaid: 2400, totalAmount: 2400 },
    ashramId: { name: "Shanti Ashram" },
  };

  it("quotes the existing policy's refund before asking to confirm", async () => {
    const engine = build({
      actions: {
        getBooking: jest.fn(async () => booking),
        previewCancellationRefund: jest.fn(async () => 2400),
      },
    });
    seedSession(engine.sessions, { messageCount: 1 });
    await engine.service.handle(
      message({ replyId: "booking:cancel:booking-1" }),
    );
    expect(engine.actions.previewCancellationRefund).toHaveBeenCalled();
    expect(engine.reply.buttons).toHaveBeenCalled();
    expect(engine.reply.buttons.mock.calls[0][2]).toContain("2,400");
    expect(engine.actions.cancelBooking).not.toHaveBeenCalled();
  });

  it("only cancels after an explicit yes", async () => {
    const engine = build({
      actions: { getBooking: jest.fn(async () => booking) },
    });
    seedSession(engine.sessions, {
      flow: "cancellation",
      step: "confirm",
      data: { bookingId: "booking-1" },
      messageCount: 2,
    });
    await engine.service.handle(message({ replyId: "cancel:yes" }));
    expect(engine.actions.cancelBooking).toHaveBeenCalledWith(
      guestCustomer,
      "booking-1",
      expect.any(String),
    );
  });

  it("leaves the booking alone on no", async () => {
    const engine = build({
      actions: { getBooking: jest.fn(async () => booking) },
    });
    seedSession(engine.sessions, {
      flow: "cancellation",
      step: "confirm",
      data: { bookingId: "booking-1" },
      messageCount: 2,
    });
    await engine.service.handle(message({ replyId: "cancel:no" }));
    expect(engine.actions.cancelBooking).not.toHaveBeenCalled();
  });

  it("refuses a booking that is not the guest's", async () => {
    // The action layer reports someone else's booking as not found; the
    // conversation must not leak that it exists.
    const engine = build({
      actions: {
        getBooking: jest.fn(async () => {
          throw Object.assign(new Error("Booking not found"), { status: 404 });
        }),
      },
    });
    seedSession(engine.sessions, { messageCount: 1 });
    await engine.service.handle(
      message({ replyId: "booking:cancel:someone-elses" }),
    );
    expect(engine.actions.cancelBooking).not.toHaveBeenCalled();
    expect(allText(engine.reply)).toMatch(/couldn't find|nahi mili|नहीं मिली/i);
  });
});

describe("flow switching and recovery", () => {
  it("switches away from a booking flow when the guest changes subject", async () => {
    const engine = build();
    seedSession(engine.sessions, {
      flow: "stay_booking",
      step: "guests",
      data: { location: "Vrindavan" },
      messageCount: 2,
    });
    await engine.service.handle(message({ text: "meri booking dikhao" }));
    expect(engine.actions.myStayBookings).toHaveBeenCalled();
  });

  it("does not guess what to cancel", async () => {
    // "cancel" alone must list the guest's bookings, never cancel one.
    const engine = build({
      actions: { myStayBookings: jest.fn(async () => []) },
    });
    await engine.service.handle(message({ text: "cancel" }));
    expect(engine.actions.cancelBooking).not.toHaveBeenCalled();
    expect(engine.actions.myStayBookings).toHaveBeenCalled();
  });

  it("starts fresh when the session expired, without booking anything", async () => {
    const { service, reply, actions } = build();
    await service.handle(message({ text: "haan" }));
    expect(actions.createStayBooking).not.toHaveBeenCalled();
    // "haan" alone, with no prior session, is an affirm with nothing to
    // affirm — the engine falls back to the menu rather than guessing.
    expect(reply.list).toHaveBeenCalled();
  });

  it("holds off when another message for the same guest is mid-flight", async () => {
    // A double-tapped confirmation must not run the booking step twice.
    const { service, actions } = build({
      sessions: { acquireLock: jest.fn(async () => null) },
    });
    await service.handle(message({ replyId: "confirm:yes" }));
    expect(actions.createStayBooking).not.toHaveBeenCalled();
  });

  it("asks the guest to slow down instead of dropping them silently", async () => {
    const { service, reply } = build({
      sessions: { withinRateLimit: jest.fn(async () => false) },
    });
    await service.handle(message({ text: "hi" }));
    expect(reply.text).toHaveBeenCalled();
  });
});

describe("error handling", () => {
  it("explains a sold-out room rather than showing an error", async () => {
    const { service, reply } = build({
      actions: {
        searchStays: jest.fn(async () => {
          throw Object.assign(new Error("no availability"), { status: 409 });
        }),
      },
    });
    await service.handle(
      message({ text: "kal se 2 din Vrindavan me room chahiye 2 log" }),
    );
    expect(allText(reply)).toMatch(/taken|book ho gaya|बुक/i);
  });

  it("never says internal server error", async () => {
    const { service, reply } = build({
      actions: {
        searchStays: jest.fn(async () => {
          throw new Error("ECONNREFUSED mongodb://prod");
        }),
      },
    });
    await service.handle(
      message({ text: "kal se 2 din Vrindavan me room chahiye 2 log" }),
    );
    const text = allText(reply);
    expect(text).not.toMatch(/internal server error|ECONNREFUSED|mongodb/i);
    expect(text).toMatch(/nothing was charged|koi charge|कोई शुल्क/i);
  });
});

describe("services that are not conversational yet", () => {
  it("says so and links to the website instead of pretending", async () => {
    const { service, reply } = build();
    await service.handle(message({ text: "parking book karni hai" }));
    const text = allText(reply);
    expect(text).toMatch(/available nahi|isn't available|उपलब्ध नहीं/i);
    expect(text).toContain("https://tirvona.com/parking");
  });
});
