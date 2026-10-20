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
const duplicateOf = (error: unknown) => (error as any)?.response?.code === "REQUEST_ALREADY_CONFIRMED";
const codeOf = (error: unknown) => (error as any)?.response?.code as string | undefined;

/** A booking in one of these states can still take an advance payment; in any other it cannot. */
const PAYABLE = ["PAYMENT_PENDING", "ACCEPTED_AWAITING_ADVANCE"];
/** Marks "this payment was handled as a late/unapplied payment"; makes handling exactly-once across callbacks and webhooks. */
const lateToken = (paymentId: string) => `late:${paymentId}`;
const alreadySeen = (booking: any, paymentId: string) =>
  ((booking.paymentRefs ?? []) as string[]).some((ref) => ref === paymentId || ref === lateToken(paymentId));
/** We retry a refund we failed to issue this many times, then leave it for finance. */
const MAX_REFUND_ATTEMPTS = 3;
/** A refund request that never got an answer (e.g. the process died) is looked at again after this long. */
const REQUESTED_STALE_MS = 10 * 60_000;
const REFUND_LOOKBACK_MS = 30 * 24 * 3_600_000;
const gatewayStatus = (status: unknown) => (status ? String(status).toUpperCase() : "PENDING");

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
      .select("customerUserId status holdExpiresAt serviceSnapshot bookingNumber paymentRefs advanceRequiredMinor advancePaymentDeadlineAt requestGroupId")
      .lean();

    if (!booking || !sameId(booking.customerUserId, user.id))
      throw providerError.notFound("BOOKING_NOT_FOUND", "Booking not found");
    if (!["PAYMENT_PENDING", "ACCEPTED_AWAITING_ADVANCE"].includes(booking.status))
      throw providerError.conflict(
        "BOOKING_NOT_PAYABLE",
        `Booking is in state ${booking.status} and cannot accept payment`,
      );
    if (booking.requestGroupId && (await this.bookings.exists({ requestGroupId: booking.requestGroupId, _id: { $ne: booking._id }, status: "CONFIRMED" })))
      throw providerError.conflict(
        "REQUEST_ALREADY_CONFIRMED",
        "This request has already been confirmed with another Pandit",
      );
    if (booking.advancePaymentDeadlineAt && new Date(booking.advancePaymentDeadlineAt) < new Date()) {
      await this.bookingService.expireHold(String(booking._id));
      throw providerError.gone(
        "BOOKING_PAYMENT_DEADLINE_EXPIRED",
        "The 1-hour advance payment deadline for this booking has expired.",
      );
    }
    if (booking.holdExpiresAt && new Date(booking.holdExpiresAt) < new Date())
      throw providerError.gone(
        "BOOKING_HOLD_EXPIRED",
        "The calendar hold for this booking has expired. Please book again.",
      );

    const totalMinor = Number(
      booking.advanceRequiredMinor ?? (booking.serviceSnapshot?.pricing?.totalMinor || 0),
    );
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
      { _id: booking._id, status: { $in: ["PAYMENT_PENDING", "ACCEPTED_AWAITING_ADVANCE"] } },
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
      .select("customerUserId status serviceSnapshot bookingNumber paymentOrder paymentRefs refund")
      .lean();
    if (!booking || !sameId(booking.customerUserId, user.id))
      throw providerError.notFound("BOOKING_NOT_FOUND", "Booking not found");

    // The same payment delivered again (by the browser and by the webhook) is not news.
    if (!PAYABLE.includes(booking.status) && alreadySeen(booking, dto.razorpay_payment_id)) {
      // ...but a payment that was set aside must not be reported as applied.
      if (((booking.paymentRefs ?? []) as string[]).includes(lateToken(dto.razorpay_payment_id)))
        throw providerError.conflict(
          "PAYMENT_NOT_APPLIED",
          this.unappliedMessage(booking.status, booking.refund?.late?.[dto.razorpay_payment_id]),
        );
      return { alreadyConfirmed: true, bookingId: booking._id, status: booking.status };
    }

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

    // A genuine payment for a booking that can no longer use it: never confirm, hand the money back.
    if (!PAYABLE.includes(booking.status)) {
      const outcome = await this.handleUnappliedPayment(booking, dto.razorpay_payment_id, {
        gatewayMinor: Number(booking.paymentOrder.gatewayMinor ?? 0),
        walletMinor: 0, // the wallet share was only ever held, not spent
        source: "callback",
      });
      throw providerError.conflict("PAYMENT_NOT_APPLIED", this.unappliedMessage(booking.status, outcome.record));
    }

    await this.captureWalletShare(booking);
    await this.bookings.updateOne(
      { _id: booking._id },
      { $addToSet: { paymentRefs: dto.razorpay_payment_id } },
    );
    const updated = await this.confirmOrRefundDuplicate(booking, dto.razorpay_payment_id);
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
    const payable = PAYABLE.includes(booking.status);
    if (!payable && alreadySeen(booking, paymentId)) return true; // duplicate event for a payment we already dealt with
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

    if (!payable) {
      await this.handleUnappliedPayment(booking, paymentId, { gatewayMinor: expected, walletMinor: 0, source: "webhook" });
      return true;
    }

    await this.captureWalletShare(booking);
    await this.bookings.updateOne({ _id: booking._id }, { $addToSet: { paymentRefs: paymentId } });
    try {
      await this.confirmOrRefundDuplicate(booking, paymentId);
      this.logger.log(`Provider booking ${booking.bookingNumber} confirmed via webhook`);
    } catch (error) {
      if (duplicateOf(error)) return true; // refunded and recorded; a retry of this event changes nothing
      throw error;
    }
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

    // A booking that already holds records of unapplied payments keeps them.
    if (booking.refund?.late) record.late = booking.refund.late;
    await this.bookings.updateOne({ _id: booking._id }, { $set: { refund: record } });
  }

  // ------------------------------------------------------------ internals
  /**
   * Confirms the booking. If another Pandit of the same request was confirmed
   * first, this payment bought nothing: it is refunded (and recorded on the
   * booking) rather than kept, then the conflict is reported.
   */
  private async confirmOrRefundDuplicate(booking: any, paymentId: string) {
    for (let attempt = 1; ; attempt += 1) {
      try {
        return await this.bookingService.confirmPayment(String(booking._id), paymentId);
      } catch (error) {
        const code = codeOf(error);
        // Another change landed between our read and the confirmation: look again once.
        if (code === "BOOKING_STATE_CONFLICT" && attempt === 1) continue;
        if (duplicateOf(error) || code === "BOOKING_INVALID_TRANSITION" || code === "BOOKING_STATE_CONFLICT") {
          // The booking was cancelled/expired/confirmed elsewhere while this payment was being applied.
          // If a concurrent delivery of this same payment confirmed it a moment ago, there is nothing to undo.
          const now: any = await this.bookings.findById(booking._id).select("status paymentRefs").lean();
          if (!duplicateOf(error) && now?.status === "CONFIRMED" && ((now.paymentRefs ?? []) as string[]).includes(paymentId))
            return now;
          // The wallet share was captured before confirming, so it goes back too.
          const outcome = await this.handleUnappliedPayment(booking, paymentId, {
            gatewayMinor: Number(booking.paymentOrder?.gatewayMinor ?? 0),
            walletMinor: Number(booking.paymentOrder?.walletMinor ?? 0),
            source: "confirmation",
          });
          if (duplicateOf(error)) throw error;
          throw providerError.conflict("PAYMENT_NOT_APPLIED", this.unappliedMessage(now?.status ?? booking.status, outcome.record));
        }
        throw error;
      }
    }
  }

  // ------------------------------------------------------------ late / unapplied payments
  /**
   * Money reached us for a booking that cannot use it (cancelled, expired, already
   * confirmed with someone else...). It never confirms anything. Existing policy
   * applies: money for a service that is not delivered goes back in full to where
   * it came from; no fee is taken. Exactly-once per payment id: the first caller
   * claims it, a duplicate callback/webhook finds the claim and does nothing.
   * Nothing is reported as refunded until the gateway says so (see reconcileRefunds).
   */
  async handleUnappliedPayment(
    booking: any,
    paymentId: string,
    amounts: { gatewayMinor: number; walletMinor: number; source: "callback" | "webhook" | "confirmation" },
  ): Promise<{ duplicate: boolean; record: any }> {
    const claimed: any = await this.bookings.findOneAndUpdate(
      { _id: booking._id, paymentRefs: { $ne: lateToken(paymentId) } },
      { $addToSet: { paymentRefs: lateToken(paymentId) } },
      { new: true },
    );
    if (!claimed) {
      const current: any = await this.bookings.findById(booking._id).select("refund").lean();
      return { duplicate: true, record: current?.refund?.late?.[paymentId] ?? null };
    }

    const record: any = {
      paymentId,
      source: amounts.source,
      bookingStatus: booking.status,
      requestedAt: new Date(),
      wallet: null,
      gateway: null,
    };
    await this.saveLateRecord(booking._id, paymentId, record); // visible to operations from the first moment

    if (amounts.walletMinor > 0) {
      try {
        const credited = await this.wallet.credit({
          userId: String(booking.customerUserId),
          amount: amounts.walletMinor / 100,
          module: MODULE,
          category: "refund",
          reference: booking.bookingNumber,
          description: `Refund of unapplied payment for puja ${booking.bookingNumber}`,
          idempotencyKey: `refund-wallet-late-${booking._id}-${paymentId}`,
        } as any);
        record.wallet = { status: credited ? "CREDITED" : "FAILED", amountMinor: amounts.walletMinor };
      } catch (error) {
        this.logger.error(`Wallet refund of unapplied payment failed for ${booking.bookingNumber}: ${(error as Error).message}`);
        record.wallet = { status: "FAILED", amountMinor: amounts.walletMinor };
      }
    }
    record.gateway =
      amounts.gatewayMinor > 0
        ? await this.issueGatewayRefund(
            booking.bookingNumber,
            { paymentId, amountMinor: amounts.gatewayMinor, status: "REQUESTED", attempts: 0 },
            "UNAPPLIED_PAYMENT",
          )
        : { status: "MANUAL_REQUIRED", paymentId, amountMinor: 0, note: "no gateway amount recorded for this order" };
    await this.saveLateRecord(booking._id, paymentId, record);
    this.logger.warn(
      `Provider booking ${booking.bookingNumber} (${booking.status}) received payment ${paymentId} it cannot use; refund ${record.gateway.status}`,
    );
    return { duplicate: false, record };
  }

  private unappliedMessage(status: string, record: any): string {
    const gateway = record?.gateway;
    const refund = !gateway
      ? "A refund is being arranged."
      : gateway.status === "PROCESSED"
        ? "The refund has been processed by the payment gateway."
        : gateway.status === "MANUAL_REQUIRED" || gateway.status === "GATEWAY_FAILED"
          ? "Our team has been alerted and will return your money."
          : gateway.status === "FAILED"
            ? "The refund could not be issued yet and will be retried automatically."
            : "A refund has been requested and is being processed by the payment gateway.";
    return `This booking is no longer open for payment (${String(status).toLowerCase().replace(/_/g, " ")}), so your payment was not applied. ${refund}`;
  }

  /** Saves one unapplied-payment record without disturbing the booking's cancellation refund. */
  private async saveLateRecord(bookingId: unknown, paymentId: string, record: any) {
    await this.bookings.updateOne({ _id: bookingId, refund: null }, { $set: { refund: { late: {} } } });
    await this.bookings.updateOne({ _id: bookingId }, { $set: { [`refund.late.${paymentId}`]: record } });
  }

  private razorpayClient(): Razorpay | null {
    const keyId = this.config.get<string>("razorpayKeyId");
    const keySecret = this.config.get<string>("razorpayKeySecret");
    return keyId && keySecret ? new Razorpay({ key_id: keyId, key_secret: keySecret }) : null;
  }

  /**
   * Asks the gateway to refund one payment and returns the record to store. Safe to call again for the
   * same record: before issuing, it looks for a refund the gateway already holds for this booking and
   * amount (an earlier attempt that succeeded but was never recorded) and adopts it instead of doubling up.
   */
  private async issueGatewayRefund(bookingNumber: string, rec: any, reasonCode: string): Promise<any> {
    const gateway = this.razorpayClient();
    if (!gateway) return { ...rec, status: "MANUAL_REQUIRED", note: "gateway not configured", updatedAt: new Date() };
    const attempts = Number(rec.attempts ?? 0) + 1;
    try {
      const existing: any = await Promise.resolve()
        .then(() => (gateway.payments as any).fetchMultipleRefund(rec.paymentId, { count: 100 }))
        .catch(() => null);
      const adopted = (existing?.items ?? []).find(
        (refund: any) =>
          refund?.notes?.bookingNumber === bookingNumber &&
          Number(refund.amount) === Number(rec.amountMinor) &&
          refund.status !== "failed",
      );
      const refund: any =
        adopted ??
        (await gateway.payments.refund(rec.paymentId, {
          amount: rec.amountMinor,
          speed: "normal",
          notes: { bookingNumber, reason: reasonCode },
        }));
      const { lastError: _drop, ...rest } = rec;
      // The gateway's own word, e.g. PENDING / PROCESSED. Not ours to promote to "refunded".
      return { ...rest, attempts, refundId: refund?.id, status: gatewayStatus(refund?.status), updatedAt: new Date() };
    } catch (error) {
      const detail = (error as any)?.error?.description ?? (error as Error)?.message ?? "refund request failed";
      this.logger.error(`Gateway refund failed for ${bookingNumber}: ${detail}`);
      return {
        ...rec,
        attempts,
        status: attempts >= MAX_REFUND_ATTEMPTS ? "MANUAL_REQUIRED" : "FAILED",
        lastError: String(detail).slice(0, 300),
        updatedAt: new Date(),
      };
    }
  }

  /**
   * Moves gateway refunds forward: asks the gateway how a pending refund ended up (PROCESSED or not),
   * retries a refund we failed to issue (a few times), and looks again at a request that never got an
   * answer. Covers cancellation refunds and unapplied-payment refunds. Idempotent; run on a schedule.
   */
  async reconcileRefunds(now = new Date()): Promise<{ checked: number; changed: number }> {
    const rows: any[] = await this.bookings
      .find({ refund: { $ne: null }, updatedAt: { $gte: new Date(now.getTime() - REFUND_LOOKBACK_MS) } })
      .select("bookingNumber refund")
      .limit(200)
      .lean();
    let checked = 0;
    let changed = 0;
    for (const row of rows) {
      const targets: Array<{ path: string; rec: any }> = [];
      if (row.refund?.gateway) targets.push({ path: "refund.gateway", rec: row.refund.gateway });
      for (const [id, late] of Object.entries<any>(row.refund?.late ?? {}))
        if (late?.gateway) targets.push({ path: `refund.late.${id}.gateway`, rec: late.gateway });
      for (const { path, rec } of targets) {
        const next = await this.advanceRefund(row.bookingNumber, rec, now);
        if (!next) continue;
        checked += 1;
        if (next.status !== rec.status || next.refundId !== rec.refundId) changed += 1;
        await this.bookings.updateOne({ _id: row._id }, { $set: { [path]: next } });
      }
    }
    return { checked, changed };
  }

  private async advanceRefund(bookingNumber: string, rec: any, now: Date): Promise<any | null> {
    if (!rec?.paymentId || !(Number(rec.amountMinor) > 0)) return null;
    const status = String(rec.status ?? "");
    const age = now.getTime() - new Date(rec.updatedAt ?? rec.requestedAt ?? 0).getTime();
    if (["PENDING", "INITIATED", "PROCESSING"].includes(status) && rec.refundId) {
      const gateway = this.razorpayClient();
      if (!gateway) return null;
      try {
        const refund: any = await (gateway.payments as any).fetchRefund(rec.paymentId, rec.refundId);
        const outcome = gatewayStatus(refund?.status);
        // A refund the gateway itself reports as failed is not retried blindly: finance looks at it.
        return { ...rec, status: outcome === "FAILED" ? "GATEWAY_FAILED" : outcome, updatedAt: new Date() };
      } catch (error) {
        this.logger.warn(`Could not check refund ${rec.refundId} for ${bookingNumber}: ${(error as Error).message}`);
        return null;
      }
    }
    const retryable =
      (status === "FAILED" && Number(rec.attempts ?? 1) < MAX_REFUND_ATTEMPTS) ||
      (status === "REQUESTED" && age > REQUESTED_STALE_MS) ||
      ((status === "PENDING" || status === "INITIATED") && !rec.refundId && age > REQUESTED_STALE_MS);
    return retryable ? this.issueGatewayRefund(bookingNumber, rec, "RETRY") : null;
  }

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
