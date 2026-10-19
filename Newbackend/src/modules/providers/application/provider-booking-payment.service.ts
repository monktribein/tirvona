import { Inject, Injectable, Logger, forwardRef } from "@nestjs/common";
import { InjectModel } from "../../../database/orm-nest";
import { ConfigService } from "@nestjs/config";
import type { Model } from "../../../database/orm";
import { createHmac, timingSafeEqual } from "node:crypto";
import Razorpay from "razorpay";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import { WalletService } from "../../wallet/application/wallet.service";
import { providerError } from "../domain/provider.errors";
import { sameId, toObjectId } from "./provider.helpers";
// Type-only: provider-booking.service imports this file too. The class is
// resolved lazily below so the two modules never load each other mid-evaluation
// (which would trip a TDZ error under the SWC dev builder).
import type { ProviderBookingService } from "./provider-booking.service";
import type {
  ConfirmProviderPaymentDto,
  CreatePaymentOrderDto,
} from "../presentation/dto/booking.dto";

const MODULE = "provider_booking" as any;

/**
 * Connects the provider booking workflow to the platform's payments:
 *
 * - The amount is always the server's price snapshot (`pricing.totalMinor`);
 *   nothing the client sends can change it.
 * - Each booking has at most one open gateway order, remembered in
 *   `paymentOrder` with its wallet/gateway split. A checkout callback is only
 *   accepted for that order and a webhook only for that order's gateway amount,
 *   so a valid signature from some other (cheaper) order cannot confirm this one.
 * - The wallet share is captured with the exact amount that was held when the
 *   order was opened.
 * - Cancelling a paid booking refunds each part to where it came from and
 *   records the outcome; a gateway refund is only ever recorded as INITIATED or
 *   as the gateway's own reported status, never as completed on our say-so.
 */
@Injectable()
export class ProviderBookingPaymentService {
  private readonly logger = new Logger(ProviderBookingPaymentService.name);

  constructor(
    @InjectModel("ProviderBooking") private readonly bookings: Model<any>,
    @Inject(
      forwardRef(
        () =>
          // Lazy on purpose: provider-booking.service imports this file too.
          // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/consistent-type-imports
          (require("./provider-booking.service") as typeof import("./provider-booking.service"))
            .ProviderBookingService,
      ),
    )
    private readonly bookingService: ProviderBookingService,
    private readonly wallet: WalletService,
    private readonly config: ConfigService,
  ) {}

  /** Opens (or replaces) the payment order for a booking that is waiting for payment. */
  async createPaymentOrder(
    bookingId: string,
    user: AuthenticatedUser,
    dto?: CreatePaymentOrderDto,
  ) {
    const booking: any = await this.bookings
      .findById(toObjectId(bookingId, "bookingId"))
      .select("customerUserId status holdExpiresAt serviceSnapshot bookingNumber paymentRefs")
      .lean();

    if (!booking || !sameId(booking.customerUserId, user.id))
      throw providerError.notFound("BOOKING_NOT_FOUND", "Booking not found");
    if (booking.status !== "PAYMENT_PENDING")
      throw providerError.conflict(
        "BOOKING_NOT_PAYABLE",
        `Booking is in state ${booking.status} and cannot accept payment`,
      );
    if (booking.holdExpiresAt && new Date(booking.holdExpiresAt) < new Date())
      throw providerError.gone(
        "BOOKING_HOLD_EXPIRED",
        "The calendar hold for this booking has expired. Please book again.",
      );

    const totalMinor = Number(booking.serviceSnapshot?.pricing?.totalMinor || 0);
    const totalRupees = totalMinor / 100;

    if (totalMinor <= 0) {
      await this.bookingService.confirmPayment(String(booking._id), "FREE");
      return { free: true, data: { bookingId: booking._id, status: "CONFIRMED" } };
    }

    const { walletAmount, gatewayAmount } = await this.wallet.planSplit(
      user.id,
      totalRupees,
      dto?.useWallet,
      { module: MODULE, sourceId: booking._id },
    );
    const walletMinor = Math.round(walletAmount * 100);
    const gatewayMinor = Math.round(gatewayAmount * 100);
    const walletInfo = { applied: walletAmount, gatewayAmount, total: totalRupees };

    // Paid entirely from the wallet: spend, then confirm. If confirming fails the spend is reversed.
    if (walletMinor > 0 && gatewayMinor <= 0) {
      const spent = await this.wallet.spend({
        userId: user.id,
        module: MODULE,
        sourceId: booking._id,
        amount: totalRupees,
        reference: booking.bookingNumber,
        description: `Payment for puja booking ${booking.bookingNumber}`,
        actorId: user.id,
      });
      const paymentRef = `WLT-${String(spent._id).slice(-10).toUpperCase()}`;
      await this.bookings.updateOne(
        { _id: booking._id },
        {
          $set: { paymentOrder: { orderId: paymentRef, gatewayMinor: 0, walletMinor: totalMinor } },
          $addToSet: { paymentRefs: paymentRef },
        },
      );
      try {
        await this.bookingService.confirmPayment(String(booking._id), paymentRef);
      } catch (error) {
        await this.reverseWalletSpend(booking, totalRupees);
        throw error;
      }
      return {
        walletPaid: true,
        wallet: { applied: totalRupees, gatewayAmount: 0 },
        data: { bookingId: booking._id, paymentRef, status: "CONFIRMED" },
      };
    }

    // Part wallet / part gateway: reserve the wallet share until the gateway payment arrives.
    if (walletMinor > 0) {
      await this.wallet.placeHold({
        userId: user.id,
        module: MODULE,
        sourceId: booking._id,
        amount: walletAmount,
        reference: booking.bookingNumber,
        expiresAt: booking.holdExpiresAt,
      });
    } else {
      await this.wallet.releaseHold(MODULE, booking._id);
    }

    const keyId = this.config.get<string>("razorpayKeyId");
    const keySecret = this.config.get<string>("razorpayKeySecret");
    if (!keyId || !keySecret) {
      if (walletMinor > 0) await this.wallet.releaseHold(MODULE, booking._id);
      this.logger.warn(
        `Razorpay credentials missing for provider booking ${booking.bookingNumber}; no order created.`,
      );
      return {
        configured: false,
        blocker: "RAZORPAY_CREDENTIALS_MISSING",
        message: "The payment gateway is not configured in this environment.",
        wallet: walletInfo,
        data: { bookingId: booking._id, amountMinor: gatewayMinor, currency: "INR" },
      };
    }

    let order: any;
    try {
      order = await new Razorpay({ key_id: keyId, key_secret: keySecret }).orders.create({
        amount: gatewayMinor,
        currency: "INR",
        receipt: booking.bookingNumber,
        notes: { bookingId: String(booking._id), bookingNumber: booking.bookingNumber },
      });
    } catch (error) {
      if (walletMinor > 0) await this.wallet.releaseHold(MODULE, booking._id);
      throw error;
    }

    await this.bookings.updateOne(
      { _id: booking._id, status: "PAYMENT_PENDING" },
      {
        $set: { paymentOrder: { orderId: order.id, gatewayMinor, walletMinor } },
        $addToSet: { paymentRefs: order.id },
      },
    );
    return {
      configured: true,
      wallet: walletInfo,
      data: {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId,
        bookingNumber: booking.bookingNumber,
      },
    };
  }

  /** Browser checkout callback. Verifies the signature AND that the order is this booking's open order. */
  async confirmPayment(
    bookingId: string,
    user: AuthenticatedUser,
    dto: ConfirmProviderPaymentDto,
  ) {
    const booking: any = await this.bookings
      .findById(toObjectId(bookingId, "bookingId"))
      .select("customerUserId status serviceSnapshot bookingNumber paymentOrder paymentRefs")
      .lean();
    if (!booking || !sameId(booking.customerUserId, user.id))
      throw providerError.notFound("BOOKING_NOT_FOUND", "Booking not found");

    if (booking.status !== "PAYMENT_PENDING")
      return { alreadyConfirmed: true, bookingId: booking._id, status: booking.status };

    const keySecret = this.config.get<string>("razorpayKeySecret");
    if (!keySecret)
      throw providerError.conflict(
        "GATEWAY_NOT_CONFIGURED",
        "Cannot verify payment: the payment gateway is not configured.",
      );
    if (!this.verifyRazorpaySignature(dto.razorpay_order_id, dto.razorpay_payment_id, dto.razorpay_signature, keySecret))
      throw providerError.badRequest("PAYMENT_SIGNATURE_INVALID", "Invalid payment signature from gateway");

    // A genuine signature proves a payment happened for *some* order. It must be this booking's order.
    if (!booking.paymentOrder?.orderId || booking.paymentOrder.orderId !== dto.razorpay_order_id)
      throw providerError.badRequest(
        "PAYMENT_ORDER_MISMATCH",
        "This payment does not belong to this booking",
      );

    await this.captureWalletShare(booking);
    await this.bookings.updateOne(
      { _id: booking._id },
      { $addToSet: { paymentRefs: dto.razorpay_payment_id } },
    );
    const updated = await this.bookingService.confirmPayment(String(booking._id), dto.razorpay_payment_id);
    return { success: true, data: updated };
  }

  /**
   * Webhook reconciliation, called by PaymentsWebhookService after it has
   * verified the gateway signature. Returns true when the order is ours.
   */
  async confirmPaymentFromWebhook(
    gatewayOrderId: string,
    paymentId: string,
    captured?: { amountPaise?: number; currency?: string },
  ): Promise<boolean> {
    const booking: any = await this.bookings.findOne({ paymentRefs: gatewayOrderId });
    if (!booking) return false;
    if (booking.status !== "PAYMENT_PENDING") return true; // late or duplicate event: nothing to change
    if (booking.paymentOrder?.orderId !== gatewayOrderId) {
      this.logger.error(`Provider booking ${booking.bookingNumber}: payment on superseded order ${gatewayOrderId}; not confirmed, needs reconciliation.`);
      return true;
    }

    // The gateway took money for this order; it must be exactly the amount the order was opened for.
    const expected = Number(booking.paymentOrder?.gatewayMinor);
    if (captured?.amountPaise === undefined || Math.round(captured.amountPaise) !== expected) {
      this.logger.error(
        `Provider booking ${booking.bookingNumber}: webhook amount ${captured?.amountPaise} does not match order amount ${expected}; not confirmed, needs reconciliation.`,
      );
      return true; // handled: claimed by this module, deliberately not confirmed
    }
    if (captured.currency && captured.currency !== "INR") return true;

    await this.captureWalletShare(booking);
    await this.bookings.updateOne({ _id: booking._id }, { $addToSet: { paymentRefs: paymentId } });
    await this.bookingService.confirmPayment(String(booking._id), paymentId);
    this.logger.log(`Provider booking ${booking.bookingNumber} confirmed via webhook`);
    return true;
  }

  /**
   * Returns the money for a paid booking that was cancelled, part by part.
   * The outcome is stored on the booking (`refund`) and never overstated: a
   * wallet credit is final, a gateway refund is "INITIATED" (or the status the
   * gateway itself returned), a failure or a missing gateway key is recorded
   * for operations instead of being logged and forgotten.
   */
  async handleRefundOnCancellation(booking: any, reasonCode: string): Promise<void> {
    const order = booking.paymentOrder;
    const refs: string[] = booking.paymentRefs ?? [];
    const walletMinor = Number(order?.walletMinor ?? 0);
    const gatewayMinor = Number(order?.gatewayMinor ?? 0);
    if (walletMinor <= 0 && gatewayMinor <= 0) return; // nothing was paid (e.g. a free offering)

    const record: any = { requestedAt: new Date(), reasonCode, wallet: null, gateway: null };

    if (walletMinor > 0) {
      try {
        const credited = await this.wallet.credit({
          userId: String(booking.customerUserId),
          amount: walletMinor / 100,
          module: MODULE,
          category: "refund",
          reference: booking.bookingNumber,
          description: `Refund for cancelled puja ${booking.bookingNumber}`,
          idempotencyKey: `refund-wallet-${booking._id}`,
        } as any);
        record.wallet = { status: credited ? "CREDITED" : "FAILED", amountMinor: walletMinor };
      } catch (error) {
        this.logger.error(`Wallet refund failed for ${booking.bookingNumber}: ${(error as Error).message}`);
        record.wallet = { status: "FAILED", amountMinor: walletMinor };
      }
    }

    if (gatewayMinor > 0) {
      const paymentId = refs.find((ref) => ref.startsWith("pay_"));
      const keyId = this.config.get<string>("razorpayKeyId");
      const keySecret = this.config.get<string>("razorpayKeySecret");
      if (!paymentId) record.gateway = { status: "MANUAL_REQUIRED", amountMinor: gatewayMinor, note: "no gateway payment id recorded" };
      else if (!keyId || !keySecret) record.gateway = { status: "MANUAL_REQUIRED", amountMinor: gatewayMinor, paymentId, note: "gateway not configured" };
      else
        try {
          const refund: any = await new Razorpay({ key_id: keyId, key_secret: keySecret }).payments.refund(paymentId, {
            amount: gatewayMinor,
            notes: { bookingNumber: booking.bookingNumber, reason: reasonCode },
          });
          // The gateway's own word, e.g. "pending" / "processed". Not ours to promote to "refunded".
          record.gateway = { status: refund?.status ? String(refund.status).toUpperCase() : "INITIATED", amountMinor: gatewayMinor, paymentId, refundId: refund?.id };
        } catch (error) {
          this.logger.error(`Gateway refund failed for ${booking.bookingNumber}: ${(error as Error).message}`);
          record.gateway = { status: "FAILED", amountMinor: gatewayMinor, paymentId };
        }
    }

    await this.bookings.updateOne({ _id: booking._id }, { $set: { refund: record } });
  }

  // ------------------------------------------------------------ internals
  /** Captures exactly the wallet share held when the order was opened. A failure stops the confirmation. */
  private async captureWalletShare(booking: any): Promise<void> {
    const walletMinor = Number(booking.paymentOrder?.walletMinor ?? 0);
    if (walletMinor <= 0) return;
    await this.wallet.spend({
      userId: String(booking.customerUserId),
      module: MODULE,
      sourceId: booking._id,
      amount: walletMinor / 100,
      reference: booking.bookingNumber,
      description: `Wallet share for puja ${booking.bookingNumber}`,
    } as any);
  }

  private async reverseWalletSpend(booking: any, rupees: number): Promise<void> {
    try {
      await this.wallet.credit({
        userId: String(booking.customerUserId),
        amount: rupees,
        module: MODULE,
        category: "refund",
        reference: booking.bookingNumber,
        description: `Reversal: booking ${booking.bookingNumber} could not be confirmed`,
        idempotencyKey: `refund-wallet-confirmfail-${booking._id}`,
      } as any);
    } catch (error) {
      this.logger.error(`Could not reverse wallet spend for ${booking.bookingNumber}: ${(error as Error).message}`);
    }
  }

  private verifyRazorpaySignature(orderId: string, paymentId: string, signature: string, secret: string): boolean {
    const expected = Buffer.from(createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex"));
    const actual = Buffer.from(String(signature ?? ""));
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }
}
