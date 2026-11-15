import { ParkingBookingService } from "./parking-booking.service";
import {
  PaymentRefundedException,
  UNAPPLIED_PAYMENT_PREFIX,
} from "../../../common/payments/unapplied-payment";

jest.mock("razorpay", () => jest.fn());
// The confirm path renders a QR image after settling; that render is
// irrelevant here and slow enough under load to time tests out (as noted in
// parking-dual-identity.spec), so it is mocked out.
jest.mock("qrcode", () => ({ toDataURL: jest.fn().mockResolvedValue("data:image/png;base64,x") }));

const BOOKING_ID = "507f1f77bcf86cd799439011";

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

const guest = {
  userId: null,
  whatsappCustomerId: "wa-1",
  role: "whatsapp_customer",
  channel: "whatsapp",
} as any;
const customer = {
  userId: "user-1",
  whatsappCustomerId: null,
  role: "customer",
  channel: "web",
} as any;

const booking = (extra: Record<string, unknown> = {}) => ({
  _id: BOOKING_ID,
  bookingReference: "PK-1",
  whatsappCustomerId: "wa-1",
  paymentStatus: "pending",
  status: "pending",
  reservationExpiresAt: new Date(Date.now() + 600_000),
  exitAt: new Date(Date.now() + 86_400_000),
  occupiedDates: [new Date("2030-10-01")],
  vehicleType: "car",
  slotTypeId: "slot-1",
  locationId: "loc-1",
  partnerId: "partner-1",
  pricing: { totalAmount: 100 },
  history: [] as any[],
  save: jest.fn(),
  ...extra,
});

const gatewayPayment = (extra: Record<string, unknown> = {}) => ({
  _id: "pay-row-1",
  status: "pending",
  amount: 100,
  save: jest.fn(),
  gateway: { orderId: "order_1" },
  ...extra,
});

const proof = {
  razorpay_order_id: "order_1",
  razorpay_payment_id: "pay_1",
  razorpay_signature: "sig",
} as any;

const build = (row: any, payment: any) => {
  const repository: any = {
    findSlotType: jest.fn().mockResolvedValue({ totalCapacity: 20 }),
    reserveInventory: jest.fn().mockResolvedValue({ ok: true }),
  };
  const bookings: any = { findOne: jest.fn(() => query(row)) };
  const payments: any = {
    findOne: jest.fn(() => query(payment)),
    updateOne: jest.fn(),
    create: jest.fn(),
  };
  const wallet: any = {
    planSplit: jest.fn(),
    placeHold: jest.fn(),
    releaseHold: jest.fn(),
    spend: jest.fn(),
    credit: jest.fn(),
  };
  const service = new ParkingBookingService(
    repository,
    { run: jest.fn((work: any) => work({})) } as any,
    { commission: jest.fn().mockResolvedValue({ percent: 0, amount: 0, partnerEarning: 0 }) } as any,
    { get: jest.fn((key: string) => (key === "razorpayKeySecret" ? "topsecret" : undefined)) } as any,
    bookings,
    payments,
    { create: jest.fn() } as any,
    { updateOne: jest.fn() } as any,
    {
      findOne: jest.fn(() => ({ sort: jest.fn(() => ({ session: jest.fn().mockResolvedValue(null) })) })),
      create: jest.fn().mockResolvedValue([{}]),
    } as any,
    { create: jest.fn() } as any,
    {} as any,
    { findById: jest.fn(() => ({ session: jest.fn() })) } as any,
    wallet,
  );
  (service as any).verifyRazorpay = jest.fn().mockReturnValue(true);
  (service as any).issueQr = jest.fn().mockResolvedValue({ displayCode: "X", token: "TVNPK1.tok" });
  (service as any).logger = { warn: jest.fn() };
  return { service, repository, payments, wallet };
};

describe("parking: a payment that arrives after the hold ran out", () => {
  const lapsed = new Date(Date.now() - 60_000);

  it("confirms when the sweep has not expired the booking yet (space still held)", async () => {
    const row = booking({ reservationExpiresAt: lapsed });
    const { service, repository } = build(row, gatewayPayment());
    const result = await service.confirmPaymentFor(guest, BOOKING_ID, proof);
    expect(result.booking.status).toBe("upcoming");
    expect(repository.reserveInventory).not.toHaveBeenCalled();
  });

  it("takes the space again for an expired booking when it is still free", async () => {
    const row = booking({ status: "expired", reservationExpiresAt: null });
    const { service, repository } = build(row, gatewayPayment());
    const result = await service.confirmPaymentFor(guest, BOOKING_ID, proof);
    expect(repository.reserveInventory).toHaveBeenCalledWith(
      expect.objectContaining({ slotTypeId: "slot-1", capacity: 20 }),
    );
    expect(result.booking.status).toBe("upcoming");
  });

  it("marks a WhatsApp guest's payment for a gateway refund when the space went to someone else", async () => {
    const row = booking({ status: "expired", reservationExpiresAt: null });
    const { service, repository, payments, wallet } = build(row, gatewayPayment());
    repository.reserveInventory.mockResolvedValue({ ok: false, failedDate: "2030-10-01" });
    await expect(service.confirmPaymentFor(guest, BOOKING_ID, proof)).rejects.toThrow(
      "refunded to your original payment method",
    );
    expect(row.save).not.toHaveBeenCalled();
    expect(wallet.credit).not.toHaveBeenCalled();
    expect(payments.updateOne).toHaveBeenCalledWith(
      { _id: "pay-row-1" },
      {
        $set: expect.objectContaining({
          status: "failed",
          failureReason: expect.stringMatching(/^UNAPPLIED_PAYMENT: /),
          "gateway.paymentId": "pay_1",
        }),
      },
      expect.anything(),
    );
  });

  it("refunds a website customer's payment for a cancelled booking to the wallet", async () => {
    const row = booking({
      status: "cancelled",
      customerId: "user-1",
      whatsappCustomerId: undefined,
    });
    const { service, wallet } = build(row, gatewayPayment());
    await expect(service.confirmPaymentFor(customer, BOOKING_ID, proof)).rejects.toThrow(
      PaymentRefundedException,
    );
    expect(wallet.credit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        amount: 100,
        module: "parking",
        idempotencyKey: "refund:unapplied:pay_1",
      }),
      expect.anything(),
    );
    expect(wallet.releaseHold).toHaveBeenCalledWith("parking", BOOKING_ID, expect.anything());
  });

  it("refunds a second payment for a booking that is already paid", async () => {
    const row = booking({ paymentStatus: "paid", status: "upcoming" });
    const { service, payments } = build(row, gatewayPayment());
    await expect(service.confirmPaymentFor(guest, BOOKING_ID, proof)).rejects.toThrow(
      "already paid",
    );
    expect(row.save).not.toHaveBeenCalled();
    expect(payments.updateOne).toHaveBeenCalled();
  });

  it("never refunds the same payment twice", async () => {
    const row = booking({ status: "cancelled" });
    const { service, payments } = build(
      row,
      gatewayPayment({ status: "failed", failureReason: `${UNAPPLIED_PAYMENT_PREFIX}handled` }),
    );
    await expect(service.confirmPaymentFor(guest, BOOKING_ID, proof)).rejects.toThrow(
      "already been refunded",
    );
    expect(payments.updateOne).not.toHaveBeenCalled();
  });

  it("the webhook treats a refunded payment as handled", async () => {
    const { service } = build(booking(), gatewayPayment({ whatsappCustomerId: "wa-1", bookingId: BOOKING_ID }));
    jest
      .spyOn(service, "confirmPaymentFor")
      .mockRejectedValue(new PaymentRefundedException("refunded"));
    await expect(service.confirmPaymentFromWebhook("order_1", "pay_1")).resolves.toBe(true);
  });
});
