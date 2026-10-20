import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Razorpay from "razorpay";
import { InjectModel } from "../../../database/orm-nest";
import type { Model } from "../../../database/orm";
import { FoodFinanceService } from "./food-finance.service";
import { FoodNotificationService } from "./food-notification.service";
import { createHmac, randomBytes, timingSafeEqual } from "crypto";

const safeEqual = (a: string, b: string): boolean => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};

export interface FoodPaymentConfirmation {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature?: string;
}

/**
 * Customer payments for food orders. Every rupee is collected on Tirvona's own
 * Razorpay account; restaurants are paid out afterwards through settlements.
 */
@Injectable()
export class FoodPaymentService {
  private readonly logger = new Logger(FoodPaymentService.name);
  private readonly razorpay: Razorpay | null;

  constructor(
    @InjectModel("FoodOrder") private readonly orderModel: Model<any>,
    @InjectModel("FoodOrderEvent")
    private readonly orderEventModel: Model<any>,
    @InjectModel("FoodPaymentAttempt")
    private readonly paymentAttemptModel: Model<any>,
    private readonly financeService: FoodFinanceService,
    private readonly config: ConfigService,
    @Optional() private readonly notifier?: FoodNotificationService,
  ) {
    const keyId = this.config.get<string>("razorpayKeyId");
    const keySecret = this.config.get<string>("razorpayKeySecret");
    this.razorpay =
      keyId && keySecret
        ? new Razorpay({ key_id: keyId, key_secret: keySecret })
        : null;
  }

  private isProduction(): boolean {
    return this.config.get<string>("nodeEnv") === "production";
  }

  /** Test payments without a gateway are only ever allowed outside production with no live key secret. */
  private demoPaymentsAllowed(): boolean {
    return !this.config.get<string>("razorpayKeySecret") && !this.isProduction();
  }

  /**
   * Starts (or resumes) checkout for a food order: creates a real Razorpay
   * order for the exact amount the server quoted.
   */
  async createPaymentSession(orderId: string) {
    const order = await this.orderModel.findById(orderId);
    if (!order) {
      throw new NotFoundException("Order not found");
    }

    if (order.orderStatus !== "PAYMENT_PENDING") {
      throw new BadRequestException(
        `Order is not in payment pending state: current status is ${order.orderStatus}`,
      );
    }

    const keyId = this.config.get<string>("razorpayKeyId") ?? "";
    const customer = {
      name: order.customerName,
      phone: order.customerPhone,
      email: order.customerEmail,
    };

    // Reopening checkout reuses the same gateway order instead of piling up new ones.
    const existing = await this.paymentAttemptModel.findOne({
      orderId: order._id,
      status: "pending",
      amountPaise: order.totalPaise,
    });
    if (existing?.gatewayOrderId) {
      return this.sessionResponse(order, existing, keyId, customer);
    }

    let gatewayProvider = "razorpay";
    let gatewayOrderId: string;
    if (this.razorpay) {
      try {
        const gatewayOrder = await this.razorpay.orders.create({
          amount: order.totalPaise,
          currency: "INR",
          receipt: String(order.orderNumber).slice(0, 40),
          notes: { module: "food", foodOrderId: String(order._id) },
        });
        gatewayOrderId = gatewayOrder.id;
      } catch (err: any) {
        this.logger.error(`Razorpay order creation failed: ${err?.message}`);
        throw new ServiceUnavailableException(
          "Payment gateway is unavailable. Please try again shortly.",
        );
      }
    } else if (this.demoPaymentsAllowed()) {
      gatewayProvider = "demo";
      gatewayOrderId = `mock_food_${Date.now()}_${randomBytes(3).toString("hex")}`;
    } else {
      throw new ServiceUnavailableException("Online payments are not configured");
    }

    const attempt = await this.paymentAttemptModel.create({
      orderId: order._id,
      gatewayProvider,
      gatewayOrderId,
      amountPaise: order.totalPaise,
      currency: "INR",
      status: "pending",
    });
    return this.sessionResponse(order, attempt, keyId, customer);
  }

  private sessionResponse(order: any, attempt: any, keyId: string, customer: any) {
    return {
      orderId: order._id,
      orderNumber: order.orderNumber,
      amountPaise: order.totalPaise,
      amountRupees: order.totalPaise / 100,
      currency: "INR",
      gatewayOrderId: attempt.gatewayOrderId,
      paymentAttemptId: attempt._id,
      key: keyId,
      demo: attempt.gatewayProvider === "demo",
      customer,
    };
  }

  /**
   * Browser checkout callback. The signature only Razorpay can produce (with
   * Tirvona's key secret) is what proves the customer really paid.
   */
  async confirmPayment(orderId: string, dto: FoodPaymentConfirmation) {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException("Order not found");
    if (order.paymentStatus === "PAID") return this.paidResponse(order);

    const attempt = await this.paymentAttemptModel.findOne({
      orderId: order._id,
      gatewayOrderId: dto.razorpay_order_id,
      status: "pending",
    });
    if (!attempt) {
      throw new BadRequestException("Payment does not belong to this order");
    }

    if (attempt.gatewayProvider === "demo") {
      if (!this.demoPaymentsAllowed())
        throw new BadRequestException("Demo payments are not accepted");
    } else {
      const secret = this.config.get<string>("razorpayKeySecret");
      const expected = secret
        ? createHmac("sha256", secret)
            .update(`${dto.razorpay_order_id}|${dto.razorpay_payment_id}`)
            .digest("hex")
        : "";
      if (!secret || !dto.razorpay_signature || !safeEqual(expected, dto.razorpay_signature)) {
        throw new BadRequestException("Payment verification failed");
      }
    }

    return this.settlePaid(
      order,
      attempt.gatewayProvider,
      dto.razorpay_payment_id,
      dto.razorpay_order_id,
      dto.razorpay_signature,
      "checkout.confirmed",
    );
  }

  /**
   * Entry for the central Razorpay webhook (PaymentsWebhookService), after it
   * has verified the webhook signature. Returns false when the Razorpay order
   * does not belong to food, so the dispatcher can try the next module.
   */
  async confirmPaymentFromWebhook(
    gatewayOrderId: string,
    paymentId: string,
    captured?: { amountPaise?: number },
  ): Promise<boolean> {
    const attempt = await this.paymentAttemptModel.findOne({
      gatewayOrderId,
      gatewayProvider: "razorpay",
    });
    if (!attempt) return false;

    const order = await this.orderModel.findById(attempt.orderId);
    if (!order) return false;
    if (order.paymentStatus === "PAID") return true;

    if (
      captured?.amountPaise !== undefined &&
      Math.round(captured.amountPaise) !== order.totalPaise
    ) {
      this.logger.error(
        `Food order ${order.orderNumber}: amount mismatch (captured ${captured.amountPaise}, expected ${order.totalPaise}). Not confirmed.`,
      );
      return true; // handled: flagged for review, never auto-confirmed
    }

    await this.settlePaid(
      order,
      "razorpay",
      paymentId,
      gatewayOrderId,
      undefined,
      "payment.captured",
    );
    return true;
  }

  /**
   * Legacy direct webhook route. It cannot see the raw request body, so
   * outside local development it only accepts a signature over the exact
   * JSON it received, and never without a configured secret.
   */
  async handlePaymentWebhook(
    provider: string,
    payload: any,
    signature?: string,
  ) {
    this.logger.log(`Received ${provider} payment webhook: ${JSON.stringify(payload?.event || payload?.type || "direct")}`);

    const event = payload?.event || "payment.captured";
    const paymentEntity =
      payload?.payload?.payment?.entity || payload?.payment || payload;
    const gatewayPaymentId =
      paymentEntity?.id || payload?.gatewayPaymentId || `pay_${Date.now()}`;
    const gatewayOrderId =
      paymentEntity?.order_id || payload?.gatewayOrderId;
    const orderId = payload?.orderId;

    const webhookSecret =
      process.env.FOOD_PAYMENT_WEBHOOK_SECRET || process.env.RAZORPAY_WEBHOOK_SECRET;
    const strict = Boolean(webhookSecret) || this.isProduction();
    if (strict) {
      const expected = webhookSecret
        ? createHmac("sha256", webhookSecret).update(JSON.stringify(payload)).digest("hex")
        : "";
      if (!webhookSecret || !signature || !safeEqual(expected, signature)) {
        this.logger.warn("Unsigned or mismatched food webhook rejected");
        throw new BadRequestException("Invalid webhook signature");
      }
    }

    // Idempotency: if this payment was already processed, exit safely
    const existingSuccessfulAttempt = await this.paymentAttemptModel.findOne({
      gatewayPaymentId,
      status: "success",
    });

    if (existingSuccessfulAttempt) {
      this.logger.log(
        `Idempotent webhook: Payment ${gatewayPaymentId} already processed. Skipping duplicate ledger entries.`,
      );
      return { status: "already_processed", paymentId: gatewayPaymentId };
    }

    let order: any = null;
    if (orderId) {
      order = await this.orderModel.findById(orderId);
    } else if (gatewayOrderId) {
      const attempt = await this.paymentAttemptModel.findOne({ gatewayOrderId });
      if (attempt) {
        order = await this.orderModel.findById(attempt.orderId);
      }
    }

    if (!order) {
      throw new NotFoundException("Associated order not found for payment webhook");
    }

    return this.settlePaid(
      order,
      provider,
      gatewayPaymentId,
      gatewayOrderId,
      signature,
      event,
    );
  }

  private paidResponse(order: any) {
    return {
      status: "success",
      orderId: order._id,
      orderNumber: order.orderNumber,
      orderStatus: order.orderStatus,
    };
  }

  /** Marks the order paid, starts the vendor acceptance clock and posts the ledger. Safe to call twice. */
  private async settlePaid(
    initial: any,
    provider: string,
    gatewayPaymentId: string,
    gatewayOrderId: string | undefined,
    signature: string | undefined,
    event: string,
  ) {
    let order = initial;
    if (order.paymentStatus === "PAID") return this.paidResponse(order);

    // Close the pending attempt for this gateway order, or record a new one.
    const pending = gatewayOrderId
      ? await this.paymentAttemptModel.findOne({
          orderId: order._id,
          gatewayOrderId,
          status: "pending",
        })
      : null;
    if (pending) {
      pending.status = "success";
      pending.gatewayPaymentId = gatewayPaymentId;
      pending.gatewaySignature = signature || "";
      pending.webhookReference = event;
      await pending.save();
    } else {
      await this.paymentAttemptModel.create({
        orderId: order._id,
        gatewayProvider: provider,
        gatewayOrderId,
        gatewayPaymentId,
        gatewaySignature: signature || "",
        amountPaise: order.totalPaise,
        currency: "INR",
        status: "success",
        webhookReference: event,
      });
    }

    // PAYMENT_PENDING -> PAID_AWAITING_VENDOR. The conditional flip is the single
    // gate: if the webhook and the browser callback arrive together, only one
    // of them posts the ledger.
    const fromStatus = order.orderStatus;
    const claimed = await this.orderModel.findOneAndUpdate(
      { _id: order._id, paymentStatus: { $ne: "PAID" } },
      {
        $set: {
          paymentStatus: "PAID",
          orderStatus: "PAID_AWAITING_VENDOR",
          // 10-minute SLA countdown starts upon payment
          vendorAcceptanceDeadline: new Date(Date.now() + 10 * 60 * 1000),
        },
      },
      { new: true },
    );
    if (!claimed) return this.paidResponse(order);
    order = claimed;

    await this.orderEventModel.create({
      orderId: order._id,
      fromStatus,
      toStatus: "PAID_AWAITING_VENDOR",
      actorType: "system",
      actorId: provider,
      reason: `Payment verified (${gatewayPaymentId}). Vendor acceptance SLA clock started.`,
      metadata: { gatewayPaymentId, gatewayOrderId, amountPaise: order.totalPaise },
    });

    await this.financeService.recordOrderPayment(order, gatewayPaymentId);
    await this.notifier?.notify(order, "paid");

    this.logger.log(
      `Order #${order.orderNumber} successfully paid! Awaiting vendor acceptance.`,
    );

    return this.paidResponse(order);
  }
}
