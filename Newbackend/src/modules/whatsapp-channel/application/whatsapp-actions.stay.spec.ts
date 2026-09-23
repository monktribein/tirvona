import { BadRequestException, NotFoundException } from "@nestjs/common";
import { WhatsAppActionsService } from "./whatsapp-actions.service";

const guest = {
  kind: "guest",
  userId: null,
  whatsappCustomerId: "wa-1",
  displayId: "WAPP-1",
  phone: "919999999999",
  name: "Asha",
  language: "hinglish",
  status: "active",
} as any;

const account = {
  kind: "account",
  userId: "user-1",
  whatsappCustomerId: null,
  displayId: null,
  phone: "919999999999",
  name: "Ravi",
  language: null,
  status: "active",
} as any;

const build = (
  opts: {
    rooms?: any[];
    calendar?: (roomId: string) => any;
    quote?: jest.Mock;
    validate?: jest.Mock;
    destinations?: { city: string; state: string; count: number }[];
  } = {},
) => {
  const ashrams: any = {
    publicList: jest.fn(),
    publicCalendar: jest.fn(async (roomId: string) => opts.calendar?.(roomId) ?? []),
    // The website's own stay-page record: approved property, active rooms.
    detail: jest.fn(async () => ({ ashram: { _id: "ashram-1" }, rooms: opts.rooms ?? [] })),
    destinations: jest.fn(async () => opts.destinations ?? []),
  };
  const bookings: any = {
    quote:
      opts.quote ??
      jest.fn(async () => ({
        pricing: { totalAmount: 5000, discountAmount: 0 },
        nights: 2,
      })),
    create: jest.fn(async () => ({ _id: "b1", bookingId: "TRV-1" })),
    previewCancellation: jest.fn(async () => ({ refundAmount: 1234 })),
    historyFor: jest.fn(async () => []),
  };
  const offers: any = {
    active: jest.fn(async () => []),
    validate:
      opts.validate ??
      jest.fn(async () => ({ valid: true, offer: { promoCode: "SAVE10" }, discountAmount: 500 })),
  };
  const refunds: any = { statusForBooking: jest.fn() };
  const links: any = {
    issue: jest.fn(async () => ({
      url: "https://tirvona.com/booking/pay/TOKEN",
      expiresAt: new Date(Date.now() + 600_000),
      amount: 5000,
      reference: "TRV-1",
    })),
  };
  const parkingDiscovery: any = { search: jest.fn(), detail: jest.fn(), quote: jest.fn() };
  const parkingBookings: any = {
    createFor: jest.fn(),
    listMineFor: jest.fn(),
    getFor: jest.fn(),
    refundPreviewFor: jest.fn(),
    cancelFor: jest.fn(),
  };
  const parkingLinks: any = { issue: jest.fn() };
  const service = new WhatsAppActionsService(
    ashrams,
    bookings,
    offers,
    refunds,
    links,
    parkingDiscovery,
    parkingBookings,
    parkingLinks,
    { get: jest.fn() } as any,
  );
  return { service, ashrams, bookings, offers, refunds, links, parkingDiscovery, parkingBookings, parkingLinks };
};

const stay = (extra: Record<string, unknown> = {}) => ({
  ashramId: "ashram-1",
  rooms: [
    { roomId: "r1", units: 2 },
    { roomId: "r2", units: 1 },
  ],
  checkIn: new Date("2030-10-01T00:00:00.000Z"),
  checkOut: new Date("2030-10-03T00:00:00.000Z"),
  guests: 5,
  ...extra,
});

describe("quoteStay passes the website's request structure to the pricing service", () => {
  it("sends every room with its units, the total room count, services and coupon", async () => {
    const { service, bookings } = build();
    await service.quoteStay(
      stay({
        promoCode: "save10",
        addOns: [{ serviceId: "add-1", quantity: 2 }],
        services: { parking: true },
      }),
    );
    const dto = bookings.quote.mock.calls[0][0];
    expect(dto).toMatchObject({
      ashramId: "ashram-1",
      rooms: [
        { roomId: "r1", units: 2 },
        { roomId: "r2", units: 1 },
      ],
      roomsBookedCount: 3,
      guestsCount: 5,
      promoCode: "SAVE10",
      services: {
        selectedAddOns: [{ serviceId: "add-1", quantity: 2 }],
        parking: { ordered: true },
        prasad: { ordered: false },
      },
    });
  });

  it("returns the pricing service's answer untouched", async () => {
    const answer = { pricing: { totalAmount: 7777, gstAmount: 1 }, nights: 3 };
    const { service } = build({ quote: jest.fn(async () => answer) });
    await expect(service.quoteStay(stay())).resolves.toBe(answer);
  });
});

describe("applyPromo follows the website's validate-then-quote sequence", () => {
  const priced = (discount: number) =>
    jest
      .fn()
      // 1st call: the stay without the code (its total is the gross payable).
      .mockResolvedValueOnce({ pricing: { totalAmount: 5000, discountAmount: 0 } })
      // 2nd call: the stay with the code.
      .mockResolvedValueOnce({
        pricing: { totalAmount: 5000 - discount, discountAmount: discount },
        coupon: { promoCode: "SAVE10" },
      });

  it("validates against the server's gross payable amount, then prices with the code", async () => {
    const quote = priced(500);
    const { service, offers } = build({ quote });
    const result = await service.applyPromo({ ...stay(), promoCode: "SAVE10" });
    expect(quote.mock.calls[0][0].promoCode).toBeUndefined();
    expect(offers.validate).toHaveBeenCalledWith({
      promoCode: "SAVE10",
      bookingAmount: 5000,
      ashramId: "ashram-1",
    });
    expect(quote.mock.calls[1][0].promoCode).toBe("SAVE10");
    expect(result).toMatchObject({ ok: true, discountAmount: 500 });
  });

  it("returns the offers service's own reason when the code is refused", async () => {
    const validate = jest
      .fn()
      .mockRejectedValue(new BadRequestException("This promo code expired on 01/01/2026"));
    const quote = priced(0);
    const { service } = build({ quote, validate });
    await expect(
      service.applyPromo({ ...stay(), promoCode: "OLD10" }),
    ).resolves.toEqual({ ok: false, reason: "This promo code expired on 01/01/2026" });
    // The stay was never re-priced with a code that did not validate.
    expect(quote).toHaveBeenCalledTimes(1);
  });

  it("returns the pricing service's reason when the code does not fit the booking", async () => {
    const quote = jest
      .fn()
      .mockResolvedValueOnce({ pricing: { totalAmount: 5000 } })
      .mockRejectedValueOnce(
        new BadRequestException("Promo code is only valid for its designated room category"),
      );
    const { service } = build({ quote });
    await expect(
      service.applyPromo({ ...stay(), promoCode: "ROOMONLY" }),
    ).resolves.toEqual({
      ok: false,
      reason: "Promo code is only valid for its designated room category",
    });
  });

  it("does not apply a code that would take nothing off the price", async () => {
    const { service } = build({ quote: priced(0) });
    const result = await service.applyPromo({ ...stay(), promoCode: "FREEUPGRADE" });
    expect(result.ok).toBe(false);
  });

  it("does not swallow an unexpected failure", async () => {
    const { service } = build({
      quote: jest.fn().mockRejectedValue(new Error("db down")),
    });
    await expect(
      service.applyPromo({ ...stay(), promoCode: "SAVE10" }),
    ).rejects.toThrow("db down");
  });

  it("cannot produce a price the pricing service did not", async () => {
    const { service } = build({ quote: priced(500) });
    const result: any = await service.applyPromo({ ...stay(), promoCode: "SAVE10" });
    expect(result.quote.pricing.totalAmount).toBe(4500);
  });
});

describe("createStayBooking", () => {
  it("creates through BookingsService.create with the same payload the quote used", async () => {
    const { service, bookings } = build();
    await service.createStayBooking(
      guest,
      stay({ promoCode: "SAVE10", services: { meals: true } }),
    );
    const [actor, dto] = bookings.create.mock.calls[0];
    expect(actor).toMatchObject({ userId: null, whatsappCustomerId: "wa-1" });
    expect(dto).toMatchObject({
      roomsBookedCount: 3,
      promoCode: "SAVE10",
      services: { meals: { ordered: true } },
    });
  });

  it("books an account-matched sender under the account, not a WAPP guest", async () => {
    const { service, bookings } = build();
    await service.createStayBooking(account, stay());
    expect(bookings.create.mock.calls[0][0]).toMatchObject({
      userId: "user-1",
      whatsappCustomerId: null,
    });
  });
});

describe("roomsFor reads availability from the public calendar", () => {
  const room = (id: string, extra: Record<string, unknown> = {}) => ({
    _id: id,
    name: `Room ${id}`,
    capacity: 3,
    basePrice: 2000,
    ...extra,
  });
  const days = (...counts: (number | "closed")[]) =>
    counts.map((c, i) => ({
      date: `2030-10-0${i + 1}`,
      available: c === "closed" ? 5 : c,
      isClosed: c === "closed",
    }));
  const dates = {
    checkIn: new Date("2030-10-01T00:00:00.000Z"),
    checkOut: new Date("2030-10-03T00:00:00.000Z"),
  };

  it("reports the fewest open units across the nights of the stay", async () => {
    const { service } = build({
      rooms: [room("r1")],
      calendar: () => days(4, 2, 9),
    });
    const [r1] = await service.roomsFor("ashram-1", dates);
    // nights are 1 Oct and 2 Oct; 3 Oct is checkout day and is ignored.
    expect(r1.unitsLeft).toBe(2);
  });

  it("treats a closed night as nothing left", async () => {
    const { service } = build({
      rooms: [room("r1")],
      calendar: () => days(4, "closed"),
    });
    expect((await service.roomsFor("ashram-1", dates))[0].unitsLeft).toBe(0);
  });

  it("reports unknown, not zero, when the calendar cannot be read", async () => {
    const { service, ashrams } = build({ rooms: [room("r1")] });
    ashrams.publicCalendar.mockRejectedValue(new Error("boom"));
    expect((await service.roomsFor("ashram-1", dates))[0].unitsLeft).toBeNull();
  });

  it("returns plain categories when no dates are given", async () => {
    const { service, ashrams } = build({ rooms: [room("r1")] });
    const rows = await service.roomsFor("ashram-1");
    expect(rows[0].unitsLeft).toBeUndefined();
    expect(ashrams.publicCalendar).not.toHaveBeenCalled();
  });

  it("asks the calendar for exactly the nights of the stay", async () => {
    const { service, ashrams } = build({ rooms: [room("r1")], calendar: () => days(1, 1) });
    await service.roomsFor("ashram-1", dates);
    expect(ashrams.publicCalendar).toHaveBeenCalledWith("r1", "2030-10-01", "2030-10-02");
  });
});

describe("roomsFor reads live room data the way the website's stay page does", () => {
  it("returns every active category, cheapest selling price first — none dropped past ten", async () => {
    const rooms = Array.from({ length: 13 }, (_, i) => ({
      _id: `r${i}`,
      name: `Room ${i}`,
      basePrice: 3000,
      sellingPrice: 3000 - i * 100,
    }));
    const { service } = build({ rooms });
    const rows = await service.roomsFor("ashram-1");
    expect(rows).toHaveLength(13);
    expect(rows[0]._id).toBe("r12");
    expect(rows[0].sellingPrice).toBe(1800);
  });

  it("is read through AshramsService.detail, which only serves an approved, live property", async () => {
    const { service, ashrams } = build();
    ashrams.detail.mockRejectedValue(new NotFoundException("Stay not found"));
    await expect(service.roomsFor("unapproved-or-deleted")).resolves.toEqual([]);
    expect(ashrams.detail).toHaveBeenCalledWith("unapproved-or-deleted");
  });

  it("sees a room the owner adds, and stops offering one they disable, on the very next call", async () => {
    const { service, ashrams } = build();
    ashrams.detail
      .mockResolvedValueOnce({ ashram: {}, rooms: [{ _id: "r1", name: "Old" }] })
      .mockResolvedValueOnce({
        ashram: {},
        rooms: [{ _id: "r2", name: "New" }],
      });
    expect((await service.roomsFor("ashram-1")).map((r) => r._id)).toEqual(["r1"]);
    expect((await service.roomsFor("ashram-1")).map((r) => r._id)).toEqual(["r2"]);
  });

  it("surfaces a database failure instead of pretending there are no rooms", async () => {
    const { service, ashrams } = build();
    ashrams.detail.mockRejectedValue(new Error("connection reset"));
    await expect(service.roomsFor("ashram-1")).rejects.toThrow("connection reset");
  });
});

describe("searchStays pages through the website's own search", () => {
  it("asks publicList for the requested page and reports how many pages exist", async () => {
    const { service, ashrams } = build();
    ashrams.publicList.mockResolvedValue({
      data: [{ _id: "a9", name: "Ninth" }],
      page: 2,
      totalPages: 3,
    });
    const rows = await service.searchStays({ place: "Vrindavan", page: 2 });
    expect(ashrams.publicList).toHaveBeenCalledWith(
      expect.objectContaining({ query: "Vrindavan", page: 2, limit: 8 }),
    );
    expect(rows.map((r) => r._id)).toEqual(["a9"]);
    expect(rows.page).toBe(2);
    expect(rows.totalPages).toBe(3);
  });

  it("runs the query every time, so a stay approved a minute ago is in the next search", async () => {
    const { service, ashrams } = build();
    ashrams.publicList
      .mockResolvedValueOnce({ data: [], totalPages: 1 })
      .mockResolvedValueOnce({ data: [{ _id: "new", name: "Just approved" }], totalPages: 1 });
    expect(await service.searchStays({ place: "Prayagraj" })).toHaveLength(0);
    expect((await service.searchStays({ place: "Prayagraj" }))[0].name).toBe("Just approved");
    expect(ashrams.publicList).toHaveBeenCalledTimes(2);
  });
});

describe("topDestinations reads the same aggregation the website's destinations page uses", () => {
  it("orders cities by how many stays they actually have, most first", async () => {
    const { service, ashrams } = build({
      destinations: [
        { city: "Haridwar", state: "UP", count: 3 },
        { city: "Vrindavan", state: "UP", count: 12 },
        { city: "Rishikesh", state: "UP", count: 7 },
      ],
    });
    const rows = await service.topDestinations();
    expect(ashrams.destinations).toHaveBeenCalled();
    expect(rows).toEqual([
      { city: "Vrindavan", count: 12 },
      { city: "Rishikesh", count: 7 },
      { city: "Haridwar", count: 3 },
    ]);
  });

  it("caps the list at the given limit", async () => {
    const { service } = build({
      destinations: Array.from({ length: 20 }, (_, i) => ({
        city: `City${i}`,
        state: "UP",
        count: 20 - i,
      })),
    });
    expect(await service.topDestinations(5)).toHaveLength(5);
  });

  it("returns an empty list rather than invent a city when there are none", async () => {
    const { service } = build({ destinations: [] });
    expect(await service.topDestinations()).toEqual([]);
  });
});

describe("propertyDetails, listOffers and previews read the domain services", () => {
  it("maps the website's detail record, including only enabled add-ons", async () => {
    const { service, ashrams } = build();
    ashrams.detail.mockResolvedValue({
      ashram: {
        _id: "ashram-1",
        name: "Prem Mandir Dharamshala",
        description: "Near Prem Mandir",
        address: { city: "Vrindavan", state: "UP" },
        amenities: ["WiFi"],
        policies: { checkInTime: "12:00", checkOutTime: "10:00", cancellationPolicy: "Free till 24h" },
        addOnServices: [
          { _id: "a1", name: "Extra Bed", price: 300, unit: "per_night", maxQuantity: 2 },
        ],
      },
      rooms: [],
    });
    const details = await service.propertyDetails("ashram-1");
    expect(details).toMatchObject({
      name: "Prem Mandir Dharamshala",
      city: "Vrindavan",
      policies: { checkInTime: "12:00", cancellationPolicy: "Free till 24h" },
      addOns: [{ id: "a1", name: "Extra Bed", price: 300 }],
    });
  });

  it("returns null for a property that is not bookable", async () => {
    const { service, ashrams } = build();
    ashrams.detail.mockRejectedValue(new NotFoundException("Stay not found"));
    await expect(service.propertyDetails("x")).resolves.toBeNull();
  });

  it("lists offers through the offers service scoped to the stay", async () => {
    const { service, offers } = build();
    offers.active.mockResolvedValue([
      {
        _id: "o1",
        promoCode: "SAVE10",
        offerTitle: "Monsoon",
        discountType: "Percentage",
        discountValue: 10,
        minimumBookingAmount: 1000,
        validTill: new Date("2030-12-31"),
      },
    ]);
    const list = await service.listOffers("ashram-1");
    expect(offers.active).toHaveBeenCalledWith(
      expect.objectContaining({ ashramId: "ashram-1", status: "active" }),
    );
    expect(list[0]).toMatchObject({ promoCode: "SAVE10", discountValue: 10 });
  });

  it("previews a cancellation refund through the booking service", async () => {
    const { service, bookings } = build();
    await expect(
      service.previewCancellationRefund(guest, { _id: "b1" }),
    ).resolves.toBe(1234);
    expect(bookings.previewCancellation).toHaveBeenCalledWith(
      "b1",
      expect.objectContaining({ whatsappCustomerId: "wa-1" }),
    );
  });

  it("reports refund status only for the customer's own cancelled bookings", async () => {
    const { service, bookings, refunds } = build();
    bookings.historyFor.mockResolvedValue([
      { _id: "b1", status: "cancelled" },
      { _id: "b2", status: "confirmed" },
    ]);
    refunds.statusForBooking.mockResolvedValue({ bookingId: "TRV-1" });
    const statuses = await service.refundStatuses(guest);
    expect(refunds.statusForBooking).toHaveBeenCalledTimes(1);
    expect(refunds.statusForBooking).toHaveBeenCalledWith(
      expect.objectContaining({ whatsappCustomerId: "wa-1" }),
      "b1",
    );
    expect(statuses).toEqual([{ bookingId: "TRV-1" }]);
  });
});

describe("createPaymentLink issues a signed link and creates no order", () => {
  it("delegates to the payment-link service with the verified identity", async () => {
    const { service, links, bookings } = build();
    const link = await service.createPaymentLink(guest, "b1");
    expect(links.issue).toHaveBeenCalledWith(
      expect.objectContaining({ whatsappCustomerId: "wa-1" }),
      "b1",
    );
    expect(link.url).toBe("https://tirvona.com/booking/pay/TOKEN");
    expect(link.url).not.toContain("/bookings/");
    // No Razorpay order is opened when the link is made.
    expect(bookings.create).not.toHaveBeenCalled();
  });

  it("never asks the website booking service for a payment order", async () => {
    const { service, bookings } = build();
    (bookings as any).paymentOrder = jest.fn();
    await service.createPaymentLink(account, "b1");
    expect((bookings as any).paymentOrder).not.toHaveBeenCalled();
  });
});
