import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Cron, CronExpression } from "@nestjs/schedule";
import { Types, type ClientSession, type Model } from "mongoose";
import {
  WALLET_HOLD_TTL_MINUTES,
  roundMoney,
  walletShare,
  type WalletModule,
  type WalletTxnCategory,
} from "../domain/wallet.constants";

export interface WalletEntry {
  userId: string;
  amount: number;
  module: WalletModule;
  category: WalletTxnCategory;
  sourceId?: unknown;
  reference?: string;
  description: string;
  idempotencyKey: string;
  actorId?: string | null;
  actorRole?: string;
}

export interface WalletSpend {
  userId: string;
  module: WalletModule;
  sourceId: unknown;
  amount: number;
  reference?: string;
  description: string;
  actorId?: string | null;
}

const isDuplicateKey = (error: any): boolean => error?.code === 11000;

const asObjectId = (value: unknown): Types.ObjectId | null => {
  if (!value) return null;
  const raw = String((value as any)?._id ?? value);
  return Types.ObjectId.isValid(raw) ? new Types.ObjectId(raw) : null;
};

/**
 * The pilgrim wallet ledger: the one place wallet money moves.
 *
 * Every balance change is a conditional `$inc` on the wallet row, so two
 * checkouts racing for the same rupees cannot both win, and every change is
 * paired with an append-only transaction keyed by an idempotency key, so a
 * retried refund or a webhook replaying a payment never moves money twice.
 * Each method takes an optional session so a module can make the wallet
 * movement part of its own booking transaction.
 */
@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    @InjectModel("PilgrimWallet") private readonly wallets: Model<any>,
    @InjectModel("PilgrimWalletTransaction") private readonly txns: Model<any>,
    @InjectModel("PilgrimWalletHold") private readonly holds: Model<any>,
  ) {}

  async ensureWallet(userId: string, session?: ClientSession): Promise<any> {
    return this.wallets.findOneAndUpdate(
      { userId },
      { $setOnInsert: { userId, balance: 0 } },
      { upsert: true, new: true, session },
    );
  }

  /** Spendable balance; zero for an account that never had a wallet. */
  async availableBalance(userId: string | null | undefined): Promise<number> {
    if (!userId || !Types.ObjectId.isValid(String(userId))) return 0;
    const wallet = await this.wallets.findOne({ userId }).select("balance").lean();
    return roundMoney(Number((wallet as any)?.balance ?? 0));
  }

  /**
   * How a checkout of `total` splits between the wallet and the gateway.
   * Wallet money already held for this very checkout counts as available, so
   * re-opening the same payment does not shrink the wallet share.
   */
  async planSplit(
    userId: string | null | undefined,
    total: number,
    useWallet: boolean | undefined,
    hold?: { module: WalletModule; sourceId: unknown },
  ): Promise<{ walletAmount: number; gatewayAmount: number }> {
    const amount = roundMoney(total);
    if (!useWallet || !userId) return { walletAmount: 0, gatewayAmount: amount };
    let available = await this.availableBalance(userId);
    if (hold) {
      const existing = await this.holds
        .findOne({
          module: hold.module,
          sourceId: asObjectId(hold.sourceId),
          userId,
          status: "held",
        })
        .lean();
      available += Number((existing as any)?.amount ?? 0);
    }
    const walletAmount = walletShare(amount, available);
    return { walletAmount, gatewayAmount: roundMoney(amount - walletAmount) };
  }

  async credit(entry: WalletEntry, session?: ClientSession): Promise<any> {
    const amount = roundMoney(entry.amount);
    if (amount <= 0) return null;
    const prior = await this.txns
      .findOne({ idempotencyKey: entry.idempotencyKey })
      .session(session ?? null);
    if (prior) return prior;
    const wallet = await this.ensureWallet(entry.userId, session);
    // The transaction row goes in first: its unique idempotency key is what
    // stops a concurrent retry from crediting the balance a second time.
    let txn: any;
    try {
      [txn] = await this.txns.create(
        [this.txnRow(wallet, entry, "credit", amount, 0)],
        { session },
      );
    } catch (error) {
      if (isDuplicateKey(error))
        return this.txns.findOne({ idempotencyKey: entry.idempotencyKey });
      throw error;
    }
    const counts = entry.category !== "withdrawal_reversal";
    const updated = await this.wallets.findOneAndUpdate(
      { _id: wallet._id },
      { $inc: { balance: amount, ...(counts ? { totalCredited: amount } : {}) } },
      { new: true, session },
    );
    txn.balanceAfter = roundMoney(updated.balance);
    await txn.save({ session });
    return txn;
  }

  /**
   * Takes money out of the spendable balance. A withdrawal moves it into
   * `pendingWithdrawal` until an admin pays it out or sends it back.
   */
  async debit(entry: WalletEntry, session?: ClientSession): Promise<any> {
    const amount = roundMoney(entry.amount);
    if (amount <= 0) return null;
    const prior = await this.txns
      .findOne({ idempotencyKey: entry.idempotencyKey })
      .session(session ?? null);
    if (prior) return prior;
    await this.ensureWallet(entry.userId, session);
    const inc: Record<string, number> = { balance: -amount };
    if (entry.category === "withdrawal") inc.pendingWithdrawal = amount;
    else inc.totalSpent = amount;
    const updated = await this.wallets.findOneAndUpdate(
      { userId: entry.userId, balance: { $gte: amount } },
      { $inc: inc },
      { new: true, session },
    );
    if (!updated)
      throw new BadRequestException(
        "Your wallet balance is not enough for this. Please refresh and try again.",
      );
    try {
      const [txn] = await this.txns.create(
        [this.txnRow(updated, entry, "debit", amount, updated.balance)],
        { session },
      );
      return txn;
    } catch (error) {
      if (!isDuplicateKey(error)) throw error;
      // Lost a race to an identical request: hand the money back.
      const undo: Record<string, number> = {};
      for (const [key, value] of Object.entries(inc)) undo[key] = -value;
      await this.wallets.updateOne({ _id: updated._id }, { $inc: undo }, { session });
      return this.txns.findOne({ idempotencyKey: entry.idempotencyKey });
    }
  }

  /**
   * Parks wallet money against one unpaid checkout. A checkout re-opened with
   * the same wallet share keeps its hold; a different share replaces it.
   */
  async placeHold(
    input: {
      userId: string;
      module: WalletModule;
      sourceId: unknown;
      amount: number;
      reference?: string;
      /** The checkout's own reservation expiry; the hold never lapses first. */
      expiresAt?: Date | null;
    },
    session?: ClientSession,
  ): Promise<any> {
    const amount = roundMoney(input.amount);
    const sourceId = asObjectId(input.sourceId);
    if (!sourceId) throw new BadRequestException("Invalid checkout reference");
    // Reservation windows are configurable per ashram, aarti and marketplace;
    // a hold that lapsed before its checkout would let a still-valid payment
    // fail for want of balance after the gateway had already taken its share.
    const expiresAt = new Date(
      Math.max(
        Date.now() + WALLET_HOLD_TTL_MINUTES * 60_000,
        input.expiresAt ? new Date(input.expiresAt).getTime() + 5 * 60_000 : 0,
      ),
    );
    const existing = await this.holds
      .findOne({ module: input.module, sourceId, status: "held" })
      .session(session ?? null);
    if (
      existing &&
      String(existing.userId) === String(input.userId) &&
      roundMoney(existing.amount) === amount
    ) {
      existing.expiresAt = expiresAt;
      await existing.save({ session });
      return existing;
    }
    if (existing) await this.releaseHold(input.module, sourceId, session);
    if (amount <= 0) return null;
    await this.ensureWallet(input.userId, session);
    const updated = await this.wallets.findOneAndUpdate(
      { userId: input.userId, balance: { $gte: amount } },
      { $inc: { balance: -amount, heldAmount: amount } },
      { new: true, session },
    );
    if (!updated)
      throw new BadRequestException(
        "Your wallet balance changed. Please refresh and try again.",
      );
    try {
      const [hold] = await this.holds.create(
        [
          {
            userId: input.userId,
            module: input.module,
            sourceId,
            amount,
            reference: input.reference ?? "",
            status: "held",
            expiresAt,
          },
        ],
        { session },
      );
      return hold;
    } catch (error) {
      await this.wallets.updateOne(
        { _id: updated._id },
        { $inc: { balance: amount, heldAmount: -amount } },
        { session },
      );
      if (isDuplicateKey(error))
        throw new ConflictException(
          "A payment for this booking is already being set up. Please try again.",
        );
      throw error;
    }
  }

  /** Returns an open hold's money to the spendable balance. */
  async releaseHold(
    module: WalletModule,
    sourceIdValue: unknown,
    session?: ClientSession,
  ): Promise<number> {
    const sourceId = asObjectId(sourceIdValue);
    if (!sourceId) return 0;
    const hold = await this.holds.findOneAndUpdate(
      { module, sourceId, status: "held" },
      { $set: { status: "released", releasedAt: new Date() } },
      { new: true, session },
    );
    if (!hold) return 0;
    await this.wallets.updateOne(
      { userId: hold.userId },
      { $inc: { balance: hold.amount, heldAmount: -hold.amount } },
      { session },
    );
    return roundMoney(hold.amount);
  }

  /**
   * Spends the wallet share of a confirmed checkout. Captures the hold placed
   * when the payment was opened; if that hold has lapsed or differs, the
   * amount is taken from the spendable balance instead. Idempotent per
   * checkout, so a webhook and a browser callback confirming the same payment
   * spend the money once.
   */
  async spend(input: WalletSpend, session?: ClientSession): Promise<any> {
    const amount = roundMoney(input.amount);
    if (amount <= 0) return null;
    const sourceId = asObjectId(input.sourceId);
    const idempotencyKey = `pay:${input.module}:${String(sourceId)}`;
    const prior = await this.txns.findOne({ idempotencyKey }).session(session ?? null);
    if (prior) return prior;
    const hold = await this.holds
      .findOne({ module: input.module, sourceId, status: "held" })
      .session(session ?? null);
    if (
      hold &&
      String(hold.userId) === String(input.userId) &&
      roundMoney(hold.amount) === amount
    ) {
      const captured = await this.holds.findOneAndUpdate(
        { _id: hold._id, status: "held" },
        { $set: { status: "captured", capturedAt: new Date() } },
        { new: true, session },
      );
      if (captured) {
        const updated = await this.wallets.findOneAndUpdate(
          { userId: input.userId },
          { $inc: { heldAmount: -amount, totalSpent: amount } },
          { new: true, session },
        );
        const [txn] = await this.txns.create(
          [
            this.txnRow(
              updated,
              {
                ...input,
                amount,
                category: "payment",
                idempotencyKey,
              },
              "debit",
              amount,
              updated.balance,
            ),
          ],
          { session },
        );
        return txn;
      }
    }
    if (hold) await this.releaseHold(input.module, sourceId, session);
    return this.debit(
      { ...input, amount, category: "payment", idempotencyKey },
      session,
    );
  }

  /** Puts back money from checkouts that were never paid. */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async releaseExpiredHolds(): Promise<number> {
    const stale = await this.holds
      .find({ status: "held", expiresAt: { $lt: new Date() } })
      .select("module sourceId")
      .limit(500)
      .lean();
    let released = 0;
    for (const hold of stale as any[]) {
      try {
        if (await this.releaseHold(hold.module, hold.sourceId)) released++;
      } catch (error) {
        this.logger.warn(
          `Could not release wallet hold ${String(hold._id)}: ${(error as Error).message}`,
        );
      }
    }
    return released;
  }

  private txnRow(
    wallet: any,
    entry: WalletEntry | (WalletSpend & { category: WalletTxnCategory; idempotencyKey: string }),
    type: "credit" | "debit",
    amount: number,
    balanceAfter: number,
  ): Record<string, unknown> {
    return {
      walletId: wallet._id,
      userId: wallet.userId,
      type,
      category: entry.category,
      amount,
      balanceAfter: roundMoney(balanceAfter),
      module: entry.module,
      sourceId: asObjectId(entry.sourceId),
      reference: entry.reference ?? "",
      description: entry.description,
      idempotencyKey: entry.idempotencyKey,
      actorId: entry.actorId ?? null,
      actorRole: (entry as WalletEntry).actorRole ?? (entry.actorId ? "customer" : "system"),
    };
  }
}
