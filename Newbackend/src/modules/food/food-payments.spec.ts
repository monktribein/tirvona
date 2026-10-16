import { createHmac } from "crypto";
import { BadRequestException } from "@nestjs/common";
import { FoodPaymentService } from "./application/food-payment.service";
import { FoodFinanceService } from "./application/food-finance.service";
import { encodeAccountNumber } from "./application/food-bank";
import { fakeCrypto, fakeModel } from "./testing/fake-model";

const SECRET = "test_key_secret";
const sign = (orderId: string, paymentId: string) =>
  createHmac("sha256", SECRET).update(`${orderId}|${paymentId}`).digest("hex");

const config = (values: Record<string, string> = {}) =>
  ({ get: (key: string) => values[key] }) as any;

describe("Food customer payment on Tirvona Razorpay", () => {
  let orders: ReturnType<typeof fakeModel>;
  let events: ReturnType<typeof fakeModel>;
  let attempts: ReturnType<typeof fakeModel>;
  let finance: { recordOrderPayment: jest.Mock };
  let order: any;

  const build = (values: Record<string, string>) =>
    new FoodPaymentService(
      orders as any,
      events as any,
      attempts as any,
      finance as any,
      config(values),
    );
  const live = { razorpayKeyId: "rzp_live_x", razorpayKeySecret: SECRET, nodeEnv: "production" };

  beforeEach(async () => {
    orders = fakeModel();
    events = fakeModel();
    attempts = fakeModel();
    finance = { recordOrderPayment: jest.fn() };
    order = await orders.create({
      orderNumber: "TF-1001",
      orderStatus: "PAYMENT_PENDING",
      paymentStatus: "PENDING",
      totalPaise: 52900,
      customerName: "Asha",
      customerPhone: "9876543210",
    });
    await attempts.create({
      orderId: order._id,
      gatewayProvider: "razorpay",
      gatewayOrderId: "order_RZP1",
      amountPaise: 52900,
      status: "pending",
    });
  });

  it("a payment signed by Razorpay marks the order paid exactly once", async () => {
    const service = build(live);
    const res = await service.confirmPayment(order._id, {
      razorpay_order_id: "order_RZP1",
      razorpay_payment_id: "pay_1",
      razorpay_signature: sign("order_RZP1", "pay_1"),
    });
    expect(res.orderStatus).toBe("PAID_AWAITING_VENDOR");
    expect(orders.rows[0].paymentStatus).toBe("PAID");
    expect(orders.rows[0].vendorAcceptanceDeadline).toBeInstanceOf(Date);
    expect(attempts.rows[0].status).toBe("success");
    expect(finance.recordOrderPayment).toHaveBeenCalledTimes(1);

    // The same payment arriving again (webhook after callback) posts nothing more.
    await service.confirmPayment(order._id, {
      razorpay_order_id: "order_RZP1",
      razorpay_payment_id: "pay_1",
      razorpay_signature: sign("order_RZP1", "pay_1"),
    });
    expect(await service.confirmPaymentFromWebhook("order_RZP1", "pay_1", { amountPaise: 52900 })).toBe(true);
    expect(finance.recordOrderPayment).toHaveBeenCalledTimes(1);
  });

  it("refuses a forged, missing or foreign signature and never marks the order paid", async () => {
    const service = build(live);
    for (const razorpay_signature of ["deadbeef", undefined, sign("order_OTHER", "pay_1")]) {
      await expect(
        service.confirmPayment(order._id, {
          razorpay_order_id: "order_RZP1",
          razorpay_payment_id: "pay_1",
          razorpay_signature,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    }
    await expect(
      service.confirmPayment(order._id, {
        razorpay_order_id: "order_SOMEONE_ELSE",
        razorpay_payment_id: "pay_1",
        razorpay_signature: sign("order_SOMEONE_ELSE", "pay_1"),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(orders.rows[0].paymentStatus).toBe("PENDING");
    expect(finance.recordOrderPayment).not.toHaveBeenCalled();
  });

  it("the webhook confirms the order, but a wrong captured amount is never auto-confirmed", async () => {
    const service = build(live);
    expect(await service.confirmPaymentFromWebhook("order_NOT_FOOD", "pay_x")).toBe(false);

    expect(await service.confirmPaymentFromWebhook("order_RZP1", "pay_2", { amountPaise: 100 })).toBe(true);
    expect(orders.rows[0].paymentStatus).toBe("PENDING");

    expect(await service.confirmPaymentFromWebhook("order_RZP1", "pay_2", { amountPaise: 52900 })).toBe(true);
    expect(orders.rows[0].paymentStatus).toBe("PAID");
    expect(finance.recordOrderPayment).toHaveBeenCalledTimes(1);
  });

  it("the old unsigned webhook route cannot mark orders paid in production or when a secret is set", async () => {
    const payload = { event: "payment.captured", orderId: order._id, gatewayPaymentId: "pay_free" };
    await expect(build(live).handlePaymentWebhook("razorpay", payload)).rejects.toBeInstanceOf(BadRequestException);
    await expect(build(live).handlePaymentWebhook("razorpay", payload, "bad")).rejects.toBeInstanceOf(BadRequestException);
    expect(orders.rows[0].paymentStatus).toBe("PENDING");
  });

  it("without Razorpay keys, demo payment works only outside production", async () => {
    attempts.rows.length = 0; // no earlier gateway order for this one
    const dev = build({});
    const session = await dev.createPaymentSession(order._id);
    expect(session.demo).toBe(true);
    expect(session.amountPaise).toBe(52900);
    const demoAttempt = attempts.rows.find((a) => a.gatewayProvider === "demo");
    const res = await dev.confirmPayment(order._id, {
      razorpay_order_id: demoAttempt.gatewayOrderId,
      razorpay_payment_id: "pay_demo",
    });
    expect(res.orderStatus).toBe("PAID_AWAITING_VENDOR");

    // In production a missing gateway is an error, never a free order.
    const orders2 = fakeModel();
    const o2 = await orders2.create({ orderNumber: "TF-2", orderStatus: "PAYMENT_PENDING", totalPaise: 1000 });
    const prod = new FoodPaymentService(orders2 as any, events as any, fakeModel() as any, finance as any, config({ nodeEnv: "production" }));
    await expect(prod.createPaymentSession(o2._id)).rejects.toThrow("not configured");
  });

  it("reopening checkout reuses the same Razorpay order", async () => {
    const service = build(live);
    const first = await service.createPaymentSession(order._id);
    const second = await service.createPaymentSession(order._id);
    expect(first.gatewayOrderId).toBe("order_RZP1");
    expect(second.gatewayOrderId).toBe("order_RZP1");
    expect(attempts.rows).toHaveLength(1);
  });
});

describe("Paying restaurants from Tirvona", () => {
  let settlements: ReturnType<typeof fakeModel>;
  let vendors: ReturnType<typeof fakeModel>;
  let outlets: ReturnType<typeof fakeModel>;
  let orders: ReturnType<typeof fakeModel>;
  let provider: any;
  let finance: FoodFinanceService;
  let vendor: any;
  let outlet: any;
  let settlement: any;

  const build = () =>
    new FoodFinanceService(
      fakeModel() as any,
      fakeModel() as any,
      settlements as any,
      orders as any,
      outlets as any,
      vendors as any,
      fakeCrypto,
      provider,
    );

  beforeEach(async () => {
    settlements = fakeModel();
    vendors = fakeModel();
    outlets = fakeModel();
    orders = fakeModel();
    provider = {
      isConfigured: jest.fn().mockReturnValue(true),
      createContact: jest.fn().mockResolvedValue("cont_1"),
      createFundAccount: jest.fn().mockResolvedValue("fa_1"),
      createPayout: jest.fn().mockResolvedValue({ id: "pout_1", status: "processing" }),
      fetchPayout: jest.fn(),
    };
    vendor = await vendors.create({
      businessName: "Radha Rasoi",
      status: "active",
      contactEmail: "r@example.com",
      contactPhone: "9876543210",
      bankAccountHolderName: "Radha Rasoi",
      bankAccountNumber: encodeAccountNumber(fakeCrypto, "123456789012"),
      bankIfscCode: "HDFC0001234",
    });
    outlet = await outlets.create({ vendorId: vendor._id, brandName: "Radha Rasoi", commissionRateBps: 1000 });
    settlement = await settlements.create({
      outletId: outlet._id,
      vendorId: vendor._id,
      netPayablePaise: 88000,
      status: "approved",
      periodStart: new Date("2026-10-01"),
      periodEnd: new Date("2026-10-07"),
    });
    finance = build();
  });

  it("sends the net amount to the restaurant bank account and records the reference", async () => {
    const res = await finance.payViaProvider(settlement._id, "admin_1");

    expect(provider.createContact).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Radha Rasoi", accountNumber: "123456789012", ifsc: "HDFC0001234" }),
    );
    expect(provider.createPayout).toHaveBeenCalledWith(
      expect.objectContaining({ fundAccountId: "fa_1", amountPaise: 88000, mode: "IMPS" }),
    );
    expect(res.payoutReference).toBe("pout_1");
    expect(res.status).toBe("approved"); // not paid until the bank confirms
    expect(vendors.rows[0].settlementProfileId.startsWith("rzpx:cont_1:fa_1:")).toBe(true);
  });

  it("cannot be started twice, and manual payment is blocked while a transfer is in flight", async () => {
    await finance.payViaProvider(settlement._id, "admin_1");
    await expect(finance.payViaProvider(settlement._id, "admin_1")).rejects.toThrow("already in progress");
    await expect(finance.markPayoutPaid(settlement._id, "UTR-MANUAL")).rejects.toThrow("already in progress");
    expect(provider.createPayout).toHaveBeenCalledTimes(1);
  });

  it("reuses saved RazorpayX ids and creates new ones when the bank details change", async () => {
    await finance.payViaProvider(settlement._id, "admin_1");
    const second = await settlements.create({ outletId: outlet._id, vendorId: vendor._id, netPayablePaise: 5000, status: "approved" });
    await finance.payViaProvider(second._id, "admin_1");
    expect(provider.createContact).toHaveBeenCalledTimes(1);
    expect(provider.createFundAccount).toHaveBeenCalledTimes(1);

    vendors.rows[0].bankIfscCode = "SBIN0004321";
    provider.createFundAccount.mockResolvedValue("fa_2");
    const third = await settlements.create({ outletId: outlet._id, vendorId: vendor._id, netPayablePaise: 5000, status: "approved" });
    await finance.payViaProvider(third._id, "admin_1");
    expect(provider.createFundAccount).toHaveBeenCalledTimes(2);
    expect(provider.createPayout).toHaveBeenLastCalledWith(expect.objectContaining({ fundAccountId: "fa_2" }));
  });

  it("marks the settlement paid with the bank UTR once the transfer is processed", async () => {
    await finance.payViaProvider(settlement._id, "admin_1");
    provider.fetchPayout.mockResolvedValue({ id: "pout_1", status: "processed", utr: "UTR12345" });
    expect(await finance.syncPayouts()).toEqual({ synced: 1 });
    expect(settlements.rows[0].status).toBe("paid");
    expect(settlements.rows[0].payoutReference).toBe("pout_1 | UTR:UTR12345");
    expect(settlements.rows[0].paidAt).toBeInstanceOf(Date);
    expect(await finance.syncPayouts()).toEqual({ synced: 0 });
  });

  it("a failed transfer keeps the settlement unpaid and can be retried under a new idempotency key", async () => {
    await finance.payViaProvider(settlement._id, "admin_1");
    provider.fetchPayout.mockResolvedValue({ id: "pout_1", status: "failed", failureReason: "Invalid account" });
    await finance.syncPayouts(settlement._id);
    expect(settlements.rows[0].status).toBe("approved");
    expect(settlements.rows[0].payoutReference).toBe("failed:pout_1");

    provider.createPayout.mockResolvedValue({ id: "pout_2", status: "processing" });
    await finance.payViaProvider(settlement._id, "admin_1");
    const keys = provider.createPayout.mock.calls.map((c: any[]) => c[0].idempotencyKey);
    expect(keys[0]).not.toBe(keys[1]);
    expect(settlements.rows[0].payoutReference).toBe("pout_2");
  });

  it("refuses to pay without bank details, for unapproved restaurants, or when payouts are off", async () => {
    vendors.rows[0].bankAccountNumber = undefined;
    await expect(finance.payViaProvider(settlement._id, "a")).rejects.toThrow("bank account details");

    vendors.rows[0].bankAccountNumber = encodeAccountNumber(fakeCrypto, "123456789012");
    vendors.rows[0].status = "suspended";
    await expect(finance.payViaProvider(settlement._id, "a")).rejects.toThrow("approved restaurants");

    vendors.rows[0].status = "active";
    provider.isConfigured.mockReturnValue(false);
    await expect(finance.payViaProvider(settlement._id, "a")).rejects.toThrow("not switched on");

    settlements.rows[0].status = "pending_approval";
    provider.isConfigured.mockReturnValue(true);
    await expect(finance.payViaProvider(settlement._id, "a")).rejects.toThrow("approved by Finance");
    expect(provider.createPayout).not.toHaveBeenCalled();
  });

  it("settlements never overlap, so an order is paid for once", async () => {
    const outlet2 = await outlets.create({ vendorId: vendor._id, brandName: "Second", commissionRateBps: 1000 });
    await orders.create({ outletId: outlet2._id, orderStatus: "COMPLETED", paymentStatus: "PAID", subtotalPaise: 100000, completedAt: new Date("2026-10-03") });
    await orders.create({ outletId: outlet2._id, orderStatus: "COMPLETED", paymentStatus: "PAID", subtotalPaise: 50000, completedAt: new Date("2026-10-09") });

    const first = await finance.generateSettlements(new Date("2026-10-01"), new Date("2026-10-07"));
    expect(first.created).toBe(1); // only the kitchen with orders; the empty one is skipped
    expect(first.settlements[0].grossFoodValuePaise).toBe(100000);
    // 10% commission + 18% GST on it
    expect(first.settlements[0].netPayablePaise).toBe(100000 - 10000 - 1800);

    // Re-running an overlapping period only picks up what is new.
    const second = await finance.generateSettlements(new Date("2026-10-05"), new Date("2026-10-15"));
    expect(second.created).toBe(1);
    expect(second.settlements[0].grossFoodValuePaise).toBe(50000);

    const again = await finance.generateSettlements(new Date("2026-10-05"), new Date("2026-10-15"));
    expect(again.created).toBe(0);
  });
});
