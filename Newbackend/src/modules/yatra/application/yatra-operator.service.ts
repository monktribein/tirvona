import { Injectable } from "@nestjs/common";
import { InjectModel } from "../../../database/orm-nest";
import type { Model } from "../../../database/orm";
import { TransactionService } from "../../../common/database/transaction.service";
import { uniqueSlug } from "../../../common/slug/slug.util";
import { phoneCandidates } from "../../../common/phone/phone.util";
import { escapeRegex } from "../../../common/utils/escape-regex";
import { BankAccountCrypto } from "../../payouts/infrastructure/bank-account.crypto";
import {
  DOCUMENT_MAX_BYTES,
  OPERATOR_DOCUMENT_TYPES,
  VEHICLE_DOCUMENT_TYPES,
  YATRA_MODEL,
} from "../domain/yatra.constants";
import { YatraException } from "../domain/yatra.errors";
import { detectDocumentType, memberPermissions } from "../domain/yatra.utils";
import {
  YatraAccessService,
  type YatraActor,
  YatraAuditService,
  YatraDocumentStorage,
  YatraNotifier,
} from "./yatra-support.service";

/** Organiser fields any member may see. Never includes the encrypted account number. */
export const operatorView = (op: any) =>
  op && {
    id: String(op._id),
    organisationName: op.organisationName,
    displayName: op.displayName || op.organisationName,
    slug: op.slug,
    organisationType: op.organisationType,
    description: op.description ?? "",
    logoUrl: op.logoUrl ?? "",
    contactName: op.contactName ?? "",
    contactPhone: op.contactPhone ?? "",
    contactEmail: op.contactEmail ?? "",
    address: op.address ?? "",
    city: op.city ?? "",
    state: op.state ?? "",
    pincode: op.pincode ?? "",
    operatingRegions: op.operatingRegions ?? [],
    yearsInBusiness: op.yearsInBusiness ?? 0,
    kyc: {
      panNumber: op.kyc?.panNumber ?? "",
      gstin: op.kyc?.gstin ?? "",
      registrationNumber: op.kyc?.registrationNumber ?? "",
    },
    payout: {
      accountHolderName: op.payout?.accountHolderName ?? "",
      accountNumberLast4: op.payout?.accountNumberLast4 ?? "",
      ifsc: op.payout?.ifsc ?? "",
      bankName: op.payout?.bankName ?? "",
      upiId: op.payout?.upiId ?? "",
      updatedAt: op.payout?.updatedAt ?? null,
    },
    status: op.status,
    submittedAt: op.submittedAt ?? null,
    reviewedAt: op.reviewedAt ?? null,
    reviewNote: op.reviewNote ?? "",
    approvedAt: op.approvedAt ?? null,
    createdAt: op.createdAt,
  };

/** What the public sees about an organiser on a tour page. */
export const operatorPublicView = (op: any) =>
  op && {
    id: String(op._id),
    name: op.displayName || op.organisationName,
    slug: op.slug,
    city: op.city ?? "",
    logoUrl: op.logoUrl ?? "",
    yearsInBusiness: op.yearsInBusiness ?? 0,
  };

const documentView = (doc: any) => ({
  id: String(doc._id),
  operatorId: String(doc.operatorId),
  vehicleId: doc.vehicleId ? String(doc.vehicleId) : null,
  documentType: doc.documentType,
  documentNumber: doc.documentNumber ?? "",
  expiresAt: doc.expiresAt ?? null,
  originalName: doc.originalName ?? "",
  mimeType: doc.storage?.mimeType ?? "",
  bytes: doc.storage?.bytes ?? 0,
  status: doc.status,
  reviewNote: doc.reviewNote ?? "",
  reviewedAt: doc.reviewedAt ?? null,
  createdAt: doc.createdAt,
});

const memberView = (m: any) => ({
  id: String(m._id),
  userId: String(m.userId),
  role: m.role,
  status: m.status,
  name: m.name ?? "",
  email: m.email ?? "",
  phone: m.phone ?? "",
  createdAt: m.createdAt,
});

const REVIEW_TRANSITIONS: Record<string, { from: string[]; to: string; needsNote?: boolean }> = {
  start_review: { from: ["submitted"], to: "under_review" },
  approve: { from: ["submitted", "under_review"], to: "approved" },
  reject: { from: ["submitted", "under_review"], to: "rejected", needsNote: true },
  suspend: { from: ["approved"], to: "suspended", needsNote: true },
  reinstate: { from: ["suspended"], to: "approved" },
};

/** Fields locked once Tirvona has approved the organiser (its legal identity). */
const LEGAL_FIELDS = ["organisationName", "organisationType", "panNumber", "gstin", "registrationNumber"];

@Injectable()
export class YatraOperatorService {
  constructor(
    private readonly transactions: TransactionService,
    private readonly access: YatraAccessService,
    private readonly audit: YatraAuditService,
    private readonly notifier: YatraNotifier,
    private readonly storage: YatraDocumentStorage,
    private readonly crypto: BankAccountCrypto,
    @InjectModel(YATRA_MODEL.Operator) private readonly operators: Model<any>,
    @InjectModel(YATRA_MODEL.Member) private readonly members: Model<any>,
    @InjectModel(YATRA_MODEL.Document) private readonly documents: Model<any>,
    @InjectModel(YATRA_MODEL.Vehicle) private readonly vehicles: Model<any>,
    @InjectModel(YATRA_MODEL.Tour) private readonly tours: Model<any>,
    @InjectModel(YATRA_MODEL.Departure) private readonly departures: Model<any>,
    @InjectModel(YATRA_MODEL.UserRef) private readonly users: Model<any>,
  ) {}

  // ------------------------------------------------------------- registration
  async register(user: YatraActor, dto: any): Promise<any> {
    if (await this.access.membership(user.id))
      throw new YatraException("This account already belongs to a Yatra organiser.", 409, "ALREADY_MEMBER");
    if (await this.operators.exists({ ownerUserId: user.id }))
      throw new YatraException("This account has already registered an organiser.", 409, "ALREADY_REGISTERED");
    const account = await this.users.findById(user.id).lean();
    const slug = await uniqueSlug(dto.organisationName, {
      exists: async (candidate) => Boolean(await this.operators.exists({ slug: candidate })),
      fallback: "organiser",
    });
    const operator = await this.transactions.run(async (session) => {
      const [created] = await this.operators.create(
        [
          {
            ownerUserId: user.id,
            organisationName: dto.organisationName,
            displayName: dto.displayName ?? "",
            slug,
            organisationType: dto.organisationType ?? "proprietorship",
            contactName: dto.contactName ?? account?.name ?? "",
            contactPhone: dto.contactPhone ?? account?.phone ?? "",
            contactEmail: dto.contactEmail ?? account?.email ?? "",
            city: dto.city ?? "",
            state: dto.state ?? "",
            status: "draft",
          },
        ],
        { session },
      );
      await this.members.create(
        [
          {
            operatorId: created._id,
            userId: user.id,
            role: "owner",
            status: "active",
            name: account?.name ?? "",
            email: account?.email ?? "",
            phone: account?.phone ?? "",
            addedBy: user.id,
          },
        ],
        { session },
      );
      await this.audit.record(user, "operator.registered", { operatorId: String(created._id) }, { after: { status: "draft" } }, session);
      return created;
    });
    return this.me({ ...user, id: user.id }, operator);
  }

  async me(user: YatraActor, known?: any): Promise<any> {
    const found = known ? { operator: known, member: await this.members.findOne({ userId: user.id, status: "active" }).lean() } : await this.access.membership(user.id);
    if (!found?.operator || !found.member) return { registered: false };
    const operatorId = found.operator._id;
    const [documents, vehicles, tours, departures] = await Promise.all([
      this.documents.find({ operatorId }).select("documentType status vehicleId").lean(),
      this.vehicles.countDocuments({ operatorId, status: "approved" }),
      this.tours.countDocuments({ operatorId, status: "published" }),
      this.departures.countDocuments({ operatorId, status: "scheduled", departAt: { $gt: new Date() } }),
    ]);
    const orgDocs = documents.filter((d: any) => !d.vehicleId);
    return {
      registered: true,
      operator: operatorView(found.operator),
      member: memberView(found.member),
      permissions: memberPermissions(found.member.role),
      checklist: {
        profileComplete: Boolean(found.operator.contactPhone && found.operator.city && found.operator.kyc?.panNumber),
        panUploaded: orgDocs.some((d: any) => d.documentType === "pan_card"),
        documentsPending: documents.filter((d: any) => d.status === "pending").length,
        payoutDetails: Boolean(found.operator.payout?.accountNumberLast4 || found.operator.payout?.upiId),
        approvedVehicles: vehicles,
        publishedTours: tours,
        upcomingDepartures: departures,
      },
    };
  }

  async updateProfile(user: YatraActor, dto: any): Promise<any> {
    const { operator } = await this.access.require(user, "manageOrganisation", { writable: true });
    const set: Record<string, unknown> = {};
    const locked = ["approved", "under_review", "submitted"].includes(operator.status);
    const plain = ["displayName", "description", "logoUrl", "contactName", "contactPhone", "contactEmail", "address", "city", "state", "pincode", "operatingRegions", "yearsInBusiness"];
    for (const key of plain) if (dto[key] !== undefined) set[key] = dto[key];
    for (const key of ["organisationName", "organisationType"]) {
      if (dto[key] === undefined || dto[key] === operator[key]) continue;
      if (locked) throw new YatraException(`${key === "organisationName" ? "The organisation name" : "The organisation type"} cannot change after submission. Contact Tirvona support.`, 400, "LEGAL_FIELD_LOCKED");
      set[key] = dto[key];
    }
    for (const key of ["panNumber", "gstin", "registrationNumber"]) {
      if (dto[key] === undefined || dto[key] === (operator.kyc?.[key] ?? "")) continue;
      if (locked) throw new YatraException("KYC numbers cannot change after submission. Contact Tirvona support.", 400, "LEGAL_FIELD_LOCKED");
      set[`kyc.${key}`] = dto[key];
    }
    if (!Object.keys(set).length) return this.me(user);
    const after = await this.operators.findOneAndUpdate({ _id: operator._id }, { $set: set }, { new: true }).lean();
    await this.audit.record(user, "operator.profile_updated", { operatorId: String(operator._id), fields: Object.keys(set) });
    return this.me(user, after);
  }

  async setPayout(user: YatraActor, dto: any): Promise<any> {
    const { operator } = await this.access.require(user, "managePayoutDetails", { writable: true });
    const set: Record<string, unknown> = {
      "payout.accountHolderName": dto.accountHolderName ?? "",
      "payout.ifsc": dto.ifsc ?? "",
      "payout.bankName": dto.bankName ?? "",
      "payout.upiId": dto.upiId ?? "",
      "payout.updatedAt": new Date(),
    };
    if (dto.accountNumber) {
      set["payout.accountNumberEncrypted"] = this.crypto.encrypt(String(dto.accountNumber));
      set["payout.accountNumberLast4"] = String(dto.accountNumber).slice(-4);
    }
    if (!dto.accountNumber && !operator.payout?.accountNumberLast4 && !dto.upiId)
      throw new YatraException("Add a bank account number or a UPI id.", 400);
    const after = await this.operators.findOneAndUpdate({ _id: operator._id }, { $set: set }, { new: true }).lean();
    await this.audit.record(user, "operator.payout_details_updated", { operatorId: String(operator._id), hasAccount: Boolean(after.payout?.accountNumberLast4), hasUpi: Boolean(after.payout?.upiId) });
    return this.me(user, after);
  }

  async submit(user: YatraActor, acceptTerms: boolean): Promise<any> {
    const { operator } = await this.access.require(user, "manageOrganisation", { writable: true });
    if (!["draft", "rejected"].includes(operator.status))
      throw new YatraException("Your organisation has already been submitted.", 409);
    if (!acceptTerms) throw new YatraException("Please accept the Tirvona Yatra organiser terms.", 400);
    const missing: string[] = [];
    if (!operator.contactPhone) missing.push("contact phone");
    if (!operator.city) missing.push("city");
    if (!operator.kyc?.panNumber) missing.push("PAN number");
    const pan = await this.documents.exists({ operatorId: operator._id, vehicleId: null, documentType: "pan_card", status: { $ne: "rejected" } });
    if (!pan) missing.push("PAN card document");
    if (missing.length) throw new YatraException(`Before submitting, add: ${missing.join(", ")}.`, 400, "INCOMPLETE_PROFILE");
    const after = await this.operators.findOneAndUpdate(
      { _id: operator._id, status: { $in: ["draft", "rejected"] } },
      { $set: { status: "submitted", submittedAt: new Date(), termsAcceptedAt: new Date(), reviewNote: "" } },
      { new: true },
    ).lean();
    if (!after) throw new YatraException("Your organisation has already been submitted.", 409);
    await this.audit.record(user, "operator.submitted", { operatorId: String(operator._id) }, { before: { status: operator.status }, after: { status: "submitted" } });
    return this.me(user, after);
  }

  // -------------------------------------------------------------------- staff
  async listStaff(user: YatraActor): Promise<any[]> {
    const { operator } = await this.access.require(user, "viewBookings");
    const rows = await this.members.find({ operatorId: operator._id }).sort({ createdAt: 1 }).lean();
    return rows.map(memberView);
  }

  async addStaff(user: YatraActor, dto: { emailOrPhone: string; role: string }): Promise<any> {
    const { operator } = await this.access.require(user, "manageStaff", { writable: true });
    const key = dto.emailOrPhone.trim();
    const account = key.includes("@")
      ? await this.users.findOne({ email: key.toLowerCase() }).lean()
      : await this.users.findOne({ phone: { $in: phoneCandidates(key) } }).lean();
    if (!account || account.isDeleted || ["deleted", "disabled", "archived"].includes(String(account.status)))
      throw new YatraException("No active Tirvona account uses that email or phone. Ask them to sign up first.", 404, "ACCOUNT_NOT_FOUND");
    const elsewhere = await this.members.findOne({ userId: account._id, status: "active" }).lean();
    if (elsewhere)
      throw new YatraException(
        String(elsewhere.operatorId) === String(operator._id) ? "This person is already in your team." : "This account already works for another organiser.",
        409,
      );
    const existing = await this.members.findOne({ operatorId: operator._id, userId: account._id });
    let member: any;
    if (existing) {
      existing.status = "active";
      existing.role = dto.role;
      existing.addedBy = user.id;
      existing.removedAt = null;
      member = await existing.save();
    } else {
      member = await this.members.create({
        operatorId: operator._id,
        userId: account._id,
        role: dto.role,
        status: "active",
        name: account.name ?? "",
        email: account.email ?? "",
        phone: account.phone ?? "",
        addedBy: user.id,
      });
    }
    await this.audit.record(user, "operator.staff_added", { operatorId: String(operator._id), userId: String(account._id), role: dto.role });
    await this.notifier.users([String(account._id)], "You were added to a Yatra organiser", `${operator.displayName || operator.organisationName} added you as ${dto.role}.`, "/operator/dashboard");
    return memberView(member);
  }

  async updateStaff(user: YatraActor, memberId: string, role: string): Promise<any> {
    const { operator } = await this.access.require(user, "manageStaff", { writable: true });
    const member = await this.members.findOne({ _id: memberId, operatorId: operator._id, status: "active" });
    if (!member) throw new YatraException("Team member not found.", 404);
    if (member.role === "owner") throw new YatraException("The owner's role cannot change.", 400);
    const before = member.role;
    member.role = role;
    await member.save();
    await this.audit.record(user, "operator.staff_role_changed", { operatorId: String(operator._id), memberId }, { before: { role: before }, after: { role } });
    return memberView(member);
  }

  async removeStaff(user: YatraActor, memberId: string): Promise<{ removed: true }> {
    const { operator } = await this.access.require(user, "manageStaff", { writable: true });
    const member = await this.members.findOne({ _id: memberId, operatorId: operator._id, status: "active" });
    if (!member) throw new YatraException("Team member not found.", 404);
    if (member.role === "owner") throw new YatraException("The owner cannot be removed.", 400);
    member.status = "removed";
    member.removedAt = new Date();
    member.removedBy = user.id;
    await member.save();
    await this.audit.record(user, "operator.staff_removed", { operatorId: String(operator._id), memberId, userId: String(member.userId) });
    return { removed: true };
  }

  // ---------------------------------------------------------------- documents
  async uploadDocument(user: YatraActor, file: Express.Multer.File | undefined, dto: any): Promise<any> {
    const { operator } = await this.access.require(user, "manageDocuments", { writable: true });
    if (!file?.buffer?.length) throw new YatraException('Attach the document as the "file" field.', 400);
    if (file.buffer.length > DOCUMENT_MAX_BYTES) throw new YatraException("Documents can be at most 10 MB.", 400);
    const detected = detectDocumentType(file.buffer);
    if (!detected) throw new YatraException("Upload a JPG, PNG, WEBP or PDF file.", 400, "UNSUPPORTED_FILE");
    let vehicleId: string | null = null;
    if (dto.vehicleId) {
      const vehicle = await this.vehicles.findOne({ _id: dto.vehicleId, operatorId: operator._id }).lean();
      if (!vehicle) throw new YatraException("Vehicle not found.", 404);
      vehicleId = String(vehicle._id);
      if (!(VEHICLE_DOCUMENT_TYPES as readonly string[]).includes(dto.documentType))
        throw new YatraException("That document type does not apply to a vehicle.", 400);
    } else if (!(OPERATOR_DOCUMENT_TYPES as readonly string[]).includes(dto.documentType)) {
      throw new YatraException("That document type does not apply to an organisation.", 400);
    }
    const stored = await this.storage.put(file.buffer, `yatra-kyc/${String(operator._id)}`, detected.resourceType);
    const doc = await this.documents.create({
      operatorId: operator._id,
      vehicleId,
      documentType: dto.documentType,
      documentNumber: dto.documentNumber ?? "",
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      storage: { ...stored, format: stored.format || detected.ext, mimeType: detected.mime },
      originalName: String(file.originalname ?? "").slice(0, 120),
      status: "pending",
      uploadedBy: user.id,
    });
    await this.audit.record(user, "document.uploaded", { operatorId: String(operator._id), documentId: String(doc._id), documentType: dto.documentType, vehicleId });
    return documentView(doc);
  }

  async listDocuments(user: YatraActor): Promise<any[]> {
    const { operator } = await this.access.require(user, "manageDocuments");
    const rows = await this.documents.find({ operatorId: operator._id }).sort({ createdAt: -1 }).lean();
    return rows.map(documentView);
  }

  async documentLink(user: YatraActor, documentId: string, asAdmin: boolean): Promise<any> {
    const filter: Record<string, unknown> = { _id: documentId };
    if (!asAdmin) filter.operatorId = (await this.access.require(user, "manageDocuments")).operator._id;
    const doc = await this.documents.findOne(filter).lean();
    if (!doc) throw new YatraException("Document not found.", 404);
    const link = this.storage.signedUrl(doc.storage);
    await this.audit.record(user, "document.viewed", { documentId, operatorId: String(doc.operatorId), asAdmin });
    return { ...link, mimeType: doc.storage?.mimeType ?? "" };
  }

  async deleteDocument(user: YatraActor, documentId: string): Promise<{ deleted: true }> {
    const { operator } = await this.access.require(user, "manageDocuments", { writable: true });
    const doc = await this.documents.findOne({ _id: documentId, operatorId: operator._id }).lean();
    if (!doc) throw new YatraException("Document not found.", 404);
    if (doc.status === "approved") throw new YatraException("An approved document cannot be deleted. Upload a newer one instead.", 400);
    await this.documents.deleteOne({ _id: doc._id, status: { $ne: "approved" } });
    await this.storage.remove(doc.storage);
    await this.audit.record(user, "document.deleted", { documentId, operatorId: String(operator._id), documentType: doc.documentType });
    return { deleted: true };
  }

  // ----------------------------------------------------------- admin: review
  async adminList(query: { status?: string; q?: string; page: number; limit: number }): Promise<any> {
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    if (query.q) filter.organisationName = { $regex: escapeRegex(query.q), $options: "i" };
    const [rows, total] = await Promise.all([
      this.operators.find(filter).sort({ updatedAt: -1 }).skip((query.page - 1) * query.limit).limit(query.limit).lean(),
      this.operators.countDocuments(filter),
    ]);
    return { items: rows.map(operatorView), total };
  }

  async adminDetail(operatorId: string): Promise<any> {
    const operator = await this.operators.findById(operatorId).lean();
    if (!operator) throw new YatraException("Organiser not found.", 404);
    const [members, documents, vehicles, tours] = await Promise.all([
      this.members.find({ operatorId }).lean(),
      this.documents.find({ operatorId }).sort({ createdAt: -1 }).lean(),
      this.vehicles.find({ operatorId }).sort({ createdAt: -1 }).lean(),
      this.tours.find({ operatorId }).select("title status productType originCity destinationCity updatedAt").sort({ updatedAt: -1 }).lean(),
    ]);
    return {
      operator: operatorView(operator),
      members: members.map(memberView),
      documents: documents.map(documentView),
      vehicles: vehicles.map((v: any) => ({ id: String(v._id), registrationNumber: v.registrationNumber, vehicleType: v.vehicleType, seatCapacity: v.seatCapacity, status: v.status })),
      tours: tours.map((t: any) => ({ id: String(t._id), title: t.title, status: t.status, productType: t.productType, originCity: t.originCity, destinationCity: t.destinationCity, updatedAt: t.updatedAt })),
    };
  }

  async adminReview(admin: YatraActor, operatorId: string, action: string, note = ""): Promise<any> {
    const rule = REVIEW_TRANSITIONS[action];
    if (!rule) throw new YatraException("Unknown review action.", 400);
    if (rule.needsNote && note.trim().length < 3) throw new YatraException("Please give a reason (at least 3 characters).", 400);
    const operator = await this.operators.findById(operatorId).lean();
    if (!operator) throw new YatraException("Organiser not found.", 404);
    if (!rule.from.includes(operator.status))
      throw new YatraException(`An organiser that is ${operator.status.replace(/_/g, " ")} cannot be moved to ${rule.to.replace(/_/g, " ")}.`, 409);
    const set: Record<string, unknown> = { status: rule.to, reviewedAt: new Date(), reviewedBy: admin.id, reviewNote: note.trim() };
    if (rule.to === "approved" && !operator.approvedAt) set.approvedAt = new Date();
    const after = await this.operators.findOneAndUpdate({ _id: operatorId, status: operator.status }, { $set: set }, { new: true }).lean();
    if (!after) throw new YatraException("This organiser changed while you were reviewing. Reload and try again.", 409);
    await this.audit.record(admin, `operator.${action}`, { operatorId, note: note.trim() }, { before: { status: operator.status }, after: { status: rule.to } });
    const messages: Record<string, string> = {
      approve: "Your organisation is approved. You can now submit tours and open departures.",
      reject: `Your organisation was not approved: ${note.trim()}`,
      suspend: `Your organisation is suspended: ${note.trim()}`,
      reinstate: "Your organisation is active again.",
      start_review: "Tirvona has started reviewing your organisation.",
    };
    await this.notifier.users([String(operator.ownerUserId)], "Yatra organiser update", messages[action], "/operator/dashboard", "yatra.operator");
    return operatorView(after);
  }

  async adminDocuments(query: { status?: string; page: number; limit: number }): Promise<any> {
    // Organiser documents only; ride partner documents are verified on the ride partner page.
    const filter: Record<string, unknown> = { operatorId: { $ne: null } };
    if (query.status) filter.status = query.status;
    const [rows, total] = await Promise.all([
      this.documents.find(filter).sort({ createdAt: -1 }).skip((query.page - 1) * query.limit).limit(query.limit).lean(),
      this.documents.countDocuments(filter),
    ]);
    const operatorIds = [...new Set(rows.filter((r: any) => r.operatorId).map((r: any) => String(r.operatorId)))];
    const ops = operatorIds.length ? await this.operators.find({ _id: { $in: operatorIds } }).select("organisationName").lean() : [];
    const names = new Map(ops.map((o: any) => [String(o._id), o.organisationName]));
    return { items: rows.map((r: any) => ({ ...documentView(r), operatorName: names.get(String(r.operatorId)) ?? "" })), total };
  }

  async adminReviewDocument(admin: YatraActor, documentId: string, decision: "approve" | "reject", note = ""): Promise<any> {
    if (decision === "reject" && note.trim().length < 3) throw new YatraException("Please give a reason (at least 3 characters).", 400);
    const doc = await this.documents.findOne({ _id: documentId, operatorId: { $ne: null } }).lean();
    if (!doc) throw new YatraException("Document not found.", 404);
    const status = decision === "approve" ? "approved" : "rejected";
    const after = await this.documents.findOneAndUpdate(
      { _id: documentId, operatorId: { $ne: null } },
      { $set: { status, reviewNote: note.trim(), reviewedBy: admin.id, reviewedAt: new Date() } },
      { new: true },
    ).lean();
    await this.audit.record(admin, `document.${decision}d`, { documentId, operatorId: String(doc.operatorId), documentType: doc.documentType, note }, { before: { status: doc.status }, after: { status } });
    const owner = await this.operators.findById(doc.operatorId).select("ownerUserId").lean();
    await this.notifier.users([owner?.ownerUserId ? String(owner.ownerUserId) : null], "Yatra document reviewed", `Your ${doc.documentType.replace(/_/g, " ")} was ${status}${note ? `: ${note}` : "."}`, "/operator/documents", "yatra.operator");
    return documentView(after);
  }

  /** Names of the given fields that are locked for an approved organiser (for the UI). */
  static readonly legalFields = LEGAL_FIELDS;
}
