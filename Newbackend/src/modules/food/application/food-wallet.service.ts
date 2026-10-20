import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { randomBytes } from "crypto";
import { InjectModel } from "../../../database/orm-nest";
import type { Model } from "../../../database/orm";
import {
  FOOD_FULFILLED_ORDER_STATUSES,
  type FoodPaymentMethod,
} from "../domain/food.constants";
import { earningOf, type FoodEarning } from "../domain/food-wallet";
import type { RecordFoodPaymentDto } from "../presentation/food-wallet.dto";
import { hasBankDetails } from "./food-bank";

/** Same default the ledger and settlements use when an outlet has no rate of its own. */
const DEFAULT_COMMISSION_BPS = 1250;
/** A little slack for a clock that runs ahead, so "paid just now" is never refused. */
const FUTURE_TOLERANCE_MS = 5 * 60_000;

export interface FoodWalletSummary {
  vendorId: string;
  businessName: string;
  hasBankDetails: boolean;
  /** Handed-over, paid orders the kitchen has earned. */
  deliveredOrders: number;
  foodValuePaise: number;
  commissionPaise: number;
  gstOnCommissionPaise: number;
  /** Food value minus commission and the GST on it: what Tirvona owes in total. */
  earnedPaise: number;
  /** Everything Tirvona has paid so far (voided payments excluded). */
  receivedPaise: number;
  /** Earned minus received. Below zero means Tirvona paid ahead; it is taken off later orders. */
  remainingPaise: number;
  lastPayment: { amountPaise: number; paidAt: Date; method: FoodPaymentMethod } | null;
}

export interface FoodWalletPayment {
  id: string;
  /** "wallet": entered by hand. "settlement": a settlement paid through the older settlement flow. */
  source: "wallet" | "settlement";
  paymentNumber: string;
  amountPaise: number;
  method: FoodPaymentMethod;
  reference: string;
  receiptUrl: string | null;
  paidAt: Date;
  note: string;
  status: "recorded" | "voided";
  voidReason: string;
  /** Who entered it. Only Super Admin and Finance get this. */
  recordedByName?: string;
}

export interface FoodWalletEarning extends FoodEarning {
  orderId: string;
  orderNumber: string;
  outletName: string;
  earnedAt: Date;
}

/** Who is acting: `name` is kept on the payments they enter. */
export interface FoodWalletActor {
  id: string;
  name?: string;
}

interface Loaded {
  outlets: any[];
  orders: any[];
  credits: any[];
  payments: any[];
  settlements: any[];
}

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

/**
 * A kitchen's wallet: what Tirvona owes it for the orders it handed over, what Tirvona has paid, and
 * what is left. Customers pay Tirvona, so Tirvona pays the kitchen itself, outside the app, and records
 * each payment here with its receipt (or as cash). Earnings are never stored: they are worked out from
 * the orders every time, so a refunded order drops out on its own.
 */
@Injectable()
export class FoodWalletService {
  private readonly logger = new Logger(FoodWalletService.name);

  constructor(
    @InjectModel("FoodVendor") private readonly vendorModel: Model<any>,
    @InjectModel("FoodOutlet") private readonly outletModel: Model<any>,
    @InjectModel("FoodOrder") private readonly orderModel: Model<any>,
    @InjectModel("FoodLedgerEntry") private readonly ledgerModel: Model<any>,
    @InjectModel("FoodSettlement") private readonly settlementModel: Model<any>,
    @InjectModel("FoodVendorPayment") private readonly paymentModel: Model<any>,
  ) {}

  // ------------------------------------------------------------ reading

  private async load(vendorIds: unknown[]): Promise<Loaded> {
    const outlets: any[] = await this.outletModel.find({ vendorId: { $in: vendorIds } }).lean();
    const outletIds = outlets.map((o) => o._id);
    const orders: any[] = outletIds.length
      ? await this.orderModel
          .find({
            outletId: { $in: outletIds },
            orderStatus: { $in: [...FOOD_FULFILLED_ORDER_STATUSES] },
            paymentStatus: "PAID",
          })
          .lean()
      : [];
    const credits: any[] = orders.length
      ? await this.ledgerModel
          .find({ orderId: { $in: orders.map((o) => o._id) }, entryType: "vendor_credit" })
          .lean()
      : [];
    const payments: any[] = await this.paymentModel.find({ vendorId: { $in: vendorIds } }).lean();
    const settlements: any[] = await this.settlementModel
      .find({ vendorId: { $in: vendorIds }, status: "paid" })
      .lean();
    return { outlets, orders, credits, payments, settlements };
  }

  private toPayment(p: any, withAdminFields: boolean): FoodWalletPayment {
    const payment: FoodWalletPayment = {
      id: String(p._id),
      source: "wallet",
      paymentNumber: p.paymentNumber,
      amountPaise: Number(p.amountPaise),
      method: p.method,
      reference: p.reference ?? "",
      receiptUrl: p.receiptUrl || null,
      paidAt: p.paidAt,
      note: p.note ?? "",
      status: p.status === "voided" ? "voided" : "recorded",
      voidReason: p.voidReason ?? "",
    };
    if (withAdminFields) payment.recordedByName = p.recordedByName ?? "";
    return payment;
  }

  /** A settlement paid through the older settlement flow is money received too. */
  private settlementAsPayment(s: any): FoodWalletPayment {
    const from = s.periodStart ? new Date(s.periodStart).toLocaleDateString("en-IN") : "";
    const to = s.periodEnd ? new Date(s.periodEnd).toLocaleDateString("en-IN") : "";
    return {
      id: String(s._id),
      source: "settlement",
      paymentNumber: "Settlement",
      amountPaise: Number(s.netPayablePaise),
      method: "bank_transfer",
      reference: s.payoutReference ?? "",
      receiptUrl: null,
      paidAt: s.paidAt ?? s.updatedAt ?? s.createdAt,
      note: from && to ? `Settlement for ${from} to ${to}` : "Settlement payout",
      status: "recorded",
      voidReason: "",
    };
  }

  private build(vendor: any, data: Loaded, withAdminFields: boolean) {
    const vendorId = String(vendor._id);
    const outletById = new Map(
      data.outlets.filter((o) => String(o.vendorId) === vendorId).map((o) => [String(o._id), o]),
    );
    const creditByOrder = new Map(
      data.credits.map((c) => [String(c.orderId), Number(c.creditPaise)]),
    );

    const earnings: FoodWalletEarning[] = data.orders
      .filter((o) => outletById.has(String(o.outletId)))
      .map((o) => {
        const outlet = outletById.get(String(o.outletId));
        return {
          orderId: String(o._id),
          orderNumber: o.orderNumber,
          outletName: outlet.brandName,
          // Pickup orders never get a delivered/completed time, so fall back to the last update.
          earnedAt: o.completedAt ?? o.deliveredAt ?? o.updatedAt ?? o.createdAt,
          ...earningOf(
            Number(o.subtotalPaise),
            creditByOrder.get(String(o._id)),
            Number(outlet.commissionRateBps) || DEFAULT_COMMISSION_BPS,
          ),
        };
      })
      .sort((a, b) => new Date(b.earnedAt).getTime() - new Date(a.earnedAt).getTime());

    const payments: FoodWalletPayment[] = [
      ...data.payments
        .filter((p) => String(p.vendorId) === vendorId)
        .map((p) => this.toPayment(p, withAdminFields)),
      ...data.settlements
        .filter((s) => String(s.vendorId) === vendorId)
        .map((s) => this.settlementAsPayment(s)),
    ].sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime());

    const counted = payments.filter((p) => p.status === "recorded");
    const earnedPaise = sum(earnings.map((e) => e.netPaise));
    const receivedPaise = sum(counted.map((p) => p.amountPaise));
    const last = counted[0];

    const summary: FoodWalletSummary = {
      vendorId,
      businessName: vendor.businessName,
      hasBankDetails: hasBankDetails(vendor),
      deliveredOrders: earnings.length,
      foodValuePaise: sum(earnings.map((e) => e.foodValuePaise)),
      commissionPaise: sum(earnings.map((e) => e.commissionPaise)),
      gstOnCommissionPaise: sum(earnings.map((e) => e.gstOnCommissionPaise)),
      earnedPaise,
      receivedPaise,
      remainingPaise: earnedPaise - receivedPaise,
      lastPayment: last ? { amountPaise: last.amountPaise, paidAt: last.paidAt, method: last.method } : null,
    };
    return { summary, payments, earnings };
  }

  private async walletOf(vendor: any, withAdminFields: boolean) {
    const data = await this.load([vendor._id]);
    const { summary, payments } = this.build(vendor, data, withAdminFields);
    return { summary, payments };
  }

  private async earningsOf(vendor: any, page = 1, limit = 20) {
    const data = await this.load([vendor._id]);
    const { earnings } = this.build(vendor, data, false);
    return {
      data: earnings.slice((page - 1) * limit, page * limit),
      total: earnings.length,
      page,
      limit,
    };
  }

  private async myVendor(userId: string) {
    const vendor = await this.vendorModel.findOne({ ownerUserId: userId });
    if (!vendor) throw new NotFoundException("You have not registered a restaurant yet");
    return vendor;
  }

  private async vendorById(vendorId: string) {
    const vendor = await this.vendorModel.findById(vendorId);
    if (!vendor) throw new NotFoundException("Restaurant not found");
    return vendor;
  }

  /** The signed-in owner's own wallet. */
  async walletForOwner(userId: string) {
    return this.walletOf(await this.myVendor(userId), false);
  }

  async earningsForOwner(userId: string, page?: number, limit?: number) {
    return this.earningsOf(await this.myVendor(userId), page, limit);
  }

  async walletForAdmin(vendorId: string) {
    return this.walletOf(await this.vendorById(vendorId), true);
  }

  async earningsForAdmin(vendorId: string, page?: number, limit?: number) {
    return this.earningsOf(await this.vendorById(vendorId), page, limit);
  }

  /** Every restaurant's balance, biggest amount owed first: who Tirvona has to pay. */
  async overview() {
    const vendors: any[] = await this.vendorModel.find({}).sort({ businessName: 1 }).limit(500).lean();
    const data = await this.load(vendors.map((v) => v._id));
    const rows = vendors
      .map((vendor) => ({ ...this.build(vendor, data, false).summary, status: vendor.status as string }))
      .filter((row) => row.deliveredOrders > 0 || row.receivedPaise !== 0)
      .sort((a, b) => b.remainingPaise - a.remainingPaise);
    return {
      rows,
      totals: {
        restaurants: rows.length,
        owedPaise: sum(rows.map((r) => Math.max(0, r.remainingPaise))),
        advancePaise: sum(rows.map((r) => Math.max(0, -r.remainingPaise))),
        receivedPaise: sum(rows.map((r) => r.receivedPaise)),
      },
    };
  }

  // ------------------------------------------------------------ writing

  private paymentNumber(paidAt: Date) {
    const day = paidAt.toISOString().slice(0, 10).replace(/-/g, "");
    return `FWP-${day}-${randomBytes(3).toString("hex").toUpperCase()}`;
  }

  /**
   * Records money Tirvona paid a kitchen. Bank transfer and UPI need the receipt image; cash has none.
   * A payment above what is currently owed is accepted: the money really was paid, so the record must
   * say so, and the surplus shows as an advance that later orders use up.
   */
  async recordPayment(actor: FoodWalletActor, vendorId: string, dto: RecordFoodPaymentDto) {
    const vendor = await this.vendorById(vendorId);

    if (dto.idempotencyKey) {
      const earlier = await this.paymentModel.findOne({ idempotencyKey: dto.idempotencyKey });
      if (earlier) return this.repeatOf(earlier, vendor);
    }
    if (dto.method !== "cash" && !dto.receiptUrl)
      throw new BadRequestException(
        "Attach the payment receipt image, or choose Cash if there is no receipt.",
      );
    const paidAt = dto.paidAt ? new Date(dto.paidAt) : new Date();
    if (Number.isNaN(paidAt.getTime()))
      throw new BadRequestException("The payment date is not a valid date.");
    if (paidAt.getTime() > Date.now() + FUTURE_TOLERANCE_MS)
      throw new BadRequestException("The payment date cannot be in the future.");

    const fields = {
      vendorId: vendor._id,
      amountPaise: dto.amountPaise,
      method: dto.method,
      reference: dto.reference,
      // Cash has no receipt: never keep one, even if the client sent it.
      receiptUrl: dto.method === "cash" ? undefined : dto.receiptUrl,
      paidAt,
      note: dto.note,
      status: "recorded",
      recordedBy: actor.id,
      recordedByName: actor.name,
      idempotencyKey: dto.idempotencyKey,
    };

    let created: any;
    for (let attempt = 1; ; attempt += 1) {
      try {
        created = await this.paymentModel.create({ ...fields, paymentNumber: this.paymentNumber(paidAt) });
        break;
      } catch (error) {
        if ((error as { code?: number }).code !== 11000) throw error;
        // The same request arriving twice at once: the other one won, so return what it recorded.
        if (dto.idempotencyKey) {
          const winner = await this.paymentModel.findOne({ idempotencyKey: dto.idempotencyKey });
          if (winner) return this.repeatOf(winner, vendor);
        }
        if (attempt >= 3) throw error;
      }
    }

    this.logger.log(
      `₹${dto.amountPaise / 100} (${dto.method}) recorded for "${vendor.businessName}" as ${created.paymentNumber} by ${actor.id}`,
    );
    return { paymentId: String(created._id), ...(await this.walletOf(vendor, true)) };
  }

  /** A retried request returns the payment it already recorded, as long as it was for the same restaurant. */
  private async repeatOf(payment: any, vendor: any) {
    if (String(payment.vendorId) !== String(vendor._id))
      throw new ConflictException("This request id was already used for another restaurant.");
    return { paymentId: String(payment._id), ...(await this.walletOf(vendor, true)) };
  }

  /** Takes a wrongly entered payment out of the totals. It stays in the history, marked void. */
  async voidPayment(actor: FoodWalletActor, paymentId: string, reason: string) {
    const payment = await this.paymentModel.findById(paymentId);
    if (!payment) throw new NotFoundException("Payment not found");
    // Claimed with a conditional update, so two people voiding it together cannot both succeed.
    const claimed = await this.paymentModel.findOneAndUpdate(
      { _id: payment._id, status: "recorded" },
      { $set: { status: "voided", voidedAt: new Date(), voidedBy: actor.id, voidReason: reason.trim() } },
    );
    if (!claimed) throw new BadRequestException("This payment was already voided.");
    this.logger.log(`Payment ${payment.paymentNumber} voided by ${actor.id}: ${reason.trim()}`);
    return this.walletOf(await this.vendorById(String(payment.vendorId)), true);
  }
}
