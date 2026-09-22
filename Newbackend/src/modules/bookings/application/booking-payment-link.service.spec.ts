import {
  BadRequestException,
  ConflictException,
  GoneException,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { createHmac } from "node:crypto";
import { IS_PUBLIC_KEY } from "../../../common/decorators/public.decorator";
import { PublicBookingPaymentController } from "../presentation/public-booking-payment.controller";
import type { BookingActor } from "../domain/booking-customer";
import {
  PAYMENT_LINK_PURPOSE,
  PAYMENT_LINK_VERSION,
  paymentLinkKey,
  signPaymentLink,
} from "../domain/payment-link-token";
import { BookingPaymentLinkService } from "./booking-payment-link.service";
import { BookingsService } from "./bookings.service";

const JWT = "j".repeat(48);
const KEY_SECRET = "rzp-test-secret";
const BOOKING_ID = "507f1f77bcf86cd799439011";
const OTHER_BOOKING_ID = "507f1f77bcf86cd799439022";

const guestActor: BookingActor = {
  userId: null,
  whatsappCustomerId: "wa-1",
  role: "whatsapp_customer",
  channel: "whatsapp" as any,
  name: "Asha",
  phone: "919999999999",
};

const query = <T>(value: T) => {
  const q: any = {
    populate: () => q,
    session: () => q,
    sort: () => q,
    lean: async () => value,
    then: (resolve: (v: T) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(value).then(resolve, reject),
  };
  return q;
};

const bookingRow = (extra: Record<string, unknown> = {}): any => ({
  _id: BOOKING_ID,
  bookingId: "TRV-9",
  whatsappCustomerId: "wa-1",
  status: "pending",
  paymentStatus: "pending",
  reservationExpiresAt: new Date(Date.now() + 8 * 60_000),
  checkInDate: new Date("2030-10-01T00:00:00.000Z"),
  checkOutDate: new Date("2030-10-03T00:00:00.000Z"),
  occupiedDates: [new Date("2030-10-01"), new Date("2030-10-02")],
  guestsCount: 3,
  ashramId: { name: "Prem Mandir Dharamshala", address: { city: "Vrindavan" } },
  rooms: [{ roomId: { name: "Deluxe Room" }, units: 2 }],
  services: {
    selectedAddOns: [{ name: "Extra Bed", quantity: 1, totalPrice: 600 }],
    prasad: { ordered: false, price: 0 },
    meals: { ordered: false, price: 0 },
    parking: { ordered: true, price: 200 },
    locker: { ordered: false, price: 0 },
  },
  promoCode: "SAVE10",
  offerName: "Monsoon offer",
  pricing: {
    basePrice: 8000,
    servicesPrice: 800,
    extraGuestAmount: 400,
    platformFee: 100,
    gstAmount: 18,
    gstPercent: 18,
    discountAmount: 500,
    totalAmount: 8818,
    currency: "INR",
  },
  ...extra,
});

/** A link service over an in-memory booking, plus the booking service it drives. */
const build = (
  row: any = bookingRow(),
  config: Record<string, unknown> = { jwtSecret: JWT, frontendUrl: "https://tirvona.com" },
) => {
  const model: any = {
    findOne: jest.fn(() => query(row)),
    updateOne: jest.fn(async (_filter: any, update: any) => {
      // Apply the $set so a token issued here verifies against this row.
      Object.assign(row, update.$set);
      return { modifiedCount: 1 };
    }),
  };
  const bookings: any = {
    actorForBooking: jest.fn(async () => guestActor),
    paymentOrder: jest.fn(async () => ({
      demo: false,
      data: { orderId: "order_A", amount: 881_800, currency: "INR", keyId: "rzp_key" },
    })),
    confirmPayment: jest.fn(async () => ({})),
  };
  const service = new BookingPaymentLinkService(
    { get: (key: string) => config[key] } as any,
    bookings,
    model,
  );
  return { service, model, bookings, row };
};

const tokenOf = (url: string) => url.split("/booking/pay/")[1];

describe("issuing a payment link", () => {
  it("issues a link on the public payment page for a booking the guest owns", async () => {
    const { service } = build();
    const link = await service.issue(guestActor, BOOKING_ID);
    expect(link.url).toMatch(/^https:\/\/tirvona\.com\/booking\/pay\/[\w-]+\.[\w-]+$/);
    expect(link.amount).toBe(8818);
    expect(link.reference).toBe("TRV-9");
  });

  it("no longer builds the old unroutable /bookings/:id/pay link", async () => {
    const { service } = build();
    const link = await service.issue(guestActor, BOOKING_ID);
    expect(link.url).not.toContain("/bookings/");
    expect(link.url).not.toContain("order=");
  });

  it("expires with the booking hold when that is sooner than 30 minutes", async () => {
    const hold = new Date(Date.now() + 5 * 60_000);
    const { service } = build(bookingRow({ reservationExpiresAt: hold }));
    const link = await service.issue(guestActor, BOOKING_ID);
    expect(link.expiresAt.getTime()).toBe(hold.getTime());
  });

  it("never lives longer than 30 minutes even if the hold is longer", async () => {
    const { service } = build(
      bookingRow({ reservationExpiresAt: new Date(Date.now() + 3 * 3_600_000) }),
    );
    const link = await service.issue(guestActor, BOOKING_ID);
    expect(link.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(30 * 60_000 + 50);
  });

  it("does not open a Razorpay order when the link is made", async () => {
    const { service, bookings } = build();
    await service.issue(guestActor, BOOKING_ID);
    expect(bookings.paymentOrder).not.toHaveBeenCalled();
  });

  it("stores only the link's id on the booking, never the token", async () => {
    const { service, model } = build();
    const link = await service.issue(guestActor, BOOKING_ID);
    const set = model.updateOne.mock.calls[0][1].$set;
    expect(Object.keys(set)).toEqual(["paymentLink"]);
    expect(JSON.stringify(set)).not.toContain(tokenOf(link.url));
  });

  it("will not issue a link for someone else's booking, and says only 'not found'", async () => {
    const { service } = build();
    await expect(
      service.issue({ ...guestActor, whatsappCustomerId: "wa-other" }, BOOKING_ID),
    ).rejects.toThrow(NotFoundException);
  });

  it("will not issue a link for a website user's booking to a different guest", async () => {
    const { service } = build(bookingRow({ whatsappCustomerId: undefined, customerId: "user-1" }));
    await expect(service.issue(guestActor, BOOKING_ID)).rejects.toThrow(NotFoundException);
  });

  it.each([
    ["already paid", { paymentStatus: "fully_paid", status: "confirmed" }],
    ["cancelled", { status: "cancelled" }],
    ["expired", { status: "expired" }],
    ["hold lapsed", { reservationExpiresAt: new Date(Date.now() - 1000) }],
  ])("will not issue a link for a booking that is %s", async (_label, patch) => {
    const { service } = build(bookingRow(patch));
    await expect(service.issue(guestActor, BOOKING_ID)).rejects.toThrow(
      BadRequestException,
    );
  });

  it("refuses to issue when no signing secret is configured", async () => {
    const { service } = build(bookingRow(), { frontendUrl: "https://tirvona.com" });
    await expect(service.issue(guestActor, BOOKING_ID)).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it("uses a dedicated PAYMENT_LINK_SECRET when one is configured", async () => {
    const explicit = "d".repeat(40);
    const a = build(bookingRow(), { jwtSecret: JWT, paymentLinkSecret: explicit, frontendUrl: "https://t.co" });
    const link = await a.service.issue(guestActor, BOOKING_ID);
    // Verifies under the dedicated key, not the derived one.
    const b = build(a.row, { jwtSecret: JWT, paymentLinkSecret: explicit, frontendUrl: "https://t.co" });
    await expect(b.service.summary(tokenOf(link.url))).resolves.toMatchObject({ status: "payable" });
    const c = build(a.row, { jwtSecret: JWT, frontendUrl: "https://t.co" });
    await expect(c.service.summary(tokenOf(link.url))).rejects.toThrow(NotFoundException);
  });
});

describe("resolving a link", () => {
  it("shows the booking for a valid token", async () => {
    const { service } = build();
    const { url } = await service.issue(guestActor, BOOKING_ID);
    await expect(service.summary(tokenOf(url))).resolves.toMatchObject({
      status: "payable",
      bookingReference: "TRV-9",
    });
  });

  it("rejects an invalid token as not valid, revealing nothing", async () => {
    const { service } = build();
    await expect(service.summary("garbage")).rejects.toThrow(NotFoundException);
    await expect(service.summary("a.b")).rejects.toThrow("This payment link is not valid.");
  });

  it("rejects a token whose signature was altered", async () => {
    const { service } = build();
    const { url } = await service.issue(guestActor, BOOKING_ID);
    const token = tokenOf(url);
    const tampered = token.slice(0, -3) + (token.endsWith("AAA") ? "BBB" : "AAA");
    await expect(service.summary(tampered)).rejects.toThrow(NotFoundException);
  });

  it("rejects an expired token as gone, so the guest knows to ask for a new one", async () => {
    const { service, row } = build();
    const key = paymentLinkKey({ jwtSecret: JWT })!;
    const token = signPaymentLink(
      {
        v: PAYMENT_LINK_VERSION,
        p: PAYMENT_LINK_PURPOSE,
        b: BOOKING_ID,
        j: "jti-1",
        iat: Date.now() - 600_000,
        exp: Date.now() - 1000,
      },
      key,
    );
    row.paymentLink = { jti: "jti-1" };
    await expect(service.summary(token)).rejects.toThrow(GoneException);
  });

  it("rejects a token minted for another purpose", async () => {
    const { service, row } = build();
    const key = paymentLinkKey({ jwtSecret: JWT })!;
    row.paymentLink = { jti: "jti-1" };
    const token = signPaymentLink(
      { v: PAYMENT_LINK_VERSION, p: "parking_pay", b: BOOKING_ID, j: "jti-1", iat: Date.now(), exp: Date.now() + 60_000 },
      key,
    );
    await expect(service.summary(token)).rejects.toThrow(NotFoundException);
  });

  it("a token for one booking cannot read another", async () => {
    const a = build(bookingRow());
    const { url } = await a.service.issue(guestActor, BOOKING_ID);
    // The other booking has its own current link id; A's token names booking A.
    const otherRow = bookingRow({ _id: OTHER_BOOKING_ID, bookingId: "TRV-OTHER", paymentLink: { jti: "someone-elses" } });
    const other = build(otherRow);
    a.model.findOne.mockImplementation((filter: any) =>
      query(String(filter._id) === OTHER_BOOKING_ID ? otherRow : a.row),
    );
    const summary = await a.service.summary(tokenOf(url));
    expect(summary.bookingReference).toBe("TRV-9");
    expect(other.model.findOne).not.toHaveBeenCalled();
  });

  it("a token whose embedded booking id is not an ObjectId is refused before any lookup", async () => {
    const { service, model } = build();
    const key = paymentLinkKey({ jwtSecret: JWT })!;
    const token = signPaymentLink(
      { v: PAYMENT_LINK_VERSION, p: PAYMENT_LINK_PURPOSE, b: "{$ne:null}", j: "x", iat: Date.now(), exp: Date.now() + 60_000 },
      key,
    );
    await expect(service.summary(token)).rejects.toThrow(NotFoundException);
    expect(model.findOne).not.toHaveBeenCalled();
  });

  it("a newer link supersedes an older one", async () => {
    const { service } = build();
    const first = await service.issue(guestActor, BOOKING_ID);
    const second = await service.issue(guestActor, BOOKING_ID);
    await expect(service.summary(tokenOf(second.url))).resolves.toMatchObject({ status: "payable" });
    await expect(service.summary(tokenOf(first.url))).rejects.toThrow(GoneException);
  });

  it("refuses a validly signed token for a booking that has no current link", async () => {
    const { service, row } = build();
    const { url } = await service.issue(guestActor, BOOKING_ID);
    row.paymentLink = undefined;
    await expect(service.summary(tokenOf(url))).rejects.toThrow(GoneException);
  });
});

describe("the payment page's summary is entirely the server's record", () => {
  it("shows the booking, rooms, dates, guests, services, offer and breakdown", async () => {
    const { service } = build();
    const { url } = await service.issue(guestActor, BOOKING_ID);
    const s = await service.summary(tokenOf(url));
    expect(s).toMatchObject({
      status: "payable",
      bookingReference: "TRV-9",
      property: { name: "Prem Mandir Dharamshala", city: "Vrindavan" },
      rooms: [{ name: "Deluxe Room", units: 2 }],
      nights: 2,
      guests: 3,
      addOns: [{ name: "Extra Bed", quantity: 1, totalPrice: 600 }],
      services: [{ key: "parking", price: 200 }],
      offer: { code: "SAVE10", name: "Monsoon offer" },
      amountDue: 8818,
      pricing: {
        basePrice: 8000,
        servicesPrice: 800,
        extraGuestAmount: 400,
        platformFee: 100,
        gstAmount: 18,
        discountAmount: 500,
        totalAmount: 8818,
        currency: "INR",
      },
    });
    expect(s.holdExpiresAt).toBeTruthy();
    expect(s.linkExpiresAt).toBeTruthy();
  });

  it("exposes no contact details or internal identifiers", async () => {
    const { service } = build();
    const { url } = await service.issue(guestActor, BOOKING_ID);
    const json = JSON.stringify(await service.summary(tokenOf(url)));
    expect(json).not.toMatch(/whatsapp|wapp|phone|email|customerId|userId|_id|jti|paymentLink/i);
    expect(json).not.toContain("wa-1");
    expect(json).not.toContain(BOOKING_ID);
  });

  it.each([
    ["paid", { paymentStatus: "fully_paid", status: "confirmed" }, 0],
    ["cancelled", { status: "cancelled" }, 0],
    ["expired", { status: "expired" }, 0],
    ["expired", { reservationExpiresAt: new Date(Date.now() - 1000) }, 0],
  ])("reports a %s booking with nothing due", async (status, patch, due) => {
    const { service, row } = build();
    const { url } = await service.issue(guestActor, BOOKING_ID);
    Object.assign(row, patch);
    const s = await service.summary(tokenOf(url));
    expect(s.status).toBe(status);
    expect(s.amountDue).toBe(due);
  });
});

describe("opening a Razorpay order from the page", () => {
  it("delegates to the booking service with the actor rebuilt from the booking", async () => {
    const { service, bookings } = build();
    const { url } = await service.issue(guestActor, BOOKING_ID);
    const order = await service.createOrder(tokenOf(url));
    expect(bookings.actorForBooking).toHaveBeenCalledWith(expect.objectContaining({ bookingId: "TRV-9" }));
    expect(bookings.paymentOrder).toHaveBeenCalledWith(BOOKING_ID, guestActor);
    expect(order).toEqual({ orderId: "order_A", amount: 881_800, currency: "INR", keyId: "rzp_key" });
  });

  it("takes no amount, booking id or order id from the caller", () => {
    // The only input is the token; the signature says so.
    expect(BookingPaymentLinkService.prototype.createOrder.length).toBe(1);
  });

  it.each([
    ["already paid", { paymentStatus: "fully_paid", status: "confirmed" }, ConflictException],
    ["cancelled", { status: "cancelled" }, BadRequestException],
    ["expired", { status: "expired" }, GoneException],
    ["hold lapsed", { reservationExpiresAt: new Date(Date.now() - 1000) }, GoneException],
  ])("refuses an order for a booking that is %s", async (_l, patch, error) => {
    const { service, row, bookings } = build();
    const { url } = await service.issue(guestActor, BOOKING_ID);
    Object.assign(row, patch);
    await expect(service.createOrder(tokenOf(url))).rejects.toThrow(error as any);
    expect(bookings.paymentOrder).not.toHaveBeenCalled();
  });

  it("refuses an order for an expired or invalid token", async () => {
    const { service, bookings } = build();
    await expect(service.createOrder("garbage")).rejects.toThrow(NotFoundException);
    expect(bookings.paymentOrder).not.toHaveBeenCalled();
  });
});

describe("confirming from the page", () => {
  const proof = {
    razorpay_order_id: "order_A",
    razorpay_payment_id: "pay_X",
    razorpay_signature: "sig",
  };

  it("uses the booking service's own confirmPayment, forcing the razorpay method", async () => {
    const { service, bookings } = build();
    const { url } = await service.issue(guestActor, BOOKING_ID);
    await expect(service.confirm(tokenOf(url), proof)).resolves.toEqual({ status: "paid" });
    expect(bookings.confirmPayment).toHaveBeenCalledWith(BOOKING_ID, guestActor, {
      ...proof,
      method: "razorpay",
    });
  });

  it("cannot be steered to another booking by the request body", async () => {
    const { service, bookings } = build();
    const { url } = await service.issue(guestActor, BOOKING_ID);
    await service.confirm(tokenOf(url), {
      ...proof,
      bookingId: OTHER_BOOKING_ID,
      amount: 1,
      idempotencyKey: "evil",
    } as any);
    const [id, , dto] = bookings.confirmPayment.mock.calls[0];
    expect(id).toBe(BOOKING_ID);
    expect(Object.keys(dto).sort()).toEqual(
      ["method", "razorpay_order_id", "razorpay_payment_id", "razorpay_signature"].sort(),
    );
  });

  it("treats 'already paid' as success — the webhook or an earlier tap got there first", async () => {
    const { service, bookings } = build();
    bookings.confirmPayment.mockRejectedValue(new ConflictException("Booking is already paid"));
    const { url } = await service.issue(guestActor, BOOKING_ID);
    await expect(service.confirm(tokenOf(url), proof)).resolves.toEqual({ status: "paid" });
  });

  it("passes on a rejection (wrong order, bad signature) instead of pretending it worked", async () => {
    const { service, bookings } = build();
    bookings.confirmPayment.mockRejectedValue(
      new BadRequestException("This payment does not belong to this booking"),
    );
    const { url } = await service.issue(guestActor, BOOKING_ID);
    await expect(service.confirm(tokenOf(url), proof)).rejects.toThrow(
      "does not belong to this booking",
    );
  });

  it("does not confirm on an invalid token", async () => {
    const { service, bookings } = build();
    await expect(service.confirm("garbage", proof)).rejects.toThrow(NotFoundException);
    expect(bookings.confirmPayment).not.toHaveBeenCalled();
  });
});

describe("the public controller", () => {
  const proto = PublicBookingPaymentController.prototype as any;

  it.each(["summary", "order", "confirm"])("%s is public — no website login", (method) => {
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, proto[method])).toBe(true);
  });

  it.each(["summary", "order", "confirm"])("%s is rate limited", (method) => {
    const keys = Reflect.getMetadataKeys(proto[method]).join(",");
    expect(keys).toMatch(/THROTTLER/i);
  });

  it.each(["summary", "order", "confirm"])("%s is never cached", (method) => {
    const headers = Reflect.getMetadata("__headers__", proto[method]) ?? [];
    expect(headers).toEqual(
      expect.arrayContaining([{ name: "Cache-Control", value: "no-store" }]),
    );
  });
});

/**
 * The guest's whole payment path, run through the REAL BookingsService payment
 * methods with only the persistence layer stubbed: a guest with no login pays
 * through the link, and every Phase A protection still applies.
 */
describe("a WhatsApp guest paying through the link, with no login", () => {
  const sign = (orderId: string, paymentId: string) =>
    createHmac("sha256", KEY_SECRET).update(`${orderId}|${paymentId}`).digest("hex");

  const proofFor = (orderId: string, paymentId = "pay_X") => ({
    razorpay_order_id: orderId,
    razorpay_payment_id: paymentId,
    razorpay_signature: sign(orderId, paymentId),
  });

  const world = (
    opts: { booking?: any; payment?: any; openOrder?: any } = {},
  ) => {
    const row = opts.booking ?? bookingRow();
    const bookingsService = Object.create(BookingsService.prototype) as any;
    const sentinel = new Error("REACHED_CONFIRMATION");
    const paymentFindOne = jest.fn((filter: any) => {
      // The open-order lookup in paymentOrder vs the binding lookup in confirmPayment.
      if (filter.status === "pending" && filter["gateway.provider"])
        return query(opts.openOrder ?? null);
      return query("payment" in opts ? opts.payment : {
        _id: "pay-1",
        bookingId: BOOKING_ID,
        amount: 8818,
        status: "pending",
        gateway: { orderId: "order_A", provider: "razorpay" },
        save: jest.fn(),
      });
    });
    Object.assign(bookingsService, {
      logger: { warn: jest.fn(), log: jest.fn() },
      config: {
        get: (key: string) =>
          ({ razorpayKeyId: "rzp_key", razorpayKeySecret: KEY_SECRET } as any)[key],
      },
      transactions: { run: jest.fn(async (work: any) => work({})) },
      bookings: {
        findOne: jest.fn(() => query(row)),
        db: {
          model: () => ({
            findById: () => ({
              select: () => ({ lean: async () => ({ name: "Asha", phone: "919999999999" }) }),
            }),
          }),
        },
      },
      payments: { findOne: paymentFindOne, create: jest.fn() },
      paymentEvents: { updateOne: jest.fn().mockResolvedValue({}) },
      notifications: { create: jest.fn().mockResolvedValue({}) },
      repository: {
        confirmInventory: jest.fn(async () => {
          throw sentinel;
        }),
        holdInventory: jest.fn(),
      },
      inventoryHolds: { updateMany: jest.fn() },
      audits: { create: jest.fn() },
      roomUnits: () => [{ roomId: "room-1", units: 2 }],
    });
    const model: any = {
      findOne: jest.fn(() => query(row)),
      updateOne: jest.fn(async (_f: any, u: any) => {
        Object.assign(row, u.$set);
        return {};
      }),
    };
    const links = new BookingPaymentLinkService(
      { get: (k: string) => ({ jwtSecret: JWT, frontendUrl: "https://tirvona.com" } as any)[k] } as any,
      bookingsService,
      model,
    );
    return { links, bookingsService, row, sentinel, paymentFindOne };
  };

  it("issues a link, shows the page, and reuses the open order instead of creating a second", async () => {
    const w = world({ openOrder: { gateway: { orderId: "order_A", provider: "razorpay" } } });
    const { url } = await w.links.issue(guestActor, BOOKING_ID);
    const page = await w.links.summary(tokenOf(url));
    expect(page.amountDue).toBe(8818);
    const order = await w.links.createOrder(tokenOf(url));
    expect(order).toMatchObject({ orderId: "order_A", amount: 881_800, currency: "INR", keyId: "rzp_key" });
    expect(w.bookingsService.payments.create).not.toHaveBeenCalled();
  });

  it("confirms a genuine payment for the guest's own order — reaching the confirmation step", async () => {
    const w = world();
    const { url } = await w.links.issue(guestActor, BOOKING_ID);
    await expect(w.links.confirm(tokenOf(url), proofFor("order_A"))).rejects.toBe(w.sentinel);
  });

  it("rejects a genuinely signed payment against an order that is not this booking's", async () => {
    const w = world({ payment: null });
    const { url } = await w.links.issue(guestActor, BOOKING_ID);
    await expect(
      w.links.confirm(tokenOf(url), proofFor("order_OTHER")),
    ).rejects.toThrow("does not belong to this booking");
    expect(w.bookingsService.repository.confirmInventory).not.toHaveBeenCalled();
  });

  it("rejects a tampered amount on the payment record", async () => {
    const w = world({
      payment: {
        _id: "pay-1",
        bookingId: BOOKING_ID,
        amount: 1,
        status: "pending",
        gateway: { orderId: "order_A" },
        save: jest.fn(),
      },
    });
    const { url } = await w.links.issue(guestActor, BOOKING_ID);
    await expect(w.links.confirm(tokenOf(url), proofFor("order_A"))).rejects.toThrow(
      "payment amount does not match",
    );
  });

  it("a failed payment (bad signature) confirms nothing", async () => {
    const w = world();
    const { url } = await w.links.issue(guestActor, BOOKING_ID);
    await expect(
      w.links.confirm(tokenOf(url), { ...proofFor("order_A"), razorpay_signature: "forged" }),
    ).rejects.toThrow("signature verification failed");
    expect(w.bookingsService.repository.confirmInventory).not.toHaveBeenCalled();
  });

  it("a duplicate confirmation of an already-paid booking is a safe no-op", async () => {
    const w = world();
    const { url } = await w.links.issue(guestActor, BOOKING_ID);
    w.row.paymentStatus = "fully_paid";
    await expect(w.links.confirm(tokenOf(url), proofFor("order_A"))).resolves.toEqual({
      status: "paid",
    });
    expect(w.bookingsService.repository.confirmInventory).not.toHaveBeenCalled();
  });

  it("a payment row already marked successful cannot confirm the booking twice", async () => {
    const w = world({
      payment: {
        _id: "pay-1",
        bookingId: BOOKING_ID,
        amount: 8818,
        status: "success",
        gateway: { orderId: "order_A" },
        save: jest.fn(),
      },
    });
    const { url } = await w.links.issue(guestActor, BOOKING_ID);
    await expect(w.links.confirm(tokenOf(url), proofFor("order_A"))).resolves.toEqual({
      status: "paid",
    });
    expect(w.bookingsService.repository.confirmInventory).not.toHaveBeenCalled();
  });

  it("does not confirm a booking that was cancelled after the link was issued", async () => {
    const w = world();
    const { url } = await w.links.issue(guestActor, BOOKING_ID);
    Object.assign(w.row, {
      status: "cancelled",
      reservationExpiresAt: new Date(Date.now() - 1000),
    });
    await expect(w.links.confirm(tokenOf(url), proofFor("order_A"))).rejects.toThrow(
      "was cancelled",
    );
    expect(w.bookingsService.repository.confirmInventory).not.toHaveBeenCalled();
  });

  it("refuses an order for an expired hold", async () => {
    const w = world();
    const { url } = await w.links.issue(guestActor, BOOKING_ID);
    w.row.reservationExpiresAt = new Date(Date.now() - 1000);
    await expect(w.links.createOrder(tokenOf(url))).rejects.toThrow(GoneException);
  });

  it("the webhook still confirms the guest's booking, rebuilding the guest as the actor", async () => {
    const w = world({
      payment: {
        _id: "pay-1",
        bookingId: BOOKING_ID,
        amount: 8818,
        status: "pending",
        whatsappCustomerId: "wa-1",
        gateway: { orderId: "order_A", provider: "razorpay" },
        save: jest.fn(),
      },
    });
    const spy = jest.spyOn(w.bookingsService, "confirmPayment").mockResolvedValue({} as any);
    await expect(
      w.bookingsService.confirmPaymentFromWebhook("order_A", "pay_X", {
        amountPaise: 881_800,
        currency: "INR",
      }),
    ).resolves.toBe(true);
    expect(spy).toHaveBeenCalledWith(
      BOOKING_ID,
      expect.objectContaining({
        whatsappCustomerId: "wa-1",
        userId: null,
        phone: "919999999999",
      }),
      expect.objectContaining({ razorpay_order_id: "order_A", method: "razorpay" }),
      { amountPaise: 881_800, currency: "INR" },
    );
  });

  it("the webhook rejects a captured amount that differs from the booking total", async () => {
    const w = world();
    await expect(
      w.bookingsService.confirmPayment(
        BOOKING_ID,
        guestActor,
        { ...proofFor("order_A"), method: "razorpay" },
        { amountPaise: 100, currency: "INR" },
      ),
    ).rejects.toThrow("captured amount does not match");
  });

  it("the actor is rebuilt from the booking, so the guest is never confused with a website user", async () => {
    const w = world();
    const actor = await w.bookingsService.actorForBooking(w.row);
    expect(actor).toMatchObject({
      userId: null,
      whatsappCustomerId: "wa-1",
      role: "whatsapp_customer",
      phone: "919999999999",
    });
    expect(actor.principal).toBeUndefined();
  });
});
