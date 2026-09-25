import { BadRequestException } from "@nestjs/common";
import { ConversationService } from "./conversation.service";
import type { InboundMessage } from "./whatsapp-webhook.service";

/**
 * End-to-end stay journeys through the real conversation engine. Only the
 * domain actions are stubbed — and they are stubbed to *record what they were
 * asked*, so each test can assert that WhatsApp handed the domain services
 * the same structure the website does, and that the figures on screen are the
 * ones the domain returned.
 */

const PHONE = "919876543210";

const guest = {
  kind: "guest" as const,
  userId: null,
  whatsappCustomerId: "wa-1",
  displayId: "WAPP-20260921-ABC123",
  phone: PHONE,
  name: "Ramesh",
  role: "whatsapp_customer",
  language: "hinglish" as const,
  status: "active" as const,
};

const ASHRAM = {
  _id: "ashram-1",
  name: "Prem Mandir Dharamshala",
  address: { city: "Vrindavan" },
  startingPrice: 1500,
};

const ROOMS = [
  { _id: "r-deluxe", name: "Deluxe Room", acType: "AC", capacity: 3, basePrice: 2000, unitsLeft: 3 },
  { _id: "r-standard", name: "Standard Room", acType: "Non-AC", capacity: 2, basePrice: 1200, unitsLeft: 1 },
  { _id: "r-family", name: "Family Room", acType: "AC", capacity: 5, basePrice: 3500, unitsLeft: 0 },
];

const DETAILS = {
  id: "ashram-1",
  name: "Prem Mandir Dharamshala",
  city: "Vrindavan",
  state: "UP",
  address: "",
  description: "A calm stay near Prem Mandir.",
  amenities: ["WiFi", "Hot water"],
  nearby: [],
  policies: {
    checkInTime: "12:00 PM",
    checkOutTime: "10:00 AM",
    minStay: 1,
    cancellationPolicy: "Free cancellation up to 24 hours before check-in.",
  },
  addOns: [{ id: "add-bed", name: "Extra Bed", price: 300, unit: "per_night", maxQuantity: 2 }],
};

/** A quote in the shape `BookingsService.quote` returns. */
const quoteFor = (input: any, extra: { discount?: number; coupon?: any } = {}) => {
  const units = input.rooms.reduce((s: number, r: any) => s + r.units, 0);
  const discount = extra.discount ?? 0;
  const services = {
    selectedAddOns: (input.addOns ?? []).map((a: any) => ({
      serviceId: a.serviceId,
      name: "Extra Bed",
      quantity: a.quantity,
      totalPrice: 600 * a.quantity,
    })),
    prasad: { ordered: Boolean(input.services?.prasad), price: input.services?.prasad ? 200 : 0 },
    meals: { ordered: Boolean(input.services?.meals), price: 0 },
    parking: { ordered: Boolean(input.services?.parking), price: input.services?.parking ? 200 : 0 },
    locker: { ordered: false, price: 0 },
  };
  const basePrice = 4000 * units;
  const servicesPrice =
    services.selectedAddOns.reduce((s: number, a: any) => s + a.totalPrice, 0) +
    services.prasad.price +
    services.parking.price;
  return {
    nights: 2,
    services,
    coupon: extra.coupon ?? null,
    pricing: {
      basePrice,
      servicesPrice,
      extraGuestAmount: 0,
      platformFee: 100,
      gstAmount: 18,
      gstPercent: 18,
      discountAmount: discount,
      totalAmount: basePrice + servicesPrice + 118 - discount,
    },
  };
};

const msg = (text: string, replyId = ""): InboundMessage => ({
  messageId: `wamid.${Math.random()}`,
  phone: PHONE,
  profileName: "Ramesh",
  messageType: replyId ? "interactive" : "text",
  text,
  replyId,
  sentAt: new Date(),
});

const build = (actionOverrides: Record<string, any> = {}, identity = guest) => {
  let stored: any = null;
  const sessions = {
    get: jest.fn(async () => stored),
    save: jest.fn(async (s: any) => {
      stored = s;
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
  const reply = {
    text: jest.fn(async (..._a: any[]) => undefined),
    buttons: jest.fn(async (..._a: any[]) => undefined),
    list: jest.fn(async (..._a: any[]) => undefined),
    withinWindow: jest.fn(() => true),
  };
  const actions: Record<string, jest.Mock> = {
    searchStays: jest.fn(async () => [ASHRAM]),
    propertyDetails: jest.fn(async () => DETAILS),
    roomsFor: jest.fn(async () => ROOMS),
    topDestinations: jest.fn(async () => [
      { city: "Vrindavan", count: 12 },
      { city: "Haridwar", count: 7 },
    ]),
    // As the real pricing service does: a code on the request is applied.
    quoteStay: jest.fn(async (input: any) =>
      input.promoCode
        ? quoteFor(input, {
            discount: 500,
            coupon: { promoCode: input.promoCode, offerTitle: "Monsoon offer" },
          })
        : quoteFor(input),
    ),
    applyPromo: jest.fn(async (input: any) => ({
      ok: true,
      quote: quoteFor(input, {
        discount: 500,
        coupon: { promoCode: input.promoCode, offerTitle: "Monsoon offer" },
      }),
      offer: { promoCode: input.promoCode },
      discountAmount: 500,
    })),
    listOffers: jest.fn(async () => []),
    createStayBooking: jest.fn(async () => ({
      _id: "booking-1",
      bookingId: "TRV-1",
      reservationExpiresAt: new Date(Date.now() + 600_000),
    })),
    createPaymentLink: jest.fn(async () => ({
      expiresAt: new Date(Date.now() + 600_000),
      url: "https://tirvona.com/pay/x",
      amount: 8118,
      reference: "TRV-1",
    })),
    myStayBookings: jest.fn(async () => []),
    getBooking: jest.fn(async () => null),
    cancelBooking: jest.fn(async () => ({ booking: { bookingId: "TRV-1" }, refundAmount: 1600 })),
    previewCancellationRefund: jest.fn(async () => 1600),
    refundStatuses: jest.fn(async () => []),
    refundStatusFor: jest.fn(async () => null),
    availabilityForRoom: jest.fn(async () => []),
    ...actionOverrides,
  };
  const service = new ConversationService(
    { normalize: (v: string) => v.replace(/\D/g, ""), resolveIdentity: jest.fn(async () => identity), setLanguage: jest.fn(), setName: jest.fn() } as any,
    sessions as any,
    reply as any,
    actions as any,
    { get: jest.fn(() => "https://tirvona.com") } as any,
  );
  const say = (text: string, replyId = "") => service.handle(msg(text, replyId));
  const texts = () => reply.text.mock.calls.map((c: any[]) => String(c[2])).join("\n---\n");
  const lastText = () => String(reply.text.mock.calls.at(-1)?.[2] ?? "");
  const lastQuoteInput = () => actions.quoteStay.mock.calls.at(-1)?.[0];
  const state = () => stored?.data ?? {};
  const seed = (s: any) => {
    stored = { phone: PHONE, userId: null, whatsappCustomerId: "wa-1", displayId: guest.displayId, language: "hinglish", lastInboundAt: Date.now(), startedAt: Date.now(), messageCount: 1, flow: null, step: null, data: {}, ...s };
  };
  return { service, reply, actions, sessions, say, texts, lastText, lastQuoteInput, state, seed, session: () => stored };
};

/** A guest who has searched, with dates and guests known, about to pick the ashram. */
const atAshramPick = (e: ReturnType<typeof build>) =>
  e.seed({
    flow: "stay_booking",
    data: { location: "Vrindavan", checkInDate: "2030-10-01", checkOutDate: "2030-10-03", guests: 2 },
  });

/** …and then through property details and the room list. */
const atRoomList = async (e: ReturnType<typeof build>) => {
  atAshramPick(e);
  await e.say("", "stay:ashram-1");
};

describe("property discovery and details", () => {
  it("shows the property's details first, then its room categories as a list", async () => {
    const e = build();
    await atRoomList(e);
    const intro = e.texts();
    expect(intro).toContain("Prem Mandir Dharamshala");
    expect(intro).toContain("A calm stay near Prem Mandir.");
    expect(intro).toContain("12:00 PM");
    expect(intro).toContain("Free cancellation up to 24 hours");
    const rows = e.reply.list.mock.calls.at(-1)![4];
    expect(rows.map((r: any) => r.id)).toEqual(["room:r-deluxe", "room:r-standard"]);
  });

  it("does not offer a category that is sold out for the dates", async () => {
    const e = build();
    await atRoomList(e);
    const ids = e.reply.list.mock.calls.at(-1)![4].map((r: any) => r.id);
    expect(ids).not.toContain("room:r-family");
  });

  it("shows capacity, price and open units on each room row", async () => {
    const e = build();
    await atRoomList(e);
    const [deluxe] = e.reply.list.mock.calls.at(-1)![4];
    expect(deluxe.description).toMatch(/AC/);
    expect(deluxe.description).toMatch(/3 guest/);
    expect(deluxe.description).toMatch(/2,000/);
    expect(deluxe.description).toMatch(/3 bacche/);
  });

  it("asks the domain for availability over the actual stay dates", async () => {
    const e = build();
    await atRoomList(e);
    expect(e.actions.roomsFor).toHaveBeenCalledWith("ashram-1", {
      checkIn: new Date("2030-10-01T00:00:00.000Z"),
      checkOut: new Date("2030-10-03T00:00:00.000Z"),
    });
  });

  it("says so, without inventing a room, when nothing is open", async () => {
    const e = build({ roomsFor: jest.fn(async () => ROOMS.map((r) => ({ ...r, unitsLeft: 0 }))) });
    await atRoomList(e);
    expect(e.texts()).toMatch(/available nahi/);
    expect(e.reply.list.mock.calls.filter((c: any[]) => String(c[1]).endsWith(":rooms"))).toHaveLength(0);
  });

  it("introduces the property once, not again on every later change", async () => {
    const e = build();
    await atRoomList(e);
    await e.say("Deluxe wala");
    await e.say("checkout 12 baje");
    expect(e.actions.propertyDetails).toHaveBeenCalledTimes(1);
  });
});

describe("room selection: units and multiple categories", () => {
  it("one tap on a category prices one unit of it", async () => {
    const e = build();
    await atRoomList(e);
    await e.say("", "room:r-deluxe");
    expect(e.lastQuoteInput().rooms).toEqual([{ roomId: "r-deluxe", units: 1 }]);
  });

  it("'2 deluxe rooms' sends units: 2, not a hard-coded 1", async () => {
    const e = build();
    await atRoomList(e);
    await e.say("2 deluxe rooms");
    expect(e.lastQuoteInput().rooms).toEqual([{ roomId: "r-deluxe", units: 2 }]);
  });

  it("'1 deluxe aur 1 standard' builds a two-category rooms list", async () => {
    const e = build();
    await atRoomList(e);
    await e.say("1 deluxe aur 1 standard");
    const rooms = e.lastQuoteInput().rooms;
    expect(rooms).toEqual(
      expect.arrayContaining([
        { roomId: "r-deluxe", units: 1 },
        { roomId: "r-standard", units: 1 },
      ]),
    );
    expect(rooms).toHaveLength(2);
  });

  it("shows the full room selection in the summary before booking", async () => {
    const e = build();
    await atRoomList(e);
    await e.say("2 deluxe aur 1 standard");
    const summary = e.lastText();
    expect(summary).toContain("2 × Deluxe Room");
    expect(summary).toContain("1 × Standard Room");
  });

  it("'2 rooms kar do' changes the count of the chosen room, keeping everything else", async () => {
    const e = build();
    await atRoomList(e);
    await e.say("", "room:r-deluxe");
    await e.say("2 rooms kar do");
    expect(e.lastQuoteInput().rooms).toEqual([{ roomId: "r-deluxe", units: 2 }]);
    expect(e.state().checkInDate).toBe("2030-10-01");
    expect(e.state().guests).toBe(2);
  });

  it("'deluxe wala' does not reset an existing count of 2", async () => {
    const e = build();
    await atRoomList(e);
    await e.say("2 deluxe");
    await e.say("deluxe wala");
    expect(e.lastQuoteInput().rooms).toEqual([{ roomId: "r-deluxe", units: 2 }]);
  });

  it("remembers a count given before a room is chosen and uses it on the tap", async () => {
    const e = build();
    await atRoomList(e);
    await e.say("2 rooms chahiye");
    expect(e.actions.quoteStay).not.toHaveBeenCalled();
    await e.say("", "room:r-deluxe");
    expect(e.lastQuoteInput().rooms).toEqual([{ roomId: "r-deluxe", units: 2 }]);
  });

  it("refuses more units than are open, and leaves the selection alone", async () => {
    const e = build();
    await atRoomList(e);
    await e.say("", "room:r-standard");
    const quotes = e.actions.quoteStay.mock.calls.length;
    await e.say("3 standard");
    expect(e.lastText()).toMatch(/sirf 1 unit/);
    expect(e.state().rooms).toEqual([{ roomId: "r-standard", units: 1 }]);
    expect(e.actions.quoteStay.mock.calls.length).toBe(quotes);
  });

  it("relays the backend's own reason when the rooms cannot hold the guests", async () => {
    const e = build({
      quoteStay: jest.fn(async () => {
        throw new BadRequestException("Guest count exceeds the selected rooms capacity");
      }),
    });
    await atRoomList(e);
    await e.say("", "room:r-standard");
    expect(e.lastText()).toContain("Guest count exceeds the selected rooms capacity");
  });
});

describe("guests: adults and children", () => {
  it("sends the backend only the total, and keeps the split for the summary", async () => {
    const e = build();
    await atRoomList(e);
    await e.say("", "room:r-deluxe");
    await e.say("2 adults aur 1 child");
    expect(e.lastQuoteInput().guests).toBe(3);
    expect(e.state()).toMatchObject({ adults: 2, children: 1, guests: 3 });
    expect(e.lastText()).toMatch(/3 \(2 adults, 1 bacche\)/);
  });

  it("a plain total replaces an earlier split", async () => {
    const e = build();
    await atRoomList(e);
    await e.say("", "room:r-deluxe");
    await e.say("2 adults aur 1 child");
    await e.say("4 log");
    expect(e.lastQuoteInput().guests).toBe(4);
    expect(e.state().adults).toBeUndefined();
  });

  it("reads the split in the very first message", async () => {
    const e = build();
    e.seed({ flow: "stay_booking", data: { location: "Vrindavan", checkInDate: "2030-10-01", checkOutDate: "2030-10-03" } });
    await e.say("2 adults aur 1 child");
    expect(e.state()).toMatchObject({ adults: 2, children: 1, guests: 3 });
  });
});

describe("dates and times", () => {
  it("changing only the checkout time keeps every other choice", async () => {
    const e = build();
    await atRoomList(e);
    await e.say("2 deluxe");
    await e.say("Checkout 12 baje kar do");
    expect(e.state()).toMatchObject({
      checkOutTime: "12:00",
      checkInDate: "2030-10-01",
      guests: 2,
      rooms: [{ roomId: "r-deluxe", units: 2 }],
    });
    expect(e.lastText()).toMatch(/12 PM/);
  });

  it("passes the requested arrival and departure times to the booking as a special request", async () => {
    const e = build();
    await atRoomList(e);
    await e.say("", "room:r-deluxe");
    await e.say("checkin 4 baje shaam, checkout 11 baje subah");
    await e.say("", "confirm:yes");
    const input = e.actions.createStayBooking.mock.calls[0][1];
    expect(input.specialRequests).toMatch(/Requested check-in 16:00/);
    expect(input.specialRequests).toMatch(/Requested check-out 11:00/);
  });

  it("re-checks availability when the dates change", async () => {
    const e = build();
    await atRoomList(e);
    await e.say("", "room:r-deluxe");
    const before = e.actions.roomsFor.mock.calls.length;
    await e.say("checkout 5 oct");
    expect(e.actions.roomsFor.mock.calls.length).toBeGreaterThan(before);
  });

  it("drops a room count that the new dates cannot satisfy and shows the room list again", async () => {
    const e = build();
    await atRoomList(e);
    await e.say("2 deluxe");
    e.actions.roomsFor.mockResolvedValue(
      ROOMS.map((r) => (r._id === "r-deluxe" ? { ...r, unitsLeft: 1 } : r)),
    );
    await e.say("checkout 5 oct");
    expect(e.lastText()).toMatch(/sirf 1 unit|Only 1 unit/);
    expect(e.state().rooms).toBeUndefined();
  });
});

describe("offers", () => {
  const OFFERS = [
    {
      id: "o1",
      promoCode: "MONSOON10",
      title: "Monsoon",
      discountType: "Percentage",
      discountValue: 10,
      maximumDiscount: 1000,
      minimumBookingAmount: 3000,
      validTill: new Date("2030-12-31"),
      roomId: null,
    },
  ];

  it("lists the running offers from the offers service, with their real terms", async () => {
    const e = build({ listOffers: jest.fn(async () => OFFERS) });
    await atRoomList(e);
    await e.say("Koi offer hai?");
    expect(e.actions.listOffers).toHaveBeenCalledWith("ashram-1");
    const rows = e.reply.list.mock.calls.at(-1)![4];
    expect(rows[0].id).toBe("offer:MONSOON10");
    expect(rows[0].title).toBe("MONSOON10");
    expect(rows[0].description).toMatch(/10% off/);
    expect(rows[0].description).toMatch(/max ₹1,000/);
    expect(rows[0].description).toMatch(/min ₹3,000/);
  });

  it("says plainly when there is no offer, and invents none", async () => {
    const e = build();
    await atRoomList(e);
    await e.say("Koi offer hai?");
    expect(e.lastText()).toMatch(/koi offer nahi/);
  });

  it("tapping an offer applies it through the offers/pricing services", async () => {
    const e = build({ listOffers: jest.fn(async () => OFFERS) });
    await atRoomList(e);
    await e.say("", "room:r-deluxe");
    await e.say("", "offer:MONSOON10");
    expect(e.actions.applyPromo).toHaveBeenCalledWith(
      expect.objectContaining({ promoCode: "MONSOON10", rooms: [{ roomId: "r-deluxe", units: 1 }] }),
    );
    expect(e.state().promoCode).toBe("MONSOON10");
  });

  it("explains the service's real reason when an offer does not apply", async () => {
    const e = build({
      listOffers: jest.fn(async () => OFFERS),
      applyPromo: jest.fn(async () => ({
        ok: false,
        reason: "This promo code needs a booking of at least ₹3000",
      })),
    });
    await atRoomList(e);
    await e.say("", "room:r-deluxe");
    await e.say("", "offer:MONSOON10");
    expect(e.texts()).toContain("This promo code needs a booking of at least ₹3000");
    expect(e.state().promoCode).toBeUndefined();
  });
});

describe("coupons", () => {
  it("applies 'ABC123 coupon apply karo' and shows the exact discount from the domain", async () => {
    const e = build();
    await atRoomList(e);
    await e.say("", "room:r-deluxe");
    await e.say("ABC123 coupon apply karo");
    expect(e.actions.applyPromo).toHaveBeenCalledWith(
      expect.objectContaining({ promoCode: "ABC123" }),
    );
    const said = e.texts();
    expect(said).toContain("*ABC123* lag gaya");
    expect(said).toContain("₹500");
    // The summary that follows carries the discount line and the coupon.
    expect(e.lastText()).toMatch(/Discount \(ABC123\): -₹500/);
    expect(e.lastText()).toMatch(/Coupon: ABC123/);
  });

  it("shows the domain's total, not one computed in the conversation", async () => {
    const e = build();
    await atRoomList(e);
    await e.say("", "room:r-deluxe");
    await e.say("Coupon SAVE20 laga do");
    // base 4000 + fee/gst 118 - discount 500 → 3618, straight from the quote.
    expect(e.lastText()).toContain("₹3,618");
  });

  it("rejects an invalid coupon with the reason, and books without it", async () => {
    const e = build({
      applyPromo: jest.fn(async () => ({ ok: false, reason: "This promo code does not exist" })),
    });
    await atRoomList(e);
    await e.say("", "room:r-deluxe");
    await e.say("BADCODE9 coupon laga do");
    expect(e.lastText()).toContain("This promo code does not exist");
    expect(e.state().promoCode).toBeUndefined();
    await e.say("", "confirm:yes");
    expect(e.actions.createStayBooking.mock.calls[0][1].promoCode).toBeUndefined();
  });

  it("rejects an expired coupon with the expiry reason", async () => {
    const e = build({
      applyPromo: jest.fn(async () => ({ ok: false, reason: "This promo code expired on 01/09/2026" })),
    });
    await atRoomList(e);
    await e.say("", "room:r-deluxe");
    await e.say("OLD2025 coupon laga do");
    expect(e.lastText()).toContain("expired on 01/09/2026");
  });

  it("removes an applied coupon and re-prices without it", async () => {
    const e = build();
    await atRoomList(e);
    await e.say("", "room:r-deluxe");
    await e.say("SAVE20 coupon laga do");
    expect(e.state().promoCode).toBe("SAVE20");
    await e.say("Coupon hata do");
    expect(e.state().promoCode).toBeUndefined();
    expect(e.lastQuoteInput().promoCode).toBeUndefined();
    expect(e.texts()).toMatch(/Coupon hata diya|Coupon removed/);
  });

  it("says so when there is no coupon to remove", async () => {
    const e = build();
    await atRoomList(e);
    await e.say("", "room:r-deluxe");
    await e.say("coupon hata do");
    expect(e.lastText()).toMatch(/koi coupon laga hua nahi|No coupon is applied/);
  });

  it("remembers a coupon given before a room is chosen and applies it once one is", async () => {
    const e = build();
    await atRoomList(e);
    await e.say("Coupon SAVE20 laga do");
    expect(e.actions.applyPromo).not.toHaveBeenCalled();
    expect(e.state().promoCode).toBe("SAVE20");
    await e.say("", "room:r-deluxe");
    expect(e.lastQuoteInput().promoCode).toBe("SAVE20");
  });

  it("keeps the coupon across a room change and drops it, with the reason, if it stops fitting", async () => {
    const quote = jest
      .fn()
      .mockImplementationOnce(async (i: any) => quoteFor(i)) // room chosen
      .mockImplementationOnce(async () => {
        throw new BadRequestException("Promo code is only valid for its designated room category");
      })
      .mockImplementation(async (i: any) => quoteFor(i));
    const e = build({ quoteStay: quote });
    await atRoomList(e);
    await e.say("", "room:r-deluxe");
    e.state().promoCode = "ROOMONLY";
    await e.say("1 standard");
    expect(e.texts()).toContain("designated room category");
    expect(e.state().promoCode).toBeUndefined();
    expect(e.lastQuoteInput().promoCode).toBeUndefined();
    expect(e.state().rooms).toEqual(expect.arrayContaining([{ roomId: "r-standard", units: 1 }]));
  });

  it("re-applies the coupon in the same request that books", async () => {
    const e = build();
    await atRoomList(e);
    await e.say("2 deluxe");
    await e.say("ABC123 coupon apply karo");
    await e.say("", "confirm:yes");
    const input = e.actions.createStayBooking.mock.calls[0][1];
    expect(input.promoCode).toBe("ABC123");
    expect(input.rooms).toEqual([{ roomId: "r-deluxe", units: 2 }]);
  });

  it("asks what coupons exist through the offers service, not from memory", async () => {
    const e = build();
    await atRoomList(e);
    await e.say("Koi coupon available hai?");
    expect(e.actions.listOffers).toHaveBeenCalled();
  });
});

describe("add-ons and services", () => {
  it("'parking bhi chahiye' is an add-on, not a switch to the parking flow", async () => {
    const e = build();
    await atRoomList(e);
    await e.say("", "room:r-deluxe");
    await e.say("parking bhi chahiye");
    expect(e.texts()).not.toMatch(/Parking.*(coming|jald|abhi)/i);
    expect(e.state().services).toEqual({ parking: true });
    expect(e.lastQuoteInput().services).toEqual({ parking: true });
    expect(e.session().flow).toBe("stay_booking");
  });

  it("prices the service through the pricing service and shows its line", async () => {
    const e = build();
    await atRoomList(e);
    await e.say("", "room:r-deluxe");
    await e.say("parking bhi chahiye");
    expect(e.lastText()).toMatch(/Parking: ₹200/);
    expect(e.lastText()).toMatch(/Services: ₹200/);
  });

  it("removes a service", async () => {
    const e = build();
    await atRoomList(e);
    await e.say("", "room:r-deluxe");
    await e.say("parking chahiye");
    await e.say("parking hata do");
    expect(e.lastQuoteInput().services).toEqual({ parking: false });
  });

  it("adds a property add-on with its quantity in the website's structure", async () => {
    const e = build();
    await atRoomList(e);
    await e.say("", "room:r-deluxe");
    await e.say("2 extra bed add karo");
    expect(e.lastQuoteInput().addOns).toEqual([{ serviceId: "add-bed", quantity: 2 }]);
    expect(e.lastText()).toMatch(/Extra Bed × 2: ₹1,200/);
  });

  it("carries services and add-ons into the booking", async () => {
    const e = build();
    await atRoomList(e);
    await e.say("", "room:r-deluxe");
    await e.say("prasad chahiye");
    await e.say("1 extra bed add karo");
    await e.say("", "confirm:yes");
    const input = e.actions.createStayBooking.mock.calls[0][1];
    expect(input.services).toEqual({ prasad: true });
    expect(input.addOns).toEqual([{ serviceId: "add-bed", quantity: 1 }]);
  });
});

describe("price breakdown and booking summary", () => {
  it("shows every line the pricing service returned, and the total", async () => {
    const e = build();
    await atRoomList(e);
    await e.say("", "room:r-deluxe");
    const s = e.lastText();
    expect(s).toMatch(/Room charges: ₹4,000/);
    expect(s).toMatch(/Platform fee: ₹100/);
    expect(s).toMatch(/GST \(18%\): ₹18/);
    expect(s).toMatch(/Total: \*₹4,118\*/);
  });

  it("includes property, rooms, dates, nights, guests, cancellation policy and asks for confirmation", async () => {
    const e = build();
    await atRoomList(e);
    await e.say("2 deluxe");
    const s = e.lastText();
    expect(s).toContain("Prem Mandir Dharamshala, Vrindavan");
    expect(s).toContain("2 × Deluxe Room");
    expect(s).toMatch(/Check-in: 1 Oct 2030/);
    expect(s).toMatch(/Check-out: 3 Oct 2030/);
    expect(s).toMatch(/Nights: 2/);
    expect(s).toMatch(/Guests: 2/);
    expect(s).toContain("Free cancellation up to 24 hours");
    const buttons = e.reply.buttons.mock.calls.at(-1)![3];
    expect(buttons.map((b: any) => b.id)).toEqual(["confirm:yes", "change:menu", "confirm:no"]);
  });

  it("'price batao' re-shows the summary with the current server figures", async () => {
    const e = build();
    await atRoomList(e);
    await e.say("", "room:r-deluxe");
    const quotes = e.actions.quoteStay.mock.calls.length;
    await e.say("price batao");
    expect(e.actions.quoteStay.mock.calls.length).toBe(quotes + 1);
    expect(e.lastText()).toMatch(/Total:/);
  });

  it("never asks for confirmation before a room is chosen", async () => {
    const e = build();
    await atRoomList(e);
    await e.say("price batao");
    expect(e.actions.quoteStay).not.toHaveBeenCalled();
    expect(e.actions.createStayBooking).not.toHaveBeenCalled();
  });

  it("the change menu offers rooms, guests, dates, add-ons and coupon", async () => {
    const e = build();
    await atRoomList(e);
    await e.say("", "room:r-deluxe");
    await e.say("", "change:menu");
    const rows = e.reply.list.mock.calls.at(-1)![4];
    expect(rows.map((r: any) => r.id)).toEqual([
      "change:rooms",
      "change:guests",
      "change:dates",
      "change:services",
      "change:coupon",
    ]);
  });

  it("while a coupon is awaited, a bare code is read as the code", async () => {
    const e = build();
    await atRoomList(e);
    await e.say("", "room:r-deluxe");
    await e.say("", "change:coupon");
    await e.say("WELCOME");
    expect(e.actions.applyPromo).toHaveBeenCalledWith(
      expect.objectContaining({ promoCode: "WELCOME" }),
    );
  });
});

describe("booking hold and creation", () => {
  it("creates the booking only after explicit confirmation", async () => {
    const e = build();
    await atRoomList(e);
    await e.say("2 deluxe aur 1 standard");
    expect(e.actions.createStayBooking).not.toHaveBeenCalled();
    await e.say("", "confirm:yes");
    expect(e.actions.createStayBooking).toHaveBeenCalledTimes(1);
  });

  it("creates with the identity resolved for the sender, the full rooms list and the guest name", async () => {
    const e = build();
    await atRoomList(e);
    await e.say("2 deluxe aur 1 standard");
    await e.say("", "confirm:yes");
    const [identity, input] = e.actions.createStayBooking.mock.calls[0];
    expect(identity).toMatchObject({ kind: "guest", whatsappCustomerId: "wa-1" });
    expect(input.rooms).toEqual(
      expect.arrayContaining([
        { roomId: "r-deluxe", units: 2 },
        { roomId: "r-standard", units: 1 },
      ]),
    );
    expect(input.guestName).toBe("Ramesh");
    expect(input.ashramId).toBe("ashram-1");
    expect(input.guests).toBe(2);
  });

  it("accepts a typed 'haan' at the summary as the confirmation", async () => {
    const e = build();
    await atRoomList(e);
    await e.say("", "room:r-deluxe");
    await e.say("haan");
    expect(e.actions.createStayBooking).toHaveBeenCalledTimes(1);
  });

  it("a typed 'nahi' at the summary abandons the booking without creating one", async () => {
    const e = build();
    await atRoomList(e);
    await e.say("", "room:r-deluxe");
    await e.say("nahi");
    expect(e.actions.createStayBooking).not.toHaveBeenCalled();
    expect(e.session().flow).toBeNull();
  });

  it("hands the guest a payment link with the hold time", async () => {
    const e = build();
    await atRoomList(e);
    await e.say("", "room:r-deluxe");
    await e.say("", "confirm:yes");
    expect(e.actions.createPaymentLink).toHaveBeenCalledWith(expect.anything(), "booking-1");
    expect(e.lastText()).toContain("TRV-1");
    expect(e.lastText()).toContain("https://tirvona.com/pay/x");
  });

  it("clears the finished booking's state so the next one starts clean", async () => {
    const e = build();
    await atRoomList(e);
    await e.say("", "room:r-deluxe");
    await e.say("", "confirm:yes");
    expect(e.session().data).toEqual({});
    expect(e.session().flow).toBeNull();
  });

  it("tells the guest plainly when the room went while they were deciding", async () => {
    const e = build({
      createStayBooking: jest.fn(async () => {
        const error: any = new Error("Inventory unavailable");
        error.status = 409;
        throw error;
      }),
    });
    await atRoomList(e);
    await e.say("", "room:r-deluxe");
    await e.say("", "confirm:yes");
    expect(e.lastText()).toMatch(/nahi|sold|room/i);
    expect(e.actions.createPaymentLink).not.toHaveBeenCalled();
  });

  it("books under a matched website account's own identity", async () => {
    const account = { ...guest, kind: "account" as const, userId: "user-1", whatsappCustomerId: null, displayId: null };
    const e = build({}, account as any);
    e.seed({
      userId: "user-1",
      whatsappCustomerId: null,
      displayId: null,
      flow: "stay_booking",
      data: { location: "Vrindavan", checkInDate: "2030-10-01", checkOutDate: "2030-10-03", guests: 2 },
    });
    await e.say("", "stay:ashram-1");
    await e.say("", "room:r-deluxe");
    await e.say("", "confirm:yes");
    expect(e.actions.createStayBooking.mock.calls[0][0]).toMatchObject({
      kind: "account",
      userId: "user-1",
    });
  });
});

describe("conversation context is never lost", () => {
  it("the whole example journey: place, guests, room, count, coupon, checkout time, book", async () => {
    const e = build();
    e.seed({
      flow: "stay_booking",
      data: { location: "Vrindavan", checkInDate: "2030-10-01", checkOutDate: "2030-10-03", guests: 2 },
    });
    await e.say("", "stay:ashram-1");
    await e.say("deluxe room");
    await e.say("2 rooms kar do");
    await e.say("ABC123 coupon laga do");
    await e.say("Checkout 12 baje");
    expect(e.state()).toMatchObject({
      ashramId: "ashram-1",
      location: "Vrindavan",
      guests: 2,
      rooms: [{ roomId: "r-deluxe", units: 2 }],
      promoCode: "ABC123",
      checkOutTime: "12:00",
      checkInDate: "2030-10-01",
    });
    await e.say("Book kar do");
    // "Book kar do" is not a yes/no; it must not restart the flow or lose state.
    expect(e.state().ashramId).toBe("ashram-1");
    expect(e.state().promoCode).toBe("ABC123");
    await e.say("", "confirm:yes");
    const input = e.actions.createStayBooking.mock.calls[0][1];
    expect(input).toMatchObject({
      ashramId: "ashram-1",
      guests: 2,
      promoCode: "ABC123",
      rooms: [{ roomId: "r-deluxe", units: 2 }],
    });
    expect(input.specialRequests).toMatch(/Requested check-out 12:00/);
  });

  it.each(["booking karni hai", "price batao", "ye wala", "change kar do"])(
    "saying %j mid-booking does not restart the flow",
    async (text) => {
      const e = build();
      await atRoomList(e);
      await e.say("2 deluxe");
      await e.say(text);
      expect(e.state()).toMatchObject({
        ashramId: "ashram-1",
        guests: 2,
        rooms: [{ roomId: "r-deluxe", units: 2 }],
        checkInDate: "2030-10-01",
      });
      expect(e.session().flow).toBe("stay_booking");
    },
  );

  it("a correction of the place drops the old property's rooms but keeps dates and guests", async () => {
    const e = build();
    await atRoomList(e);
    await e.say("2 deluxe");
    await e.say("nahi Mathura mein chahiye");
    expect(e.state().rooms).toBeUndefined();
    expect(e.state().ashramId).toBeUndefined();
    expect(e.state()).toMatchObject({ checkInDate: "2030-10-01", guests: 2 });
  });

  it("a fresh session (expired) does not apply a coupon or invent a booking", async () => {
    const e = build();
    // No session is stored: it expired.
    await e.say("Coupon SAVE20 laga do");
    expect(e.actions.applyPromo).not.toHaveBeenCalled();
    expect(e.actions.createStayBooking).not.toHaveBeenCalled();
  });

  it("an expired session cannot be confirmed by a stray 'haan'", async () => {
    const e = build();
    await e.say("haan");
    expect(e.actions.createStayBooking).not.toHaveBeenCalled();
  });

  it("a duplicate confirmation tap after booking creates nothing new", async () => {
    const e = build();
    await atRoomList(e);
    await e.say("", "room:r-deluxe");
    await e.say("", "confirm:yes");
    await e.say("", "confirm:yes");
    expect(e.actions.createStayBooking).toHaveBeenCalledTimes(1);
  });
});

describe("languages", () => {
  it("answers in Hindi (Devanagari) and reads a Devanagari room count", async () => {
    const e = build();
    e.seed({
      language: "hi",
      flow: "stay_booking",
      data: { location: "Vrindavan", checkInDate: "2030-10-01", checkOutDate: "2030-10-03", guests: 2 },
    });
    await e.say("", "stay:ashram-1");
    await e.say("", "room:r-deluxe");
    await e.say("दो कमरे चाहिए");
    expect(e.lastQuoteInput().rooms).toEqual([{ roomId: "r-deluxe", units: 2 }]);
    expect(e.lastText()).toContain("बुकिंग विवरण");
  });

  it("answers in English when addressed in English", async () => {
    const e = build();
    e.seed({
      language: "en",
      flow: "stay_booking",
      data: { location: "Vrindavan", checkInDate: "2030-10-01", checkOutDate: "2030-10-03", guests: 2 },
    });
    await e.say("", "stay:ashram-1");
    await e.say("2 deluxe rooms please");
    expect(e.lastText()).toContain("Booking summary");
    expect(e.lastQuoteInput().rooms).toEqual([{ roomId: "r-deluxe", units: 2 }]);
  });
});

describe("my bookings, cancellation and refund status", () => {
  const BOOKING = {
    _id: "b1",
    bookingId: "TRV-77",
    ashramId: { name: "Prem Mandir Dharamshala" },
    rooms: [{ units: 2, roomId: { name: "Deluxe Room" } }],
    checkInDate: new Date("2030-10-01"),
    checkOutDate: new Date("2030-10-03"),
    guestsCount: 3,
    status: "confirmed",
    paymentStatus: "fully_paid",
    checkInCode: "4821",
    pricing: { totalAmount: 8118 },
    reservationExpiresAt: null,
  };

  it("lists the guest's bookings, each opening its details", async () => {
    const e = build({ myStayBookings: jest.fn(async () => [BOOKING]) });
    await e.say("meri bookings dikhao");
    const rows = e.reply.list.mock.calls.at(-1)![4];
    expect(rows[0].id).toBe("booking:view:b1");
    expect(e.texts()).toContain("TRV-77");
  });

  it("shows the booking's rooms, dates, guests, payment status and arrival code", async () => {
    const e = build({ getBooking: jest.fn(async () => BOOKING) });
    await e.say("", "booking:view:b1");
    const s = e.lastText();
    expect(s).toContain("TRV-77");
    expect(s).toContain("2 × Deluxe Room");
    expect(s).toContain("confirmed");
    expect(s).toContain("fully_paid");
    expect(s).toContain("4821");
    expect(s).toContain("₹8,118");
  });

  it("does not show the arrival code for a booking that is not confirmed", async () => {
    const e = build({
      getBooking: jest.fn(async () => ({ ...BOOKING, status: "pending", paymentStatus: "pending", checkInCode: "4821", reservationExpiresAt: new Date(Date.now() + 60000) })),
    });
    await e.say("", "booking:view:b1");
    expect(e.lastText()).not.toContain("4821");
  });

  it("offers Pay now only for an unpaid booking whose hold is still open", async () => {
    const pending = { ...BOOKING, status: "pending", paymentStatus: "pending", reservationExpiresAt: new Date(Date.now() + 60000) };
    const e = build({ getBooking: jest.fn(async () => pending) });
    await e.say("", "booking:view:b1");
    const ids = e.reply.buttons.mock.calls.at(-1)![3].map((b: any) => b.id);
    expect(ids).toEqual(["booking:pay:b1", "booking:cancel:b1"]);

    const expired = build({
      getBooking: jest.fn(async () => ({ ...pending, reservationExpiresAt: new Date(Date.now() - 1000) })),
    });
    await expired.say("", "booking:view:b1");
    const expiredIds = expired.reply.buttons.mock.calls.at(-1)![3].map((b: any) => b.id);
    expect(expiredIds).toEqual(["booking:cancel:b1"]);
  });

  it("offers no action on a booking that is already cancelled, and shows its refund", async () => {
    const cancelled = { ...BOOKING, status: "cancelled" };
    const e = build({
      getBooking: jest.fn(async () => cancelled),
      refundStatusFor: jest.fn(async () => ({
        decidedRefundAmount: 1600,
        cancellationRefund: { status: "pending" },
        request: null,
      })),
    });
    await e.say("", "booking:view:b1");
    expect(e.lastText()).toMatch(/Refund: ₹1,600 · pending/);
    expect(e.reply.buttons).not.toHaveBeenCalled();
  });

  it("states the refund the domain would give before cancelling, and cancels only on yes", async () => {
    const e = build({ getBooking: jest.fn(async () => BOOKING) });
    await e.say("", "booking:cancel:b1");
    expect(e.actions.previewCancellationRefund).toHaveBeenCalledWith(
      expect.objectContaining({ whatsappCustomerId: "wa-1" }),
      BOOKING,
    );
    expect(e.reply.buttons.mock.calls.at(-1)![2]).toContain("1,600");
    expect(e.actions.cancelBooking).not.toHaveBeenCalled();
    await e.say("", "cancel:yes");
    expect(e.actions.cancelBooking).toHaveBeenCalledTimes(1);
    expect(e.lastText()).toContain("1,600");
  });

  it("does not cancel when the guest says no", async () => {
    const e = build({ getBooking: jest.fn(async () => BOOKING) });
    await e.say("", "booking:cancel:b1");
    await e.say("", "cancel:no");
    expect(e.actions.cancelBooking).not.toHaveBeenCalled();
  });

  it("answers 'mera refund kahan hai' from the refund records", async () => {
    const e = build({
      refundStatuses: jest.fn(async () => [
        {
          bookingId: "TRV-77",
          decidedRefundAmount: 1600,
          cancellationRefund: { amount: 1600, status: "pending" },
          request: { refundNumber: "RFD-1", status: "approved", amount: 1600 },
        },
      ]),
    });
    await e.say("mera refund kahan hai");
    const s = e.lastText();
    expect(s).toContain("TRV-77");
    expect(s).toContain("₹1,600");
    expect(s).toContain("RFD-1: approved");
  });

  it("says plainly when there is no refund on record", async () => {
    const e = build();
    await e.say("refund status");
    expect(e.lastText()).toMatch(/refund darj nahi|refund/i);
    expect(e.actions.refundStatuses).toHaveBeenCalled();
  });

  it("does not let a refund question interrupt a booking in progress", async () => {
    const e = build();
    await atRoomList(e);
    await e.say("2 deluxe");
    await e.say("mera refund kahan hai");
    expect(e.state().rooms).toEqual([{ roomId: "r-deluxe", units: 2 }]);
    expect(e.session().flow).toBe("stay_booking");
  });
});

describe("choosing a destination from a tappable list", () => {
  it("offers real destinations alongside the 'which place' question, most-listed first", async () => {
    const e = build();
    await e.say("Mujhe stay chahiye");
    expect(e.actions.topDestinations).toHaveBeenCalled();
    const rows = e.reply.list.mock.calls.at(-1)![4];
    expect(rows).toEqual([
      { id: "location:Vrindavan", title: "Vrindavan", description: expect.stringContaining("12") },
      { id: "location:Haridwar", title: "Haridwar", description: expect.stringContaining("7") },
    ]);
    // The text prompt still goes out too — tapping is an addition, not a replacement.
    expect(e.texts()).toMatch(/which place|kis jagah|kaunsi jagah/i);
  });

  it("tapping a destination behaves exactly like typing its name", async () => {
    const e = build();
    await e.say("Mujhe stay chahiye");
    await e.say("", "location:Vrindavan");
    expect(e.state().location).toBe("Vrindavan");
    expect(e.session().flow).toBe("stay_booking");
    // A bare place with no dates yet is a browse, exactly as typing
    // "Vrindavan" alone would be — not a silent skip to a booked result.
    expect(e.actions.searchStays).toHaveBeenCalledWith(
      expect.objectContaining({ place: "Vrindavan" }),
    );
    expect(e.state().ashramId).toBeUndefined();
  });

  it("reaches the same room list whether the place was tapped or typed", async () => {
    const tapped = build();
    await tapped.say("Mujhe stay chahiye");
    await tapped.say("", "location:Vrindavan");
    await tapped.say("2 guests ke liye 1 Oct se 3 Oct tak");
    await tapped.say("", "stay:ashram-1");

    const typed = build();
    await typed.say("Vrindavan mein stay chahiye");
    await typed.say("2 guests ke liye 1 Oct se 3 Oct tak");
    await typed.say("", "stay:ashram-1");

    expect(tapped.state().ashramId).toBe(typed.state().ashramId);
    expect(tapped.reply.list.mock.calls.at(-1)![4].map((r: any) => r.id)).toEqual(
      typed.reply.list.mock.calls.at(-1)![4].map((r: any) => r.id),
    );
  });

  it("does not offer a list when there are no destinations to show", async () => {
    const e = build({ topDestinations: jest.fn(async () => []) });
    await e.say("Mujhe stay chahiye");
    expect(e.reply.list).not.toHaveBeenCalled();
    // The plain question still went out.
    expect(e.texts().length).toBeGreaterThan(0);
  });

  it("still asks the question in text even if fetching destinations fails", async () => {
    const e = build({
      topDestinations: jest.fn().mockRejectedValue(new Error("db down")),
    });
    await e.say("Mujhe stay chahiye");
    expect(e.reply.list).not.toHaveBeenCalled();
    expect(e.texts()).toMatch(/which place|kis jagah|kaunsi jagah/i);
  });

  it("re-offers the list on a repeated, unanswered location question", async () => {
    const e = build();
    await e.say("Mujhe stay chahiye");
    // Words the parser is built to never read as a place name (see
    // nlu.ts's PLACE_STOPWORDS hedge-word comment) — so the location slot
    // genuinely stays empty and the same question is asked again.
    await e.say("hmm not sure yet");
    expect(e.state().location).toBeUndefined();
    expect(e.actions.topDestinations).toHaveBeenCalledTimes(2);
  });
});
