import {
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { createHmac } from "node:crypto";
import { BookingsService } from "./bookings.service";
import type { BookingActor } from "../domain/booking-customer";

const KEY_SECRET = "test-key-secret";

const sign = (orderId: string, paymentId: string) =>
  createHmac("sha256", KEY_SECRET).update(`${orderId}|${paymentId}`).digest("hex");

/** A mongoose-style query that supports .session()/.sort()/.lean(). */
const query = <T>(value: T) => {
  const q: any = {
    session: () => q,
    sort: () => q,
    lean: async () => value,
    then: (resolve: (v: T) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(value).then(resolve, reject),
  };
  return q;
};

const owner: BookingActor = {
  userId: "user-1",
  whatsappCustomerId: null,
  role: "customer",
  channel: "web" as any,
  principal: { id: "user-1", role: "customer" } as any,
};

const guest: BookingActor = {
  userId: null,
  whatsappCustomerId: "wa-1",
  role: "whatsapp_customer",
  channel: "whatsapp" as any,
};

const booking = (extra: Record<string, unknown> = {}) => ({
  _id: "booking-1",
  bookingId: "TRV-1",
  customerId: "user-1",
  ashramId: "ashram-1",
  status: "pending",
  paymentStatus: "pending",
  reservationExpiresAt: new Date(Date.now() + 5 * 60_000),
  pricing: { totalAmount: 2000 },
  occupiedDates: [new Date("2030-10-01")],
  roomsBookedCount: 1,
  ...extra,
});

const pendingPayment = (extra: Record<string, unknown> = {}) => ({
  _id: "pay-1",
  bookingId: "booking-1",
  amount: 2000,
  status: "pending",
  gateway: { orderId: "order_A", provider: "razorpay" },
  save: jest.fn(),
  ...extra,
});

const dtoFor = (orderId: string, paymentId = "pay_X") => ({
  razorpay_order_id: orderId,
  razorpay_payment_id: paymentId,
  razorpay_signature: sign(orderId, paymentId),
  method: "razorpay",
});

const createService = (
  opts: { booking?: any; payment?: any; prior?: any } = {},
) => {
  const service = Object.create(BookingsService.prototype) as any;
  const bookingRow = "booking" in opts ? opts.booking : booking();
  const paymentFindOne = jest.fn(() => query("payment" in opts ? opts.payment : pendingPayment()));
  const sentinel = new Error("REACHED_CONFIRMATION");
  Object.assign(service, {
    logger: { warn: jest.fn(), log: jest.fn() },
    config: {
      get: (key: string) => (key === "razorpayKeySecret" ? KEY_SECRET : undefined),
    },
    transactions: { run: jest.fn(async (work: any) => work({})) },
    bookings: { findOne: jest.fn(() => query(bookingRow)) },
    payments: {
      findOne: paymentFindOne,
    },
    paymentEvents: { updateOne: jest.fn().mockResolvedValue({}) },
    notifications: { create: jest.fn().mockResolvedValue({}) },
    inventoryHolds: { updateMany: jest.fn() },
    audits: { create: jest.fn() },
    // The first thing that runs once the payment has been accepted. Reaching
    // it proves the guard passed; it throws so the test need not model the
    // whole confirmation.
    repository: {
      confirmInventory: jest.fn(async () => {
        throw sentinel;
      }),
      holdInventory: jest.fn(),
    },
    roomUnits: () => [{ roomId: "room-1", units: 1 }],
  });
  return { service, paymentFindOne, sentinel };
};

describe("BookingsService.confirmPayment order ↔ booking binding", () => {
  it("looks the payment up by this booking AND the submitted Razorpay order id", async () => {
    const { service, paymentFindOne, sentinel } = createService();
    await expect(
      service.confirmPayment("booking-1", owner, dtoFor("order_A")),
    ).rejects.toBe(sentinel);
    expect(paymentFindOne).toHaveBeenCalledWith({
      bookingId: "booking-1",
      "gateway.orderId": "order_A",
    });
  });

  it("rejects a genuinely-signed payment made against an order that is not this booking's", async () => {
    // Signature is valid for (order_OTHER, pay_X) but this booking has no
    // payment row carrying order_OTHER.
    const { service } = createService({ payment: null });
    await expect(
      service.confirmPayment("booking-1", owner, dtoFor("order_OTHER")),
    ).rejects.toThrow("does not belong to this booking");
    expect(service.repository.confirmInventory).not.toHaveBeenCalled();
    expect(service.repository.holdInventory).not.toHaveBeenCalled();
    expect(service.paymentEvents.updateOne).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        $setOnInsert: expect.objectContaining({ eventType: "payment_rejected" }),
      }),
      expect.anything(),
    );
  });

  it("rejects a payment row that belongs to a different booking", async () => {
    const { service } = createService({
      payment: pendingPayment({ bookingId: "booking-2" }),
    });
    await expect(
      service.confirmPayment("booking-1", owner, dtoFor("order_A")),
    ).rejects.toThrow(BadRequestException);
  });

  it("rejects when the payment amount was tampered away from the booking total", async () => {
    const { service } = createService({
      payment: pendingPayment({ amount: 1 }),
    });
    await expect(
      service.confirmPayment("booking-1", owner, dtoFor("order_A")),
    ).rejects.toThrow("payment amount does not match");
    expect(service.repository.confirmInventory).not.toHaveBeenCalled();
  });

  it("rejects when the booking total itself does not match the order that was paid", async () => {
    const { service } = createService({
      booking: booking({ pricing: { totalAmount: 5000 } }),
    });
    await expect(
      service.confirmPayment("booking-1", owner, dtoFor("order_A")),
    ).rejects.toThrow("payment amount does not match");
  });

  it("rejects a webhook whose captured amount differs from the booking total", async () => {
    const { service } = createService();
    await expect(
      service.confirmPayment("booking-1", owner, dtoFor("order_A"), {
        amountPaise: 100,
        currency: "INR",
      }),
    ).rejects.toThrow("captured amount does not match");
  });

  it("rejects a non-INR capture", async () => {
    const { service } = createService();
    await expect(
      service.confirmPayment("booking-1", owner, dtoFor("order_A"), {
        amountPaise: 200_000,
        currency: "USD",
      }),
    ).rejects.toThrow("Unexpected payment currency");
  });

  it("accepts the matching captured amount and proceeds to confirm", async () => {
    const { service, sentinel } = createService();
    await expect(
      service.confirmPayment("booking-1", owner, dtoFor("order_A"), {
        amountPaise: 200_000,
        currency: "INR",
      }),
    ).rejects.toBe(sentinel);
  });

  it("refuses to confirm twice: a payment already marked success is a conflict", async () => {
    const { service } = createService({
      payment: pendingPayment({ status: "success" }),
    });
    await expect(
      service.confirmPayment("booking-1", owner, dtoFor("order_A")),
    ).rejects.toThrow(ConflictException);
    expect(service.repository.confirmInventory).not.toHaveBeenCalled();
  });

  it("refuses an already-paid booking", async () => {
    const { service } = createService({
      booking: booking({ paymentStatus: "fully_paid" }),
    });
    await expect(
      service.confirmPayment("booking-1", owner, dtoFor("order_A")),
    ).rejects.toThrow("already paid");
  });

  it("does not confirm a cancelled booking even with a valid order and signature", async () => {
    const { service } = createService({
      booking: booking({
        status: "cancelled",
        reservationExpiresAt: new Date(Date.now() - 60_000),
      }),
    });
    await expect(
      service.confirmPayment("booking-1", owner, dtoFor("order_A")),
    ).rejects.toThrow("was cancelled");
    expect(service.repository.confirmInventory).not.toHaveBeenCalled();
  });

  it("rejects a bad signature before touching the payment or booking", async () => {
    const { service, paymentFindOne } = createService();
    await expect(
      service.confirmPayment("booking-1", owner, {
        ...dtoFor("order_A"),
        razorpay_signature: "deadbeef",
      }),
    ).rejects.toThrow("signature verification failed");
    expect(paymentFindOne).not.toHaveBeenCalled();
  });

  it("does not let another customer pay for this booking", async () => {
    const { service } = createService();
    await expect(
      service.confirmPayment(
        "booking-1",
        { ...owner, userId: "someone-else", principal: undefined },
        dtoFor("order_A"),
      ),
    ).rejects.toThrow("belongs to someone else");
  });

  it("scopes an idempotency key to the booking so it cannot replay another booking's result", async () => {
    const { service, paymentFindOne, sentinel } = createService();
    // No prior success under this key for this booking; the order lookup
    // still resolves normally.
    paymentFindOne.mockImplementation(((filter: any) =>
      query("idempotencyKey" in filter ? null : pendingPayment())) as any);
    await expect(
      service.confirmPayment("booking-1", owner, {
        ...dtoFor("order_A"),
        idempotencyKey: "key-1",
      }),
    ).rejects.toBe(sentinel);
    expect(paymentFindOne).toHaveBeenCalledWith({
      idempotencyKey: "key-1",
      bookingId: "booking-1",
      status: "success",
    });
  });
});

describe("BookingsService.confirmPayment for a WhatsApp guest", () => {
  it("confirms a guest's own booking through the same binding", async () => {
    const { service, sentinel } = createService({
      booking: booking({ customerId: undefined, whatsappCustomerId: "wa-1" }),
    });
    await expect(
      service.confirmPayment("booking-1", guest, dtoFor("order_A")),
    ).rejects.toBe(sentinel);
  });

  it("does not let a guest pay for a website user's booking", async () => {
    const { service } = createService();
    await expect(
      service.confirmPayment("booking-1", guest, dtoFor("order_A")),
    ).rejects.toThrow("belongs to someone else");
  });
});

describe("BookingsService.confirmPaymentFromWebhook", () => {
  const withWebhook = (payment: any) => {
    const { service } = createService();
    (service as any).payments.findOne = jest.fn(() => query(payment));
    (service as any).actorFromPayment = jest.fn().mockResolvedValue(owner);
    return service;
  };

  it("ignores an order that no booking payment owns, so other modules can claim it", async () => {
    const service = withWebhook(null);
    await expect(
      service.confirmPaymentFromWebhook("order_ZZZ", "pay_1"),
    ).resolves.toBe(false);
  });

  it("forwards the captured amount into the shared confirmation guard", async () => {
    const service = withWebhook(pendingPayment());
    const spy = jest.spyOn(service, "confirmPayment").mockResolvedValue({} as any);
    await service.confirmPaymentFromWebhook("order_A", "pay_1", {
      amountPaise: 200_000,
      currency: "INR",
    });
    expect(spy).toHaveBeenCalledWith(
      "booking-1",
      owner,
      expect.objectContaining({ razorpay_order_id: "order_A" }),
      { amountPaise: 200_000, currency: "INR" },
    );
  });

  it("treats a duplicate webhook for an already-paid booking as a safe no-op", async () => {
    const service = withWebhook(pendingPayment());
    jest
      .spyOn(service, "confirmPayment")
      .mockRejectedValue(new ConflictException("Booking is already paid"));
    await expect(
      service.confirmPaymentFromWebhook("order_A", "pay_1"),
    ).resolves.toBe(true);
  });

  it("surfaces an amount mismatch instead of silently confirming", async () => {
    const service = withWebhook(pendingPayment());
    jest
      .spyOn(service, "confirmPayment")
      .mockRejectedValue(new BadRequestException("captured amount does not match"));
    await expect(
      service.confirmPaymentFromWebhook("order_A", "pay_1", { amountPaise: 1 }),
    ).rejects.toThrow(BadRequestException);
  });
});

describe("BookingsService.paymentOrder", () => {
  const withOrders = (open: any, b = booking()) => {
    const service = Object.create(BookingsService.prototype) as any;
    Object.assign(service, {
      config: {
        get: (key: string) =>
          key === "razorpayKeyId"
            ? "rzp_test_key"
            : key === "razorpayKeySecret"
              ? KEY_SECRET
              : undefined,
      },
      bookings: { findOne: jest.fn(() => query(b)), updateOne: jest.fn() },
      payments: {
        findOne: jest.fn(() => query(open)),
        create: jest.fn(),
      },
    });
    return service;
  };

  it("hands back the existing open order instead of creating a second one", async () => {
    const service = withOrders({
      gateway: { orderId: "order_A", provider: "razorpay" },
    });
    const result = await service.paymentOrder("booking-1", owner);
    expect(result.data).toMatchObject({
      orderId: "order_A",
      amount: 200_000,
      currency: "INR",
      keyId: "rzp_test_key",
    });
    expect(service.payments.create).not.toHaveBeenCalled();
    expect(service.payments.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: "booking-1",
        status: "pending",
        amount: 2000,
      }),
    );
  });

  it("refuses to open an order for an already-paid booking", async () => {
    const service = withOrders(null, booking({ paymentStatus: "fully_paid" }));
    await expect(service.paymentOrder("booking-1", owner)).rejects.toThrow(
      "already paid",
    );
  });

  it("refuses to open an order once the hold has expired", async () => {
    const service = withOrders(
      null,
      booking({ reservationExpiresAt: new Date(Date.now() - 1000) }),
    );
    await expect(service.paymentOrder("booking-1", owner)).rejects.toThrow(
      "hold has expired",
    );
  });

  it("refuses to open an order on someone else's booking", async () => {
    const service = withOrders(null);
    await expect(
      service.paymentOrder("booking-1", {
        ...owner,
        userId: "intruder",
        principal: undefined,
      }),
    ).rejects.toThrow("belongs to someone else");
  });
});
