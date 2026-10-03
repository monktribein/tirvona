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

const reservationExpiresAt = new Date(Date.now() + 45 * 60_000);

const booking = (extra: Record<string, unknown> = {}) => ({
  _id: "booking-1",
  bookingId: "TRV-1",
  customerId: "user-1",
  ashramId: "ashram-1",
  status: "pending",
  paymentStatus: "pending",
  reservationExpiresAt,
  pricing: { totalAmount: 2000 },
  occupiedDates: [new Date("2030-10-01")],
  roomsBookedCount: 1,
  ...extra,
});

/**
 * The real `BookingsService` with its collaborators stubbed. The Razorpay
 * order already exists, so `paymentOrder` hands it back without calling the
 * gateway, and `confirmInventory` throws a sentinel once the wallet step has
 * run, so the test need not model the whole confirmation.
 */
const createService = (opts: {
  booking?: any;
  split?: { walletAmount: number; gatewayAmount: number };
  payment?: any;
}) => {
  const service = Object.create(BookingsService.prototype) as any;
  const row = opts.booking ?? booking();
  const sentinel = new Error("REACHED_CONFIRMATION");
  Object.assign(service, {
    wallet: {
      planSplit: jest.fn(async () => opts.split ?? { walletAmount: 0, gatewayAmount: 2000 }),
      placeHold: jest.fn(async () => null),
      releaseHold: jest.fn(async () => 0),
      spend: jest.fn(async () => ({ _id: "wtx-1" })),
      credit: jest.fn(),
    },
    assertCanPayFor: jest.fn(async () => undefined),
    logger: { warn: jest.fn(), log: jest.fn() },
    config: {
      get: (key: string) =>
        key === "razorpayKeySecret" ? KEY_SECRET : key === "razorpayKeyId" ? "rzp_test" : undefined,
    },
    transactions: { run: jest.fn(async (work: any) => work({})) },
    bookings: { findOne: jest.fn(() => query(row)), updateOne: jest.fn() },
    payments: { findOne: jest.fn(() => query(opts.payment ?? null)) },
    paymentEvents: { updateOne: jest.fn().mockResolvedValue({}) },
    notifications: { create: jest.fn().mockResolvedValue({}) },
    inventoryHolds: { updateMany: jest.fn() },
    audits: { create: jest.fn() },
    repository: {
      confirmInventory: jest.fn(async () => {
        throw sentinel;
      }),
      holdInventory: jest.fn(),
    },
    roomUnits: () => [{ roomId: "room-1", units: 1 }],
  });
  return { service, sentinel };
};

const openOrder = (walletAmount: number, amount: number) => ({
  _id: "pay-1",
  bookingId: "booking-1",
  amount,
  walletAmount,
  status: "pending",
  gateway: { orderId: "order_A", provider: "razorpay" },
  save: jest.fn(),
});

describe("BookingsService wallet split (stays)", () => {
  it("parks the wallet share for as long as the reservation and returns the split", async () => {
    const { service } = createService({
      split: { walletAmount: 800, gatewayAmount: 1200 },
      payment: openOrder(800, 1200),
    });
    const result = await service.paymentOrder("booking-1", owner, { useWallet: true });

    expect(service.wallet.planSplit).toHaveBeenCalledWith("user-1", 2000, true, {
      module: "ashram_booking",
      sourceId: "booking-1",
    });
    expect(service.wallet.placeHold).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        module: "ashram_booking",
        amount: 800,
        expiresAt: reservationExpiresAt,
      }),
    );
    expect(result.wallet).toEqual({ applied: 800, gatewayAmount: 1200, total: 2000 });
    expect(result.data).toMatchObject({ orderId: "order_A", amount: 120000 });
  });

  it("gives back an earlier hold when the pilgrim chooses not to use the wallet", async () => {
    const { service } = createService({ payment: openOrder(0, 2000) });
    await service.paymentOrder("booking-1", owner, { useWallet: false });
    expect(service.wallet.placeHold).not.toHaveBeenCalled();
    expect(service.wallet.releaseHold).toHaveBeenCalledWith("ashram_booking", "booking-1");
  });

  it("never applies a wallet for a WhatsApp guest, who has none", async () => {
    const { service } = createService({
      booking: booking({ customerId: null, whatsappCustomerId: "wa-1" }),
      payment: openOrder(0, 2000),
    });
    await service.paymentOrder("booking-1", guest, { useWallet: true });
    expect(service.wallet.planSplit.mock.calls[0][0]).toBeNull();
    expect(service.wallet.placeHold).not.toHaveBeenCalled();
  });

  it("spends the parked share in the same step that confirms the payment", async () => {
    const { service, sentinel } = createService({ payment: openOrder(800, 1200) });
    await expect(
      service.confirmPayment("booking-1", owner, {
        razorpay_order_id: "order_A",
        razorpay_payment_id: "pay_X",
        razorpay_signature: sign("order_A", "pay_X"),
        method: "razorpay",
      }),
    ).rejects.toBe(sentinel);
    expect(service.wallet.spend).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        module: "ashram_booking",
        sourceId: "booking-1",
        amount: 800,
      }),
      expect.anything(),
    );
  });

  it("refuses to confirm a wallet share on a booking with no wallet owner", async () => {
    const { service } = createService({
      booking: booking({ customerId: null, whatsappCustomerId: "wa-1" }),
      payment: openOrder(800, 1200),
    });
    await expect(
      service.confirmPayment("booking-1", owner, {
        razorpay_order_id: "order_A",
        razorpay_payment_id: "pay_X",
        razorpay_signature: sign("order_A", "pay_X"),
        method: "razorpay",
      }),
    ).rejects.toThrow();
    expect(service.wallet.spend).not.toHaveBeenCalled();
    expect(service.repository.confirmInventory).not.toHaveBeenCalled();
  });
});
