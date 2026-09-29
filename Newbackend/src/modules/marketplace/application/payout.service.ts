import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { randomBytes, randomUUID } from "node:crypto";
import { isValidObjectId, Types, type Model } from "mongoose";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import { BankAccountCrypto } from "../../payouts/infrastructure/bank-account.crypto";
import { mapProviderStatus, type PayoutProvider } from "../../payouts/domain/payout.types";
import { PAYOUT_TRANSITIONS, assertTransition, type MarketplacePayoutStatus } from "../domain/marketplace.constants";
import { toPaise } from "../domain/pricing";
import type { PayoutQueryDto, RequestPayoutDto } from "../presentation/marketplace.dto";
import { LedgerService } from "./ledger.service";
import { MarketplaceAuditService } from "./marketplace-audit.service";
import { MarketplaceSettingsService } from "./marketplace-settings.service";
import { VendorService } from "./vendor.service";

/** DI token for the transfer integration (RazorpayX today, swappable later). */
export const MARKETPLACE_PAYOUT_PROVIDER = Symbol("MARKETPLACE_PAYOUT_PROVIDER");

/**
 * Vendor payouts. Requesting a payout debits the ledger immediately (so the
 * same money cannot be requested twice); a failed or cancelled payout writes
 * a reversal credit. A payout is only marked PAID when the provider reports
 * it processed, or when an admin records a manual bank transfer with its UTR.
 */
@Injectable()
export class PayoutService {
  private readonly logger = new Logger(PayoutService.name);

  constructor(
    @InjectModel("MpPayout") private readonly payouts: Model<any>,
    @InjectModel("MpVendor") private readonly vendors: Model<any>,
    @InjectModel("MpVendorBankAccount") private readonly bankAccounts: Model<any>,
    @Inject(MARKETPLACE_PAYOUT_PROVIDER) private readonly provider: PayoutProvider,
    private readonly crypto: BankAccountCrypto,
    private readonly ledger: LedgerService,
    private readonly settings: MarketplaceSettingsService,
    private readonly vendorService: VendorService,
    private readonly audit: MarketplaceAuditService,
  ) {}

  // ------------------------------------------------------------- vendor
  async request(user: AuthenticatedUser, dto: RequestPayoutDto): Promise<any> {
    const vendor = await this.vendorService.requireOwnVendor(user);
    this.vendorService.assertCanSell(vendor);
    const amount = Math.round(Number(dto.amount) * 100) / 100;
    const { minimumPayoutAmount } = await this.settings.get();
    if (!(amount >= minimumPayoutAmount)) throw new BadRequestException(`Minimum payout is ₹${minimumPayoutAmount}`);

    const account = dto.bankAccountId
      ? await this.bankAccounts.findOne({ _id: this.oid(dto.bankAccountId), vendorId: vendor._id, deletedAt: null })
      : await this.bankAccounts.findOne({ vendorId: vendor._id, deletedAt: null, isDefault: true });
    if (!account) throw new BadRequestException("Add a bank account first");
    if (account.verificationStatus === "rejected") throw new BadRequestException("This bank account was rejected");

    // Serialise payout requests per vendor so two concurrent requests
    // cannot both pass the balance check.
    const token = randomBytes(12).toString("hex");
    const now = new Date();
    const locked = await this.vendors.findOneAndUpdate(
      { _id: vendor._id, $or: [{ payoutLockExpiresAt: null }, { payoutLockExpiresAt: { $exists: false } }, { payoutLockExpiresAt: { $lt: now } }] },
      { $set: { payoutLockToken: token, payoutLockExpiresAt: new Date(now.getTime() + 15000) } },
    );
    if (!locked) throw new ConflictException("Another payout request is being processed. Try again in a moment.");
    try {
      const balance = await this.ledger.balance(vendor._id);
      if (toPaise(amount) > toPaise(balance.available)) {
        throw new BadRequestException(`Insufficient available balance (₹${balance.available.toFixed(2)})`);
      }
      const payout = await this.payouts.create({
        vendorId: vendor._id,
        payoutNumber: `TVN-MPO-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 4).toUpperCase()}`,
        amount,
        status: "requested",
        bankAccountId: account._id,
        bankSnapshot: {
          accountHolderName: account.accountHolderName,
          bankName: account.bankName,
          ifsc: account.ifsc,
          accountNumberLast4: account.accountNumberLast4,
        },
        mode: dto.mode ?? "IMPS",
        statusHistory: [{ from: "none", to: "requested", at: new Date(), actorId: user.id }],
      });
      await this.ledger.append([
        {
          vendorId: vendor._id,
          type: "payout_debit",
          amount,
          idempotencyKey: `payout:${payout._id}`,
          availableAt: new Date(),
          payoutId: payout._id,
          description: `Payout ${payout.payoutNumber}`,
          actorId: user.id,
        },
      ]);
      await this.audit.log(user, "payout.requested", "MpPayout", payout._id, { amount });
      return payout;
    } finally {
      await this.vendors.updateOne({ _id: vendor._id, payoutLockToken: token }, { $unset: { payoutLockToken: "", payoutLockExpiresAt: "" } });
    }
  }

  async listOwn(user: AuthenticatedUser, query: PayoutQueryDto): Promise<any> {
    const vendor = await this.vendorService.requireOwnVendor(user);
    return this.paginate({ vendorId: vendor._id, ...(query.status ? { status: query.status } : {}) }, query);
  }

  async cancelOwn(user: AuthenticatedUser, id: string): Promise<any> {
    const vendor = await this.vendorService.requireOwnVendor(user);
    const payout = await this.payouts.findOne({ _id: this.oid(id), vendorId: vendor._id });
    if (!payout) throw new NotFoundException("Payout not found");
    if (payout.status !== "requested") throw new BadRequestException("Only a payout that has not been reviewed can be cancelled");
    return this.close(payout, "cancelled", user, "Cancelled by store");
  }

  async summary(user: AuthenticatedUser): Promise<any> {
    const vendor = await this.vendorService.requireOwnVendor(user);
    return this.vendorSummary(vendor._id);
  }

  async vendorSummary(vendorId: unknown): Promise<any> {
    const [balance, paidAgg] = await Promise.all([
      this.ledger.balance(vendorId),
      this.payouts.aggregate([
        { $match: { vendorId: typeof vendorId === "string" ? new Types.ObjectId(vendorId) : vendorId } },
        { $group: { _id: "$status", amount: { $sum: "$amount" } } },
      ]),
    ]);
    const by = Object.fromEntries(paidAgg.map((r: any) => [r._id, r.amount]));
    return {
      ...balance,
      paidOut: by.paid ?? 0,
      inFlight: (by.requested ?? 0) + (by.under_review ?? 0) + (by.processing ?? 0),
    };
  }

  // -------------------------------------------------------------- admin
  async adminList(query: PayoutQueryDto): Promise<any> {
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    if (query.vendorId && isValidObjectId(query.vendorId)) filter.vendorId = new Types.ObjectId(query.vendorId);
    return this.paginate(filter, query, true);
  }

  /**
   * Approves a payout. With RazorpayX configured the transfer is initiated
   * and the payout moves to PROCESSING; otherwise it moves to UNDER_REVIEW
   * awaiting a manual bank transfer recorded via `adminMarkPaid`.
   */
  async adminApprove(actor: AuthenticatedUser, id: string): Promise<any> {
    const payout = await this.payouts.findById(this.oid(id));
    if (!payout) throw new NotFoundException("Payout not found");
    if (!["requested", "under_review"].includes(payout.status)) throw new BadRequestException(`Payout is ${payout.status}`);
    payout.reviewedBy = actor.id;
    payout.reviewedAt = new Date();

    if (!this.provider.isConfigured()) {
      this.move(payout, "under_review", actor, "Approved; awaiting manual bank transfer");
      await payout.save();
      await this.audit.log(actor, "payout.approved_manual", "MpPayout", payout._id);
      return payout;
    }

    const account = await this.bankAccounts
      .findById(payout.bankAccountId)
      .select("+accountNumberEncrypted +providerContactId +providerFundAccountId");
    if (!account || account.deletedAt) throw new BadRequestException("The payout bank account no longer exists");
    if (account.verificationStatus !== "verified") throw new ForbiddenException("Verify the vendor's bank account before sending money");
    try {
      if (!account.providerFundAccountId) {
        const vendor = await this.vendors.findById(payout.vendorId).lean();
        const beneficiary = {
          name: account.accountHolderName,
          email: (vendor as any)?.contactEmail,
          phone: (vendor as any)?.contactPhone,
          accountNumber: this.crypto.decrypt(account.accountNumberEncrypted),
          ifsc: account.ifsc,
          referenceId: String(payout.vendorId),
        };
        account.providerContactId = account.providerContactId || (await this.provider.createContact(beneficiary));
        account.providerFundAccountId = await this.provider.createFundAccount(account.providerContactId, beneficiary);
        await account.save();
      }
      const result = await this.provider.createPayout({
        fundAccountId: account.providerFundAccountId,
        amountPaise: toPaise(payout.amount),
        mode: payout.mode,
        referenceId: payout.payoutNumber,
        idempotencyKey: `mp-payout-${payout._id}`,
      });
      payout.provider = "razorpayx";
      payout.providerPayoutId = result.id;
      payout.utr = result.utr;
      this.move(payout, "processing", actor, "Transfer initiated");
      await payout.save();
      await this.applyProviderStatus(payout, result.status, result.failureReason, actor);
    } catch (err: any) {
      this.logger.error(`Payout ${payout.payoutNumber} provider error: ${err?.message}`);
      throw new BadRequestException(`Payout provider error: ${err?.message ?? "unknown"}`);
    }
    await this.audit.log(actor, "payout.approved", "MpPayout", payout._id, { providerPayoutId: payout.providerPayoutId });
    return payout;
  }

  /** Pulls the latest status from the provider. */
  async adminSync(actor: AuthenticatedUser, id: string): Promise<any> {
    const payout = await this.payouts.findById(this.oid(id));
    if (!payout?.providerPayoutId) throw new BadRequestException("This payout has no provider transfer to sync");
    const result = await this.provider.fetchPayout(payout.providerPayoutId);
    if (result.utr) payout.utr = result.utr;
    await this.applyProviderStatus(payout, result.status, result.failureReason, actor);
    return payout;
  }

  /** Records a manual bank transfer. Requires the bank reference (UTR). */
  async adminMarkPaid(actor: AuthenticatedUser, id: string, utr: string): Promise<any> {
    if (!utr?.trim()) throw new BadRequestException("The bank transfer reference (UTR) is required");
    const payout = await this.payouts.findById(this.oid(id));
    if (!payout) throw new NotFoundException("Payout not found");
    if (payout.providerPayoutId) throw new BadRequestException("Provider payouts are settled by syncing with the provider");
    payout.utr = utr.trim();
    payout.provider = "manual";
    this.move(payout, "paid", actor, `Manual transfer ${payout.utr}`);
    payout.paidAt = new Date();
    await payout.save();
    await this.audit.log(actor, "payout.paid", "MpPayout", payout._id, { utr: payout.utr, manual: true });
    return payout;
  }

  async adminMarkFailed(actor: AuthenticatedUser, id: string, reason: string): Promise<any> {
    if (!reason?.trim()) throw new BadRequestException("A reason is required");
    const payout = await this.payouts.findById(this.oid(id));
    if (!payout) throw new NotFoundException("Payout not found");
    return this.close(payout, "failed", actor, reason);
  }

  // ------------------------------------------------------------ helpers
  private async applyProviderStatus(payout: any, providerStatus: string, failureReason: string | undefined, actor: AuthenticatedUser | null) {
    const mapped = mapProviderStatus(providerStatus);
    if (mapped === "paid" && payout.status !== "paid") {
      this.move(payout, "paid", actor, "Provider processed");
      payout.paidAt = new Date();
      await payout.save();
      await this.audit.log(actor, "payout.paid", "MpPayout", payout._id, { utr: payout.utr });
    } else if (mapped === "failed" && payout.status !== "failed") {
      await this.close(payout, "failed", actor, failureReason ?? "Provider reported failure");
    }
  }

  /** Terminal failure/cancel: returns the money to the vendor's available balance. */
  private async close(payout: any, to: "failed" | "cancelled", actor: AuthenticatedUser | null, reason: string) {
    this.move(payout, to, actor, reason);
    payout.failureReason = reason;
    await payout.save();
    await this.ledger.append([
      {
        vendorId: payout.vendorId,
        type: "payout_reversal_credit",
        amount: payout.amount,
        idempotencyKey: `payout-reversal:${payout._id}`,
        availableAt: new Date(),
        payoutId: payout._id,
        description: `Payout ${payout.payoutNumber} ${to}: ${reason}`,
        actorId: actor?.id,
      },
    ]);
    await this.audit.log(actor, `payout.${to}`, "MpPayout", payout._id, { reason });
    return payout;
  }

  private move(payout: any, to: MarketplacePayoutStatus, actor: AuthenticatedUser | null, note?: string) {
    // Money states are strict: repeating a transition is an error, not a no-op.
    if (payout.status === to) throw new BadRequestException(`Payout cannot move from "${to}" to "${to}"`);
    assertTransition(PAYOUT_TRANSITIONS, payout.status as MarketplacePayoutStatus, to, "Payout");
    payout.statusHistory = [...(payout.statusHistory ?? []), { from: payout.status, to, at: new Date(), actorId: actor?.id, note }];
    payout.status = to;
  }

  private async paginate(filter: Record<string, unknown>, query: { page?: number; limit?: number }, withVendor = false) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    let q = this.payouts.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit);
    if (withVendor) q = q.populate("vendorId", "storeName slug");
    const [data, total] = await Promise.all([q.lean(), this.payouts.countDocuments(filter)]);
    return { data, total, page, limit };
  }

  private oid(value: string): string {
    if (!isValidObjectId(value)) throw new NotFoundException("Not found");
    return value;
  }
}
