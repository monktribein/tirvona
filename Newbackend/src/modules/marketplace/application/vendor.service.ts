import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { isValidObjectId, type Model } from "mongoose";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import { uniqueSlug } from "../../../common/slug/slug.util";
import { escapeRegex } from "../../../common/utils/escape-regex";
import { BankAccountCrypto } from "../../payouts/infrastructure/bank-account.crypto";
import {
  AWAITING_APPROVAL_FILTER,
  AWAITING_APPROVAL_STATUSES,
  HIDDEN_STATUS,
  REQUIRED_VENDOR_DOCUMENTS,
  VISIBLE_STATUS,
  VENDOR_TRANSITIONS,
  assertTransition,
  type VendorStatus,
} from "../domain/marketplace.constants";
import type {
  AddBankAccountDto,
  AddVendorDocumentDto,
  CreateVendorProfileDto,
  UpdateVendorProfileDto,
} from "../presentation/marketplace.dto";
import { MarketplaceAuditService } from "./marketplace-audit.service";

/** Fields a vendor may not change after approval without re-verification. */
const LEGAL_FIELDS = ["legalBusinessName", "businessType", "gstin"] as const;
/** Fields hidden from the vendor's own and public views. */
const PRIVATE_VENDOR_FIELDS = "-payoutLockToken -payoutLockExpiresAt";

@Injectable()
export class VendorService {
  constructor(
    @InjectModel("MpVendor") private readonly vendors: Model<any>,
    @InjectModel("MpVendorDocument") private readonly documents: Model<any>,
    @InjectModel("MpVendorBankAccount") private readonly bankAccounts: Model<any>,
    @InjectModel("MpProduct") private readonly products: Model<any>,
    private readonly crypto: BankAccountCrypto,
    private readonly audit: MarketplaceAuditService,
  ) {}

  // ------------------------------------------------------------ ownership
  /** The caller's own vendor profile (document), or 404. */
  async requireOwnVendor(user: AuthenticatedUser): Promise<any> {
    const vendor = await this.vendors.findOne({ userId: user.id, deletedAt: null });
    if (!vendor) throw new NotFoundException("You have not created a vendor profile yet");
    return vendor;
  }

  /** Vendor must be ACTIVE to sell (submit products, receive orders, request payouts). */
  assertCanSell(vendor: any): void {
    if (vendor.status !== "active") {
      throw new ForbiddenException(
        vendor.status === "suspended"
          ? "Your store is suspended. Contact Tirvona support."
          : "Your store must be approved and activated before it can sell",
      );
    }
  }

  // ------------------------------------------------------------- profile
  async createProfile(user: AuthenticatedUser, dto: CreateVendorProfileDto): Promise<any> {
    if (await this.vendors.exists({ userId: user.id })) {
      throw new ConflictException("You already have a vendor profile");
    }
    const slug = await uniqueSlug(dto.storeName, {
      exists: async (s) => Boolean(await this.vendors.exists({ slug: s })),
      fallback: "store",
    });
    const vendor = await this.vendors.create({
      ...dto,
      userId: user.id,
      slug,
      contactEmail: dto.contactEmail ?? user.email,
      contactPhone: dto.contactPhone ?? user.phone,
      status: "draft",
    });
    await this.audit.log(user, "vendor.created", "MpVendor", vendor._id);
    return this.withoutPrivate(vendor);
  }

  /**
   * The caller's own store, or null when they have none. Not a 404: the site
   * header asks this for every signed-in user, and most of them are not sellers.
   */
  async getOwnProfile(user: AuthenticatedUser): Promise<any> {
    const vendor = await this.vendors.findOne({ userId: user.id, deletedAt: null });
    if (!vendor) return null;
    const [documents, bankAccounts] = await Promise.all([
      this.documents.find({ vendorId: vendor._id, deletedAt: null }).sort({ createdAt: -1 }).lean(),
      this.bankAccounts.find({ vendorId: vendor._id, deletedAt: null }).lean(),
    ]);
    return {
      ...this.withoutPrivate(vendor),
      documents,
      bankAccounts: bankAccounts.map((b: any) => this.maskedAccount(b)),
      missingDocuments: this.missingDocuments(documents),
    };
  }

  async updateOwnProfile(user: AuthenticatedUser, dto: UpdateVendorProfileDto): Promise<any> {
    const vendor = await this.requireOwnVendor(user);
    if (vendor.status === "deactivated") throw new ForbiddenException("This store is deactivated");
    const lockedLegal = !["draft", "rejected"].includes(vendor.status);
    for (const f of LEGAL_FIELDS) {
      if (lockedLegal && (dto as any)[f] !== undefined && (dto as any)[f] !== vendor[f]) {
        throw new BadRequestException(
          "Legal business details can only be changed before verification. Contact support to update them.",
        );
      }
    }
    Object.assign(vendor, dto);
    await vendor.save();
    await this.audit.log(user, "vendor.updated", "MpVendor", vendor._id, { fields: Object.keys(dto) });
    return this.withoutPrivate(vendor);
  }

  async submitForVerification(user: AuthenticatedUser): Promise<any> {
    const vendor = await this.requireOwnVendor(user);
    assertTransition(VENDOR_TRANSITIONS, vendor.status as VendorStatus, "pending_verification", "Vendor");
    // Documents, address and phone are optional; sellers can add them later.
    vendor.status = "pending_verification";
    vendor.verificationStatus = "pending";
    vendor.submittedAt = new Date();
    vendor.rejectionReason = undefined;
    await vendor.save();
    await this.audit.log(user, "vendor.submitted", "MpVendor", vendor._id);
    return this.withoutPrivate(vendor);
  }

  /** Legacy path for stores left in "approved": go live. A bank account is only needed for payouts. */
  async activate(user: AuthenticatedUser): Promise<any> {
    const vendor = await this.requireOwnVendor(user);
    if (vendor.status !== "approved") {
      throw new BadRequestException("Only an approved store can be activated");
    }
    vendor.status = "active";
    await vendor.save();
    await this.audit.log(user, "vendor.activated", "MpVendor", vendor._id);
    return this.withoutPrivate(vendor);
  }

  async deactivateOwn(user: AuthenticatedUser): Promise<any> {
    const vendor = await this.requireOwnVendor(user);
    assertTransition(VENDOR_TRANSITIONS, vendor.status as VendorStatus, "deactivated", "Vendor");
    vendor.status = "deactivated";
    vendor.deactivatedAt = new Date();
    await vendor.save();
    await this.hideAllProducts(vendor._id);
    await this.audit.log(user, "vendor.deactivated", "MpVendor", vendor._id);
    return this.withoutPrivate(vendor);
  }

  // ------------------------------------------------------------ documents
  async addDocument(user: AuthenticatedUser, dto: AddVendorDocumentDto): Promise<any> {
    const vendor = await this.requireOwnVendor(user);
    if (["suspended", "deactivated"].includes(vendor.status)) {
      throw new ForbiddenException("Documents cannot be changed on a suspended or deactivated store");
    }
    const doc = await this.documents.create({ ...dto, vendorId: vendor._id, status: "pending" });
    await this.audit.log(user, "vendor.document_added", "MpVendorDocument", doc._id, { type: dto.type });
    return doc;
  }

  async removeDocument(user: AuthenticatedUser, documentId: string): Promise<any> {
    const vendor = await this.requireOwnVendor(user);
    const doc = await this.documents.findOneAndUpdate(
      { _id: this.oid(documentId), vendorId: vendor._id, deletedAt: null, status: { $ne: "verified" } },
      { $set: { deletedAt: new Date() } },
      { new: true },
    );
    if (!doc) throw new NotFoundException("Document not found, or already verified");
    return { success: true };
  }

  // -------------------------------------------------------- bank accounts
  async addBankAccount(user: AuthenticatedUser, dto: AddBankAccountDto): Promise<any> {
    const vendor = await this.requireOwnVendor(user);
    if (["suspended", "deactivated"].includes(vendor.status)) {
      throw new ForbiddenException("Bank details cannot be changed on a suspended or deactivated store");
    }
    const accountNumber = dto.accountNumber.replace(/\s+/g, "");
    const fingerprint = this.crypto.fingerprint(accountNumber, dto.ifsc.toUpperCase());
    if (await this.bankAccounts.exists({ vendorId: vendor._id, fingerprint, deletedAt: null })) {
      throw new ConflictException("This bank account is already added");
    }
    const isFirst = !(await this.bankAccounts.exists({ vendorId: vendor._id, deletedAt: null }));
    if (dto.isDefault && !isFirst) {
      await this.bankAccounts.updateMany({ vendorId: vendor._id }, { $set: { isDefault: false } });
    }
    const account = await this.bankAccounts.create({
      vendorId: vendor._id,
      accountHolderName: dto.accountHolderName,
      bankName: dto.bankName,
      ifsc: dto.ifsc.toUpperCase(),
      accountNumberEncrypted: this.crypto.encrypt(accountNumber),
      accountNumberLast4: accountNumber.slice(-4),
      fingerprint,
      isDefault: isFirst || Boolean(dto.isDefault),
      verificationStatus: "pending",
    });
    await this.audit.log(user, "vendor.bank_added", "MpVendorBankAccount", account._id, {
      last4: account.accountNumberLast4,
    });
    return this.maskedAccount(account);
  }

  async listBankAccounts(user: AuthenticatedUser): Promise<any[]> {
    const vendor = await this.requireOwnVendor(user);
    const rows = await this.bankAccounts.find({ vendorId: vendor._id, deletedAt: null }).lean();
    return rows.map((r) => this.maskedAccount(r));
  }

  async setDefaultBankAccount(user: AuthenticatedUser, accountId: string): Promise<any> {
    const vendor = await this.requireOwnVendor(user);
    const account = await this.bankAccounts.findOne({ _id: this.oid(accountId), vendorId: vendor._id, deletedAt: null });
    if (!account) throw new NotFoundException("Bank account not found");
    await this.bankAccounts.updateMany({ vendorId: vendor._id }, { $set: { isDefault: false } });
    account.isDefault = true;
    await account.save();
    await this.audit.log(user, "vendor.bank_default_changed", "MpVendorBankAccount", account._id);
    return this.maskedAccount(account);
  }

  async removeBankAccount(user: AuthenticatedUser, accountId: string): Promise<any> {
    const vendor = await this.requireOwnVendor(user);
    const account = await this.bankAccounts.findOne({ _id: this.oid(accountId), vendorId: vendor._id, deletedAt: null });
    if (!account) throw new NotFoundException("Bank account not found");
    const others = await this.bankAccounts.countDocuments({ vendorId: vendor._id, deletedAt: null, _id: { $ne: account._id } });
    if (vendor.status === "active" && others === 0) {
      throw new BadRequestException("An active store must keep at least one bank account");
    }
    account.deletedAt = new Date();
    account.isDefault = false;
    await account.save();
    if (others > 0 && !(await this.bankAccounts.exists({ vendorId: vendor._id, deletedAt: null, isDefault: true }))) {
      await this.bankAccounts.updateOne({ vendorId: vendor._id, deletedAt: null }, { $set: { isDefault: true } });
    }
    await this.audit.log(user, "vendor.bank_removed", "MpVendorBankAccount", account._id);
    return { success: true };
  }

  // ---------------------------------------------------------------- admin
  async adminList(query: { status?: string; search?: string; page?: number; limit?: number }): Promise<any> {
    const filter: Record<string, any> = { deletedAt: null };
    if (query.status === AWAITING_APPROVAL_FILTER) filter.status = { $in: AWAITING_APPROVAL_STATUSES };
    else if (query.status) filter.status = query.status;
    if (query.search) {
      const term = escapeRegex(String(query.search).slice(0, 80));
      filter.$or = [
        { storeName: { $regex: term, $options: "i" } },
        { legalBusinessName: { $regex: term, $options: "i" } },
        { slug: { $regex: term, $options: "i" } },
      ];
    }
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const [data, total] = await Promise.all([
      this.vendors
        .find(filter)
        .select(PRIVATE_VENDOR_FIELDS)
        .populate("userId", "name email phone")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.vendors.countDocuments(filter),
    ]);
    return { data, total, page, limit };
  }

  async adminGet(vendorId: string): Promise<any> {
    const vendor = await this.vendors
      .findById(this.oid(vendorId))
      .select(PRIVATE_VENDOR_FIELDS)
      .populate("userId", "name email phone")
      .lean();
    if (!vendor) throw new NotFoundException("Vendor not found");
    const [documents, bankAccounts, productCounts] = await Promise.all([
      this.documents.find({ vendorId: vendor._id, deletedAt: null }).sort({ createdAt: -1 }).lean(),
      this.bankAccounts.find({ vendorId: vendor._id, deletedAt: null }).lean(),
      this.products.aggregate([
        { $match: { vendorId: vendor._id, deletedAt: null } },
        { $group: { _id: "$approvalStatus", count: { $sum: 1 } } },
      ]),
    ]);
    return {
      ...vendor,
      documents,
      bankAccounts: bankAccounts.map((b: any) => this.maskedAccount(b)),
      productCounts: Object.fromEntries(productCounts.map((p: any) => [p._id, p.count])),
    };
  }

  async adminSetStatus(
    actor: AuthenticatedUser,
    vendorId: string,
    action: "start_review" | "approve" | "reject" | "suspend" | "reactivate",
    reason?: string,
  ): Promise<any> {
    const vendor = await this.vendors.findById(this.oid(vendorId));
    if (!vendor) throw new NotFoundException("Vendor not found");
    const from = vendor.status as VendorStatus;
    const to: VendorStatus = {
      start_review: "under_review",
      approve: "active", // approval puts the shop live immediately
      reject: "rejected",
      suspend: "suspended",
      reactivate: "active",
    }[action] as VendorStatus;
    // "approve" targets "active", which suspended/active stores can also reach; those use "reactivate".
    if (action === "approve" && ["active", "suspended", "deactivated"].includes(from)) {
      throw new BadRequestException(`Vendor cannot move from ${from} to approved`);
    }
    assertTransition(VENDOR_TRANSITIONS, from, to, "Vendor");
    if ((action === "reject" || action === "suspend") && !reason?.trim()) {
      throw new BadRequestException("A reason is required");
    }

    vendor.status = to;
    if (action === "approve") {
      vendor.verificationStatus = "verified";
      vendor.approvedAt = new Date();
      vendor.approvedBy = actor.id;
      vendor.rejectionReason = undefined;
    } else if (action === "reject") {
      vendor.verificationStatus = "rejected";
      vendor.rejectionReason = reason;
    } else if (action === "suspend") {
      vendor.suspendedAt = new Date();
      vendor.suspendedBy = actor.id;
      vendor.suspensionReason = reason;
    } else if (action === "reactivate") {
      vendor.suspendedAt = undefined;
      vendor.suspensionReason = undefined;
    }
    await vendor.save();

    if (action === "suspend") await this.hideAllProducts(vendor._id);
    if (action === "reactivate" || action === "approve") await this.restoreProductVisibility(vendor._id);

    await this.audit.log(actor, `vendor.${action}`, "MpVendor", vendor._id, { from, to, reason });
    return this.withoutPrivate(vendor);
  }

  async adminSetCommission(actor: AuthenticatedUser, vendorId: string, percent: number | null): Promise<any> {
    if (percent !== null && (!(percent >= 0) || percent > 100)) {
      throw new BadRequestException("Commission must be between 0 and 100, or null to use the default");
    }
    const vendor = await this.vendors.findById(this.oid(vendorId));
    if (!vendor) throw new NotFoundException("Vendor not found");
    const before = vendor.commissionPercent ?? null;
    vendor.commissionPercent = percent;
    await vendor.save();
    await this.audit.log(actor, "vendor.commission_changed", "MpVendor", vendor._id, { before, after: percent });
    return this.withoutPrivate(vendor);
  }

  async adminReviewDocument(
    actor: AuthenticatedUser,
    documentId: string,
    status: "verified" | "rejected",
    note?: string,
  ): Promise<any> {
    if (status === "rejected" && !note?.trim()) throw new BadRequestException("A note is required when rejecting");
    const doc = await this.documents.findOneAndUpdate(
      { _id: this.oid(documentId), deletedAt: null },
      { $set: { status, reviewNote: note, reviewedBy: actor.id, reviewedAt: new Date() } },
      { new: true },
    );
    if (!doc) throw new NotFoundException("Document not found");
    await this.audit.log(actor, `vendor.document_${status}`, "MpVendorDocument", doc._id, { vendorId: doc.vendorId, note });
    return doc;
  }

  async adminVerifyBankAccount(actor: AuthenticatedUser, accountId: string, status: "verified" | "rejected"): Promise<any> {
    const account = await this.bankAccounts.findOneAndUpdate(
      { _id: this.oid(accountId), deletedAt: null },
      { $set: { verificationStatus: status } },
      { new: true },
    );
    if (!account) throw new NotFoundException("Bank account not found");
    await this.audit.log(actor, `vendor.bank_${status}`, "MpVendorBankAccount", account._id, { vendorId: account.vendorId });
    return this.maskedAccount(account);
  }

  // -------------------------------------------------------------- public
  async publicStore(slug: string): Promise<any> {
    const vendor = await this.vendors
      .findOne({ slug: String(slug).toLowerCase(), status: "active", deletedAt: null })
      .select("storeName slug description logoUrl address.city address.state isPlatformVendor createdAt")
      .lean();
    if (!vendor) throw new NotFoundException("Store not found");
    return vendor;
  }

  // ------------------------------------------------------------- helpers
  private missingDocuments(docs: any[]): string[] {
    const usable = new Set(docs.filter((d) => d.status !== "rejected").map((d) => d.type));
    return REQUIRED_VENDOR_DOCUMENTS.filter((t) => !usable.has(t));
  }

  private async hideAllProducts(vendorId: unknown): Promise<void> {
    await this.products.updateMany({ vendorId, status: "active" }, { $set: { status: HIDDEN_STATUS } });
  }

  /** Re-lists products that are approved + active and not disabled by an admin. */
  private async restoreProductVisibility(vendorId: unknown): Promise<void> {
    await this.products.updateMany(
      { vendorId, approvalStatus: "approved", listingStatus: "active", adminDisabled: { $ne: true }, deletedAt: null },
      { $set: { status: VISIBLE_STATUS } },
    );
  }

  maskedAccount(a: any) {
    const o = typeof a?.toObject === "function" ? a.toObject() : { ...a };
    delete o.accountNumberEncrypted;
    delete o.fingerprint;
    delete o.providerContactId;
    delete o.providerFundAccountId;
    o.accountNumberMasked = `XXXXXX${o.accountNumberLast4 ?? ""}`;
    return o;
  }

  private withoutPrivate(vendor: any) {
    const o = typeof vendor?.toObject === "function" ? vendor.toObject() : { ...vendor };
    delete o.payoutLockToken;
    delete o.payoutLockExpiresAt;
    return o;
  }

  private oid(value: string): string {
    if (!isValidObjectId(value)) throw new NotFoundException("Not found");
    return value;
  }
}
