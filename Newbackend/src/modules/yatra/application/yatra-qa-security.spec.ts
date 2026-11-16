/**
 * QA (final verification): payment-signature and webhook security around Tirvona Yatra, using
 * test secrets only. Covers the real HMAC paths that the demo-mode integration tests cannot:
 * the Razorpay checkout signature (Yatra), the shared webhook signature (Payments), webhook
 * routing to Yatra, and the per-route rate limits on Yatra write endpoints.
 */
import { createHmac } from "node:crypto";
import { UnauthorizedException } from "@nestjs/common";
import { YatraGatewayService } from "./yatra-support.service";
import { PaymentsWebhookService } from "../../payments/application/payments-webhook.service";
import { PaymentsWebhookController } from "../../payments/presentation/payments-webhook.controller";
import { YatraOperatorPayoutController, YatraRideCustomerController, YatraRidePartnerController } from "../presentation/yatra-p5.controller";

const config = (values: Record<string, unknown>) => ({ get: (key: string) => values[key] }) as any;
const TEST_SECRET = "qa_test_key_secret_not_a_real_key";
const sign = (orderId: string, paymentId: string, secret = TEST_SECRET) => createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");

describe("Yatra checkout signature (Razorpay HMAC, test secret)", () => {
  const live = new YatraGatewayService(config({ razorpayKeyId: "rzp_test_qa", razorpayKeySecret: TEST_SECRET, nodeEnv: "production" }));

  it("accepts only Razorpay's HMAC-SHA256 of order|payment", () => {
    expect(live.verifySignature("order_A1", "pay_B2", sign("order_A1", "pay_B2"))).toBe(true);
    expect(live.verifySignature("order_A1", "pay_B2", sign("order_A1", "pay_OTHER"))).toBe(false);
    expect(live.verifySignature("order_A1", "pay_B2", sign("order_A1", "pay_B2", "another_secret"))).toBe(false);
    expect(live.verifySignature("order_A1", "pay_B2", "short")).toBe(false);
    expect(live.verifySignature("order_A1", "pay_B2", "")).toBe(false);
  });

  it("never accepts demo payments once keys are configured, or in production without keys", () => {
    expect(live.verifySignature("demo_order_1", "demo_pay_1", "")).toBe(false);
    const prodNoKeys = new YatraGatewayService(config({ razorpayKeyId: "", razorpayKeySecret: "", nodeEnv: "production" }));
    expect(prodNoKeys.verifySignature("demo_order_1", "demo_pay_1", "")).toBe(false);
    const devNoKeys = new YatraGatewayService(config({ razorpayKeyId: "", razorpayKeySecret: "", nodeEnv: "development" }));
    expect(devNoKeys.verifySignature("demo_order_1", "demo_pay_1", "")).toBe(true);
    expect(devNoKeys.verifySignature("order_real", "pay_real", "")).toBe(false);
  });

  it("refuses to create demo orders in production when Razorpay is not configured", async () => {
    const prodNoKeys = new YatraGatewayService(config({ razorpayKeyId: "", razorpayKeySecret: "", nodeEnv: "production" }));
    await expect(prodNoKeys.createOrder(1500, "r", {})).rejects.toThrow(/not configured/);
  });
});

describe("Shared Razorpay webhook (signature and routing to Yatra)", () => {
  const WEBHOOK_SECRET = "qa_webhook_secret";
  const body = { event: "payment.captured", payload: { payment: { entity: { id: "pay_Y1", order_id: "order_Y1", amount: 150000, currency: "INR" } } } };
  const raw = Buffer.from(JSON.stringify(body));
  const signature = createHmac("sha256", WEBHOOK_SECRET).update(raw).digest("hex");

  const build = () => {
    const event: any = { status: "received", save: jest.fn() };
    const events: any = { create: jest.fn().mockResolvedValue(event), findOne: jest.fn() };
    const none: any = { confirmPaymentFromWebhook: jest.fn().mockResolvedValue(false) };
    const yatra: any = { confirmPaymentFromWebhook: jest.fn().mockResolvedValue(true) };
    const service = new PaymentsWebhookService(config({ razorpayWebhookSecret: WEBHOOK_SECRET }), events, none, none, none, none, none, none, none, yatra);
    return { service, event, yatra };
  };

  it("verifies the HMAC of the raw body with the webhook secret", () => {
    const { service } = build();
    expect(service.verifySignature(raw, signature)).toBe(true);
    expect(service.verifySignature(Buffer.from(JSON.stringify({ ...body, event: "order.paid" })), signature)).toBe(false);
    expect(service.verifySignature(raw, "0".repeat(64))).toBe(false);
    expect(service.verifySignature(raw, "")).toBe(false);
    const noSecret = new PaymentsWebhookService(config({}), {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any);
    expect(noSecret.verifySignature(raw, signature)).toBe(false);
  });

  it("rejects an invalid signature with 401 before any module is called", async () => {
    const { service, yatra } = build();
    const controller = new PaymentsWebhookController(service);
    await expect(controller.handle({ rawBody: raw } as any, "bad-signature", "evt_1", body)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(yatra.confirmPaymentFromWebhook).not.toHaveBeenCalled();
  });

  it("routes a captured Yatra order to Yatra with the captured amount", async () => {
    const { service, event, yatra } = build();
    const controller = new PaymentsWebhookController(service);
    await expect(controller.handle({ rawBody: raw } as any, signature, "evt_2", body)).resolves.toEqual({ success: true });
    expect(yatra.confirmPaymentFromWebhook).toHaveBeenCalledWith("order_Y1", "pay_Y1", { amountPaise: 150000, currency: "INR" });
    expect(event).toMatchObject({ status: "processed", matchedModule: "yatra" });
  });
});

describe("Per-route rate limits on Yatra write endpoints", () => {
  const limitOf = (proto: any, method: string) => Reflect.getMetadata("THROTTLER:LIMITdefault", proto[method]);
  it("throttles pilgrim / partner issue reports and payout requests", () => {
    expect(limitOf(YatraRideCustomerController.prototype, "journeyIssue")).toBe(10);
    expect(limitOf(YatraRideCustomerController.prototype, "issue")).toBe(10);
    expect(limitOf(YatraRidePartnerController.prototype, "issue")).toBe(10);
    expect(limitOf(YatraRidePartnerController.prototype, "requestPayout")).toBe(10);
    expect(limitOf(YatraOperatorPayoutController.prototype, "request")).toBe(10);
    expect(limitOf(YatraRideCustomerController.prototype, "request")).toBe(20);
  });
});
