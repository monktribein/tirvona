import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { randomUUID } from "node:crypto";
import { Types, type Model } from "mongoose";
import { TransactionService } from "../../../common/database/transaction.service";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import { InAppNotificationService } from "../../notifications/application/in-app-notification.service";
import {
  OPEN_WITHDRAWAL_STATUSES,
  roundMoney,
} from "../domain/wallet.constants";
import type {
  AdminCreditDto,
  CreateWithdrawalDto,
  WalletAdminQueryDto,
  WalletTransactionQueryDto,
  WithdrawalQueryDto,
} from "../presentation/wallet.dto";
import { WalletService } from "./wallet.service";

const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const ACCOUNT_PATTERN = /^\d{9,18}$/;
const UPI_PATTERN = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9.-]{1,64}$/;

const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const page = (query: { page?: number; limit?: number }) => {
  const p = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  return { page: p, limit, skip: (p - 1) * limit };
};

const maskAccount = (value: string): string =>
  value ? `${"•".repeat(Math.max(0, value.length - 4))}${value.slice(-4)}` : "";

const EMPTY_WALLET = {
  balance: 0,
  heldAmount: 0,
  pendingWithdrawal: 0,
  totalCredited: 0,
  totalSpent: 0,
  totalWithdrawn: 0,
  currency: "INR",
};

/**
 * Everything a person does with a wallet over HTTP: the pilgrim's statement
 * and bank-transfer requests, and the admin console's view of every wallet,
 * manual credits, and the withdrawal queue. Money only ever moves through
 * `WalletService`.
 */
@Injectable()
export class WalletAccountService {
  constructor(
    private readonly wallet: WalletService,
    private readonly transactions: TransactionService,
    private readonly notifier: InAppNotificationService,
    @InjectModel("PilgrimWallet") private readonly wallets: Model<any>,
    @InjectModel("PilgrimWalletTransaction") private readonly txns: Model<any>,
    @InjectModel("PilgrimWalletWithdrawal") private readonly withdrawals: Model<any>,
    @InjectModel("User") private readonly users: Model<any>,
  ) {}

  // ============================================================ pilgrim
  async summary(userId: string): Promise<any> {
    const [wallet, recent, openWithdrawal] = await Promise.all([
      this.wallets.findOne({ userId }).lean(),
      this.txns.find({ userId }).sort({ createdAt: -1 }).limit(5).lean(),
      this.withdrawals
        .findOne({ userId, status: { $in: OPEN_WITHDRAWAL_STATUSES } })
        .sort({ createdAt: -1 })
        .lean(),
    ]);
    return {
      wallet: this.walletView(wallet),
      recent,
      openWithdrawal: openWithdrawal ? this.customerWithdrawal(openWithdrawal) : null,
    };
  }

  async transactionsFor(userId: string, query: WalletTransactionQueryDto): Promise<any> {
    const { page: p, limit, skip } = page(query);
    const filter: Record<string, unknown> = { userId };
    if (query.type) filter.type = query.type;
    if (query.category) filter.category = query.category;
    const [data, total] = await Promise.all([
      this.txns.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      this.txns.countDocuments(filter),
    ]);
    return { data, total, page: p, limit };
  }

  async withdrawalsFor(userId: string): Promise<any[]> {
    const rows = await this.withdrawals.find({ userId }).sort({ createdAt: -1 }).limit(50).lean();
    return rows.map((row: any) => this.customerWithdrawal(row));
  }

  async requestWithdrawal(user: AuthenticatedUser, dto: CreateWithdrawalDto): Promise<any> {
    const amount = roundMoney(dto.amount);
    if (amount < 1) throw new BadRequestException("Enter an amount of at least ₹1");
    const details = this.payoutDetails(dto);

    const open = await this.withdrawals.exists({
      userId: user.id,
      status: { $in: OPEN_WITHDRAWAL_STATUSES },
    });
    if (open)
      throw new ConflictException(
        "You already have a transfer request in progress. Please wait for it to complete.",
      );
    const available = await this.wallet.availableBalance(user.id);
    if (amount > available)
      throw new BadRequestException(
        `You can transfer up to ₹${available.toLocaleString("en-IN")}`,
      );

    const request = await this.transactions.run(async (session) => {
      const [row] = await this.withdrawals.create(
        [
          {
            requestNumber: `WD-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 4).toUpperCase()}`,
            userId: user.id,
            amount,
            ...details,
            customerNote: dto.note?.trim() ?? "",
            status: "pending",
          },
        ],
        { session },
      );
      await this.wallet.debit(
        {
          userId: user.id,
          amount,
          module: "withdrawal",
          category: "withdrawal",
          sourceId: row._id,
          reference: row.requestNumber,
          description: `Bank transfer request ${row.requestNumber}`,
          idempotencyKey: `withdraw:${String(row._id)}`,
          actorId: user.id,
          actorRole: user.role,
        },
        session,
      );
      return row;
    });
    return this.customerWithdrawal(request.toObject());
  }

  async cancelWithdrawal(user: AuthenticatedUser, id: string): Promise<any> {
    this.assertId(id);
    const row = await this.transactions.run(async (session) => {
      const updated = await this.withdrawals.findOneAndUpdate(
        { _id: id, userId: user.id, status: "pending" },
        { $set: { status: "cancelled", cancelledAt: new Date() } },
        { new: true, session },
      );
      if (!updated)
        throw new BadRequestException("Only a request that is still pending can be cancelled");
      await this.returnToWallet(updated, "Transfer request cancelled", user, session);
      return updated;
    });
    return this.customerWithdrawal(row.toObject());
  }

  // ============================================================== admin
  async overview(): Promise<any> {
    const [[totals], byCategory, [pending], [approved]] = await Promise.all([
      this.wallets.aggregate([
        {
          $group: {
            _id: null,
            wallets: { $sum: 1 },
            balance: { $sum: "$balance" },
            heldAmount: { $sum: "$heldAmount" },
            pendingWithdrawal: { $sum: "$pendingWithdrawal" },
            totalCredited: { $sum: "$totalCredited" },
            totalSpent: { $sum: "$totalSpent" },
            totalWithdrawn: { $sum: "$totalWithdrawn" },
          },
        },
      ]),
      this.txns.aggregate([
        { $group: { _id: "$category", amount: { $sum: "$amount" }, count: { $sum: 1 } } },
      ]),
      this.withdrawals.aggregate([
        { $match: { status: "pending" } },
        { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: "$amount" } } },
      ]),
      this.withdrawals.aggregate([
        { $match: { status: "approved" } },
        { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: "$amount" } } },
      ]),
    ]);
    const category = (key: string) => {
      const row = byCategory.find((r: any) => r._id === key);
      return { amount: roundMoney(row?.amount ?? 0), count: row?.count ?? 0 };
    };
    return {
      wallets: totals?.wallets ?? 0,
      balance: roundMoney(totals?.balance ?? 0),
      heldAmount: roundMoney(totals?.heldAmount ?? 0),
      pendingWithdrawal: roundMoney(totals?.pendingWithdrawal ?? 0),
      totalCredited: roundMoney(totals?.totalCredited ?? 0),
      totalSpent: roundMoney(totals?.totalSpent ?? 0),
      totalWithdrawn: roundMoney(totals?.totalWithdrawn ?? 0),
      refundCredits: category("refund"),
      adminCredits: category("admin_credit"),
      withdrawalsPending: { count: pending?.count ?? 0, amount: roundMoney(pending?.amount ?? 0) },
      withdrawalsApproved: { count: approved?.count ?? 0, amount: roundMoney(approved?.amount ?? 0) },
    };
  }

  async listWallets(query: WalletAdminQueryDto): Promise<any> {
    const { page: p, limit, skip } = page(query);
    const filter: Record<string, unknown> = {};
    if (query.search?.trim()) filter.userId = { $in: await this.matchingUserIds(query.search) };
    if (query.hasBalance) filter.balance = { $gt: 0 };
    const sort: Record<string, 1 | -1> =
      query.sort === "recent" ? { updatedAt: -1 } : { balance: -1, updatedAt: -1 };
    const [data, total] = await Promise.all([
      this.wallets
        .find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate("userId", "name email phone role")
        .lean(),
      this.wallets.countDocuments(filter),
    ]);
    return { data, total, page: p, limit };
  }

  /** Pilgrim accounts an admin can credit, with their current balance. */
  async searchCustomers(search: string): Promise<any[]> {
    if (!search?.trim()) return [];
    const ids = await this.matchingUserIds(search, 10);
    const [users, wallets] = await Promise.all([
      this.users.find({ _id: { $in: ids } }).select("name email phone role").lean(),
      this.wallets.find({ userId: { $in: ids } }).select("userId balance").lean(),
    ]);
    const balanceOf = new Map(wallets.map((w: any) => [String(w.userId), Number(w.balance ?? 0)]));
    return users.map((u: any) => ({ ...u, balance: roundMoney(balanceOf.get(String(u._id)) ?? 0) }));
  }

  async walletDetail(userId: string, query: WalletTransactionQueryDto): Promise<any> {
    this.assertId(userId, "Pilgrim not found");
    const user = await this.users.findById(userId).select("name email phone role createdAt").lean();
    if (!user) throw new NotFoundException("Pilgrim not found");
    const [wallet, statement, withdrawals] = await Promise.all([
      this.wallets.findOne({ userId }).lean(),
      this.transactionsFor(userId, query),
      this.withdrawals.find({ userId }).sort({ createdAt: -1 }).limit(50).lean(),
    ]);
    return { user, wallet: this.walletView(wallet), statement, withdrawals };
  }

  async adminCredit(admin: AuthenticatedUser, dto: AdminCreditDto): Promise<any> {
    this.assertId(dto.userId, "Pilgrim not found");
    const amount = roundMoney(dto.amount);
    if (amount < 1) throw new BadRequestException("Enter an amount of at least ₹1");
    const user = await this.users.findById(dto.userId).select("name").lean();
    if (!user) throw new NotFoundException("Pilgrim not found");
    const note = dto.note?.trim() || "Credit added by Tirvona";
    const txn = await this.wallet.credit({
      userId: dto.userId,
      amount,
      module: "admin",
      category: "admin_credit",
      reference: `ADM-${Date.now().toString(36).toUpperCase()}`,
      description: note,
      idempotencyKey: `admin:${dto.idempotencyKey?.trim() || randomUUID()}`,
      actorId: admin.id,
      actorRole: admin.role,
    });
    await this.notifier.notifyUsers([dto.userId], {
      title: "Wallet credited",
      body: `₹${amount.toLocaleString("en-IN")} has been added to your Tirvona wallet. ${note}`,
      deepLink: "/wallet",
      kind: "wallet.credit",
    });
    return txn;
  }

  async listWithdrawals(query: WithdrawalQueryDto): Promise<any> {
    const { page: p, limit, skip } = page(query);
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    if (query.search?.trim()) {
      const term = query.search.trim();
      filter.$or = [
        { requestNumber: { $regex: escapeRegex(term), $options: "i" } },
        { userId: { $in: await this.matchingUserIds(term) } },
      ];
    }
    const [data, total] = await Promise.all([
      this.withdrawals
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("userId", "name email phone")
        .populate("reviewedBy", "name")
        .populate("paidBy", "name")
        .lean(),
      this.withdrawals.countDocuments(filter),
    ]);
    return { data, total, page: p, limit };
  }

  async approveWithdrawal(admin: AuthenticatedUser, id: string, note?: string): Promise<any> {
    this.assertId(id);
    const row = await this.withdrawals.findOneAndUpdate(
      { _id: id, status: "pending" },
      {
        $set: {
          status: "approved",
          reviewedBy: admin.id,
          reviewedAt: new Date(),
          adminNote: note?.trim() ?? "",
        },
      },
      { new: true },
    );
    if (!row) throw new BadRequestException("Only a pending request can be approved");
    await this.notifier.notifyUsers([String(row.userId)], {
      title: "Transfer request approved",
      body: `Your request ${row.requestNumber} for ₹${row.amount.toLocaleString("en-IN")} is approved. The money will reach your account shortly.`,
      deepLink: "/wallet",
      kind: "wallet.withdrawal",
    });
    return row;
  }

  async rejectWithdrawal(admin: AuthenticatedUser, id: string, reason: string): Promise<any> {
    this.assertId(id);
    if (!reason?.trim()) throw new BadRequestException("A reason is required");
    const row = await this.transactions.run(async (session) => {
      const updated = await this.withdrawals.findOneAndUpdate(
        { _id: id, status: { $in: OPEN_WITHDRAWAL_STATUSES } },
        {
          $set: {
            status: "rejected",
            rejectionReason: reason.trim(),
            reviewedBy: admin.id,
            reviewedAt: new Date(),
          },
        },
        { new: true, session },
      );
      if (!updated) throw new BadRequestException("This request is no longer open");
      await this.returnToWallet(updated, `Transfer request rejected: ${reason.trim()}`, admin, session);
      return updated;
    });
    await this.notifier.notifyUsers([String(row.userId)], {
      title: "Transfer request declined",
      body: `₹${row.amount.toLocaleString("en-IN")} is back in your wallet. Reason: ${reason.trim()}`,
      deepLink: "/wallet",
      kind: "wallet.withdrawal",
    });
    return row;
  }

  async markWithdrawalPaid(
    admin: AuthenticatedUser,
    id: string,
    payoutReference: string,
    note?: string,
  ): Promise<any> {
    this.assertId(id);
    if (!payoutReference?.trim())
      throw new BadRequestException("Enter the bank / UPI transaction reference (UTR)");
    const row = await this.transactions.run(async (session) => {
      const updated = await this.withdrawals.findOneAndUpdate(
        { _id: id, status: { $in: OPEN_WITHDRAWAL_STATUSES } },
        {
          $set: {
            status: "paid",
            payoutReference: payoutReference.trim(),
            paidBy: admin.id,
            paidAt: new Date(),
            ...(note?.trim() ? { adminNote: note.trim() } : {}),
          },
        },
        { new: true, session },
      );
      if (!updated) throw new BadRequestException("This request is no longer open");
      if (!updated.reviewedBy) {
        updated.reviewedBy = admin.id;
        updated.reviewedAt = new Date();
        await updated.save({ session });
      }
      await this.wallets.updateOne(
        { userId: updated.userId },
        { $inc: { pendingWithdrawal: -updated.amount, totalWithdrawn: updated.amount } },
        { session },
      );
      return updated;
    });
    await this.notifier.notifyUsers([String(row.userId)], {
      title: "Money transferred",
      body: `₹${row.amount.toLocaleString("en-IN")} has been sent to your ${row.method === "upi" ? "UPI ID" : "bank account"}. Reference: ${row.payoutReference}`,
      deepLink: "/wallet",
      kind: "wallet.withdrawal",
    });
    return row;
  }

  // ========================================================== internals
  private async returnToWallet(
    request: any,
    description: string,
    actor: AuthenticatedUser,
    session: any,
  ): Promise<void> {
    await this.wallets.updateOne(
      { userId: request.userId, pendingWithdrawal: { $gte: request.amount } },
      { $inc: { pendingWithdrawal: -request.amount } },
      { session },
    );
    await this.wallet.credit(
      {
        userId: String(request.userId),
        amount: request.amount,
        module: "withdrawal",
        category: "withdrawal_reversal",
        sourceId: request._id,
        reference: request.requestNumber,
        description,
        idempotencyKey: `withdraw-return:${String(request._id)}`,
        actorId: actor.id,
        actorRole: actor.role,
      },
      session,
    );
  }

  private payoutDetails(dto: CreateWithdrawalDto): Record<string, string> {
    if (dto.method === "upi") {
      const upiId = dto.upiId?.trim() ?? "";
      if (!UPI_PATTERN.test(upiId)) throw new BadRequestException("Enter a valid UPI ID, like name@bank");
      return {
        method: "upi",
        upiId,
        accountHolderName: dto.accountHolderName?.trim() ?? "",
      };
    }
    const accountHolderName = dto.accountHolderName?.trim() ?? "";
    const accountNumber = (dto.accountNumber ?? "").replace(/\s+/g, "");
    const ifsc = (dto.ifsc ?? "").trim().toUpperCase();
    if (accountHolderName.length < 2) throw new BadRequestException("Enter the account holder's name");
    if (!ACCOUNT_PATTERN.test(accountNumber))
      throw new BadRequestException("Enter a valid bank account number (9–18 digits)");
    if (!IFSC_PATTERN.test(ifsc)) throw new BadRequestException("Enter a valid IFSC code, like SBIN0001234");
    return {
      method: "bank",
      accountHolderName,
      accountNumber,
      ifsc,
      bankName: dto.bankName?.trim() ?? "",
    };
  }

  private async matchingUserIds(search: string, limit = 200): Promise<Types.ObjectId[]> {
    const pattern = { $regex: escapeRegex(search.trim()), $options: "i" };
    const rows = await this.users
      .find({ $or: [{ name: pattern }, { email: pattern }, { phone: pattern }] })
      .select("_id")
      .limit(limit)
      .lean();
    return rows.map((r: any) => r._id);
  }

  private walletView(wallet: any): any {
    const row = wallet ?? EMPTY_WALLET;
    return {
      balance: roundMoney(row.balance ?? 0),
      heldAmount: roundMoney(row.heldAmount ?? 0),
      pendingWithdrawal: roundMoney(row.pendingWithdrawal ?? 0),
      totalCredited: roundMoney(row.totalCredited ?? 0),
      totalSpent: roundMoney(row.totalSpent ?? 0),
      totalWithdrawn: roundMoney(row.totalWithdrawn ?? 0),
      currency: row.currency ?? "INR",
      updatedAt: row.updatedAt ?? null,
    };
  }

  /** What the pilgrim sees of their own request: account number masked. */
  private customerWithdrawal(row: any): any {
    return { ...row, accountNumber: maskAccount(row.accountNumber ?? "") };
  }

  private assertId(id: string, message = "Request not found"): void {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException(message);
  }
}
