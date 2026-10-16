import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "../../../database/orm-nest";
import type { Model } from "../../../database/orm";
import { randomBytes } from "crypto";
import { BankAccountCrypto } from "../../payouts/infrastructure/bank-account.crypto";
import { RazorpayXPayoutProvider } from "../../payouts/providers/razorpayx-payout.provider";
import { mapProviderStatus } from "../../payouts/domain/payout.types";
import {
  bankFingerprint,
  decodeAccountNumber,
  hasBankDetails,
} from "./food-bank";

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
  ) {}

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
    if (!order || order.paymentStatus !== "PAID") {
      this.logger.warn(
        `Refund skipped for Order #${order?.orderNumber}: order was not paid`,
      );
      return null;
    }

    const existingRefund = await this.refundModel.findOne({
      orderId: order._id,
    });
    if (existingRefund) {
      return existingRefund;
    }

    const gatewayRefundId = `REF-${Date.now()}-${randomBytes(3).toString("hex").toUpperCase()}`;

    if (simulateGatewayFailure) {
      const failedRecord = await this.refundModel.create({
        orderId: order._id,
        amountPaise: order.totalPaise,
        reason,
        gatewayRefundId: null,
        status: "failed",
        initiatedBy,
        resolvedAt: null,
      });

      await this.orderModel.findByIdAndUpdate(order._id, {
        paymentStatus: "REFUND_FAILED",
        orderStatus: "REFUND_FAILED",
      });

      this.logger.error(
        `Refund gateway failure recorded for Order #${order.orderNumber}: flagged for finance escalation`,
      );
      return failedRecord;
    }

    const refundRecord = await this.refundModel.create({
      orderId: order._id,
      amountPaise: order.totalPaise,
      reason,
      gatewayRefundId,
      status: "refunded",
      initiatedBy,
      resolvedAt: new Date(),
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

    // Update order payment status
    await this.orderModel.findByIdAndUpdate(order._id, {
      paymentStatus: "REFUNDED",
      orderStatus: "REFUNDED",
    });

    this.logger.log(
      `Refund completed for Order #${order.orderNumber}: ₹${order.totalPaise / 100} (${reason})`,
    );

    return refundRecord;
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
    const taxOnCommissionPaise = Math.round(commissionAmountPaise * 0.18); // 18% GST on commission
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
