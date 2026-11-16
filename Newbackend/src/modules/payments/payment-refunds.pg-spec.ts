/// <reference types="jest" />
/**
 * Money that could not become a booking, against a real Postgres 17: the aarti
 * expiry sweep, a late payment re-taking freed passes, a payment for a
 * cancelled booking refunded to the wallet exactly once, and the admin
 * Payment issues list. Run with `npm run test:pg`.
 *
 * The unit specs cover the decisions; this proves the storage driver does
 * what those decisions rely on — dotted `$set` keeping sibling fields, the
 * `$regex` filter on `failureReason`, `$push` on history, conditional claims
 * and the wallet's idempotency key.
 */
import "reflect-metadata";
import { Global, Module, type INestApplicationContext } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { createHmac } from "node:crypto";
import { OrmModule, getModelToken } from "../../database/orm-nest";
import { Types } from "../../database/orm";
import { DRIVER_URI } from "../../database/database";
import { enablePostgresDriver } from "../../database/pg/pg-driver";
import { REGISTRY } from "../../database/pg/registry.generated";
import { createTestDatabase, type TestDatabase } from "../../database/pg/test-database";
import { environment } from "../../config/environment";
import { TransactionService } from "../../common/database/transaction.service";
import {
  PaymentRefundedException,
  UNAPPLIED_PAYMENT_PREFIX,
} from "../../common/payments/unapplied-payment";
import { AartiModule } from "../aarti/aarti.module";
import { ParkingModule } from "../parking/parking.module";
import { AartiBookingService } from "../aarti/application/aarti-booking.service";
import { AartiMaintenanceService } from "../aarti/application/aarti-maintenance.service";
import { ParkingManagementService } from "../parking/application/parking-management.service";
import { AARTI_MODEL } from "../aarti/domain/aarti.constants";
import { PARKING_MODEL } from "../parking/domain/parking.constants";
import { BookingSchema } from "../bookings/infrastructure/persistence/booking.schemas";
import { BookingPaymentSchema } from "../bookings/infrastructure/persistence/booking-finance.schemas";
import { PaymentWebhookEventSchema } from "./infrastructure/persistence/payment-webhook-event.schema";
import { PaymentIssuesService } from "./application/payment-issues.service";

const KEY_SECRET = "pg-spec-razorpay-secret";
const sign = (orderId: string, paymentId: string) =>
  createHmac("sha256", KEY_SECRET).update(`${orderId}|${paymentId}`).digest("hex");
const oid = () => new Types.ObjectId();
const DAY = 86_400_000;

describe("unusable payments are refunded, never kept (real Postgres)", () => {
  let db: TestDatabase;
  let ctx: INestApplicationContext;
  let aarti: AartiBookingService;
  let sweep: AartiMaintenanceService;
  let issues: PaymentIssuesService;
  const model = (name: string) => ctx.get(getModelToken(name));

  const customerId = oid();
  const user = { id: String(customerId), _id: String(customerId), role: "customer" } as any;
  const ashramId = oid();
  let sessionId: Types.ObjectId;
  let passTypeId: Types.ObjectId;
  const sessionDate = new Date(Date.UTC(2030, 9, 1));

  const aartiBooking = async (extra: Record<string, unknown>) =>
    model(AARTI_MODEL.Booking).create({
      bookingReference: `AAR-${Math.random().toString(36).slice(2, 8)}`,
      customerId,
      sessionId,
      ashramId,
      passTypeId,
      sessionDate,
      startsAt: new Date(Date.now() + 2 * DAY),
      endsAt: new Date(Date.now() + 2 * DAY + 3_600_000),
      passCount: 2,
      pricing: { totalAmount: 500, unitPrice: 250, passCount: 2 },
      status: "pending",
      paymentStatus: "pending",
      reservationExpiresAt: new Date(Date.now() + 600_000),
      history: [{ status: "pending", note: "Booking created" }],
      ...extra,
    });

  const aartiPayment = (bookingId: unknown, orderId: string) =>
    model(AARTI_MODEL.Payment).create({
      bookingId,
      userId: customerId,
      ashramId,
      amount: 500,
      walletAmount: 0,
      purpose: "booking",
      method: "razorpay",
      status: "pending",
      gateway: { orderId, provider: "razorpay" },
    });

  const availability = () =>
    model(AARTI_MODEL.Availability).findOne({ passTypeId, date: sessionDate }).lean();

  const walletBalance = async () =>
    Number(
      ((await model("PilgrimWallet").findOne({ userId: customerId }).lean()) as any)?.balance ?? 0,
    );

  beforeAll(async () => {
    process.env.RAZORPAY_KEY_SECRET = KEY_SECRET;
    db = await createTestDatabase(REGISTRY.tables);
    enablePostgresDriver({ pool: db.pool, registry: REGISTRY, ttlSweep: false });

    @Global()
    @Module({ providers: [TransactionService], exports: [TransactionService] })
    class TransactionsModule {}

    const moduleRef = await Test.createTestingModule({
      imports: [
        // ignoreEnvFile: tests must never read the workspace .env (it holds real credentials).
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, load: [environment] }),
        OrmModule.forRoot(DRIVER_URI),
        TransactionsModule,
        AartiModule,
        ParkingModule,
        OrmModule.forFeature([
          { name: "PaymentWebhookEvent", schema: PaymentWebhookEventSchema },
          { name: "Booking", schema: BookingSchema },
          { name: "BookingPayment", schema: BookingPaymentSchema },
        ]),
      ],
      providers: [PaymentIssuesService],
    }).compile();
    ctx = moduleRef;
    aarti = ctx.get(AartiBookingService);
    sweep = ctx.get(AartiMaintenanceService);
    issues = ctx.get(PaymentIssuesService);

    const session = await model(AARTI_MODEL.Session).create({
      ashramId,
      ownerId: oid(),
      name: "Mangala Aarti",
      slug: `mangala-${Date.now()}`,
      startTime: "05:30",
      status: "approved",
    });
    sessionId = session._id;
    const passType = await model(AARTI_MODEL.PassType).create({
      sessionId,
      ashramId,
      name: "General",
      code: "GEN",
      basePrice: 250,
      totalCapacity: 2,
      isActive: true,
    });
    passTypeId = passType._id;
  });

  afterAll(async () => {
    await ctx?.close();
    await db?.drop();
    delete process.env.RAZORPAY_KEY_SECRET;
  });

  it("the sweep expires an unpaid aarti booking and gives its passes back", async () => {
    // Capacity 2, both passes held by an abandoned checkout.
    await model(AARTI_MODEL.Availability).create({
      sessionId,
      passTypeId,
      date: sessionDate,
      totalCapacity: 2,
      bookedCount: 2,
    });
    const abandoned = await aartiBooking({
      reservationExpiresAt: new Date(Date.now() - 60_000),
    });

    await expect(sweep.expireHolds()).resolves.toBe(1);

    const row: any = await model(AARTI_MODEL.Booking).findById(abandoned._id).lean();
    expect(row.status).toBe("expired");
    expect(row.reservationExpiresAt ?? null).toBeNull();
    expect(row.history.map((h: any) => h.status)).toEqual(["pending", "expired"]);
    expect(((await availability()) as any).bookedCount).toBe(0);
    // Running again finds nothing left to do.
    await expect(sweep.expireHolds()).resolves.toBe(0);
  });

  it("a payment arriving after the sweep re-takes the freed passes and confirms", async () => {
    const late = await aartiBooking({ status: "expired", reservationExpiresAt: null });
    await aartiPayment(late._id, "order_late_ok");

    const result = await aarti.confirmPayment(String(late._id), user, {
      razorpay_order_id: "order_late_ok",
      razorpay_payment_id: "pay_late_ok",
      razorpay_signature: sign("order_late_ok", "pay_late_ok"),
      method: "razorpay",
    });

    expect(result.booking.status).toBe("upcoming");
    const row: any = await model(AARTI_MODEL.Booking).findById(late._id).lean();
    expect(row).toMatchObject({ status: "upcoming", paymentStatus: "paid" });
    expect(((await availability()) as any).bookedCount).toBe(2);
  });

  it("a payment whose passes went to someone else is refunded to the wallet, once", async () => {
    // The two passes are now taken by the booking confirmed above.
    const unlucky = await aartiBooking({ status: "expired", reservationExpiresAt: null });
    await aartiPayment(unlucky._id, "order_late_full");
    const dto = {
      razorpay_order_id: "order_late_full",
      razorpay_payment_id: "pay_late_full",
      razorpay_signature: sign("order_late_full", "pay_late_full"),
      method: "razorpay" as const,
    };

    await expect(aarti.confirmPayment(String(unlucky._id), user, dto)).rejects.toThrow(
      PaymentRefundedException,
    );
    expect(await walletBalance()).toBe(500);
    const payment: any = await model(AARTI_MODEL.Payment)
      .findOne({ bookingId: unlucky._id })
      .lean();
    expect(payment.status).toBe("refunded");
    expect(payment.failureReason.startsWith(UNAPPLIED_PAYMENT_PREFIX)).toBe(true);
    // The dotted $set kept the order id beside the new payment id.
    expect(payment.gateway).toMatchObject({ orderId: "order_late_full", paymentId: "pay_late_full" });
    expect(payment.refund).toMatchObject({ amount: 500 });
    // Nothing was confirmed and no pass was taken.
    expect(((await availability()) as any).bookedCount).toBe(2);

    // The browser retries, then Razorpay's webhook arrives: no second refund.
    await expect(aarti.confirmPayment(String(unlucky._id), user, dto)).rejects.toThrow(
      "already been refunded",
    );
    await expect(
      aarti.confirmPaymentFromWebhook("order_late_full", "pay_late_full"),
    ).resolves.toBe(true);
    expect(await walletBalance()).toBe(500);
    const refunds = await model("PilgrimWalletTransaction")
      .find({ idempotencyKey: "refund:unapplied:pay_late_full" })
      .lean();
    expect(refunds).toHaveLength(1);
  });

  it("refuses a genuine payment made for another booking's order", async () => {
    const dear = await aartiBooking({});
    await aartiPayment(dear._id, "order_dear");
    const cheap = await aartiBooking({});
    await aartiPayment(cheap._id, "order_cheap");

    await expect(
      aarti.confirmPayment(String(dear._id), user, {
        razorpay_order_id: "order_cheap",
        razorpay_payment_id: "pay_cheap",
        razorpay_signature: sign("order_cheap", "pay_cheap"),
        method: "razorpay",
      }),
    ).rejects.toThrow("does not belong to this booking");
    const row: any = await model(AARTI_MODEL.Booking).findById(dear._id).lean();
    expect(row.paymentStatus).toBe("pending");
  });

  it("lists unusable payments for admins and records a parking gateway refund", async () => {
    const parkingBookingId = oid();
    const owed = await model(PARKING_MODEL.Payment).create({
      bookingId: parkingBookingId,
      whatsappCustomerId: oid(),
      amount: 80,
      purpose: "booking",
      method: "razorpay",
      status: "failed",
      failureReason: `${UNAPPLIED_PAYMENT_PREFIX}The time for this booking has already passed`,
      gateway: { orderId: "order_pk", paymentId: "pay_pk", provider: "razorpay" },
      refund: { amount: 80, reference: "PKREF-1", reason: "The time for this booking has already passed" },
    });
    // An ordinary failed payment is not an "unusable payment".
    await model(PARKING_MODEL.Payment).create({
      bookingId: parkingBookingId,
      amount: 80,
      purpose: "booking",
      method: "razorpay",
      status: "failed",
      failureReason: "Card declined",
    });

    const list = await issues.list();
    const parking = list.unapplied.filter((r: any) => r.module === "parking");
    expect(parking).toHaveLength(1);
    expect(parking[0]).toMatchObject({
      refundState: "gateway_refund_owed",
      customer: "whatsapp",
      amount: 80,
    });
    expect(list.unapplied.some((r: any) => r.module === "aarti" && r.refundState === "refunded_to_wallet")).toBe(true);

    await issues.markParkingRefunded({ id: String(oid()) } as any, String(owed._id), "rfnd_123");
    const after: any = await model(PARKING_MODEL.Payment).findById(owed._id).lean();
    expect(after.status).toBe("refunded");
    // The dotted $set filled in the refund without dropping what was there.
    expect(after.refund).toMatchObject({ amount: 80, reference: "rfnd_123", reason: expect.any(String) });
    expect(after.refund.at).toBeTruthy();
    // Recording it twice is refused.
    await expect(
      issues.markParkingRefunded({ id: String(oid()) } as any, String(owed._id)),
    ).rejects.toThrow("No refund is owed");
  });

  it("the parking sweep expires unpaid bookings and marks no-shows (it used to crash)", async () => {
    const bookings = model(PARKING_MODEL.Booking);
    const slotTypeId = oid();
    const date = new Date(Date.UTC(2030, 9, 2));
    await model(PARKING_MODEL.Availability).create({
      locationId: oid(),
      slotTypeId,
      date,
      totalCapacity: 5,
      bookedCount: 1,
    });
    const base = {
      customerId: oid(),
      locationId: oid(),
      partnerId: oid(),
      slotTypeId,
      vehicleType: "car",
      vehicleNumber: "UP85AB1234",
      durationHours: 24,
      occupiedDates: [date],
      pricing: { totalAmount: 80 },
      history: [{ status: "pending", note: "Booking created" }],
    };
    const unpaid = await bookings.create({
      ...base,
      bookingReference: "PK-SWEEP-1",
      entryAt: new Date(Date.now() + DAY),
      exitAt: new Date(Date.now() + 2 * DAY),
      status: "pending",
      paymentStatus: "pending",
      reservationExpiresAt: new Date(Date.now() - 60_000),
    });
    const absent = await bookings.create({
      ...base,
      bookingReference: "PK-SWEEP-2",
      entryAt: new Date(Date.now() - DAY),
      exitAt: new Date(Date.now() + DAY),
      status: "upcoming",
      paymentStatus: "paid",
    });

    const result = await ctx.get(ParkingManagementService).maintenanceSweep();
    expect(result).toMatchObject({ released: 1, marked: 1 });

    const expired: any = await bookings.findById(unpaid._id).lean();
    expect(expired.status).toBe("expired");
    expect(expired.history.map((h: any) => h.status)).toEqual(["pending", "expired"]);
    const noShow: any = await bookings.findById(absent._id).lean();
    expect(noShow.status).toBe("no_show");
    expect(noShow.history.map((h: any) => h.status)).toEqual(["pending", "no_show"]);
    const slot: any = await model(PARKING_MODEL.Availability).findOne({ slotTypeId, date }).lean();
    expect(slot.bookedCount).toBe(0);
  });

  it("a stay payment's dotted gateway update keeps its order id", async () => {
    const payments = model("BookingPayment");
    const row = await payments.create({
      bookingId: oid(),
      ashramId: oid(),
      userId: oid(),
      amount: 2000,
      method: "razorpay",
      status: "pending",
      gateway: { orderId: "order_stay", provider: "razorpay" },
    });
    await payments.updateOne(
      { _id: row._id },
      {
        $set: {
          status: "refunded",
          failureReason: `${UNAPPLIED_PAYMENT_PREFIX}This booking was already paid`,
          "gateway.paymentId": "pay_stay",
        },
      },
    );
    const after: any = await payments.findById(row._id).lean();
    expect(after.gateway).toMatchObject({ orderId: "order_stay", paymentId: "pay_stay", provider: "razorpay" });
    const listed = (await issues.list()).unapplied.find((r: any) => r.id === String(row._id));
    expect(listed).toMatchObject({ module: "stay", refundState: "refunded_to_wallet" });
  });
});
