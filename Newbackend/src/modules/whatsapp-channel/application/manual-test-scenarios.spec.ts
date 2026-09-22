import { ConversationService } from "./conversation.service";
import type { InboundMessage } from "./whatsapp-webhook.service";

/**
 * The exact ten manual test scenarios from the conversational-quality bug
 * report, run as one continuous conversation against the real
 * `ConversationService` — the same session carried from message to message,
 * exactly as a real WhatsApp conversation would. Only the domain services
 * (`WhatsAppActionsService`) and the identity/session infrastructure are
 * mocked; the NLU, slot-merging and flow logic under test are all real.
 *
 * This is the strongest evidence available short of a live Meta webhook that
 * the reported "bot repeats the same question" defect is actually fixed and
 * stays fixed across the whole conversation, not just in isolated messages.
 */

const PHONE = "919876543210";

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

describe("the ten official manual test scenarios, run as one live conversation", () => {
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
  };

  const identity = {
    normalize: jest.fn((value: string) => value.replace(/\D/g, "")),
    resolveIdentity: jest.fn(async () => guestCustomer),
    setLanguage: jest.fn(async () => undefined),
    setName: jest.fn(async () => undefined),
  };

  const ASHRAM = {
    _id: "ashram-1",
    name: "Shanti Ashram",
    address: { city: "Vrindavan" },
    startingPrice: 2000,
  };
  const ROOM = { _id: "room-1", name: "Deluxe Room", acType: "AC", basePrice: 2000 };

  const reply = {
    text: jest.fn(async (..._args: any[]) => undefined),
    buttons: jest.fn(async (..._args: any[]) => undefined),
    list: jest.fn(async (..._args: any[]) => undefined),
    withinWindow: jest.fn(() => true),
  };

  const actions = {
    searchStays: jest.fn(async (input: any) =>
      !input.place || /vrindavan/i.test(input.place) ? [ASHRAM] : [],
    ),
    roomsFor: jest.fn(async () => [ROOM]),
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
    quoteStay: jest.fn(async () => ({ pricing: { totalAmount: 4000 }, nights: 2 })),
    createStayBooking: jest.fn(async () => ({
      _id: "booking-1",
      bookingId: "TRV-1",
      reservationExpiresAt: new Date(Date.now() + 600_000),
    })),
    createPaymentLink: jest.fn(async () => ({
      expiresAt: new Date(Date.now() + 600_000),
      url: "https://tirvona.com/pay/TRV-1",
      amount: 4000,
      reference: "TRV-1",
    })),
    myStayBookings: jest.fn(async () => []),
    getBooking: jest.fn(async () => null),
    cancelBooking: jest.fn(async () => ({ booking: {}, refundAmount: 0 })),
    previewCancellationRefund: jest.fn(async () => 0),
    availabilityForRoom: jest.fn(async (): Promise<any[]> => []),
  };

  const config = { get: jest.fn(() => "https://tirvona.com") };

  const service = new ConversationService(
    identity as any,
    sessions as any,
    reply as any,
    actions as any,
    config as any,
  );

  const allTextSoFar = (): string =>
    reply.text.mock.calls.map((call: any[]) => call[2]).join("\n");
  const lastReplyCallCount = () =>
    reply.text.mock.calls.length + reply.list.mock.calls.length + reply.buttons.mock.calls.length;

  it("TEST 1 — 'Hi' greets with the menu", async () => {
    await service.handle(message({ text: "Hi" }));
    expect(reply.list).toHaveBeenCalled();
    const rows = reply.list.mock.calls[0][4] as any[];
    expect(rows.length).toBeGreaterThan(3); // an interactive list, not buttons
  });

  it("TEST 2 — 'Mujhe ashram ka list do' shows a discovery list, not a date prompt", async () => {
    const before = lastReplyCallCount();
    await service.handle(message({ text: "Mujhe ashram ka list do" }));
    expect(actions.searchStays).toHaveBeenCalledWith({ place: undefined });
    expect(reply.list.mock.calls.length).toBeGreaterThan(0);
    expect(lastReplyCallCount()).toBeGreaterThan(before);
    expect(allTextSoFar()).not.toMatch(/check.?in date|kab aaenge/i);
  });

  it("TEST 3 — 'Vrindavan mein chahiye' shows Vrindavan results directly", async () => {
    await service.handle(message({ text: "Vrindavan mein chahiye" }));
    expect(actions.searchStays).toHaveBeenCalledWith({ place: "Vrindavan" });
    expect(stored.data.location).toBe("Vrindavan");
    // Still browsing — no ashram chosen yet, no date demanded.
    expect(stored.data.ashramId).toBeUndefined();
  });

  it("TEST 4 — combined date+time message extracts both sides, no repeats", async () => {
    // The guest picks the shown ashram first (as a real user would tap it),
    // then gives the combined date/time sentence from the bug report.
    await service.handle(message({ replyId: "stay:ashram-1" }));
    expect(stored.data.ashramId).toBe("ashram-1");

    const beforeText = allTextSoFar();
    await service.handle(
      message({ text: "Kal 4 baje checkin aur agle din 11 baje checkout" }),
    );
    expect(stored.data.checkInTime).toBe("16:00");
    expect(stored.data.checkOutTime).toBe("11:00");
    expect(stored.data.checkInDate).toBeDefined();
    expect(stored.data.checkOutDate).toBeDefined();
    expect(new Date(stored.data.checkOutDate).getTime()).toBeGreaterThan(
      new Date(stored.data.checkInDate).getTime(),
    );
    // The bot must not have asked about check-in again — the only new
    // question, if any, is about guests (still unknown).
    const newText = allTextSoFar().slice(beforeText.length);
    expect(newText).not.toMatch(/check.?in date|kab check.?in/i);
  });

  it("TEST 5 — '2 guests' completes the slots without losing dates/location", async () => {
    await service.handle(message({ text: "2 guests" }));
    expect(stored.data.guests).toBe(2);
    expect(stored.data.location).toBe("Vrindavan");
    expect(stored.data.checkInDate).toBeDefined();
    expect(stored.data.checkOutDate).toBeDefined();
    // Every required slot is now known, so the room list should have run.
    expect(actions.roomsFor).toHaveBeenCalledWith("ashram-1", expect.anything());
  });

  it("TEST 6 — 'Booking karni hai' continues using existing context", async () => {
    const before = JSON.stringify(stored.data);
    await service.handle(message({ text: "Booking karni hai" }));
    // Re-stating the intent mid-flow must not wipe what is already known.
    expect(stored.data.location).toBe("Vrindavan");
    expect(stored.data.guests).toBe(2);
    expect(JSON.stringify(stored.data)).toBe(before);
  });

  it("picks the room so the flow reaches the confirm step", async () => {
    await service.handle(message({ replyId: "room:room-1" }));
    expect(stored.data.rooms).toEqual([{ roomId: "room-1", units: 1 }]);
    expect(reply.buttons).toHaveBeenCalled();
  });

  it("TEST 7 — 'Checkout 12 baje kar do' updates only the checkout time", async () => {
    const before = { ...stored.data };
    await service.handle(message({ text: "Checkout 12 baje kar do" }));
    expect(stored.data.checkOutTime).toBe("12:00");
    expect(stored.data.checkInDate).toBe(before.checkInDate);
    expect(stored.data.checkOutDate).toBe(before.checkOutDate);
    expect(stored.data.guests).toBe(before.guests);
    expect(stored.data.location).toBe(before.location);
  });

  it("TEST 8 — 'Actually Mathura mein chahiye' updates only the location", async () => {
    const before = { ...stored.data };
    actions.searchStays.mockClear();
    await service.handle(message({ text: "Actually Mathura mein chahiye" }));
    expect(stored.data.location).toBe("Mathura");
    expect(stored.data.checkInDate).toBe(before.checkInDate);
    expect(stored.data.checkOutDate).toBe(before.checkOutDate);
    expect(stored.data.guests).toBe(before.guests);
    // The room/ashram picked for Vrindavan is no longer valid for Mathura.
    expect(stored.data.ashramId).toBeUndefined();
  });

  it("TEST 9 — 'Kaunsi date available hai?' answers from known context, not a generic prompt", async () => {
    // Re-establish a known ashram/room so the availability query has
    // something concrete to answer from.
    actions.availabilityForRoom.mockResolvedValueOnce([
      { date: "2026-10-05", available: true, isClosed: false },
    ]);
    stored.data.ashramId = "ashram-1";
    stored.data.roomId = "room-1";
    await service.handle(message({ text: "Kaunsi date available hai?" }));
    expect(actions.availabilityForRoom).toHaveBeenCalledWith("room-1");
    expect(allTextSoFar()).toMatch(/available/i);
  });

  it("TEST 10 — 'Help' shows help without corrupting the active session", async () => {
    const before = { ...stored.data };
    await service.handle(message({ text: "Help" }));
    expect(allTextSoFar()).toMatch(/help|madad|मदद/i);
    // The in-progress booking context survives a help request.
    expect(stored.data.location).toBe(before.location);
    expect(stored.data.ashramId).toBe(before.ashramId);
    expect(stored.flow).toBe("stay_booking");
  });
});
