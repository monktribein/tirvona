import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Razorpay from "razorpay";
import { InjectModel } from "../../../database/orm-nest";
import type { Model } from "../../../database/orm";
import { randomBytes } from "crypto";
import { BankAccountCrypto } from "../../payouts/infrastructure/bank-account.crypto";
import { RazorpayXPayoutProvider } from "../../payouts/providers/razorpayx-payout.provider";
import { mapProviderStatus } from "../../payouts/domain/payout.types";
import { gstOnCommissionPaise } from "../domain/food-wallet";
import {
  bankFingerprint,
  decodeAccountNumber,
  hasBankDetails,
} from "./food-bank";

/** A paid order can be refunded. "REFUND_FAILED" is the legacy paymentStatus of an order whose refund failed; it is still a paid order. */
const REFUNDABLE_PAYMENT_STATUSES = ["PAID", "REFUND_FAILED"];
const MAX_REFUND_TRIES = 3;
const REFUND_RETRY_WAIT_MS = 15 * 60_000;
const INTERRUPTED_REFUND_MS = 10 * 60_000;

@Injectable()
export class FoodFinanceService {
  private readonly logger = new Logger(FoodFinanceService.name);

  constructor(
    @InjectModel("FoodLedgerEntry")
    private readonly ledgerModel: Model<any>,
    @InjectModel("FoodRefund") private readonly refundModel: Model<any>,
    @InjectModel("FoodSettlement")
    private readonly settlementModel: Model<any>,
    @InjectModel("FoodOrder") private readonly orderModel: Model<any>,
    @InjectModel("FoodOutlet") private readonly outletModel: Model<any>,
    @InjectModel("FoodVendor") private readonly vendorModel: Model<any>,
    private readonly crypto: BankAccountCrypto,
    private readonly payoutProvider: RazorpayXPayoutProvider,
    @Optional()
    @InjectModel("FoodPaymentAttempt")
    private readonly paymentAttemptModel?: Model<any>,
    @Optional() private readonly config?: ConfigService,
  ) {}

  /** Razorpay client for customer refunds, or null when no live keys are configured. */
  private refundGateway(): Razorpay | null {
    const keyId = this.config?.get<string>("razorpayKeyId");
    const keySecret = this.config?.get<string>("razorpayKeySecret");
    return keyId && keySecret
      ? new Razorpay({ key_id: keyId, key_secret: keySecret })
      : null;
  }

  private async recordRefundFailure(
    order: any,
    reason: string,
    initiatedBy: string,
    failureReason: string,
    paymentAttemptId?: unknown,
  ) {
    const failedRecord = await this.refundModel.create({
      orderId: order._id,
      paymentAttemptId: paymentAttemptId ?? undefined,
      amountPaise: order.totalPaise,
      reason,
      gatewayRefundId: null,
      status: "failed",
      failureReason,
      initiatedBy,
      resolvedAt: null,
    });

    // The payment itself is still PAID (we hold the money); only the order's refund state changes.
    // "REFUND_FAILED" is not a payment status, so paymentStatus is left alone.
    await this.orderModel.findByIdAndUpdate(order._id, { orderStatus: "REFUND_FAILED" });

    this.logger.error(
      `Refund gateway failure recorded for Order #${order.orderNumber}: flagged for finance escalation`,
    );
    return failedRecord;
  }

  /**
   * Posts immutable double-entry ledger records upon successful order payment.
   */
  async recordOrderPayment(order: any, referenceId: string) {
    const outlet = await this.outletModel.findById(order.outletId);
    const commissionBps = outlet?.commissionRateBps || 1250; // default 12.5%
    const commissionAmountPaise = Math.round(
      (order.subtotalPaise * commissionBps) / 10000,
    );
    const vendorFoodEntitlementPaise =
      order.subtotalPaise - commissionAmountPaise;

    const baseEntryId = `LEDG-${order.orderNumber}-${randomBytes(3).toString("hex").toUpperCase()}`;

    // 1. Customer Receivable Debit (Customer pays full total)
    await this.ledgerModel.create({
      entryId: `${baseEntryId}-DR-CUST`,
      orderId: order._id,
      entryType: "order_payment",
      account: "customer_receivable",
      debitPaise: order.totalPaise,
      creditPaise: 0,
      description: `Customer payment received for Order #${order.orderNumber}`,
      referenceId,
    });

    // 2. Vendor Payable Credit (Vendor's net food earning)
    await this.ledgerModel.create({
      entryId: `${baseEntryId}-CR-VEND`,
      orderId: order._id,
      entryType: "vendor_credit",
      account: "vendor_payable",
      debitPaise: 0,
      creditPaise: vendorFoodEntitlementPaise,
      description: `Food value payable to ${outlet?.brandName || "Outlet"} (Gross ₹${order.subtotalPaise / 100} minus ${commissionBps / 100}% comm)`,
      referenceId,
    });

    // 3. Platform Revenue Credit (Commission + Packaging + Delivery Fee + Tax)
    const platformRevenuePaise =
      commissionAmountPaise +
      order.packagingFeePaise +
      order.deliveryFeePaise +
      order.taxPaise;

    await this.ledgerModel.create({
      entryId: `${baseEntryId}-CR-PLAT`,
      orderId: order._id,
      entryType: "platform_commission",
      account: "platform_revenue",
      debitPaise: 0,
      creditPaise: platformRevenuePaise,
      description: `Platform fee, packaging, delivery and tax retained for Order #${order.orderNumber}`,
      referenceId,
    });

    this.logger.log(
      `Ledger posted for Order #${order.orderNumber}: Total ₹${order.totalPaise / 100}, Vendor ₹${vendorFoodEntitlementPaise / 100}, Platform ₹${platformRevenuePaise / 100}`,
    );
  }

  /**
   * Initiates and records an auditable customer refund for cancelled/rejected orders.
   */
  async initiateRefund(
    order: any,
    reason: string,
    initiatedBy: string = "system",
    simulateGatewayFailure: boolean = false,
  ) {
    if (!order || !REFUNDABLE_PAYMENT_STATUSES.includes(order.paymentStatus)) {
      this.logger.warn(
        `Refund skipped for Order #${order?.orderNumber}: order was not paid`,
      );
      return null;
    }

    // A refund that is pending or done is final for this order. A failed one is history: the retry creates a new record.
    const existingRefund = await this.refundModel.findOne({
      orderId: order._id,
      status: { $ne: "failed" },
    });
    if (existingRefund) {
      return existingRefund;
    }

    // Claim the order before touching the gateway. Two cancellations arriving
    // together (customer + vendor, or a retry) both pass the check above; only
    // the one whose conditional update succeeds may call Razorpay, so a payment
    // is never refunded twice. The claim is replaced by REFUNDED or
    // REFUND_FAILED below.
    const claimed = await this.orderModel.findOneAndUpdate(
      { _id: order._id, paymentStatus: { $in: REFUNDABLE_PAYMENT_STATUSES }, orderStatus: { $ne: "REFUND_PROCESSING" } },
      { $set: { orderStatus: "REFUND_PROCESSING" } },
      { new: true },
    );
    if (!claimed) {
      this.logger.warn(`Refund for Order #${order.orderNumber} is already being processed`);
      return this.refundModel.findOne({ orderId: order._id, status: { $ne: "failed" } }); // null while the winner is mid-flight
    }

    if (simulateGatewayFailure) {
      return this.recordRefundFailure(order, reason, initiatedBy, "Simulated gateway failure");
    }

    // The money went in through a real gateway payment, so it has to come back
    // the same way. Only local "demo" payments (never created in production) are
    // refunded on paper alone. Without a payment-attempt model (unit tests) the
    // refund is bookkeeping only.
    let gatewayRefundId = `REF-${Date.now()}-${randomBytes(3).toString("hex").toUpperCase()}`;
    let refundStatus: "refunded" | "processing" = "refunded";
    let paymentAttemptId: unknown;
    if (this.paymentAttemptModel) {
      const attempt: any = await this.paymentAttemptModel.findOne({
        orderId: order._id,
        status: "success",
      });
      paymentAttemptId = attempt?._id;
      if (attempt?.gatewayProvider === "razorpay") {
        const gateway = this.refundGateway();
        if (!gateway || !attempt.gatewayPaymentId) {
          return this.recordRefundFailure(
            order,
            reason,
            initiatedBy,
            "Razorpay is not configured or the payment id is missing",
            paymentAttemptId,
          );
        }
        try {
          // An earlier attempt may have reached Razorpay without us recording the answer: adopt that refund
          // instead of creating a second one.
          const held: any = await Promise.resolve()
            .then(() => (gateway.payments as any).fetchMultipleRefund(attempt.gatewayPaymentId, { count: 100 }))
            .catch(() => null);
          const adopted = (held?.items ?? []).find(
            (r: any) =>
              r?.notes?.foodOrderId === String(order._id) &&
              Number(r.amount) === Number(order.totalPaise) &&
              r.status !== "failed",
          );
          const refund: any =
            adopted ??
            (await gateway.payments.refund(attempt.gatewayPaymentId, {
              amount: order.totalPaise,
              speed: "normal",
              receipt: String(order.orderNumber).slice(0, 40),
              notes: { module: "food", foodOrderId: String(order._id), reason: reason.slice(0, 200) },
            }));
          if (refund.status === "failed")
            return this.recordRefundFailure(order, reason, initiatedBy, "Razorpay reported the refund as failed", paymentAttemptId);
          gatewayRefundId = String(refund.id);
          if (refund.status === "pending") refundStatus = "processing";
        } catch (error: any) {
          const detail = error?.error?.description || error?.message || "Razorpay refund failed";
          this.logger.error(`Razorpay refund for Order #${order.orderNumber} failed: ${detail}`);
          return this.recordRefundFailure(order, reason, initiatedBy, String(detail), paymentAttemptId);
        }
      } else if (attempt?.gatewayProvider !== "demo") {
        return this.recordRefundFailure(
          order,
          reason,
          initiatedBy,
          "No captured gateway payment found for this order",
          paymentAttemptId,
        );
      }
    }

    const refundRecord = await this.refundModel.create({
      orderId: order._id,
      paymentAttemptId: paymentAttemptId ?? undefined,
      amountPaise: order.totalPaise,
      reason,
      gatewayRefundId,
      status: refundStatus,
      initiatedBy,
      resolvedAt: refundStatus === "refunded" ? new Date() : null,
    });

    // Post refund ledger entries (reversing customer debit)
    const baseEntryId = `LEDG-REF-${order.orderNumber}-${randomBytes(3).toString("hex").toUpperCase()}`;
    await this.ledgerModel.create({
      entryId: `${baseEntryId}-REF-PAY`,
      orderId: order._id,
      entryType: "refund_debit",
      account: "refund_payable",
      debitPaise: 0,
      creditPaise: order.totalPaise,
      description: `Refund credited for Order #${order.orderNumber}: ${reason}`,
      referenceId: gatewayRefundId,
      actorId: initiatedBy,
    });

    // "REFUNDED" only once the gateway has finished; until then the order says the refund is processing
    // and the payment stays PAID.
    await this.orderModel.findByIdAndUpdate(
      order._id,
      refundStatus === "refunded"
        ? { paymentStatus: "REFUNDED", orderStatus: "REFUNDED" }
        : { orderStatus: "REFUND_PROCESSING" },
    );

    this.logger.log(
      `Refund ${refundStatus} for Order #${order.orderNumber}: ₹${order.totalPaise / 100} (${reason})`,
    );

    return refundRecord;
  }

  /** The order's current refund, newest first, for display. Null when it has none. */
  async latestRefund(orderId: unknown) {
    const rows = await this.refundModel.find({ orderId }).sort({ createdAt: -1 }).limit(1).lean();
    return rows[0] ?? null;
  }

  /**
   * Asks Razorpay how refunds that were still pending ended. Returns what changed so the caller can tell the
   * customer. A refund counts as done only when the gateway says processed.
   */
  async reconcileProcessingRefunds(): Promise<Array<{ orderId: unknown; outcome: "refunded" | "failed" }>> {
    const gateway = this.refundGateway();
    if (!gateway || !this.paymentAttemptModel) return [];
    const pending: any[] = await this.refundModel.find({ status: "processing" }).limit(100).lean();
    const changes: Array<{ orderId: unknown; outcome: "refunded" | "failed" }> = [];
    for (const refund of pending) {
      const attempt: any = await this.paymentAttemptModel.findOne({ orderId: refund.orderId, status: "success" });
      if (!attempt?.gatewayPaymentId || !refund.gatewayRefundId) continue;
      try {
        const result: any = await (gateway.payments as any).fetchRefund(attempt.gatewayPaymentId, refund.gatewayRefundId);
        if (result?.status === "processed") {
          await this.refundModel.findByIdAndUpdate(refund._id, { status: "refunded", resolvedAt: new Date() });
          await this.orderModel.findByIdAndUpdate(refund.orderId, { paymentStatus: "REFUNDED", orderStatus: "REFUNDED" });
          changes.push({ orderId: refund.orderId, outcome: "refunded" });
        } else if (result?.status === "failed") {
          await this.refundModel.findByIdAndUpdate(refund._id, {
            status: "failed",
            failureReason: "Razorpay reported the refund as failed",
          });
          await this.orderModel.findByIdAndUpdate(refund.orderId, { orderStatus: "REFUND_FAILED" });
          changes.push({ orderId: refund.orderId, outcome: "failed" });
        }
      } catch (error: any) {
        this.logger.warn(`Could not check refund ${refund.gatewayRefundId}: ${error?.message ?? error}`);
      }
    }
    return changes;
  }

  /**
   * An order claimed for refund whose process died before the gateway answered would sit in REFUND_PROCESSING
   * forever. After a grace period it is flagged failed so the retry (which first looks for a refund already held
   * by the gateway) can take over. Returns how many were flagged.
   */
  async recoverInterruptedRefunds(now = new Date()): Promise<number> {
    const stuck: any[] = await this.orderModel
      .find({
        orderStatus: "REFUND_PROCESSING",
        paymentStatus: { $in: REFUNDABLE_PAYMENT_STATUSES },
        updatedAt: { $lt: new Date(now.getTime() - INTERRUPTED_REFUND_MS) },
      })
      .limit(50);
    let flagged = 0;
    for (const order of stuck) {
      const live = await this.refundModel.findOne({ orderId: order._id, status: { $ne: "failed" } });
      if (live) continue; // a refund exists; reconciliation follows it
      await this.recordRefundFailure(
        order,
        "Interrupted refund",
        "system",
        "The refund was interrupted before the gateway answered; it will be retried after checking the gateway",
      );
      flagged += 1;
    }
    return flagged;
  }

  /** Orders whose refund failed and is due another try (a few tries, spaced out; then it stays for finance). */
  async refundsDueForRetry(now = new Date()): Promise<any[]> {
    const failed: any[] = await this.orderModel
      .find({
        orderStatus: "REFUND_FAILED",
        paymentStatus: { $in: REFUNDABLE_PAYMENT_STATUSES },
        updatedAt: { $lt: new Date(now.getTime() - REFUND_RETRY_WAIT_MS) },
      })
      .limit(50);
    const due: any[] = [];
    for (const order of failed) {
      const failures = await this.refundModel.countDocuments({ orderId: order._id, status: "failed" });
      if (failures < MAX_REFUND_TRIES) due.push(order);
    }
    return due;
  }

  /**
   * Calculates settlements for an outlet over a period.
   * Enforces idempotency (no duplicate settlement job entries).
   */
  async generateSettlement(
    outletId: string,
    periodStart: Date,
    periodEnd: Date,
    options: { skipEmpty?: boolean } = {},
  ) {
    const outlet = await this.outletModel.findById(outletId);
    if (!outlet) {
      throw new NotFoundException("Outlet not found");
    }

    // An order is settled once: a new settlement starts right after the
    // previous one ends, so overlapping periods can never pay the same order twice.
    const previous = await this.settlementModel
      .find({ outletId: outlet._id })
      .sort({ periodEnd: -1 })
      .limit(1);
    const last = previous[0];
    if (last && new Date(last.periodEnd) >= periodStart) {
      if (new Date(last.periodEnd) >= periodEnd) return options.skipEmpty ? null : last;
      periodStart = new Date(new Date(last.periodEnd).getTime() + 1);
    }

    // Aggregate completed orders
    const orders = await this.orderModel.find({
      outletId: outlet._id,
      orderStatus: "COMPLETED",
      paymentStatus: "PAID",
      completedAt: { $gte: periodStart, $lte: periodEnd },
    });

    if (options.skipEmpty && orders.length === 0) return null;

    let grossFoodValuePaise = 0;
    for (const ord of orders) {
      grossFoodValuePaise += ord.subtotalPaise;
    }

    const commissionBps = outlet.commissionRateBps || 1250;
    const commissionAmountPaise = Math.round(
      (grossFoodValuePaise * commissionBps) / 10000,
    );
    const taxOnCommissionPaise = gstOnCommissionPaise(commissionAmountPaise); // 18% GST on commission
    const deliveryRetainedPaise = 0;
    const adjustmentsPaise = 0;
    const netPayablePaise =
      grossFoodValuePaise -
      commissionAmountPaise -
      taxOnCommissionPaise +
      adjustmentsPaise;

    return this.settlementModel.create({
      outletId: outlet._id,
      vendorId: outlet.vendorId,
      periodStart,
      periodEnd,
      grossFoodValuePaise,
      commissionRateBps: commissionBps,
      commissionAmountPaise,
      taxOnCommissionPaise,
      deliveryRetainedPaise,
      adjustmentsPaise,
      netPayablePaise: Math.max(0, netPayablePaise),
      orderCount: orders.length,
      status: "pending_approval",
    });
  }

  /** Settles every outlet that has completed, paid orders in the period. */
  async generateSettlements(periodStart: Date, periodEnd: Date, outletId?: string) {
    if (!(periodStart < periodEnd))
      throw new BadRequestException("The period start must be before its end");
    const outlets = outletId
      ? [await this.outletModel.findById(outletId)].filter(Boolean)
      : await this.outletModel.find({});
    const created: any[] = [];
    for (const outlet of outlets) {
      const settlement = await this.generateSettlement(
        String(outlet._id),
        periodStart,
        periodEnd,
        { skipEmpty: true },
      );
      if (settlement) created.push(settlement);
    }
    return { created: created.length, settlements: created };
  }

  /**
   * Finance settlement review and approval.
   */
  async approveSettlement(settlementId: string, adminUserId: string) {
    const settlement = await this.settlementModel.findById(settlementId);
    if (!settlement) {
      throw new NotFoundException("Settlement not found");
    }

    if (settlement.status !== "pending_approval" && settlement.status !== "draft") {
      throw new BadRequestException(
        `Settlement is already ${settlement.status}`,
      );
    }

    settlement.status = "approved";
    settlement.approvedBy = adminUserId;
    settlement.approvedAt = new Date();
    await settlement.save();

    return settlement;
  }

  /**
   * Mark payout completed by Finance.
   */
  async markPayoutPaid(settlementId: string, payoutReference: string) {
    const settlement = await this.settlementModel.findById(settlementId);
    if (!settlement) {
      throw new NotFoundException("Settlement not found");
    }

    if (settlement.status !== "approved") {
      throw new BadRequestException(
        "Settlement must be approved by Finance before payout",
      );
    }

    if (this.isTransferInFlight(settlement)) {
      throw new BadRequestException(
        "An automatic bank transfer is already in progress for this settlement. Sync its status instead.",
      );
    }

    settlement.status = "paid";
    settlement.payoutReference = payoutReference;
    settlement.paidAt = new Date();
    await settlement.save();

    return settlement;
  }

  // ---- Automatic payout to the restaurant bank account (RazorpayX) ----

  /** "pout_x" means a transfer was started and is not known to have failed. */
  private isTransferInFlight(settlement: any): boolean {
    const ref = String(settlement.payoutReference ?? "");
    return ref.startsWith("pout_") && !ref.includes("UTR:");
  }

  private payoutId(settlement: any): string | null {
    const match = String(settlement.payoutReference ?? "").match(/pout_\w+/);
    return match ? match[0] : null;
  }

  /** Saved provider ids live in settlementProfileId as "rzpx:<contact>:<fundAccount>:<fingerprint>". */
  private async ensureFundAccount(vendor: any): Promise<string> {
    const account = decodeAccountNumber(this.crypto, vendor.bankAccountNumber);
    const fingerprint = bankFingerprint(
      account,
      vendor.bankIfscCode,
      vendor.bankAccountHolderName,
    );
    const [tag, contactId, fundAccountId, savedFingerprint] = String(
      vendor.settlementProfileId ?? "",
    ).split(":");
    if (tag === "rzpx" && fundAccountId && savedFingerprint === fingerprint)
      return fundAccountId;

    const beneficiary = {
      name: vendor.bankAccountHolderName,
      email: vendor.contactEmail,
      phone: vendor.contactPhone,
      accountNumber: account,
      ifsc: vendor.bankIfscCode,
      referenceId: `food-${vendor._id}`,
    };
    const contact =
      tag === "rzpx" && contactId
        ? contactId
        : await this.payoutProvider.createContact(beneficiary);
    const fundAccount = await this.payoutProvider.createFundAccount(
      contact,
      beneficiary,
    );
    vendor.settlementProfileId = `rzpx:${contact}:${fundAccount}:${fingerprint}`;
    await vendor.save();
    return fundAccount;
  }

  /** Sends the approved settlement amount from Tirvona to the restaurant bank account. */
  async payViaProvider(settlementId: string, adminUserId: string) {
    const settlement = await this.settlementModel.findById(settlementId);
    if (!settlement) throw new NotFoundException("Settlement not found");
    if (settlement.status !== "approved")
      throw new BadRequestException(
        "Settlement must be approved by Finance before payout",
      );
    if (this.isTransferInFlight(settlement))
      throw new BadRequestException(
        "A transfer is already in progress for this settlement. Sync its status instead.",
      );
    if (!this.payoutProvider.isConfigured())
      throw new BadRequestException(
        "Automatic payouts (RazorpayX) are not switched on. Record a manual bank transfer with its UTR instead.",
      );
    if (settlement.netPayablePaise < 100)
      throw new BadRequestException("Nothing to pay: the net payable is below ₹1");

    const vendor = await this.vendorModel.findById(settlement.vendorId);
    if (!vendor) throw new NotFoundException("Restaurant not found");
    if (vendor.status !== "active")
      throw new BadRequestException("Only approved restaurants can be paid");
    if (!hasBankDetails(vendor))
      throw new BadRequestException(
        "This restaurant has not added its bank account details yet",
      );

    const previousFailure = String(settlement.payoutReference ?? "").startsWith("failed:")
      ? `-${String(settlement.payoutReference).slice(-8)}`
      : "";
    try {
      const fundAccountId = await this.ensureFundAccount(vendor);
      const result = await this.payoutProvider.createPayout({
        fundAccountId,
        amountPaise: settlement.netPayablePaise,
        mode: "IMPS",
        referenceId: `FS-${String(settlement._id).slice(-12)}`,
        // Stable per settlement, so a retried request can never pay twice.
        idempotencyKey: `food-settlement-${settlement._id}${previousFailure}`,
      });
      settlement.payoutReference = result.id;
      await settlement.save();
      this.logger.log(
        `Settlement ${settlement._id} payout ${result.id} started by ${adminUserId} (${result.status})`,
      );
      return this.applyProviderResult(settlement, result);
    } catch (err: any) {
      this.logger.error(`Settlement ${settlement._id} payout failed: ${err?.message}`);
      throw new BadRequestException(
        `Bank transfer could not be started: ${err?.message ?? "provider error"}`,
      );
    }
  }

  private async applyProviderResult(
    settlement: any,
    result: { id: string; status: string; utr?: string; failureReason?: string },
  ) {
    const mapped = mapProviderStatus(result.status);
    if (mapped === "paid") {
      settlement.status = "paid";
      settlement.paidAt = new Date();
      settlement.payoutReference = `${result.id} | UTR:${result.utr ?? "pending"}`;
    } else if (mapped === "failed") {
      settlement.payoutReference = `failed:${result.id}`;
      this.logger.warn(
        `Settlement ${settlement._id} transfer ${result.id} failed: ${result.failureReason ?? result.status}`,
      );
    } else {
      settlement.payoutReference = result.id;
    }
    await settlement.save();
    return settlement;
  }

  /** Pulls the latest state of started transfers from RazorpayX. */
  async syncPayouts(settlementId?: string) {
    const filter: any = settlementId
      ? { _id: settlementId }
      : { status: "approved", payoutReference: { $regex: "^pout_" } };
    const settlements = await this.settlementModel.find(filter);
    let updated = 0;
    for (const settlement of settlements) {
      const id = this.payoutId(settlement);
      if (!id || settlement.status === "paid") continue;
      const result = await this.payoutProvider.fetchPayout(id);
      await this.applyProviderResult(settlement, result);
      updated += 1;
    }
    if (settlementId && updated === 0)
      throw new BadRequestException("This settlement has no bank transfer to sync");
    return { synced: updated };
  }

  async getSettlements(filter: any = {}) {
    const rows = await this.settlementModel
      .find(filter)
      .populate("outletId", "brandName address")
      .populate(
        "vendorId",
        "businessName contactName contactPhone bankAccountNumber bankIfscCode bankAccountHolderName",
      )
      .sort({ createdAt: -1 })
      .lean();
    // Only whether payout details exist leaves the server, never the account number.
    return rows.map((row: any) => {
      const vendor = row.vendorId;
      if (!vendor || typeof vendor !== "object") return row;
      const { bankAccountNumber, bankIfscCode, bankAccountHolderName, ...rest } = vendor;
      return {
        ...row,
        vendorId: {
          ...rest,
          hasBankDetails: hasBankDetails({
            bankAccountNumber,
            bankIfscCode,
            bankAccountHolderName,
          }),
        },
      };
    });
  }

  async getLedgerEntries(filter: any = {}) {
    return this.ledgerModel
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
  }
}
