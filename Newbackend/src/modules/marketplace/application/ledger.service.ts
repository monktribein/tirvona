import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { randomUUID } from "node:crypto";
import { Types, type ClientSession, type Model } from "mongoose";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import { computeWalletBalance, type LedgerEntryLike, type WalletBalance } from "../domain/ledger";
import type { LedgerEntryType } from "../domain/marketplace.constants";
import { MarketplaceAuditService } from "./marketplace-audit.service";

interface NewEntry {
  vendorId: unknown;
  type: LedgerEntryType;
  amount: number;
  idempotencyKey: string;
  availableAt?: Date | null;
  vendorOrderId?: unknown;
  masterOrderId?: unknown;
  payoutId?: unknown;
  description?: string;
  actorId?: unknown;
}

/**
 * Append-only vendor ledger. Every financial event is one entry with a unique
 * `idempotencyKey`, so replays (double webhook, retried request) can never
 * double-credit, double-charge commission or double-debit a payout.
 */
@Injectable()
export class LedgerService {
  constructor(
    @InjectModel("MpLedgerEntry") private readonly entries: Model<any>,
    private readonly audit: MarketplaceAuditService,
  ) {}

  /** Inserts entries; entries whose idempotency key already exists are skipped. Returns how many were new. */
  async append(entries: NewEntry[], session?: ClientSession): Promise<number> {
    let created = 0;
    for (const e of entries) {
      if (!(e.amount > 0)) continue;
      try {
        await this.entries.create([{ availableAt: null, ...e, amount: Math.round(e.amount * 100) / 100 }], session ? { session } : {});
        created++;
      } catch (err: any) {
        if (err?.code !== 11000) throw err; // duplicate key = already recorded
      }
    }
    return created;
  }

  /** Sale credit (vendor order total) + commission debit, both pending until settlement. */
  recordSale(vo: any, session?: ClientSession): Promise<number> {
    return this.append(
      [
        {
          vendorId: vo.vendorId,
          type: "sale_credit",
          amount: vo.total,
          idempotencyKey: `sale:${vo._id}`,
          vendorOrderId: vo._id,
          masterOrderId: vo.masterOrderId,
          description: `Sale ${vo.vendorOrderNumber}`,
        },
        {
          vendorId: vo.vendorId,
          type: "commission_debit",
          amount: vo.commissionAmount,
          idempotencyKey: `commission:${vo._id}`,
          vendorOrderId: vo._id,
          masterOrderId: vo.masterOrderId,
          description: `Tirvona commission ${vo.vendorOrderNumber}`,
        },
      ],
      session,
    );
  }

  /** Makes a delivered vendor order's sale + commission entries available from `at`. */
  async scheduleSettlement(vendorOrderId: unknown, at: Date): Promise<void> {
    await this.entries.updateMany(
      { vendorOrderId, type: { $in: ["sale_credit", "commission_debit"] }, availableAt: null },
      { $set: { availableAt: at } },
    );
  }

  /**
   * Reverses a vendor order's earnings after a refund. If the sale had already
   * settled, the reversal hits the available balance now (and may push it
   * negative, recovered from future sales); otherwise it stays pending and
   * nets the pending sale to zero.
   */
  async reverseSale(vo: any, reason: string): Promise<void> {
    const sale: any = await this.entries.findOne({ idempotencyKey: `sale:${vo._id}` }).lean();
    if (!sale) return; // never paid -> nothing to reverse
    const settled = sale.availableAt && new Date(sale.availableAt) <= new Date();
    const availableAt = settled ? new Date() : null;
    await this.append([
      {
        vendorId: vo.vendorId,
        type: "refund_debit",
        amount: vo.total,
        idempotencyKey: `refund:${vo._id}`,
        availableAt,
        vendorOrderId: vo._id,
        masterOrderId: vo.masterOrderId,
        description: `Refund ${vo.vendorOrderNumber}: ${reason}`,
      },
      {
        vendorId: vo.vendorId,
        type: "commission_reversal_credit",
        amount: vo.commissionAmount,
        idempotencyKey: `commission-reversal:${vo._id}`,
        availableAt,
        vendorOrderId: vo._id,
        masterOrderId: vo.masterOrderId,
        description: `Commission returned ${vo.vendorOrderNumber}`,
      },
    ]);
  }

  async adjust(actor: AuthenticatedUser, vendorId: string, direction: "credit" | "debit", amount: number, reason: string): Promise<any> {
    if (!(amount > 0)) throw new BadRequestException("Amount must be greater than 0");
    if (!reason?.trim()) throw new BadRequestException("A reason is required");
    const key = `adjustment:${randomUUID()}`;
    await this.append([
      {
        vendorId: new Types.ObjectId(vendorId),
        type: direction === "credit" ? "adjustment_credit" : "adjustment_debit",
        amount,
        idempotencyKey: key,
        availableAt: new Date(),
        description: reason,
        actorId: actor.id,
      },
    ]);
    await this.audit.log(actor, "finance.adjustment", "MpVendor", vendorId, { direction, amount, reason });
    return this.balance(vendorId);
  }

  async balance(vendorId: unknown, now = new Date()): Promise<WalletBalance> {
    const vid = typeof vendorId === "string" ? new Types.ObjectId(vendorId) : vendorId;
    // Sum per (type, available?) in the database, then apply the pure balance rules.
    const groups: Array<{ _id: { type: LedgerEntryType; available: boolean }; amount: number }> = await this.entries.aggregate([
      { $match: { vendorId: vid } },
      {
        $group: {
          _id: {
            type: "$type",
            available: { $and: [{ $ne: ["$availableAt", null] }, { $lte: ["$availableAt", now] }] },
          },
          amount: { $sum: "$amount" },
        },
      },
    ]);
    const summarized: LedgerEntryLike[] = groups.map((g) => ({
      type: g._id.type,
      amount: g.amount,
      availableAt: g._id.available ? now : null,
    }));
    return computeWalletBalance(summarized, now);
  }

  async list(vendorId: unknown, query: { page?: number; limit?: number; type?: string }): Promise<any> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const filter: Record<string, unknown> = { vendorId };
    if (query.type) filter.type = query.type;
    const [data, total] = await Promise.all([
      this.entries.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      this.entries.countDocuments(filter),
    ]);
    return { data, total, page, limit };
  }

  /** Platform-wide commission earned (net of reversals), optionally for one vendor. */
  async commissionSummary(vendorId?: string): Promise<any> {
    const match: Record<string, unknown> = { type: { $in: ["commission_debit", "commission_reversal_credit"] } };
    if (vendorId) match.vendorId = new Types.ObjectId(vendorId);
    const rows = await this.entries.aggregate([{ $match: match }, { $group: { _id: "$type", amount: { $sum: "$amount" } } }]);
    const get = (t: string) => rows.find((r: any) => r._id === t)?.amount ?? 0;
    const gross = get("commission_debit");
    const reversed = get("commission_reversal_credit");
    return { grossCommission: gross, reversedCommission: reversed, netCommission: Math.round((gross - reversed) * 100) / 100 };
  }
}
