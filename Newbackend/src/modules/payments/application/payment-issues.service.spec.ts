import { NotFoundException } from "@nestjs/common";
import { PaymentIssuesService } from "./payment-issues.service";
import { UNAPPLIED_PAYMENT_PREFIX } from "../../../common/payments/unapplied-payment";

/** find() → .sort().limit().lean() for lists, .select().lean() for lookups. */
const model = (rows: any[], lookup: any[] = []) => ({
  find: jest.fn((filter: any) =>
    filter?._id
      ? { select: () => ({ lean: async () => lookup }) }
      : { sort: () => ({ limit: () => ({ lean: async () => rows }) }) },
  ),
  findOneAndUpdate: jest.fn(),
});

const unapplied = (extra: Record<string, unknown>) => ({
  _id: "p1",
  bookingId: "b1",
  amount: 300,
  failureReason: `${UNAPPLIED_PAYMENT_PREFIX}This booking was cancelled before your payment reached us`,
  gateway: { orderId: "order_1", paymentId: "pay_1" },
  updatedAt: new Date("2026-11-10T10:00:00Z"),
  ...extra,
});

const build = (o: {
  events?: any[];
  stay?: any[];
  aarti?: any[];
  parking?: any[];
} = {}) => {
  const events = model(o.events ?? []);
  const stayPayments = model(o.stay ?? []);
  const stays = model([], [{ _id: "b1", bookingId: "TRV-1" }]);
  const aartiPayments = model(o.aarti ?? []);
  const aartiBookings = model([], [{ _id: "b2", bookingReference: "AAR-2" }]);
  const parkingPayments = model(o.parking ?? []);
  const parkingBookings = model([], [{ _id: "b3", bookingReference: "PK-3" }]);
  const service = new PaymentIssuesService(
    events as any,
    stayPayments as any,
    stays as any,
    aartiPayments as any,
    aartiBookings as any,
    parkingPayments as any,
    parkingBookings as any,
  );
  return { service, events, parkingPayments };
};

describe("PaymentIssuesService.list", () => {
  it("lists unusable payments from every booking type with how each was refunded", async () => {
    const { service } = build({
      stay: [unapplied({ _id: "s1", status: "failed", whatsappCustomerId: "wa-1" })],
      aarti: [unapplied({ _id: "a1", bookingId: "b2", status: "refunded", userId: "u1" })],
      parking: [unapplied({ _id: "k1", bookingId: "b3", status: "refunded", whatsappCustomerId: "wa-2" })],
    });
    const result = await service.list();
    const byId = Object.fromEntries(result.unapplied.map((r: any) => [r.id, r]));
    expect(byId.s1).toMatchObject({
      module: "stay",
      bookingReference: "TRV-1",
      refundState: "gateway_refund_owed",
      customer: "whatsapp",
      reason: "This booking was cancelled before your payment reached us",
      razorpayPaymentId: "pay_1",
    });
    expect(byId.a1).toMatchObject({ module: "aarti", refundState: "refunded_to_wallet" });
    expect(byId.k1).toMatchObject({ module: "parking", refundState: "gateway_refunded" });
    expect(result.summary).toMatchObject({
      refundOwedCount: 1,
      refundOwedAmount: 300,
      refundedToWalletCount: 1,
    });
  });

  it("shows failed and unclaimed Razorpay deliveries, each payment once", async () => {
    const { service, events } = build({
      events: [
        { _id: "e1", eventId: "x1", eventType: "payment.captured", paymentId: "pay_9", status: "ignored" },
        { _id: "e2", eventId: "x2", eventType: "order.paid", paymentId: "pay_9", status: "ignored" },
        { _id: "e3", eventId: "x3", eventType: "payment.captured", paymentId: "pay_8", status: "failed", processingError: "boom" },
      ],
    });
    const result = await service.list();
    expect(events.find).toHaveBeenCalledWith({
      $or: [
        { status: "failed" },
        { status: "ignored", eventType: { $in: ["payment.captured", "order.paid"] } },
      ],
    });
    expect(result.webhooks).toHaveLength(2);
    expect(result.summary).toMatchObject({ webhookFailureCount: 1, unmatchedPaymentCount: 1 });
  });
});

describe("PaymentIssuesService.markParkingRefunded", () => {
  const user = { id: "507f1f77bcf86cd799439099" } as any;

  it("records the gateway refund only on a parking payment that is still owed one", async () => {
    const { service, parkingPayments } = build();
    parkingPayments.findOneAndUpdate.mockResolvedValue({ _id: "k1", status: "refunded" });
    await expect(
      service.markParkingRefunded(user, "507f1f77bcf86cd799439011", " rfnd_1 "),
    ).resolves.toEqual({ id: "k1", status: "refunded" });
    expect(parkingPayments.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", failureReason: expect.anything() }),
      {
        $set: expect.objectContaining({
          status: "refunded",
          "refund.by": user.id,
          "refund.reference": "rfnd_1",
        }),
      },
      { new: true },
    );
  });

  it("refuses a payment that is not owed a refund", async () => {
    const { service, parkingPayments } = build();
    parkingPayments.findOneAndUpdate.mockResolvedValue(null);
    await expect(
      service.markParkingRefunded(user, "507f1f77bcf86cd799439011"),
    ).rejects.toThrow(NotFoundException);
  });

  it("refuses a malformed id without touching the database", async () => {
    const { service, parkingPayments } = build();
    await expect(service.markParkingRefunded(user, "nope")).rejects.toThrow(NotFoundException);
    expect(parkingPayments.findOneAndUpdate).not.toHaveBeenCalled();
  });
});
