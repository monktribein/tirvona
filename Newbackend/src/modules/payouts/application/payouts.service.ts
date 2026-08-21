import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { createHash, randomUUID } from "node:crypto";
import type { ClientSession, Model } from "mongoose";
import { TransactionService } from "../../../common/database/transaction.service";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import {
  PAYOUT_LIMITS,
  PAYOUT_PROVIDER,
  type PayoutMode,
  type PayoutStatus,
} from "../domain/payout.constants";
import {
  mapProviderStatus,
  type PayoutProvider,
  type ProviderPayoutResult,
} from "../domain/payout.types";
import { PayoutProviderError } from "../errors/payout.errors";
import { BankAccountCrypto } from "../infrastructure/bank-account.crypto";
import type {
  CreatePayoutRequestDto,
  PayoutListQueryDto,
  RecordManualPayoutDto,
  SavePayoutBankAccountDto,
} from "../presentation/payout.dto";

const OWNER_ROLES = ["ashram_owner", "owner", "ashram_admin", "stay_admin"];
const roundMoney = (value: number): number => Math.round(value * 100) / 100;

@Injectable()
export class PayoutsService {
  private readonly logger = new Logger(PayoutsService.name);

  constructor(
    private readonly transactions: TransactionService,
    private readonly crypto: BankAccountCrypto,
    @Inject(PAYOUT_PROVIDER) private readonly provider: PayoutProvider,
    @InjectModel("Ashram") private readonly ashrams: Model<any>,
    @InjectModel("BookingCommission") private readonly commissions: Model<any>,
    @InjectModel("PayoutBankAccount") private readonly bankAccounts: Model<any>,
    @InjectModel("PayoutRequest") private readonly payouts: Model<any>,
    @InjectModel("PayoutTransaction") private readonly payoutTransactions: Model<any>,
    @InjectModel("PayoutAuditLog") private readonly audits: Model<any>,
    @InjectModel("PayoutWebhook") private readonly webhooks: Model<any>,
  ) {}

  private canViewGlobal(user: AuthenticatedUser): boolean {
    return (
      user.role === "super_admin" ||
      (user.role === "finance_manager" && user.permissions.includes("payouts.view_all"))
    );
  }

  private assertOwnerRole(user: AuthenticatedUser): void {
    if (!OWNER_ROLES.includes(user.role) && user.role !== "super_admin")
      throw new ForbiddenException("Not authorized for payout management");
  }

  private assertRequester(user: AuthenticatedUser): void {
    if (!OWNER_ROLES.includes(user.role))
      throw new ForbiddenException(
        "Only an Ashram Owner or Ashram Admin can manage payout accounts and requests",
      );
  }

  private async scopedAshramIds(user: AuthenticatedUser): Promise<string[] | null> {
    if (this.canViewGlobal(user)) return null;
    this.assertOwnerRole(user);
    const explicit = [
      ...(user.scopedAshramIds ?? []),
      ...(user.employerAshramId ? [user.employerAshramId] : []),
    ];
    const owned = await this.ashrams
      .find({ ownerId: user.id, deletedAt: null })
      .distinct("_id");
    return [...new Set([...explicit, ...owned.map(String)])];
  }

  private async scopedAshram(user: AuthenticatedUser, ashramId: string): Promise<any> {
    const ashram = await this.ashrams.findOne({ _id: ashramId, deletedAt: null }).lean();
    if (!ashram) throw new NotFoundException("Ashram not found");
    const scope = await this.scopedAshramIds(user);
    if (scope !== null && !scope.includes(String(ashram._id)))
      throw new ForbiddenException("You do not have payout access to this ashram");
    return ashram;
  }

  private objectId(id: string): any {
    return this.payouts.db.base.Types.ObjectId.createFromHexString(id);
  }

  private async availableBalance(ashramId: string, session?: ClientSession): Promise<number> {
    const aggregate = this.commissions.aggregate([
      {
        $match: {
          ashramId: this.objectId(ashramId),
          settlementStatus: "pending",
        },
      },
      {
        $group: {
          _id: null,
          amount: {
            $sum: {
              $max: [
                { $subtract: ["$ownerEarning", { $ifNull: ["$taxWithheld", 0] }] },
                0,
              ],
            },
          },
        },
      },
    ]);
    if (session) aggregate.session(session);
    const [row] = await aggregate;
    return roundMoney(Number(row?.amount ?? 0));
  }

  async summary(user: AuthenticatedUser, ashramId?: string): Promise<any> {
    const scope = await this.scopedAshramIds(user);
    if (ashramId) await this.scopedAshram(user, ashramId);
    const ids = ashramId ? [ashramId] : scope;
    const match = ids === null ? {} : { ashramId: { $in: ids.map((id) => this.objectId(id)) } };
    const [balances, states] = await Promise.all([
      this.commissions.aggregate([
        { $match: { ...match, settlementStatus: "pending" } },
        {
          $group: {
            _id: null,
            available: {
              $sum: {
                $max: [
                  { $subtract: ["$ownerEarning", { $ifNull: ["$taxWithheld", 0] }] },
                  0,
                ],
              },
            },
          },
        },
      ]),
      this.payouts.aggregate([
        { $match: match },
        { $group: { _id: "$status", amount: { $sum: "$amount" }, count: { $sum: 1 } } },
      ]),
    ]);
    const byStatus = Object.fromEntries(
      states.map((row: any) => [row._id, { amount: roundMoney(row.amount), count: row.count }]),
    );
    return {
      available: roundMoney(Number(balances[0]?.available ?? 0)),
      pending: byStatus.pending ?? { amount: 0, count: 0 },
      processing: byStatus.processing ?? { amount: 0, count: 0 },
      paid: byStatus.paid ?? { amount: 0, count: 0 },
      failed: byStatus.failed ?? { amount: 0, count: 0 },
    };
  }

  async availableAshrams(user: AuthenticatedUser): Promise<any[]> {
    const scope = await this.scopedAshramIds(user);
    return this.ashrams
      .find({
        deletedAt: null,
        ...(scope === null ? {} : { _id: { $in: scope } }),
      })
      .select("name ashramCode ownerId")
      .sort({ name: 1 })
      .lean();
  }

  async list(user: AuthenticatedUser, query: PayoutListQueryDto): Promise<any> {
    const scope = await this.scopedAshramIds(user);
    if (query.ashramId) await this.scopedAshram(user, query.ashramId);
    const filter: any = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.ownerId && this.canViewGlobal(user) ? { ownerId: query.ownerId } : {}),
    };
    if (query.ashramId) filter.ashramId = query.ashramId;
    else if (scope !== null) filter.ashramId = { $in: scope };
    const [rows, total] = await Promise.all([
      this.payouts
        .find(filter)
        .select("-providerIdempotencyKey")
        .populate("ashramId", "name ashramCode")
        .populate("ownerId", "name email phone")
        .populate(
          "bankAccountId",
          "accountHolderName accountNumberLast4 ifscPrefix beneficiaryEmail beneficiaryPhone active updatedAt",
        )
        .sort({ createdAt: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean(),
      this.payouts.countDocuments(filter),
    ]);
    return {
      rows: rows.map((row: any) => this.withMaskedBeneficiary(row)),
      total,
      page: query.page,
      limit: query.limit,
      pages: Math.ceil(total / query.limit),
    };
  }

  async get(user: AuthenticatedUser, id: string): Promise<any> {
    const row = await this.payouts
      .findById(id)
      .select("-providerIdempotencyKey")
      .populate("ashramId", "name ashramCode")
      .populate("ownerId", "name email phone")
      .populate(
        "bankAccountId",
        "accountHolderName accountNumberLast4 ifscPrefix beneficiaryEmail beneficiaryPhone active updatedAt",
      )
      .lean();
    if (!row) throw new NotFoundException("Payout not found");
    await this.scopedAshram(user, String(row.ashramId?._id ?? row.ashramId));
    const audit = await this.audits
      .find({ payoutId: id })
      .select("action occurredAt actorId before after")
      .sort({ occurredAt: -1 })
      .lean();
    return { ...this.withMaskedBeneficiary(row), audit };
  }

  async getBankAccount(user: AuthenticatedUser, ashramId: string): Promise<any> {
    const ashram = await this.scopedAshram(user, ashramId);
    const row = await this.bankAccounts
      .findOne({ ownerId: ashram.ownerId, active: true })
      .select("accountHolderName accountNumberLast4 ifscPrefix beneficiaryEmail beneficiaryPhone active updatedAt")
      .lean();
    return row ? this.maskBank(row) : null;
  }

  async bankAccountCoverage(user: AuthenticatedUser): Promise<any[]> {
    const ashrams = await this.availableAshrams(user);
    const ownerIds = [...new Set(ashrams.map((row: any) => String(row.ownerId)))];
    const accounts = await this.bankAccounts
      .find({ ownerId: { $in: ownerIds }, active: true })
      .select("ownerId accountHolderName accountNumberLast4 ifscPrefix beneficiaryEmail beneficiaryPhone active updatedAt")
      .lean();
    const byOwner = new Map(
      accounts.map((row: any) => [String(row.ownerId), this.maskBank(row)]),
    );
    return ashrams.map((ashram: any) => ({
      ashram: {
        _id: ashram._id,
        name: ashram.name,
        ashramCode: ashram.ashramCode,
      },
      bankAccount: byOwner.get(String(ashram.ownerId)) ?? null,
    }));
  }

  async saveBankAccount(
    user: AuthenticatedUser,
    ashramId: string,
    dto: SavePayoutBankAccountDto,
  ): Promise<any> {
    this.assertRequester(user);
    const ashram = await this.scopedAshram(user, ashramId);
    if (dto.accountNumber !== dto.confirmAccountNumber)
      throw new BadRequestException("Bank account numbers do not match");
    const activePayout = await this.payouts.exists({
      ownerId: ashram.ownerId,
      status: { $in: ["pending", "processing"] },
    });
    if (activePayout)
      throw new ConflictException("Bank details cannot change while a payout is pending or processing");
    const encrypted = this.crypto.encrypt(dto.accountNumber);
    const payload = {
      ownerId: ashram.ownerId,
      accountHolderName: dto.accountHolderName.trim(),
      accountNumberCiphertext: encrypted.ciphertext,
      accountNumberIv: encrypted.iv,
      accountNumberTag: encrypted.tag,
      accountNumberLast4: dto.accountNumber.slice(-4),
      accountFingerprint: this.crypto.fingerprint(dto.accountNumber, dto.ifsc),
      ifsc: dto.ifsc,
      ifscPrefix: dto.ifsc.slice(0, 4),
      beneficiaryEmail: dto.beneficiaryEmail?.toLowerCase(),
      beneficiaryPhone: dto.beneficiaryPhone,
      providerContactId: null,
      providerFundAccountId: null,
      active: true,
      updatedBy: user.id,
    };
    const row = await this.transactions.run(async (session) => {
      await this.bankAccounts.updateMany(
        { ownerId: ashram.ownerId, active: true },
        { $set: { active: false, updatedBy: user.id } },
        { session },
      );
      const [created] = await this.bankAccounts.create(
        [{ ...payload, ashramId, createdBy: user.id }],
        { session },
      );
      await this.audits.create([{
        bankAccountId: created._id,
        ashramId,
        actorId: user.id,
        action: "PAYOUT_BANK_ACCOUNT_SAVED",
        after: {
          accountNumberLast4: created.accountNumberLast4,
          ifscPrefix: created.ifscPrefix,
        },
      }], { session });
      return created;
    });
    return this.maskBank(row.toObject());
  }

  async createRequest(user: AuthenticatedUser, dto: CreatePayoutRequestDto): Promise<any> {
    this.assertRequester(user);
    const ashram = await this.scopedAshram(user, dto.ashramId);
    const duplicate = await this.payouts.findOne({
      requestedBy: user.id,
      clientRequestId: dto.clientRequestId,
    });
    if (duplicate) {
      if (String(duplicate.ashramId) !== dto.ashramId || Number(duplicate.amount) !== dto.amount)
        throw new ConflictException("The request id was already used for another payout");
      return duplicate;
    }
    const bank = await this.bankAccounts.exists({ ownerId: ashram.ownerId, active: true });
    if (!bank) throw new BadRequestException("Add a verified payout bank account first");
    this.validateMode(dto.amount, dto.mode);

    try {
      return await this.transactions.run(async (session) => {
      const available = await this.availableBalance(dto.ashramId, session);
      const amount = roundMoney(dto.amount);
      if (amount < PAYOUT_LIMITS.minimumRupees || amount > PAYOUT_LIMITS.maximumRupees)
        throw new BadRequestException("Payout amount is outside the allowed limits");
      if (amount !== available)
        throw new BadRequestException(`Payout amount must equal the available balance of ₹${available.toFixed(2)}`);
      const commissions = await this.commissions
        .find({ ashramId: dto.ashramId, settlementStatus: "pending" })
        .select("_id")
        .session(session)
        .lean();
      if (!commissions.length) throw new BadRequestException("No eligible payout balance is available");
      const reference = `PO-${randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase()}`;
      const [payout] = await this.payouts.create(
        [{
          payoutReference: reference,
          ashramId: dto.ashramId,
          ownerId: ashram.ownerId,
          bankAccountId: bank._id,
          commissionIds: commissions.map((row: any) => row._id),
          amount,
          mode: (dto.mode ?? this.defaultMode(amount)) as PayoutMode,
          status: "pending",
          clientRequestId: dto.clientRequestId,
          providerIdempotencyKey: randomUUID(),
          requestedBy: user.id,
        }],
        { session },
      );
      const reserved = await this.commissions.updateMany(
        { _id: { $in: commissions.map((row: any) => row._id) }, settlementStatus: "pending" },
        { $set: { settlementStatus: "processing", payoutId: payout._id } },
        { session },
      );
      if (reserved.modifiedCount !== commissions.length)
        throw new ConflictException("The payout balance changed; refresh and try again");
      await this.audits.create([{
        payoutId: payout._id,
        ashramId: dto.ashramId,
        actorId: user.id,
        action: "PAYOUT_REQUESTED",
        after: { status: "pending", amount, mode: payout.mode },
      }], { session });
      await this.payoutTransactions.create([{
        payoutId: payout._id,
        ashramId: dto.ashramId,
        ownerId: ashram.ownerId,
        type: "reservation",
        amount,
        status: "pending",
      }], { session });
        return payout;
      });
    } catch (error: any) {
      if (error?.code !== 11000) throw error;
      const existing = await this.payouts.findOne({
        requestedBy: user.id,
        clientRequestId: dto.clientRequestId,
      });
      if (
        existing &&
        String(existing.ashramId) === dto.ashramId &&
        Number(existing.amount) === roundMoney(dto.amount)
      )
        return existing;
      throw new ConflictException("This payout request has already been submitted");
    }
  }

  providerStatus(user: AuthenticatedUser): { ready: boolean; provider: string } {
    this.assertProcessor(user);
    return { ready: this.provider.isConfigured(), provider: "razorpayx" };
  }

  async revealManualBankDetails(
    user: AuthenticatedUser,
    id: string,
    reason: string,
  ): Promise<any> {
    this.assertProcessor(user);
    const payout = await this.payouts
      .findOne({
        _id: id,
        status: "pending",
        providerPayoutId: { $in: [null, ""] },
      })
      .select("payoutReference ashramId ownerId bankAccountId amount currency status")
      .lean();
    if (!payout)
      throw new ConflictException(
        "Bank details can be revealed only for a pending payout not submitted to RazorpayX",
      );
    const bank = await this.bankAccounts
      .findById(payout.bankAccountId)
      .select(
        "accountHolderName +accountNumberCiphertext +accountNumberIv +accountNumberTag +ifsc beneficiaryEmail beneficiaryPhone active",
      )
      .lean();
    if (!bank?.active)
      throw new BadRequestException("The payout beneficiary account is unavailable");
    const accountNumber = this.crypto.decrypt({
      ciphertext: bank.accountNumberCiphertext,
      iv: bank.accountNumberIv,
      tag: bank.accountNumberTag,
    });
    await this.audits.create({
      payoutId: payout._id,
      bankAccountId: bank._id,
      ashramId: payout.ashramId,
      actorId: user.id,
      action: "PAYOUT_BANK_DETAILS_REVEALED",
      after: {
        reason: reason.trim(),
        payoutReference: payout.payoutReference,
      },
    });
    this.logger.warn(
      JSON.stringify({
        event: "payout.bank_details_revealed",
        payoutId: String(payout._id),
        ashramId: String(payout.ashramId),
        actorId: user.id,
      }),
    );
    return {
      payoutId: String(payout._id),
      payoutReference: payout.payoutReference,
      amount: Number(payout.amount),
      currency: payout.currency ?? "INR",
      accountHolderName: bank.accountHolderName,
      accountNumber,
      ifsc: bank.ifsc,
    };
  }

  async recordManualPayment(
    user: AuthenticatedUser,
    id: string,
    dto: RecordManualPayoutDto,
  ): Promise<any> {
    this.assertProcessor(user);
    if (dto.confirmed !== true)
      throw new BadRequestException("Manual payment confirmation is required");
    const recentReveal = await this.audits
      .findOne({
        payoutId: id,
        actorId: user.id,
        action: "PAYOUT_BANK_DETAILS_REVEALED",
        occurredAt: { $gte: new Date(Date.now() - 10 * 60 * 1000) },
      })
      .select("_id")
      .lean();
    if (!recentReveal)
      throw new ForbiddenException(
        "Reveal and review the beneficiary bank details before recording manual payment",
      );
    const transferReference = dto.transferReference.trim().toUpperCase();
    const idempotencyHash = createHash("sha256")
      .update(`${user.id}:${dto.clientRequestId}`)
      .digest("hex");
    const replay = await this.payouts
      .findOne({ manualPaymentIdempotencyKeyHash: idempotencyHash })
      .select("+manualPaymentIdempotencyKeyHash");
    if (replay) {
      if (
        String(replay._id) === id &&
        replay.status === "paid" &&
        replay.manualPaymentReference === transferReference
      )
        return replay;
      throw new ConflictException("This manual-payment request has already been used");
    }

    try {
      return await this.transactions.run(async (session) => {
      const payout = await this.payouts
        .findById(id)
        .select("+providerIdempotencyKey +manualPaymentIdempotencyKeyHash")
        .session(session);
      if (!payout) throw new NotFoundException("Payout not found");
      if (
        payout.status !== "pending" ||
        payout.providerPayoutId ||
        payout.settlementMethod === "manual_bank_transfer"
      )
        throw new ConflictException(
          "Only a pending payout not submitted to RazorpayX can be paid manually",
        );
      const duplicateReference = await this.payouts
        .findOne({
          _id: { $ne: payout._id },
          manualPaymentReference: transferReference,
        })
        .session(session)
        .lean();
      if (duplicateReference)
        throw new ConflictException("This bank transfer reference is already recorded");

      const previous = payout.status;
      payout.status = "paid";
      payout.provider = "manual";
      payout.providerStatus = "paid_manually";
      payout.providerUtr = transferReference;
      payout.settlementMethod = "manual_bank_transfer";
      payout.manualPaymentReference = transferReference;
      payout.manualPaymentIdempotencyKeyHash = idempotencyHash;
      payout.manualPaymentNote = dto.note?.trim();
      payout.processedBy = user.id;
      payout.processingAt ??= new Date();
      payout.paidAt = new Date();
      payout.failureReason = undefined;
      await payout.save({ session });
      const settled = await this.commissions.updateMany(
        { payoutId: payout._id, settlementStatus: "processing" },
        { $set: { settlementStatus: "settled" } },
        { session },
      );
      if (
        !payout.commissionIds?.length ||
        settled.matchedCount !== payout.commissionIds.length
      )
        throw new ConflictException(
          "Reserved payout commissions changed; refresh before recording payment",
        );
      await this.audits.create(
        [
          {
            payoutId: payout._id,
            ashramId: payout.ashramId,
            actorId: user.id,
            action: "PAYOUT_MANUALLY_PAID",
            before: { status: previous },
            after: {
              status: "paid",
              settlementMethod: "manual_bank_transfer",
              transferReference,
            },
          },
        ],
        { session },
      );
      await this.payoutTransactions.create(
        [
          {
            payoutId: payout._id,
            ashramId: payout.ashramId,
            ownerId: payout.ownerId,
            type: "manual_bank_transfer",
            amount: payout.amount,
            status: "paid",
            idempotencyKeyHash: idempotencyHash,
            details: { transferReference },
          },
        ],
        { session },
      );
      this.logger.log(
        JSON.stringify({
          event: "payout.manual_payment_recorded",
          payoutId: String(payout._id),
          ashramId: String(payout.ashramId),
          actorId: user.id,
          status: "paid",
        }),
      );
        return payout;
      });
    } catch (error: any) {
      if (error?.code === 11000)
        throw new ConflictException(
          "This bank transfer reference or manual-payment request is already recorded",
        );
      throw error;
    }
  }

  async process(user: AuthenticatedUser, id: string): Promise<any> {
    this.assertProcessor(user);
    const payout = await this.payouts
      .findOne({ _id: id, status: { $in: ["pending", "processing"] } })
      .select("+providerIdempotencyKey");
    if (!payout) throw new NotFoundException("Processable payout not found");
    if (payout.providerPayoutId)
      return this.reconcileOne(id, user.id);
    payout.status = "processing";
    payout.processingAt ??= new Date();
    payout.processedBy = user.id;
    await payout.save();
    await this.auditStatus(payout, user.id, "PAYOUT_PROCESSING", "pending", "processing");
    try {
      const bank = await this.bankAccounts
        .findById(payout.bankAccountId)
        .select("+accountNumberCiphertext +accountNumberIv +accountNumberTag +ifsc +providerContactId +providerFundAccountId");
      if (!bank) throw new PayoutProviderError("Payout bank account is unavailable", false);
      const accountNumber = this.crypto.decrypt({
        ciphertext: bank.accountNumberCiphertext,
        iv: bank.accountNumberIv,
        tag: bank.accountNumberTag,
      });
      const beneficiary = {
        name: bank.accountHolderName,
        email: bank.beneficiaryEmail,
        phone: bank.beneficiaryPhone,
        accountNumber,
        ifsc: bank.ifsc,
        referenceId: `ASHRAM-${String(payout.ashramId)}`.slice(0, 40),
      };
      if (!bank.providerContactId) {
        bank.providerContactId = await this.provider.createContact(beneficiary);
        await bank.save();
      }
      if (!bank.providerFundAccountId) {
        bank.providerFundAccountId = await this.provider.createFundAccount(
          bank.providerContactId,
          beneficiary,
        );
        await bank.save();
      }
      const result = await this.provider.createPayout({
        fundAccountId: bank.providerFundAccountId,
        amountPaise: Math.round(Number(payout.amount) * 100),
        mode: payout.mode,
        referenceId: payout.payoutReference,
        idempotencyKey: payout.providerIdempotencyKey,
      });
      return this.applyProviderResult(payout, result, user.id, "provider_response");
    } catch (error) {
      const providerError =
        error instanceof PayoutProviderError
          ? error
          : new PayoutProviderError("Payout processing failed", false);
      if (providerError.retryable) {
        payout.failureReason = providerError.message;
        await payout.save();
        await this.recordTransaction(payout, "provider_error", "processing");
        throw new ServiceUnavailableException(
          "Payout status is uncertain and will be reconciled safely using the same idempotency key",
        );
      }
      await this.failAndRelease(payout, providerError.message, user.id);
      throw new BadRequestException(providerError.message);
    }
  }

  async reconcile(user: AuthenticatedUser, id: string): Promise<any> {
    this.assertProcessor(user);
    return this.reconcileOne(id, user.id);
  }

  async reconcileOne(id: string, actorId?: string): Promise<any> {
    const payout = await this.payouts
      .findOne({ _id: id, status: { $in: ["pending", "processing"] }, providerPayoutId: { $ne: null } })
      .select("+providerIdempotencyKey");
    if (!payout) throw new NotFoundException("Reconcilable payout not found");
    const result = await this.provider.fetchPayout(payout.providerPayoutId);
    payout.lastReconciledAt = new Date();
    return this.applyProviderResult(payout, result, actorId, "reconciliation");
  }

  async reconciliationCandidates(): Promise<string[]> {
    const rows = await this.payouts
      .find({ status: { $in: ["pending", "processing"] }, providerPayoutId: { $ne: null } })
      .select("_id")
      .sort({ lastReconciledAt: 1 })
      .limit(50)
      .lean();
    return rows.map((row: any) => String(row._id));
  }

  verifyWebhook(rawBody: Buffer, signature: string): void {
    if (!this.provider.verifyWebhook(rawBody, signature))
      throw new UnauthorizedException("Invalid RazorpayX webhook signature");
  }

  async handleWebhook(eventId: string, eventType: string, payload: any): Promise<void> {
    if (!eventId) throw new BadRequestException("Missing RazorpayX event id");
    let event: any;
    try {
      event = await this.webhooks.create({
        eventId,
        eventType,
        providerPayoutId: payload?.payload?.payout?.entity?.id,
        status: "received",
      });
    } catch (error: any) {
      if (error?.code === 11000) return;
      throw error;
    }
    try {
      const providerEntity = payload?.payload?.payout?.entity;
      const payout = providerEntity?.id
        ? await this.payouts.findOne({ providerPayoutId: providerEntity.id }).select("+providerIdempotencyKey")
        : null;
      if (!payout) {
        event.status = "ignored";
      } else {
        await this.applyProviderResult(
          payout,
          {
            id: providerEntity.id,
            status: providerEntity.status,
            utr: providerEntity.utr,
            failureReason: providerEntity.status_details?.description,
          },
          undefined,
          `webhook:${eventType}`,
        );
        event.status = "processed";
      }
      event.processedAt = new Date();
      await event.save();
    } catch (error) {
      event.status = "failed";
      event.error = error instanceof Error ? error.message : "Webhook processing failed";
      await event.save();
      throw error;
    }
  }

  private async applyProviderResult(
    payout: any,
    result: ProviderPayoutResult,
    actorId: string | undefined,
    source: string,
  ): Promise<any> {
    const next = mapProviderStatus(result.status);
    const previous = payout.status as PayoutStatus;
    if (previous === "failed")
      return this.finalizeTerminal(payout, "failed", result, actorId, source);
    if (previous === "paid" && next !== "failed")
      return this.finalizeTerminal(payout, "paid", result, actorId, source);
    payout.providerPayoutId = result.id || payout.providerPayoutId;
    payout.providerStatus = result.status;
    payout.providerUtr = result.utr || payout.providerUtr;
    payout.failureReason = result.failureReason;
    payout.lastReconciledAt = new Date();
    if (next === "paid" || next === "failed")
      return this.finalizeTerminal(payout, next, result, actorId, source);
    else {
      payout.status = next;
      await payout.save();
    }
    await this.auditStatus(payout, actorId, "PAYOUT_STATUS_RECONCILED", previous, payout.status, source);
    await this.recordTransaction(payout, source, payout.status);
    this.logger.log(JSON.stringify({
      event: "payout.status_updated",
      payoutId: String(payout._id),
      ashramId: String(payout.ashramId),
      status: payout.status,
      providerStatus: result.status,
    }));
    return payout;
  }

  private async failAndRelease(payout: any, reason: string, actorId?: string): Promise<any> {
    return this.finalizeTerminal(
      payout,
      "failed",
      {
        id: payout.providerPayoutId ?? "",
        status: "failed",
        failureReason: reason,
      },
      actorId,
      "failure",
    );
  }

  private async finalizeTerminal(
    payout: any,
    status: "paid" | "failed",
    result: ProviderPayoutResult,
    actorId: string | undefined,
    source: string,
  ): Promise<any> {
    return this.transactions.run(async (session) => {
      const current = await this.payouts
        .findById(payout._id)
        .select("+providerIdempotencyKey")
        .session(session);
      if (!current) throw new NotFoundException("Payout not found");
      const previous = current.status;
      current.providerPayoutId = result.id || current.providerPayoutId;
      current.providerStatus = result.status || current.providerStatus;
      current.providerUtr = result.utr || current.providerUtr;
      current.lastReconciledAt = new Date();
      current.status = status;
      if (status === "paid") {
        current.paidAt ??= new Date();
        current.failureReason = undefined;
      } else {
        current.failedAt ??= new Date();
        current.failureReason = result.failureReason || "RazorpayX payout failed";
      }
      await current.save({ session });
      await this.commissions.updateMany(
        { payoutId: current._id },
        status === "paid"
          ? { $set: { settlementStatus: "settled" } }
          : { $set: { settlementStatus: "pending", payoutId: null } },
        { session },
      );
      if (previous !== status) {
        await this.audits.create([{
          payoutId: current._id,
          ashramId: current.ashramId,
          actorId: actorId || null,
          action: status === "paid" ? "PAYOUT_PAID" : "PAYOUT_FAILED",
          before: { status: previous },
          after: { status, source },
        }], { session });
        await this.payoutTransactions.create([{
          payoutId: current._id,
          ashramId: current.ashramId,
          ownerId: current.ownerId,
          type: source,
          amount: current.amount,
          status,
          providerPayoutId: current.providerPayoutId,
          idempotencyKeyHash: current.providerIdempotencyKey
            ? createHash("sha256").update(current.providerIdempotencyKey).digest("hex")
            : undefined,
        }], { session });
      }
      this.logger.log(JSON.stringify({
        event: "payout.status_updated",
        payoutId: String(current._id),
        ashramId: String(current.ashramId),
        status,
        providerStatus: result.status,
      }));
      return current;
    });
  }

  private validateMode(amount: number, mode?: string): void {
    if (mode === "IMPS" && amount > PAYOUT_LIMITS.impsMaximumRupees)
      throw new BadRequestException("IMPS payouts cannot exceed ₹5,00,000");
    if (mode === "RTGS" && amount < PAYOUT_LIMITS.rtgsMinimumRupees)
      throw new BadRequestException("RTGS payouts must be at least ₹2,00,000");
  }

  private defaultMode(amount: number): PayoutMode {
    return amount <= PAYOUT_LIMITS.impsMaximumRupees ? "IMPS" : "NEFT";
  }

  private assertProcessor(user: AuthenticatedUser): void {
    if (user.role !== "super_admin")
      throw new ForbiddenException("Only a Super Admin can process payouts");
  }

  private withMaskedBeneficiary(row: any): any {
    const populated =
      row?.bankAccountId && typeof row.bankAccountId === "object"
        ? row.bankAccountId
        : null;
    return {
      ...row,
      bankAccountId: populated?._id ?? row?.bankAccountId,
      beneficiary: populated ? this.maskBank(populated) : null,
    };
  }

  private maskBank(row: any): any {
    return {
      _id: row._id,
      accountHolderName: row.accountHolderName,
      maskedAccountNumber: `••••${row.accountNumberLast4}`,
      maskedIfsc: `${row.ifscPrefix}0••••••`,
      beneficiaryEmail: this.maskEmail(row.beneficiaryEmail),
      beneficiaryPhone: row.beneficiaryPhone
        ? `${String(row.beneficiaryPhone).slice(0, 2)}••••••${String(row.beneficiaryPhone).slice(-2)}`
        : undefined,
      active: row.active,
      updatedAt: row.updatedAt,
    };
  }

  private maskEmail(value?: string): string | undefined {
    if (!value) return undefined;
    const [local, domain] = String(value).split("@");
    if (!domain) return undefined;
    return `${local.slice(0, Math.min(2, local.length))}•••@${domain}`;
  }

  private async auditStatus(
    payout: any,
    actorId: string | undefined,
    action: string,
    before: string,
    after: string,
    source?: string,
  ): Promise<void> {
    await this.audits.create({
      payoutId: payout._id,
      ashramId: payout.ashramId,
      actorId: actorId || null,
      action,
      before: { status: before },
      after: { status: after, source },
    });
  }

  private async recordTransaction(payout: any, type: string, status: string): Promise<void> {
    await this.payoutTransactions.create({
      payoutId: payout._id,
      ashramId: payout.ashramId,
      ownerId: payout.ownerId,
      type,
      amount: payout.amount,
      status,
      providerPayoutId: payout.providerPayoutId,
      idempotencyKeyHash: payout.providerIdempotencyKey
        ? createHash("sha256").update(payout.providerIdempotencyKey).digest("hex")
        : undefined,
    });
  }
}
