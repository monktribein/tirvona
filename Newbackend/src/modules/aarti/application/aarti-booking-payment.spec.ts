import { ConflictException } from "@nestjs/common";
import { createHmac } from "node:crypto";
import { AartiBookingService } from "./aarti-booking.service";
import {
  PaymentRefundedException,
  UNAPPLIED_PAYMENT_PREFIX,
} from "../../../common/payments/unapplied-payment";

const KEY_SECRET = "test-key-secret";
const sign = (orderId: string, paymentId: string) =>
  createHmac("sha256", KEY_SECRET).update(`${orderId}|${paymentId}`).digest("hex");

/** A model query that supports .session()/.sort() and can be awaited. */
const query = <T>(value: T) => {
  const q: any = {
    session: () => q,
    sort: () => q,
    then: (resolve: (v: T) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(value).then(resolve, reject),
  };
  return q;
};

const user = { id: "user-1", _id: "user-1", role: "customer" } as any;

const booking = (extra: Record<string, unknown> = {}) => ({
  _id: "booking-1",
  bookingReference: "AAR-1",
  customerId: "user-1",
  sessionId: "session-1",
  passTypeId: "pass-1",
  sessionDate: new Date("2030-10-01"),
  endsAt: new Date(Date.now() + 86_400_000),
  passCount: 2,
  status: "pending",
  paymentStatus: "pending",
  reservationExpiresAt: new Date(Date.now() + 5 * 60_000),
  pricing: { totalAmount: 500 },
  history: [] as any[],
  ...extra,
});

const gatewayPayment = (extra: Record<string, unknown> = {}) => ({
  _id: "pay-row-1",
  bookingId: "booking-1",
  amount: 500,
  walletAmount: 0,
  status: "pending",
  gateway: { orderId: "order_A", provider: "razorpay" },
  ...extra,
});

const dtoFor = (orderId: string, paymentId = "pay_X") => ({
  razorpay_order_id: orderId,
  razorpay_payment_id: paymentId,
  razorpay_signature: sign(orderId, paymentId),
  method: "razorpay",
});

const build = (opts: { booking?: any; payment?: any } = {}) => {
  const row = opts.booking ?? booking();
  const payment = "payment" in opts ? opts.payment : gatewayPayment();
  const service = Object.create(AartiBookingService.prototype) as any;
  const settled = { booking: row, payment, pass: { token: "t" } };
  Object.assign(service, {
    logger: { warn: jest.fn(), log: jest.fn(), error: jest.fn() },
    config: {
      get: (key: string) => (key === "razorpayKeySecret" ? KEY_SECRET : undefined),
    },
    transactions: { run: jest.fn(async (work: any) => work({})) },
    bookings: { findOne: jest.fn(() => query(row)) },
    payments: {
      findOne: jest.fn(() => query(payment)),
      updateOne: jest.fn(),
      create: jest.fn(),
    },
    notifications: { create: jest.fn() },
    wallet: { spend: jest.fn(), credit: jest.fn(), releaseHold: jest.fn() },
    repository: {
      findPassType: jest.fn().mockResolvedValue({ totalCapacity: 50 }),
      reserveSeats: jest.fn().mockResolvedValue({ ok: true }),
    },
    // Reaching these proves the payment was accepted; the pass issue itself
    // is covered elsewhere.
    settlePayment: jest.fn().mockResolvedValue(settled),
    withQrImage: jest.fn(async (r: any) => r),
  });
  return { service, row, payment };
};

describe("AartiBookingService.confirmPayment order ↔ booking binding", () => {
  it("looks the payment up by this booking AND the submitted Razorpay order id", async () => {
    const { service } = build();
    await service.confirmPayment("booking-1", user, dtoFor("order_A"));
    expect(service.payments.findOne).toHaveBeenCalledWith({
      bookingId: "booking-1",
      purpose: "booking",
      "gateway.orderId": "order_A",
    });
    expect(service.settlePayment).toHaveBeenCalled();
  });

  it("refuses a genuinely-signed payment made for an order that is not this booking's", async () => {
    // Before the fix, the latest pending payment of the booking was used
    // whatever order had been paid — a cheap payment for any other order
    // could confirm a dearer pass.
    const { service } = build({ payment: null });
    await expect(
      service.confirmPayment("booking-1", user, dtoFor("order_OTHER")),
    ).rejects.toThrow("does not belong to this booking");
    expect(service.settlePayment).not.toHaveBeenCalled();
  });

  it("refuses when the payment no longer adds up to the booking total", async () => {
    const { service } = build({ payment: gatewayPayment({ amount: 1 }) });
    await expect(
      service.confirmPayment("booking-1", user, dtoFor("order_A")),
    ).rejects.toThrow("amount does not match");
    expect(service.settlePayment).not.toHaveBeenCalled();
  });

  it("treats a payment already applied to this booking as a conflict", async () => {
    const { service } = build({ payment: gatewayPayment({ status: "paid" }) });
    await expect(
      service.confirmPayment("booking-1", user, dtoFor("order_A")),
    ).rejects.toThrow(ConflictException);
    expect(service.wallet.credit).not.toHaveBeenCalled();
  });

  it("rejects a bad signature before touching anything", async () => {
    const { service } = build();
    await expect(
      service.confirmPayment("booking-1", user, {
        ...dtoFor("order_A"),
        razorpay_signature: "deadbeef",
      }),
    ).rejects.toThrow("signature verification failed");
    expect(service.payments.findOne).not.toHaveBeenCalled();
  });
});

describe("AartiBookingService.confirmPayment after the hold ran out", () => {
  const lapsed = new Date(Date.now() - 60_000);

  it("confirms when the sweep has not expired the booking yet (passes still held)", async () => {
    const { service } = build({ booking: booking({ reservationExpiresAt: lapsed }) });
    await service.confirmPayment("booking-1", user, dtoFor("order_A"));
    expect(service.repository.reserveSeats).not.toHaveBeenCalled();
    expect(service.settlePayment).toHaveBeenCalled();
  });

  it("takes the passes again for an expired booking when they are still free", async () => {
    const { service, row } = build({
      booking: booking({ status: "expired", reservationExpiresAt: null }),
    });
    await service.confirmPayment("booking-1", user, dtoFor("order_A"));
    expect(service.repository.reserveSeats).toHaveBeenCalledWith(
      expect.objectContaining({ passTypeId: "pass-1", seats: 2, capacity: 50 }),
    );
    expect(row.status).toBe("pending");
    expect(service.settlePayment).toHaveBeenCalled();
  });

  it("refunds to the wallet when the passes went to someone else", async () => {
    const { service } = build({
      booking: booking({ status: "expired", reservationExpiresAt: null }),
    });
    service.repository.reserveSeats.mockResolvedValue({ ok: false, remaining: 0 });
    await expect(
      service.confirmPayment("booking-1", user, dtoFor("order_A")),
    ).rejects.toThrow(PaymentRefundedException);
    expect(service.settlePayment).not.toHaveBeenCalled();
    expect(service.wallet.credit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        amount: 500,
        module: "aarti",
        category: "refund",
        idempotencyKey: "refund:unapplied:pay_X",
      }),
      expect.anything(),
    );
    expect(service.payments.updateOne).toHaveBeenCalledWith(
      { _id: "pay-row-1" },
      {
        $set: expect.objectContaining({
          status: "refunded",
          failureReason: expect.stringMatching(/^UNAPPLIED_PAYMENT: /),
        }),
      },
      expect.anything(),
    );
    expect(service.wallet.releaseHold).toHaveBeenCalledWith("aarti", "booking-1", expect.anything());
  });

  it("refunds when the aarti has already ended", async () => {
    const { service } = build({
      booking: booking({
        status: "expired",
        reservationExpiresAt: null,
        endsAt: new Date(Date.now() - 1000),
      }),
    });
    await expect(
      service.confirmPayment("booking-1", user, dtoFor("order_A")),
    ).rejects.toThrow("already passed");
    expect(service.repository.reserveSeats).not.toHaveBeenCalled();
    expect(service.wallet.credit).toHaveBeenCalled();
  });

  it("refunds a payment for a cancelled booking", async () => {
    const { service } = build({ booking: booking({ status: "cancelled" }) });
    await expect(
      service.confirmPayment("booking-1", user, dtoFor("order_A")),
    ).rejects.toThrow("was cancelled");
    expect(service.wallet.credit).toHaveBeenCalled();
  });

  it("refunds a second payment for a booking that is already paid", async () => {
    const { service } = build({ booking: booking({ paymentStatus: "paid", status: "upcoming" }) });
    await expect(
      service.confirmPayment("booking-1", user, dtoFor("order_A")),
    ).rejects.toThrow("already paid");
    expect(service.settlePayment).not.toHaveBeenCalled();
    expect(service.wallet.credit).toHaveBeenCalled();
  });

  it("refunds a payment made on an order a newer checkout replaced", async () => {
    const { service } = build({ payment: gatewayPayment({ status: "failed" }) });
    await expect(
      service.confirmPayment("booking-1", user, dtoFor("order_A")),
    ).rejects.toThrow("older checkout");
    expect(service.wallet.credit).toHaveBeenCalled();
    // The booking is still open for the newer checkout: leave its wallet hold.
    expect(service.wallet.releaseHold).not.toHaveBeenCalled();
  });

  it("never refunds the same payment twice", async () => {
    const { service } = build({
      booking: booking({ status: "cancelled" }),
      payment: gatewayPayment({
        status: "refunded",
        failureReason: `${UNAPPLIED_PAYMENT_PREFIX}already handled`,
      }),
    });
    await expect(
      service.confirmPayment("booking-1", user, dtoFor("order_A")),
    ).rejects.toThrow("already been refunded");
    expect(service.wallet.credit).not.toHaveBeenCalled();
    expect(service.payments.updateOne).not.toHaveBeenCalled();
  });
});

describe("AartiBookingService.confirmPaymentFromWebhook", () => {
  it("treats a refunded payment as handled so Razorpay stops retrying", async () => {
    const { service } = build();
    jest
      .spyOn(service, "confirmPayment")
      .mockRejectedValue(new PaymentRefundedException("refunded"));
    await expect(
      service.confirmPaymentFromWebhook("order_A", "pay_X"),
    ).resolves.toBe(true);
  });
});
