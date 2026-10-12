import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Cron, CronExpression } from "@nestjs/schedule";
import type { ClientSession, Model } from "mongoose";
import { TransactionService } from "../../../common/database/transaction.service";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import { InAppNotificationService } from "../../notifications/application/in-app-notification.service";
import { BankAccountCrypto } from "../../payouts/infrastructure/bank-account.crypto";
import {
  OPEN_WITHDRAWAL_STATUSES,
  WITHDRAWAL_NUMBER_PREFIX,
  paymentMethodOf,
  providerWalletConfig,
  splitEarning,
  type ProviderWithdrawalStatus,
} from "../domain/provider-wallet.constants";
import { providerError } from "../domain/provider.errors";
import { pageParams } from "../presentation/dto/common.dto";
import type {
  AdminWithdrawalQueryDto,
  MarkWithdrawalPaidDto,
  RejectWithdrawalDto,
  RequestWithdrawalDto,
  SavePayoutAccountDto,
  WalletEntryQueryDto,
  WithdrawalQueryDto,
} from "../presentation/dto/wallet.dto";
import { ProviderAuditService } from "./provider-audit.service";
import { ProviderProfileService } from "./provider-profile.service";
import { idStr, paged, providerConfig, randomBase32, sameId, toObjectId } from "./provider.helpers";

const HOUR = 3_600_000;
const RELEASE_BATCH = 200;

const rupees = (minor: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(minor / 100);

const maskUpi = (upi: string) => {
  const [name, host] = upi.split("@");
  if (!host) return upi;
  return `${name.slice(0, 2)}${"•".repeat(Math.max(1, name.length - 2))}@${host}`;
};

/**
 * The pandit's earnings wallet: the one place provider money moves.
 *
 * Money in: a booking that becomes CONFIRMED (the devotee paid Tirvona via
 * Razorpay / UPI QR or their Tirvona wallet) credits the pandit's net share
 * as PENDING, inside the booking's own transaction. After the hold period
 * (`PROVIDER_WALLET_HOLD_HOURS`, default 72 h) it is released to the
 * withdrawable balance by a sweep, and also lazily whenever the wallet is read.
 *
 * Money out: the pandit requests a withdrawal to a saved bank account or UPI
 * id; finance marks it paid with the bank reference (UTR), or rejects it and
 * the money returns to the balance.
 *
 * Refunds: when a paid booking is cancelled the devotee is refunded in full,
 * so the earning is reversed. A pending earning is simply voided; an already
 * released one is taken from the balance and any shortfall is recorded as
 * `recoveryDueMinor`, deducted from the next earnings.
 *
 * Every balance change is a conditional `$inc` paired with a ledger entry with
 * a unique idempotency key, so retries never move money twice.
 */
@Injectable()
export class ProviderWalletService implements OnModuleInit {
  private readonly logger = new Logger(ProviderWalletService.name);
  private sweeping = false;

  constructor(
    @InjectModel("ProviderWallet") private readonly wallets: Model<any>,
    @InjectModel("ProviderWalletEntry") private readonly entries: Model<any>,
    @InjectModel("ProviderPayoutAccount") private readonly accounts: Model<any>,
    @InjectModel("ProviderWithdrawal") private readonly withdrawals: Model<any>,
    @InjectModel("ProviderProfile") private readonly profileModel: Model<any>,
    private readonly transactions: TransactionService,
    private readonly profiles: ProviderProfileService,
    private readonly audit: ProviderAuditService,
    private readonly notifier: InAppNotificationService,
    private readonly crypto: BankAccountCrypto,
  ) {}

  /** Say at startup, not on a pandit's first save, that bank details cannot be sealed. */
  onModuleInit() {
    if (process.env.NODE_ENV === "production" && !process.env.PAYOUT_ENCRYPTION_KEY?.trim())
      this.logger.error(
        "PAYOUT_ENCRYPTION_KEY is not set: pandits cannot save bank accounts for withdrawals (UPI still works). Set a base64 32-byte key.",
      );
  }

  // ================================================== booking hooks (money in)
  /**
   * Credits the pandit for a booking that has just been paid. Called by
   * ProviderBookingService inside the CONFIRMED transition's transaction.
   * Idempotent per booking.
   */
  async recordEarning(booking: any, paymentRef: string | undefined, session: ClientSession) {
    const grossMinor = Number(booking.serviceSnapshot?.pricing?.totalMinor ?? 0);
    if (!(grossMinor > 0)) return null; // free offering: nothing was paid
    const idempotencyKey = `earning-${booking._id}`;
    const prior = await this.entries.findOne({ idempotencyKey }).session(session);
    if (prior) return prior;

    const cfg = providerWalletConfig();
    const { platformFeeMinor, netMinor } = splitEarning(grossMinor, cfg.platformFeeBps);
    const wallet = await this.ensureWallet(booking.providerId, booking.providerUserId, session);
    const now = new Date();
    const [entry] = await this.entries.create(
      [
        {
          walletId: wallet._id,
          providerId: booking.providerId,
          type: "EARNING",
          direction: "CREDIT",
          status: "PENDING",
          amountMinor: netMinor,
          grossMinor,
          platformFeeMinor,
          bookingId: booking._id,
          bookingNumber: booking.bookingNumber,
          paymentRef: paymentRef ?? "",
          paymentMethod: paymentMethodOf(paymentRef),
          description: `Payment received for ${this.bookingTitle(booking)}`,
          availableAt: new Date(now.getTime() + cfg.holdHours * HOUR),
          idempotencyKey,
        },
      ],
      { session },
    );
    await this.wallets.updateOne(
      { _id: wallet._id },
      {
        $inc: {
          pendingMinor: netMinor,
          lifetimeEarnedMinor: netMinor,
          lifetimePlatformFeeMinor: platformFeeMinor,
        },
      },
      { session },
    );
    return entry;
  }

  /** Sends the "money received" notice; called after the booking transaction committed. */
  async notifyEarning(booking: any) {
    const entry: any = await this.entries
      .findOne({ idempotencyKey: `earning-${booking._id}` })
      .lean();
    if (!entry) return;
    try {
      await this.notifier.notifyUsers([String(booking.providerUserId)], {
        title: `${rupees(entry.amountMinor)} added to your wallet`,
        body: `Payment for booking ${booking.bookingNumber} received. It can be withdrawn after ${new Date(entry.availableAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })}.`,
        deepLink: "/provider/wallet",
        kind: "provider.wallet.earning",
      } as any);
    } catch (error) {
      this.logger.warn(`Wallet notice for ${booking.bookingNumber} failed: ${(error as Error).message}`);
    }
  }

  /**
   * Takes back the earning of a paid booking that was cancelled (the devotee
   * is refunded in full). Called inside the cancellation's transaction.
   */
  async reverseEarning(booking: any, session: ClientSession) {
    const earning = await this.entries
      .findOne({ bookingId: booking._id, type: "EARNING" })
      .session(session);
    if (!earning || earning.status === "REVERSED") return;
    const amount = Number(earning.amountMinor);
    const now = new Date();

    if (earning.status === "PENDING") {
      const voided = await this.entries.updateOne(
        { _id: earning._id, status: "PENDING" },
        { $set: { status: "REVERSED", reversedAt: now } },
        { session },
      );
      if (!voided.modifiedCount) return;
      await this.wallets.updateOne(
        { _id: earning.walletId },
        {
          $inc: {
            pendingMinor: -amount,
            lifetimeEarnedMinor: -amount,
            lifetimePlatformFeeMinor: -Number(earning.platformFeeMinor ?? 0),
          },
        },
        { session },
      );
      return;
    }

    // Already released: debit what is there, the rest becomes recovery due.
    const idempotencyKey = `earning-reversal-${booking._id}`;
    if (await this.entries.findOne({ idempotencyKey }).session(session)) return;
    const wallet: any = await this.wallets.findById(earning.walletId).session(session);
    const fromBalance = Math.min(amount, Math.max(0, Number(wallet?.availableMinor ?? 0)));
    const recovery = amount - fromBalance;
    await this.entries.create(
      [
        {
          walletId: earning.walletId,
          providerId: earning.providerId,
          type: "EARNING_REVERSAL",
          direction: "DEBIT",
          status: "POSTED",
          amountMinor: amount,
          recoveryMinor: recovery,
          bookingId: booking._id,
          bookingNumber: booking.bookingNumber,
          description: `Refund to devotee: booking ${booking.bookingNumber} was cancelled`,
          idempotencyKey,
        },
      ],
      { session },
    );
    await this.entries.updateOne({ _id: earning._id }, { $set: { reversedAt: now } }, { session });
    await this.wallets.updateOne(
      { _id: earning.walletId },
      {
        $inc: {
          availableMinor: -fromBalance,
          recoveryDueMinor: recovery,
          lifetimeEarnedMinor: -amount,
          lifetimePlatformFeeMinor: -Number(earning.platformFeeMinor ?? 0),
        },
      },
      { session },
    );
  }

  // ======================================================= hold release
  @Cron(CronExpression.EVERY_5_MINUTES)
  async sweepReleases(): Promise<number> {
    if (!providerConfig().maintenanceEnabled || this.sweeping) return 0;
    this.sweeping = true;
    try {
      return await this.releaseDue();
    } catch (error) {
      this.logger.error(`Wallet release sweep failed: ${(error as Error).message}`);
      return 0;
    } finally {
      this.sweeping = false;
    }
  }

  /** Moves every earning whose hold has run out to the available balance. Safe to run concurrently. */
  async releaseDue(providerId?: unknown, now = new Date()): Promise<number> {
    const filter: Record<string, unknown> = { status: "PENDING", availableAt: { $lte: now } };
    if (providerId) filter.providerId = toObjectId(String(providerId));
    const due: any[] = await this.entries.find(filter).select("_id").limit(RELEASE_BATCH).lean();
    let released = 0;
    for (const row of due) {
      try {
        if (await this.releaseOne(row._id, now)) released += 1;
      } catch (error) {
        this.logger.warn(`Could not release wallet entry ${row._id}: ${(error as Error).message}`);
      }
    }
    return released;
  }

  private async releaseOne(entryId: unknown, now: Date): Promise<boolean> {
    return this.transactions.run(async (session) => {
      const entry: any = await this.entries.findOneAndUpdate(
        { _id: entryId, status: "PENDING", availableAt: { $lte: now } },
        { $set: { status: "AVAILABLE", releasedAt: now } },
        { new: true, session },
      );
      if (!entry) return false;
      const amount = Number(entry.amountMinor);
      const wallet: any = await this.wallets.findById(entry.walletId).session(session);
      const recovered = Math.min(amount, Math.max(0, Number(wallet?.recoveryDueMinor ?? 0)));
      await this.wallets.updateOne(
        { _id: entry.walletId },
        {
          $inc: {
            pendingMinor: -amount,
            availableMinor: amount - recovered,
            recoveryDueMinor: -recovered,
          },
        },
        { session },
      );
      return true;
    });
  }

  // ===================================================== provider: read
  async summary(user: AuthenticatedUser) {
    const profile = await this.profiles.requireOwn(user);
    await this.releaseDue(profile._id);
    const cfg = providerWalletConfig();
    const [wallet, account, openWithdrawals, nextRelease, recent] = await Promise.all([
      this.wallets.findOne({ providerId: profile._id }).lean(),
      this.accounts.findOne({ providerId: profile._id, active: true }).lean(),
      this.withdrawals
        .find({ providerId: profile._id, status: { $in: OPEN_WITHDRAWAL_STATUSES } })
        .sort({ createdAt: -1 })
        .lean(),
      this.entries
        .findOne({ providerId: profile._id, status: "PENDING" })
        .sort({ availableAt: 1 })
        .lean(),
      this.entries.find({ providerId: profile._id }).sort({ createdAt: -1 }).limit(5).lean(),
    ]);
    const w: any = wallet ?? {};
    return {
      success: true,
      data: {
        currency: w.currency ?? "INR",
        availableMinor: Math.max(0, Number(w.availableMinor ?? 0)),
        pendingMinor: Math.max(0, Number(w.pendingMinor ?? 0)),
        withdrawingMinor: Math.max(0, Number(w.withdrawingMinor ?? 0)),
        recoveryDueMinor: Math.max(0, Number(w.recoveryDueMinor ?? 0)),
        lifetimeEarnedMinor: Number(w.lifetimeEarnedMinor ?? 0),
        lifetimeWithdrawnMinor: Number(w.lifetimeWithdrawnMinor ?? 0),
        lifetimePlatformFeeMinor: Number(w.lifetimePlatformFeeMinor ?? 0),
        nextRelease: nextRelease
          ? { amountMinor: (nextRelease as any).amountMinor, availableAt: (nextRelease as any).availableAt }
          : null,
        payoutAccount: account ? this.accountView(account) : null,
        openWithdrawals: openWithdrawals.map((row) => this.withdrawalView(row)),
        recentEntries: recent.map((row) => this.entryView(row)),
        rules: {
          holdHours: cfg.holdHours,
          platformFeePercent: cfg.platformFeeBps / 100,
          minWithdrawalMinor: cfg.minWithdrawalMinor,
        },
      },
    };
  }

  async listEntries(user: AuthenticatedUser, query: WalletEntryQueryDto) {
    const profile = await this.profiles.requireOwn(user);
    const { page, limit, skip } = pageParams(query);
    const filter: Record<string, unknown> = { providerId: profile._id };
    if (query.type) filter.type = query.type;
    if (query.status) filter.status = query.status;
    const [rows, total] = await Promise.all([
      this.entries.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      this.entries.countDocuments(filter),
    ]);
    return paged(rows.map((row) => this.entryView(row)), total, page, limit);
  }

  async listWithdrawals(user: AuthenticatedUser, query: WithdrawalQueryDto) {
    const profile = await this.profiles.requireOwn(user);
    const { page, limit, skip } = pageParams(query);
    const filter: Record<string, unknown> = { providerId: profile._id };
    if (query.status) filter.status = query.status;
    const [rows, total] = await Promise.all([
      this.withdrawals.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      this.withdrawals.countDocuments(filter),
    ]);
    return paged(rows.map((row) => this.withdrawalView(row)), total, page, limit);
  }

  // =========================================== provider: payout account
  async getPayoutAccount(user: AuthenticatedUser) {
    const profile = await this.profiles.requireOwn(user);
    const account = await this.accounts.findOne({ providerId: profile._id, active: true }).lean();
    return { success: true, data: account ? this.accountView(account) : null };
  }

  async savePayoutAccount(user: AuthenticatedUser, dto: SavePayoutAccountDto) {
    const profile = await this.profiles.requireOwn(user);
    const row: Record<string, unknown> = {
      providerId: profile._id,
      userId: profile.userId,
      method: dto.method,
      accountHolderName: dto.accountHolderName.trim(),
      active: true,
      accountNumberCiphertext: "",
      accountNumberIv: "",
      accountNumberTag: "",
      accountNumberLast4: "",
      ifsc: "",
      bankName: "",
      upiId: "",
    };
    if (dto.method === "BANK") {
      const number = String(dto.accountNumber ?? "").replace(/\s+/g, "");
      const ifsc = String(dto.ifsc ?? "").trim().toUpperCase();
      if (!/^\d{9,18}$/.test(number))
        throw providerError.badRequest("INVALID_ACCOUNT_NUMBER", "Account number must be 9 to 18 digits");
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc))
        throw providerError.badRequest("INVALID_IFSC", "Enter a valid 11-character IFSC code");
      const sealed = this.seal(number);
      Object.assign(row, {
        accountNumberCiphertext: sealed.ciphertext,
        accountNumberIv: sealed.iv,
        accountNumberTag: sealed.tag,
        accountNumberLast4: number.slice(-4),
        ifsc,
        bankName: (dto.bankName ?? "").trim(),
      });
    } else {
      const upi = String(dto.upiId ?? "").trim();
      if (!/^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9.-]{1,64}$/.test(upi))
        throw providerError.badRequest("INVALID_UPI_ID", "Enter a valid UPI id, e.g. name@okhdfcbank");
      row.upiId = upi;
    }

    const saved = await this.transactions.run(async (session) => {
      await this.accounts.updateMany(
        { providerId: profile._id, active: true },
        { $set: { active: false } },
        { session },
      );
      const [created] = await this.accounts.create([row], { session });
      return created;
    });
    await this.audit.log(user, "wallet.payout_account.saved", "provider_payout_account", saved._id, {
      method: dto.method,
    });
    return { success: true, data: this.accountView(saved.toObject()) };
  }

  // =============================================== provider: withdrawals
  async requestWithdrawal(user: AuthenticatedUser, dto: RequestWithdrawalDto) {
    const profile = await this.profiles.requireOwn(user);
    if (profile.status === "SUSPENDED")
      throw providerError.forbidden("PROVIDER_SUSPENDED", "Withdrawals are paused while your account is suspended");
    await this.releaseDue(profile._id);

    const amount = Math.round(Number(dto.amountMinor));
    const { minWithdrawalMinor } = providerWalletConfig();
    if (!(amount >= minWithdrawalMinor))
      throw providerError.badRequest(
        "WITHDRAWAL_TOO_SMALL",
        `The minimum withdrawal is ${rupees(minWithdrawalMinor)}`,
      );
    const account: any = await this.accounts.findOne({ providerId: profile._id, active: true }).lean();
    if (!account)
      throw providerError.conflict("PAYOUT_ACCOUNT_MISSING", "Add your bank account or UPI id first");

    const withdrawal = await this.transactions.run(async (session) => {
      const wallet = await this.wallets.findOneAndUpdate(
        { providerId: profile._id, availableMinor: { $gte: amount } },
        { $inc: { availableMinor: -amount, withdrawingMinor: amount } },
        { new: true, session },
      );
      if (!wallet)
        throw providerError.conflict(
          "INSUFFICIENT_BALANCE",
          "That is more than your available balance. Money becomes available 72 hours after payment.",
        );
      const [created] = await this.withdrawals.create(
        [
          {
            withdrawalNumber: this.withdrawalNumber(),
            providerId: profile._id,
            userId: profile.userId,
            amountMinor: amount,
            payoutAccountId: account._id,
            destination: this.accountView(account),
            note: (dto.note ?? "").trim(),
          },
        ],
        { session },
      );
      await this.entries.create(
        [
          {
            walletId: wallet._id,
            providerId: profile._id,
            type: "WITHDRAWAL",
            direction: "DEBIT",
            status: "POSTED",
            amountMinor: amount,
            withdrawalId: created._id,
            description: `Withdrawal ${created.withdrawalNumber} to ${this.destinationLabel(account)}`,
            idempotencyKey: `withdrawal-${created._id}`,
          },
        ],
        { session },
      );
      return created.toObject();
    });
    await this.audit.log(user, "wallet.withdrawal.requested", "provider_withdrawal", withdrawal._id, {
      amountMinor: amount,
    });
    return { success: true, data: this.withdrawalView(withdrawal) };
  }

  async cancelWithdrawal(user: AuthenticatedUser, withdrawalId: string) {
    const profile = await this.profiles.requireOwn(user);
    const row: any = await this.withdrawals.findById(toObjectId(withdrawalId, "withdrawalId")).lean();
    if (!row || !sameId(row.providerId, profile._id))
      throw providerError.notFound("WITHDRAWAL_NOT_FOUND", "Withdrawal not found");
    const updated = await this.returnToBalance(row, ["REQUESTED"], "CANCELLED", {
      cancelledAt: new Date(),
    });
    await this.audit.log(user, "wallet.withdrawal.cancelled", "provider_withdrawal", row._id);
    return { success: true, data: this.withdrawalView(updated) };
  }

  // ======================================================= admin / finance
  async adminListWithdrawals(query: AdminWithdrawalQueryDto) {
    const { page, limit, skip } = pageParams(query);
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    if (query.providerId) filter.providerId = toObjectId(query.providerId, "providerId");
    const [rows, total] = await Promise.all([
      this.withdrawals.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      this.withdrawals.countDocuments(filter),
    ]);
    const profileIds = [...new Set(rows.map((row: any) => String(row.providerId)))];
    const profileRows: any[] = profileIds.length
      ? await this.profileModel
          .find({ _id: { $in: profileIds.map((value) => toObjectId(value)) } })
          .select("displayName")
          .lean()
      : [];
    const names = new Map(profileRows.map((p) => [String(p._id), String(p.displayName ?? "")]));
    return paged(
      rows.map((row: any) => ({
        ...this.withdrawalView(row),
        provider: { id: idStr(row.providerId), displayName: names.get(String(row.providerId)) ?? "" },
      })),
      total,
      page,
      limit,
    );
  }

  async adminOverview() {
    const [wallets, openCount] = await Promise.all([
      this.wallets
        .find({})
        .select("pendingMinor availableMinor withdrawingMinor recoveryDueMinor lifetimeWithdrawnMinor lifetimePlatformFeeMinor")
        .lean(),
      this.withdrawals.countDocuments({ status: { $in: OPEN_WITHDRAWAL_STATUSES } }),
    ]);
    const sum = (key: string) => wallets.reduce((acc: number, w: any) => acc + Math.max(0, Number(w[key] ?? 0)), 0);
    return {
      success: true,
      data: {
        wallets: wallets.length,
        pendingMinor: sum("pendingMinor"),
        availableMinor: sum("availableMinor"),
        withdrawingMinor: sum("withdrawingMinor"),
        recoveryDueMinor: sum("recoveryDueMinor"),
        paidOutMinor: sum("lifetimeWithdrawnMinor"),
        platformFeeMinor: sum("lifetimePlatformFeeMinor"),
        openWithdrawals: openCount,
      },
    };
  }

  /** Full destination (decrypted account number) so finance can make the transfer. Audited. */
  async adminRevealDestination(user: AuthenticatedUser, withdrawalId: string) {
    const row: any = await this.withdrawals.findById(toObjectId(withdrawalId, "withdrawalId")).lean();
    if (!row) throw providerError.notFound("WITHDRAWAL_NOT_FOUND", "Withdrawal not found");
    const account: any = await this.accounts
      .findById(row.payoutAccountId)
      .select("+accountNumberCiphertext +accountNumberIv +accountNumberTag")
      .lean();
    if (!account) throw providerError.notFound("PAYOUT_ACCOUNT_NOT_FOUND", "Payout account not found");
    const accountNumber =
      account.method === "BANK" && account.accountNumberCiphertext
        ? this.crypto.decrypt({
            ciphertext: account.accountNumberCiphertext,
            iv: account.accountNumberIv,
            tag: account.accountNumberTag,
          })
        : "";
    await this.audit.log(user, "wallet.withdrawal.destination_revealed", "provider_withdrawal", row._id);
    return {
      success: true,
      data: {
        method: account.method,
        accountHolderName: account.accountHolderName,
        accountNumber,
        ifsc: account.ifsc,
        bankName: account.bankName,
        upiId: account.upiId,
      },
    };
  }

  async adminMarkProcessing(user: AuthenticatedUser, withdrawalId: string) {
    const updated = await this.withdrawals.findOneAndUpdate(
      { _id: toObjectId(withdrawalId, "withdrawalId"), status: "REQUESTED" },
      { $set: { status: "PROCESSING", processingAt: new Date(), processedBy: toObjectId(user.id) } },
      { new: true },
    );
    if (!updated)
      throw providerError.conflict("WITHDRAWAL_STATE_CONFLICT", "Only a requested withdrawal can be moved to processing");
    await this.audit.log(user, "wallet.withdrawal.processing", "provider_withdrawal", updated._id);
    return { success: true, data: this.withdrawalView(updated.toObject()) };
  }

  async adminMarkPaid(user: AuthenticatedUser, withdrawalId: string, dto: MarkWithdrawalPaidDto) {
    const id = toObjectId(withdrawalId, "withdrawalId");
    const updated = await this.transactions.run(async (session) => {
      const row: any = await this.withdrawals.findOneAndUpdate(
        { _id: id, status: { $in: OPEN_WITHDRAWAL_STATUSES } },
        {
          $set: {
            status: "PAID",
            paidAt: new Date(),
            payoutReference: dto.payoutReference.trim(),
            processedBy: toObjectId(user.id),
          },
        },
        { new: true, session },
      );
      if (!row)
        throw providerError.conflict("WITHDRAWAL_STATE_CONFLICT", "This withdrawal is no longer open");
      await this.wallets.updateOne(
        { providerId: row.providerId },
        { $inc: { withdrawingMinor: -row.amountMinor, lifetimeWithdrawnMinor: row.amountMinor } },
        { session },
      );
      return row.toObject();
    });
    await this.audit.log(user, "wallet.withdrawal.paid", "provider_withdrawal", updated._id, {
      amountMinor: updated.amountMinor,
    });
    await this.tell(updated.userId, `${rupees(updated.amountMinor)} sent to your account`, `Withdrawal ${updated.withdrawalNumber} was paid. Reference: ${updated.payoutReference}.`);
    return { success: true, data: this.withdrawalView(updated) };
  }

  async adminReject(user: AuthenticatedUser, withdrawalId: string, dto: RejectWithdrawalDto) {
    const row: any = await this.withdrawals.findById(toObjectId(withdrawalId, "withdrawalId")).lean();
    if (!row) throw providerError.notFound("WITHDRAWAL_NOT_FOUND", "Withdrawal not found");
    const updated = await this.returnToBalance(row, OPEN_WITHDRAWAL_STATUSES, "REJECTED", {
      rejectedAt: new Date(),
      rejectionReason: dto.reason.trim(),
      processedBy: toObjectId(user.id),
    });
    await this.audit.log(user, "wallet.withdrawal.rejected", "provider_withdrawal", row._id);
    await this.tell(updated.userId, "Withdrawal returned to your wallet", `Withdrawal ${updated.withdrawalNumber} could not be paid: ${updated.rejectionReason}. The amount is back in your available balance.`);
    return { success: true, data: this.withdrawalView(updated) };
  }

  // ============================================================ internals
  private seal(accountNumber: string) {
    try {
      return this.crypto.encrypt(accountNumber);
    } catch (error) {
      this.logger.error(`Cannot seal a pandit bank account: ${(error as Error).message}`);
      throw providerError.unavailable(
        "PAYOUT_ENCRYPTION_NOT_CONFIGURED",
        "Bank accounts cannot be saved right now. Please add a UPI id instead, or try again later.",
      );
    }
  }

  private async ensureWallet(providerId: unknown, userId: unknown, session: ClientSession) {
    return this.wallets.findOneAndUpdate(
      { providerId },
      { $setOnInsert: { providerId, userId, currency: "INR" } },
      { upsert: true, new: true, session },
    );
  }

  /** Cancel / reject: the withdrawal's amount goes back to the available balance. */
  private async returnToBalance(
    row: any,
    from: ProviderWithdrawalStatus[],
    to: ProviderWithdrawalStatus,
    set: Record<string, unknown>,
  ) {
    return this.transactions.run(async (session) => {
      const updated: any = await this.withdrawals.findOneAndUpdate(
        { _id: row._id, status: { $in: from } },
        { $set: { status: to, ...set } },
        { new: true, session },
      );
      if (!updated)
        throw providerError.conflict(
          "WITHDRAWAL_STATE_CONFLICT",
          `This withdrawal can no longer be ${to.toLowerCase()}`,
        );
      const wallet: any = await this.wallets.findOneAndUpdate(
        { providerId: row.providerId },
        { $inc: { withdrawingMinor: -row.amountMinor, availableMinor: row.amountMinor } },
        { new: true, session },
      );
      await this.entries.create(
        [
          {
            walletId: wallet._id,
            providerId: row.providerId,
            type: "WITHDRAWAL_REVERSAL",
            direction: "CREDIT",
            status: "POSTED",
            amountMinor: row.amountMinor,
            withdrawalId: row._id,
            description: `Withdrawal ${row.withdrawalNumber} ${to === "CANCELLED" ? "cancelled" : "rejected"}: amount returned`,
            idempotencyKey: `withdrawal-reversal-${row._id}`,
          },
        ],
        { session },
      );
      return updated.toObject();
    });
  }

  private async tell(userId: unknown, title: string, body: string) {
    try {
      await this.notifier.notifyUsers([String(userId)], {
        title,
        body,
        deepLink: "/provider/wallet",
        kind: "provider.wallet.withdrawal",
      } as any);
    } catch (error) {
      this.logger.warn(`Wallet notification failed: ${(error as Error).message}`);
    }
  }

  private withdrawalNumber() {
    const now = new Date();
    const yy = String(now.getUTCFullYear()).slice(-2);
    const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(now.getUTCDate()).padStart(2, "0");
    return `${WITHDRAWAL_NUMBER_PREFIX}-${yy}${mm}${dd}-${randomBase32(6)}`;
  }

  private bookingTitle(booking: any): string {
    const snap = booking.serviceSnapshot ?? {};
    const title =
      snap.offering?.title ||
      snap.ritual?.titles?.en ||
      Object.values(snap.ritual?.titles ?? {})[0] ||
      "puja booking";
    return `${title} (${booking.bookingNumber})`;
  }

  private destinationLabel(account: any): string {
    return account.method === "UPI"
      ? `UPI ${maskUpi(account.upiId)}`
      : `${account.bankName || "bank"} ••••${account.accountNumberLast4}`;
  }

  private accountView(account: any) {
    return {
      id: idStr(account._id),
      method: account.method,
      accountHolderName: account.accountHolderName,
      accountNumberLast4: account.method === "BANK" ? account.accountNumberLast4 : undefined,
      ifsc: account.method === "BANK" ? account.ifsc : undefined,
      bankName: account.method === "BANK" ? account.bankName : undefined,
      upiId: account.method === "UPI" ? maskUpi(account.upiId) : undefined,
      label: this.destinationLabel(account),
      updatedAt: account.updatedAt,
    };
  }

  private entryView(row: any) {
    return {
      id: idStr(row._id),
      type: row.type,
      direction: row.direction,
      status: row.status,
      amountMinor: row.amountMinor,
      grossMinor: row.grossMinor || undefined,
      platformFeeMinor: row.platformFeeMinor || undefined,
      recoveryMinor: row.recoveryMinor || undefined,
      currency: row.currency ?? "INR",
      bookingId: idStr(row.bookingId),
      bookingNumber: row.bookingNumber || undefined,
      withdrawalId: idStr(row.withdrawalId),
      paymentMethod: row.paymentMethod || undefined,
      description: row.description,
      availableAt: row.availableAt ?? undefined,
      releasedAt: row.releasedAt ?? undefined,
      reversedAt: row.reversedAt ?? undefined,
      createdAt: row.createdAt,
    };
  }

  private withdrawalView(row: any) {
    return {
      id: idStr(row._id),
      withdrawalNumber: row.withdrawalNumber,
      amountMinor: row.amountMinor,
      currency: row.currency ?? "INR",
      status: row.status,
      destination: row.destination,
      note: row.note || undefined,
      payoutReference: row.payoutReference || undefined,
      rejectionReason: row.rejectionReason || undefined,
      createdAt: row.createdAt,
      processingAt: row.processingAt,
      paidAt: row.paidAt,
      rejectedAt: row.rejectedAt,
      cancelledAt: row.cancelledAt,
    };
  }
}
