import { FoodFinanceService } from "./application/food-finance.service";
import { FoodNotificationService } from "./application/food-notification.service";
import { FoodOrderService } from "./application/food-order.service";
import { FOOD_PAYMENT_STATUSES, FOOD_REFUND_STATUSES, canonicalPaymentStatus } from "./domain/food.constants";
import { fakeCrypto, fakeModel } from "./testing/fake-model";

const refundMock = jest.fn();
const fetchRefundMock = jest.fn();
const fetchMultipleMock = jest.fn();
jest.mock("razorpay", () =>
  jest.fn().mockImplementation(() => ({
    payments: { refund: refundMock, fetchRefund: fetchRefundMock, fetchMultipleRefund: fetchMultipleMock },
  })),
);

const config = (values: Record<string, string> = { razorpayKeyId: "rzp_live_x", razorpayKeySecret: "secret" }) =>
  ({ get: (key: string) => values[key] }) as any;

describe("Food refunds: payment status and refund status stay separate", () => {
  let orders: ReturnType<typeof fakeModel>;
  let refunds: ReturnType<typeof fakeModel>;
  let attempts: ReturnType<typeof fakeModel>;
  let finance: FoodFinanceService;
  let service: FoodOrderService;
  let inApp: { notifyUsers: jest.Mock };

  const paidOrder = async (extra: Record<string, unknown> = {}) => {
    const order = await orders.create({
      orderNumber: "TF-20261019-RRRR",
      orderStatus: "VENDOR_REJECTED",
      paymentStatus: "PAID",
      totalPaise: 52900,
      customerId: "cust_1",
      ...extra,
    });
    await attempts.create({ orderId: order._id, gatewayProvider: "razorpay", gatewayPaymentId: "pay_1", status: "success" });
    return order;
  };
  const stored = (order: any) => orders.rows.find((o) => o._id === order._id);
  const bodies = () => inApp.notifyUsers.mock.calls.map(([, msg]) => msg.body as string);
  const later = (minutes: number) => new Date(Date.now() + minutes * 60_000);

  beforeEach(() => {
    refundMock.mockReset();
    fetchRefundMock.mockReset();
    fetchMultipleMock.mockReset();
    refundMock.mockResolvedValue({ id: "rfnd_1", status: "processed" });
    fetchMultipleMock.mockResolvedValue({ items: [] });
    orders = fakeModel();
    refunds = fakeModel();
    attempts = fakeModel();
    inApp = { notifyUsers: jest.fn().mockResolvedValue(undefined) };
    finance = new FoodFinanceService(
      fakeModel() as any, refunds as any, fakeModel() as any, orders as any, fakeModel() as any,
      fakeModel() as any, fakeCrypto, { isConfigured: () => false } as any, attempts as any, config(),
    );
    service = new FoodOrderService(
      orders as any, fakeModel() as any, fakeModel() as any, fakeModel() as any, fakeModel() as any, fakeModel() as any,
      { validateQuote: jest.fn() } as any, finance, new FoodNotificationService(fakeModel() as any, fakeModel() as any, inApp as any),
    );
  });

  describe("failure", () => {
    it("keeps paymentStatus a supported value, marks the order REFUND_FAILED and records the reason", async () => {
      refundMock.mockRejectedValue({ error: { description: "Insufficient balance" } });
      const order = await paidOrder();
      const refund = await finance.initiateRefund(order, "Vendor rejected", "vendor");

      expect(refund.status).toBe("failed");
      expect(refund.failureReason).toBe("Insufficient balance");
      expect(stored(order).orderStatus).toBe("REFUND_FAILED");
      expect(stored(order).paymentStatus).toBe("PAID"); // the money is still with us
      for (const o of orders.rows) expect(FOOD_PAYMENT_STATUSES).toContain(o.paymentStatus);
      for (const r of refunds.rows) expect(FOOD_REFUND_STATUSES).toContain(r.status);
    });

    it("tells the customer it failed rather than that it succeeded", async () => {
      refundMock.mockRejectedValue(new Error("down"));
      await service["refundWithNotice"](await paidOrder(), "Vendor rejected", "vendor");
      expect(bodies().some((b) => /could not process your refund/.test(b))).toBe(true);
      expect(bodies().some((b) => /has been refunded|has been started/.test(b))).toBe(false);
    });
  });

  describe("pending at the gateway", () => {
    beforeEach(() => refundMock.mockResolvedValue({ id: "rfnd_P", status: "pending" }));

    it("is processing, not refunded: the payment stays PAID until the gateway finishes", async () => {
      const order = await paidOrder();
      const refund = await finance.initiateRefund(order, "Cancelled", "cust");
      expect(refund.status).toBe("processing");
      expect(refund.resolvedAt).toBeNull();
      expect(stored(order)).toMatchObject({ orderStatus: "REFUND_PROCESSING", paymentStatus: "PAID" });
    });

    it("tells the customer the refund has started, never that it has been refunded", async () => {
      await service["refundWithNotice"](await paidOrder(), "Cancelled", "cust");
      expect(bodies().some((b) => /refund of ₹529\.00 has been started/.test(b))).toBe(true);
      expect(bodies().some((b) => /has been refunded/.test(b))).toBe(false);
    });
  });

  describe("reconciliation", () => {
    it("a pending refund becomes refunded only when the gateway says processed, then tells the customer", async () => {
      refundMock.mockResolvedValue({ id: "rfnd_P", status: "pending" });
      const order = await paidOrder();
      await finance.initiateRefund(order, "Cancelled", "cust");

      fetchRefundMock.mockResolvedValue({ id: "rfnd_P", status: "pending" });
      expect(await finance.reconcileProcessingRefunds()).toEqual([]);
      expect(refunds.rows[0].status).toBe("processing");

      fetchRefundMock.mockResolvedValue({ id: "rfnd_P", status: "processed" });
      expect(await finance.reconcileProcessingRefunds()).toEqual([{ orderId: order._id, outcome: "refunded" }]);
      expect(fetchRefundMock).toHaveBeenLastCalledWith("pay_1", "rfnd_P");
      expect(refunds.rows[0]).toMatchObject({ status: "refunded" });
      expect(refunds.rows[0].resolvedAt).toBeInstanceOf(Date);
      expect(stored(order)).toMatchObject({ orderStatus: "REFUNDED", paymentStatus: "REFUNDED" });

      expect(await finance.reconcileProcessingRefunds()).toEqual([]); // final stays final
    });

    it("the order service notifies once, when the refund really completes", async () => {
      refundMock.mockResolvedValue({ id: "rfnd_P", status: "pending" });
      await service["refundWithNotice"](await paidOrder(), "Cancelled", "cust");
      fetchRefundMock.mockResolvedValue({ status: "processed" });
      expect(await service.reconcileRefunds()).toBe(1);
      expect(await service.reconcileRefunds()).toBe(0);
      expect(bodies().filter((b) => /has been refunded/.test(b))).toHaveLength(1);
    });

    it("a refund the gateway reports as failed is recorded as failed and flagged on the order", async () => {
      refundMock.mockResolvedValue({ id: "rfnd_P", status: "pending" });
      const order = await paidOrder();
      await finance.initiateRefund(order, "Cancelled", "cust");
      fetchRefundMock.mockResolvedValue({ status: "failed" });
      expect(await finance.reconcileProcessingRefunds()).toEqual([{ orderId: order._id, outcome: "failed" }]);
      expect(refunds.rows[0]).toMatchObject({ status: "failed" });
      expect(stored(order)).toMatchObject({ orderStatus: "REFUND_FAILED", paymentStatus: "PAID" });
    });

    it("an unreachable gateway changes nothing", async () => {
      refundMock.mockResolvedValue({ id: "rfnd_P", status: "pending" });
      await finance.initiateRefund(await paidOrder(), "Cancelled", "cust");
      fetchRefundMock.mockRejectedValue(new Error("timeout"));
      expect(await finance.reconcileProcessingRefunds()).toEqual([]);
      expect(refunds.rows[0].status).toBe("processing");
    });
  });

  describe("retry", () => {
    it("a failed refund is retried after a pause, creating a new record and keeping the failed one as history", async () => {
      refundMock.mockRejectedValueOnce(new Error("temporary"));
      const order = await paidOrder();
      await finance.initiateRefund(order, "Vendor rejected", "vendor");
      expect(await finance.refundsDueForRetry()).toHaveLength(0); // not straight away
      expect(await finance.refundsDueForRetry(later(20))).toHaveLength(1);

      const retry = await finance.initiateRefund(stored(order), "Automatic retry", "system");
      expect(retry.status).toBe("refunded");
      expect(refunds.rows.map((r) => r.status)).toEqual(["failed", "refunded"]);
      expect(stored(order)).toMatchObject({ orderStatus: "REFUNDED", paymentStatus: "REFUNDED" });
      expect(await finance.refundsDueForRetry(later(60))).toHaveLength(0);
    });

    it("stops retrying after three failures and leaves the order for finance", async () => {
      refundMock.mockRejectedValue(new Error("still down"));
      const order = await paidOrder();
      for (let i = 0; i < 3; i += 1) await finance.initiateRefund(stored(order), "try", "system");
      expect(refunds.rows.filter((r) => r.status === "failed")).toHaveLength(3);
      expect(await finance.refundsDueForRetry(later(600))).toHaveLength(0);
      expect(stored(order).orderStatus).toBe("REFUND_FAILED");
    });

    it("the order service sweep retries due orders and tells the customer the outcome", async () => {
      refundMock.mockRejectedValueOnce(new Error("temporary"));
      const order = await paidOrder();
      await service["refundWithNotice"](order, "Vendor rejected", "vendor");
      jest.spyOn(finance, "refundsDueForRetry").mockResolvedValue([stored(order)]);
      expect(await service.retryFailedRefunds()).toBe(1);
      expect(stored(order).paymentStatus).toBe("REFUNDED");
      expect(bodies().some((b) => /has been refunded/.test(b))).toBe(true);
    });

    it("never refunds twice: a refund the gateway already holds is adopted instead of repeated", async () => {
      const order = await paidOrder();
      fetchMultipleMock.mockResolvedValue({
        items: [{ id: "rfnd_held", status: "processed", amount: 52900, notes: { foodOrderId: String(order._id) } }],
      });
      const refund = await finance.initiateRefund(order, "retry after crash", "system");
      expect(refundMock).not.toHaveBeenCalled();
      expect(refund).toMatchObject({ gatewayRefundId: "rfnd_held", status: "refunded" });
    });

    it("a refund the gateway holds for a different amount or as failed is not adopted", async () => {
      const order = await paidOrder();
      fetchMultipleMock.mockResolvedValue({
        items: [
          { id: "rfnd_other", status: "processed", amount: 100, notes: { foodOrderId: String(order._id) } },
          { id: "rfnd_bad", status: "failed", amount: 52900, notes: { foodOrderId: String(order._id) } },
        ],
      });
      await finance.initiateRefund(order, "retry", "system");
      expect(refundMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("duplicate processing", () => {
    it("simultaneous retries of a failed refund reach the gateway once", async () => {
      refundMock.mockRejectedValueOnce(new Error("temporary")).mockResolvedValue({ id: "rfnd_R", status: "processed" });
      const order = await paidOrder();
      await finance.initiateRefund(order, "first", "system");
      refundMock.mockClear();
      await Promise.all([1, 2, 3, 4].map(() => finance.initiateRefund(stored(order), "retry", "system")));
      expect(refundMock).toHaveBeenCalledTimes(1);
      expect(refunds.rows.filter((r) => r.status === "refunded")).toHaveLength(1);
    });

    it("a refund already refunded or processing is returned as is, never started again", async () => {
      refundMock.mockResolvedValue({ id: "rfnd_P", status: "pending" });
      const order = await paidOrder();
      const first = await finance.initiateRefund(order, "r", "system");
      const again = await finance.initiateRefund({ ...stored(order), paymentStatus: "PAID", orderStatus: "REFUND_PROCESSING" }, "r", "system");
      expect(String(again._id)).toBe(String(first._id));
      expect(refundMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("interrupted refunds", () => {
    it("an order stuck in REFUND_PROCESSING without any refund is flagged failed after a grace period, then retried safely", async () => {
      const order = await paidOrder({ orderStatus: "REFUND_PROCESSING" });
      expect(await finance.recoverInterruptedRefunds()).toBe(0); // just claimed: leave it alone
      expect(await finance.recoverInterruptedRefunds(later(11))).toBe(1);
      expect(stored(order)).toMatchObject({ orderStatus: "REFUND_FAILED", paymentStatus: "PAID" });
      expect(refunds.rows[0]).toMatchObject({ status: "failed" });
      expect(await finance.recoverInterruptedRefunds(later(30))).toBe(0); // already handled

      fetchMultipleMock.mockResolvedValue({
        items: [{ id: "rfnd_after_crash", status: "processed", amount: 52900, notes: { foodOrderId: String(order._id) } }],
      });
      const retry = await finance.initiateRefund(stored(order), "retry", "system");
      expect(retry.gatewayRefundId).toBe("rfnd_after_crash");
      expect(refundMock).not.toHaveBeenCalled();
    });

    it("an order whose refund is in progress is not touched", async () => {
      refundMock.mockResolvedValue({ id: "rfnd_P", status: "pending" });
      await finance.initiateRefund(await paidOrder(), "r", "system");
      expect(await finance.recoverInterruptedRefunds(later(60))).toBe(0);
    });
  });

  describe("compatibility with records already stored", () => {
    it("an order stored with the old paymentStatus REFUND_FAILED is still refundable and ends up REFUNDED", async () => {
      const order = await paidOrder({ paymentStatus: "REFUND_FAILED", orderStatus: "REFUND_FAILED" });
      await refunds.create({ orderId: order._id, status: "failed", amountPaise: 52900, reason: "old", failureReason: "x" });
      expect(await finance.refundsDueForRetry(later(20))).toHaveLength(1);
      const retry = await finance.initiateRefund(order, "retry", "system");
      expect(retry.status).toBe("refunded");
      expect(stored(order)).toMatchObject({ paymentStatus: "REFUNDED", orderStatus: "REFUNDED" });
    });

    it("canonicalPaymentStatus maps only the unsupported value and leaves every supported one alone", () => {
      expect(canonicalPaymentStatus("REFUND_FAILED")).toBe("PAID");
      for (const status of FOOD_PAYMENT_STATUSES) expect(canonicalPaymentStatus(status)).toBe(status);
    });
  });

  describe("API serialization", () => {
    const view = async (order: any) => (await (service as any).getOrderWithItems(order._id)) as any;
    beforeEach(() => {
      // the fake model cannot populate or chain lean() on findById, so serve the read-back from the rows
      (orders as any).findById = (id: any) => {
        const row = orders.rows.find((o) => String(o._id) === String(id));
        const q: any = { populate: () => q, lean: async () => (row ? { ...row } : null) };
        return q;
      };
      (service as any).orderItemModel = { find: () => ({ lean: async () => [] }) };
      (service as any).orderEventModel = { find: () => ({ sort: () => ({ lean: async () => [] }) }) };
    });

    it("shows a legacy REFUND_FAILED payment status as PAID, with the refund failure alongside", async () => {
      const order = await paidOrder({ paymentStatus: "REFUND_FAILED", orderStatus: "REFUND_FAILED", subtotalPaise: 1, deliveryFeePaise: 0, packagingFeePaise: 0, taxPaise: 0 });
      await refunds.create({ orderId: order._id, status: "failed", amountPaise: 52900, reason: "r", failureReason: "Insufficient balance" });
      const out = await view(order);
      expect(out.paymentStatus).toBe("PAID");
      expect(out.orderStatus).toBe("REFUND_FAILED");
      expect(out.refund).toMatchObject({ status: "failed", amountRupees: 529, failureReason: "Insufficient balance" });
    });

    it.each([
      ["processing", "REFUND_PROCESSING", "PAID"],
      ["refunded", "REFUNDED", "REFUNDED"],
    ])("serializes a %s refund with payment status %s/%s", async (refundStatus, orderStatus, paymentStatus) => {
      const order = await paidOrder({ orderStatus, paymentStatus, subtotalPaise: 1, deliveryFeePaise: 0, packagingFeePaise: 0, taxPaise: 0 });
      await refunds.create({ orderId: order._id, status: refundStatus, amountPaise: 52900, reason: "r", resolvedAt: refundStatus === "refunded" ? new Date() : null });
      const out = await view(order);
      expect(out).toMatchObject({ orderStatus, paymentStatus, refund: { status: refundStatus, amountRupees: 529 } });
      expect(FOOD_PAYMENT_STATUSES).toContain(out.paymentStatus);
    });

    it("an order with no refund has refund: null", async () => {
      const order = await paidOrder({ orderStatus: "ACCEPTED", subtotalPaise: 1, deliveryFeePaise: 0, packagingFeePaise: 0, taxPaise: 0 });
      expect((await view(order)).refund).toBeNull();
    });
  });
});
