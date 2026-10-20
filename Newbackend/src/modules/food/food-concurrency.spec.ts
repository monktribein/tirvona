import { createHmac } from "crypto";
import { FoodFinanceService } from "./application/food-finance.service";
import { FoodPaymentService } from "./application/food-payment.service";
import { fakeCrypto, fakeModel } from "./testing/fake-model";

const refundMock = jest.fn();
jest.mock("razorpay", () => jest.fn().mockImplementation(() => ({ payments: { refund: refundMock } })));

const SECRET = "test_key_secret";
const sign = (o: string, p: string) => createHmac("sha256", SECRET).update(`${o}|${p}`).digest("hex");
const config = (values: Record<string, string>) => ({ get: (k: string) => values[k] }) as any;
const live = { razorpayKeyId: "rzp_live_x", razorpayKeySecret: SECRET, nodeEnv: "production" };

describe("Food: concurrent payment and refund handling", () => {
  let orders: ReturnType<typeof fakeModel>;
  let refunds: ReturnType<typeof fakeModel>;
  let attempts: ReturnType<typeof fakeModel>;
  let ledger: ReturnType<typeof fakeModel>;
  let events: ReturnType<typeof fakeModel>;

  beforeEach(() => {
    orders = fakeModel();
    refunds = fakeModel();
    attempts = fakeModel();
    ledger = fakeModel();
    events = fakeModel();
    refundMock.mockReset();
    refundMock.mockResolvedValue({ id: "rfnd_1", status: "processed" });
  });

  const finance = () =>
    new FoodFinanceService(
      ledger as any, refunds as any, fakeModel() as any, orders as any, fakeModel() as any,
      fakeModel() as any, fakeCrypto, { isConfigured: () => false } as any, attempts as any, config(live),
    );

  describe("refunds", () => {
    const paidOrder = async () => {
      const order = await orders.create({ orderNumber: "TF-1", orderStatus: "VENDOR_REJECTED", paymentStatus: "PAID", totalPaise: 52900 });
      await attempts.create({ orderId: order._id, gatewayProvider: "razorpay", gatewayPaymentId: "pay_1", status: "success" });
      return order;
    };

    it("two simultaneous refunds for one order reach Razorpay once and write one refund and one ledger entry", async () => {
      const order = await paidOrder();
      const svc = finance();
      await Promise.all([svc.initiateRefund(order, "Vendor rejected", "vendor"), svc.initiateRefund(order, "Customer cancelled", "cust")]);
      expect(refundMock).toHaveBeenCalledTimes(1);
      expect(refunds.rows).toHaveLength(1);
      expect(ledger.rows.filter((r) => r.entryType === "refund_debit")).toHaveLength(1);
      expect(orders.rows[0]).toMatchObject({ paymentStatus: "REFUNDED", orderStatus: "REFUNDED" });
    });

    it("many simultaneous refunds still refund once", async () => {
      const order = await paidOrder();
      const svc = finance();
      await Promise.all(Array.from({ length: 6 }, () => svc.initiateRefund(order, "dup", "system")));
      expect(refundMock).toHaveBeenCalledTimes(1);
      expect(refunds.rows).toHaveLength(1);
    });

    it("a repeated refund after completion is skipped: no second Razorpay call, no second record", async () => {
      const order = await paidOrder();
      const svc = finance();
      expect((await svc.initiateRefund(order, "r", "system")).status).toBe("refunded");
      expect(await svc.initiateRefund(order, "r", "system")).toBeNull(); // the order is no longer PAID
      expect(refundMock).toHaveBeenCalledTimes(1);
      expect(refunds.rows).toHaveLength(1);
    });

    it("a gateway failure under concurrency is recorded once and never reported as refunded", async () => {
      const order = await paidOrder();
      refundMock.mockRejectedValue({ error: { description: "Insufficient balance" } });
      const svc = finance();
      await Promise.all([svc.initiateRefund(order, "r", "a"), svc.initiateRefund(order, "r", "b")]);
      expect(refundMock).toHaveBeenCalledTimes(1);
      expect(refunds.rows).toHaveLength(1);
      expect(refunds.rows[0].status).toBe("failed");
      expect(orders.rows[0].paymentStatus).not.toBe("REFUNDED");
    });

    it("never refunds an order that was not paid", async () => {
      const order = await orders.create({ orderNumber: "TF-2", orderStatus: "PAYMENT_PENDING", paymentStatus: "PENDING", totalPaise: 100 });
      expect(await finance().initiateRefund(order, "r", "system")).toBeNull();
      expect(refundMock).not.toHaveBeenCalled();
    });
  });

  describe("payment confirmation", () => {
    let recordOrderPayment: jest.Mock;
    let order: any;
    const service = () => new FoodPaymentService(orders as any, events as any, attempts as any, { recordOrderPayment } as any, config(live));

    beforeEach(async () => {
      recordOrderPayment = jest.fn();
      order = await orders.create({ orderNumber: "TF-9", orderStatus: "PAYMENT_PENDING", paymentStatus: "PENDING", totalPaise: 52900, customerName: "A", customerPhone: "9876543210" });
      await attempts.create({ orderId: order._id, gatewayProvider: "razorpay", gatewayOrderId: "order_R1", amountPaise: 52900, status: "pending" });
    });

    const callback = () => ({ razorpay_order_id: "order_R1", razorpay_payment_id: "pay_1", razorpay_signature: sign("order_R1", "pay_1") });

    it("a webhook and the browser callback arriving together post the ledger once", async () => {
      const svc = service();
      await Promise.all([svc.confirmPayment(order._id, callback()), svc.confirmPaymentFromWebhook("order_R1", "pay_1", { amountPaise: 52900 })]);
      expect(recordOrderPayment).toHaveBeenCalledTimes(1);
      expect(orders.rows[0]).toMatchObject({ paymentStatus: "PAID", orderStatus: "PAID_AWAITING_VENDOR" });
      expect(events.rows.filter((e) => e.toStatus === "PAID_AWAITING_VENDOR")).toHaveLength(1);
    });

    it("duplicate webhooks delivered concurrently post the ledger once", async () => {
      const svc = service();
      const results = await Promise.all(Array.from({ length: 5 }, () => svc.confirmPaymentFromWebhook("order_R1", "pay_1", { amountPaise: 52900 })));
      expect(results.every(Boolean)).toBe(true);
      expect(recordOrderPayment).toHaveBeenCalledTimes(1);
    });

    it("a repeated callback after payment is harmless", async () => {
      const svc = service();
      await svc.confirmPayment(order._id, callback());
      await svc.confirmPayment(order._id, callback());
      expect(recordOrderPayment).toHaveBeenCalledTimes(1);
    });

    it("a webhook with the wrong amount never confirms the order, even when repeated concurrently", async () => {
      const svc = service();
      await Promise.all(Array.from({ length: 3 }, () => svc.confirmPaymentFromWebhook("order_R1", "pay_1", { amountPaise: 100 })));
      expect(orders.rows[0].paymentStatus).toBe("PENDING");
      expect(recordOrderPayment).not.toHaveBeenCalled();
    });
  });
});
