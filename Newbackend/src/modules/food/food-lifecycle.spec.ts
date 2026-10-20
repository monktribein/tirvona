import { FoodOrderService } from "./application/food-order.service";
import { FoodFinanceService } from "./application/food-finance.service";
import { FoodMaintenanceService } from "./application/food-maintenance.service";
import { FoodNotificationService } from "./application/food-notification.service";
import { fakeCrypto, fakeModel } from "./testing/fake-model";

const refundMock = jest.fn();
jest.mock("razorpay", () =>
  jest.fn().mockImplementation(() => ({ payments: { refund: refundMock } })),
);

const config = (values: Record<string, string> = {}) =>
  ({ get: (key: string) => values[key] }) as any;
const live = { razorpayKeyId: "rzp_live_x", razorpayKeySecret: "secret" };

describe("Food order lifecycle: kitchen timeout, real refunds, notifications", () => {
  let orders: ReturnType<typeof fakeModel>;
  let events: ReturnType<typeof fakeModel>;
  let refunds: ReturnType<typeof fakeModel>;
  let attempts: ReturnType<typeof fakeModel>;
  let outlets: ReturnType<typeof fakeModel>;
  let vendors: ReturnType<typeof fakeModel>;
  let inApp: { notifyUsers: jest.Mock };
  let finance: FoodFinanceService;
  let service: FoodOrderService;
  let vendor: any;
  let outlet: any;

  const buildFinance = (values: Record<string, string> = live) =>
    new FoodFinanceService(
      fakeModel() as any, // ledger
      refunds as any,
      fakeModel() as any, // settlements
      orders as any,
      outlets as any,
      vendors as any,
      fakeCrypto,
      { isConfigured: () => false } as any,
      attempts as any,
      config(values),
    );

  const overdueOrder = async (extra: Record<string, unknown> = {}) => {
    const order = await orders.create({
      orderNumber: "TF-20261019-AAAA",
      orderStatus: "PAID_AWAITING_VENDOR",
      paymentStatus: "PAID",
      totalPaise: 52900,
      outletId: outlet._id,
      customerId: "cust_1",
      fulfilmentType: "pickup",
      vendorAcceptanceDeadline: new Date(Date.now() - 60_000),
      ...extra,
    });
    await attempts.create({
      orderId: order._id,
      gatewayProvider: "razorpay",
      gatewayPaymentId: "pay_1",
      status: "success",
    });
    return order;
  };

  beforeEach(async () => {
    refundMock.mockReset();
    refundMock.mockResolvedValue({ id: "rfnd_1", status: "processed" });
    orders = fakeModel();
    events = fakeModel();
    refunds = fakeModel();
    attempts = fakeModel();
    outlets = fakeModel();
    vendors = fakeModel();
    inApp = { notifyUsers: jest.fn().mockResolvedValue(undefined) };
    vendor = await vendors.create({ businessName: "Radha Rasoi", ownerUserId: "owner_1" });
    outlet = await outlets.create({ vendorId: vendor._id, brandName: "Radha Rasoi" });
    finance = buildFinance();
    const notifier = new FoodNotificationService(outlets as any, vendors as any, inApp as any);
    service = new FoodOrderService(
      orders as any,
      fakeModel() as any,
      events as any,
      outlets as any,
      vendors as any,
      fakeModel() as any,
      { validateQuote: jest.fn() } as any,
      finance,
      notifier,
    );
    // The fake model cannot populate; the read-back is not what these tests are about.
    jest
      .spyOn(service as any, "getOrderWithItems")
      .mockImplementation(async (id: any) => orders.rows.find((o) => String(o._id) === String(id)));
  });

  describe("vendor acceptance timeout", () => {
    it("cancels an overdue paid order, refunds it through Razorpay and tells both sides", async () => {
      const order = await overdueOrder();

      expect(await service.checkVendorTimeouts()).toBe(1);

      expect(refundMock).toHaveBeenCalledWith(
        "pay_1",
        expect.objectContaining({ amount: 52900, speed: "normal" }),
      );
      const stored = orders.rows.find((o) => o._id === order._id);
      expect(stored.orderStatus).toBe("REFUNDED");
      expect(stored.paymentStatus).toBe("REFUNDED");
      expect(refunds.rows[0]).toMatchObject({
        status: "refunded",
        gatewayRefundId: "rfnd_1",
        amountPaise: 52900,
      });
      expect(events.rows.map((e) => e.toStatus)).toContain("VENDOR_TIMEOUT");

      const bodies = inApp.notifyUsers.mock.calls.map(([ids, msg]) => `${ids[0]}: ${msg.body}`);
      expect(bodies.some((b) => b.startsWith("cust_1:") && b.includes("did not respond"))).toBe(true);
      expect(bodies.some((b) => b.startsWith("cust_1:") && b.includes("₹529.00 has been refunded"))).toBe(true);
      expect(bodies.some((b) => b.startsWith("owner_1:") && b.includes("not accepted in time"))).toBe(true);
    });

    it("leaves orders alone that are not overdue, already accepted or unpaid", async () => {
      await overdueOrder({ vendorAcceptanceDeadline: new Date(Date.now() + 5 * 60_000) });
      await overdueOrder({ orderStatus: "ACCEPTED" });
      await overdueOrder({ orderStatus: "PAYMENT_PENDING", paymentStatus: "PENDING" });

      expect(await service.checkVendorTimeouts()).toBe(0);
      expect(refundMock).not.toHaveBeenCalled();
    });

    it("processes an order once even when two sweeps run together", async () => {
      await overdueOrder();
      const results = await Promise.all([service.checkVendorTimeouts(), service.checkVendorTimeouts()]);

      expect(results.reduce((a, b) => a + b, 0)).toBe(1);
      expect(refundMock).toHaveBeenCalledTimes(1);
      expect(refunds.rows).toHaveLength(1);
    });

    it("retries the refund of an order that timed out but was never refunded", async () => {
      const order = await overdueOrder({
        orderStatus: "VENDOR_TIMEOUT",
        updatedAt: new Date(Date.now() - 10 * 60_000),
      });

      expect(await service.checkVendorTimeouts()).toBe(1);

      expect(refundMock).toHaveBeenCalledTimes(1);
      expect(orders.rows.find((o) => o._id === order._id).orderStatus).toBe("REFUNDED");
    });

    it("does not retry a timed-out order whose refund may still be in flight", async () => {
      await overdueOrder({ orderStatus: "VENDOR_TIMEOUT" }); // updated just now

      expect(await service.checkVendorTimeouts()).toBe(0);
      expect(refundMock).not.toHaveBeenCalled();
    });

    it("flags the order for finance, not as refunded, when Razorpay rejects the refund", async () => {
      refundMock.mockRejectedValue({ error: { description: "Insufficient balance" } });
      const order = await overdueOrder();

      await service.checkVendorTimeouts();

      const stored = orders.rows.find((o) => o._id === order._id);
      expect(stored.orderStatus).toBe("REFUND_FAILED");
      expect(refunds.rows[0]).toMatchObject({ status: "failed", failureReason: "Insufficient balance" });
      const bodies = inApp.notifyUsers.mock.calls.map(([, msg]) => msg.body);
      expect(bodies.some((b) => b.includes("could not process your refund"))).toBe(true);
      expect(bodies.some((b) => b.includes("has been refunded"))).toBe(false);
    });

    it("keeps running after one order fails", async () => {
      await overdueOrder({ orderNumber: "TF-BAD" });
      const good = await overdueOrder({ orderNumber: "TF-GOOD" });
      jest.spyOn(finance, "initiateRefund").mockImplementationOnce(async () => {
        throw new Error("db down");
      });

      expect(await service.checkVendorTimeouts()).toBe(1);
      expect(orders.rows.find((o) => o._id === good._id).orderStatus).toBe("REFUNDED");
    });
  });

  describe("scheduler", () => {
    it("runs the timeout sweep, never overlaps itself and can be switched off", async () => {
      const sweep = jest.spyOn(service, "checkVendorTimeouts").mockResolvedValue(2);
      const maintenance = new FoodMaintenanceService(service);

      expect(await maintenance.sweepVendorTimeouts()).toBe(2);

      process.env.FOOD_MAINTENANCE_ENABLED = "false";
      try {
        expect(await maintenance.sweepVendorTimeouts()).toBe(0);
      } finally {
        delete process.env.FOOD_MAINTENANCE_ENABLED;
      }
      expect(sweep).toHaveBeenCalledTimes(1);
    });

    it("swallows sweep errors so the interval keeps firing", async () => {
      jest.spyOn(service, "checkVendorTimeouts").mockRejectedValue(new Error("boom"));
      expect(await new FoodMaintenanceService(service).sweepVendorTimeouts()).toBe(0);
    });
  });

  describe("refunds reach the gateway", () => {
    it("refunds the captured Razorpay payment in full and records the gateway refund id", async () => {
      const order = await overdueOrder();
      const refund: any = await finance.initiateRefund(order, "Customer cancellation", "cust_1");

      expect(refundMock).toHaveBeenCalledWith("pay_1", expect.objectContaining({ amount: 52900 }));
      expect(refund).toMatchObject({ status: "refunded", gatewayRefundId: "rfnd_1" });
    });

    it("is idempotent: a second request does not refund twice", async () => {
      const order = await overdueOrder();
      await finance.initiateRefund(order, "first", "system");
      await finance.initiateRefund(order, "second", "system");
      expect(refundMock).toHaveBeenCalledTimes(1);
    });

    it("marks the refund processing when Razorpay has not settled it yet", async () => {
      refundMock.mockResolvedValue({ id: "rfnd_2", status: "pending" });
      const order = await overdueOrder();
      const refund: any = await finance.initiateRefund(order, "slow", "system");
      expect(refund.status).toBe("processing");
    });

    it("fails safe instead of faking a refund when Razorpay keys are missing", async () => {
      const order = await overdueOrder();
      const refund: any = await buildFinance({}).initiateRefund(order, "no keys", "system");
      expect(refund.status).toBe("failed");
      expect(refundMock).not.toHaveBeenCalled();
    });

    it("fails safe when no captured payment exists for a paid order", async () => {
      attempts.rows.length = 0;
      const order = await overdueOrder();
      attempts.rows.length = 0;
      const refund: any = await finance.initiateRefund(order, "orphan", "system");
      expect(refund.status).toBe("failed");
      expect(refundMock).not.toHaveBeenCalled();
    });

    it("still refunds local demo payments on paper only", async () => {
      const order = await overdueOrder();
      attempts.rows.length = 0;
      await attempts.create({ orderId: order._id, gatewayProvider: "demo", status: "success" });
      const refund: any = await finance.initiateRefund(order, "demo", "system");
      expect(refund.status).toBe("refunded");
      expect(refundMock).not.toHaveBeenCalled();
    });
  });

  describe("order notifications", () => {
    it("tells the customer when the kitchen accepts and as the order progresses", async () => {
      const order = await orders.create({
        orderNumber: "TF-1",
        orderStatus: "PAID_AWAITING_VENDOR",
        paymentStatus: "PAID",
        outletId: outlet._id,
        customerId: "cust_1",
        fulfilmentType: "delivery",
      });

      await service.vendorAcceptOrder(order._id, "owner_1");
      await service.updateVendorOrderStatus(order._id, "owner_1", "PREPARING");
      await service.updateVendorOrderStatus(order._id, "owner_1", "READY");

      const sent = inApp.notifyUsers.mock.calls.map(([ids, msg]) => [ids[0], msg.body, msg.deepLink]);
      expect(sent).toEqual([
        ["cust_1", "Radha Rasoi accepted your order.", `/food/orders/${order._id}`],
        ["cust_1", "Your food is being prepared.", `/food/orders/${order._id}`],
        ["cust_1", "Your order is ready and will be on its way shortly.", `/food/orders/${order._id}`],
      ]);
    });

    it("notifies the kitchen when a customer cancels and refunds a paid order", async () => {
      const order = await overdueOrder({ vendorAcceptanceDeadline: undefined });

      await service.cancelOrder(order._id, "cust_1", "changed my mind");

      const ownerMessages = inApp.notifyUsers.mock.calls
        .filter(([ids]) => ids[0] === "owner_1")
        .map(([, msg]) => msg.body);
      expect(ownerMessages).toEqual(["The customer cancelled this order."]);
      expect(refundMock).toHaveBeenCalledTimes(1);
    });

    it("skips the inbox for guest checkouts but still never fails the order", async () => {
      const order = await orders.create({
        orderNumber: "TF-2",
        orderStatus: "PAID_AWAITING_VENDOR",
        paymentStatus: "PAID",
        outletId: outlet._id,
        customerId: null,
      });

      await expect(service.vendorAcceptOrder(order._id, "owner_1")).resolves.toBeTruthy();
      expect(inApp.notifyUsers).not.toHaveBeenCalled();
    });

    it("a failing notification channel never breaks the order action", async () => {
      inApp.notifyUsers.mockRejectedValue(new Error("socket down"));
      const order = await orders.create({
        orderNumber: "TF-3",
        orderStatus: "PAID_AWAITING_VENDOR",
        paymentStatus: "PAID",
        outletId: outlet._id,
        customerId: "cust_1",
      });

      const accepted: any = await service.vendorAcceptOrder(order._id, "owner_1");
      expect(accepted).toBeTruthy();
      expect(orders.rows.find((o) => o._id === order._id).orderStatus).toBe("ACCEPTED");
    });
  });
});
