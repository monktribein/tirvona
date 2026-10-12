import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import { TransactionService } from "../../../common/database/transaction.service";
import { InAppNotificationService } from "../../notifications/application/in-app-notification.service";
import {
  APPROVAL_REASON_CODES,
  DEFAULT_VERIFICATION_VALIDITY_DAYS,
  MAX_REJECTED_CASES_PER_TYPE,
  PROVIDER_OPENABLE_CASE_TYPES,
  REJECTION_REASON_CODES,
  REQUIRED_EVIDENCE,
  type EvidenceType,
  type RejectionReasonCode,
  type VerificationCaseType,
} from "../domain/provider.constants";
import { providerError } from "../domain/provider.errors";
import { isEntryValid, type VerificationMap } from "../domain/provider-visibility";
import { pageParams } from "../presentation/dto/common.dto";
import type {
  AddEvidenceDto,
  DecideVerificationDto,
  OpenVerificationCaseDto,
  VerificationQueueQueryDto,
} from "../presentation/dto/verification.dto";
import { ProviderAuditService } from "./provider-audit.service";
import { ProviderProfileService } from "./provider-profile.service";
import { ProviderProjectionService } from "./provider-projection.service";
import { idStr, paged, sameId, toObjectId } from "./provider.helpers";

const REVIEWER_ROLES = ["verification_reviewer", "super_admin"];
export const isVerificationReviewer = (user: Pick<AuthenticatedUser, "role">): boolean =>
  REVIEWER_ROLES.includes(user.role);

const MAX_EVIDENCE_PER_CASE = 10;
const RENEWAL_WINDOW_DAYS = 30;
const DAY = 86_400_000;

/**
 * Accepts what the uploads module returns: a Cloudinary public id, or a
 * https://res.cloudinary.com/... delivery URL. Arbitrary links are refused so a
 * reviewer is never sent to a page the provider controls.
 */
export const isAcceptableStorageKey = (key: string): boolean => {
  if (/^https:\/\//i.test(key)) {
    try {
      return new URL(key).hostname === "res.cloudinary.com";
    } catch {
      return false;
    }
  }
  return /^[A-Za-z0-9][A-Za-z0-9/_\-.]{2,299}$/.test(key) && !key.includes("..");
};

type Entry = {
  from: string | null;
  to: string;
  actorId?: string;
  actorRole: string;
  reasonCode?: string | null;
  at: Date;
};

@Injectable()
export class ProviderVerificationService {
  private readonly logger = new Logger(ProviderVerificationService.name);

  constructor(
    @InjectModel("ProviderVerificationCase") private readonly cases: Model<any>,
    @InjectModel("ProviderVerificationEvidence") private readonly evidence: Model<any>,
    @InjectModel("ProviderProfile") private readonly profileModel: Model<any>,
    @InjectModel("ProviderPrivateProfile") private readonly privates: Model<any>,
    private readonly transactions: TransactionService,
    private readonly profiles: ProviderProfileService,
    private readonly projection: ProviderProjectionService,
    private readonly audit: ProviderAuditService,
    private readonly notifier: InAppNotificationService,
  ) {}

  // ----------------------------------------------------------------- open
  async open(user: AuthenticatedUser, dto: OpenVerificationCaseDto, previous?: any) {
    const reviewer = isVerificationReviewer(user);
    const type = (dto.verificationType ?? "IDENTITY") as VerificationCaseType;

    let provider: any;
    if (reviewer && dto.providerId) {
      provider = await this.profileModel.findOne({ _id: toObjectId(dto.providerId), deletedAt: null });
      if (!provider) throw providerError.notFound("PROVIDER_NOT_FOUND", "Provider not found");
    } else {
      provider = await this.profiles.requireOwn(user);
      // The id in the body is advisory only; it can never select someone else's profile.
      if (dto.providerId && !sameId(dto.providerId, provider._id))
        throw providerError.forbidden(
          "PROVIDER_MISMATCH",
          "You can only open verification for your own profile",
        );
    }
    if (!reviewer) {
      this.profiles.assertNotSuspended(provider);
      if (!PROVIDER_OPENABLE_CASE_TYPES.includes(type))
        throw providerError.forbidden(
          "VERIFICATION_TYPE_RESTRICTED",
          "Tirvona Trusted status is earned and can only be reviewed by Tirvona",
        );
    }
    this.assertPrerequisites(provider, type);

    const rejected: any[] = await this.cases
      .find({ providerId: provider._id, verificationType: type, status: "REJECTED" })
      .sort({ decidedAt: -1 })
      .lean();
    if (!reviewer) {
      const last = rejected[0];
      if (last && !this.resubmittable(last.decisionReasonCode))
        throw providerError.conflict(
          "VERIFICATION_NOT_RESUBMITTABLE",
          "This verification was declined and cannot be resubmitted. Contact Tirvona support.",
        );
      if (rejected.length >= MAX_REJECTED_CASES_PER_TYPE)
        throw providerError.conflict(
          "VERIFICATION_ATTEMPTS_EXHAUSTED",
          "The maximum number of attempts has been reached. Contact Tirvona support.",
        );
    }

    const now = new Date();
    const entry: Entry = {
      from: null,
      to: "OPEN",
      actorId: user.id,
      actorRole: reviewer ? "REVIEWER" : "PROVIDER",
      at: now,
    };
    let created: any;
    try {
      created = await this.cases.create({
        providerId: provider._id,
        providerUserId: provider.userId,
        verificationType: type,
        status: "OPEN",
        openedAt: now,
        attempt: rejected.length + 1,
        previousCaseId: previous?._id ?? null,
        evidenceIds: previous ? previous.evidenceIds : [],
        history: [entry],
      });
    } catch (error) {
      if ((error as { code?: number }).code === 11000)
        throw providerError.conflict(
          "VERIFICATION_CASE_ALREADY_OPEN",
          "A verification of this type is already in progress",
        );
      throw error;
    }
    await this.audit.log(user, "verification.case_opened", "verification_case", created._id, {
      providerId: idStr(provider._id),
      verificationType: type,
      attempt: created.attempt,
    });
    return { success: true, data: await this.view(created._id, user) };
  }

  /** Opens a new case after a rejection that allows it, carrying the earlier evidence forward. */
  async resubmit(user: AuthenticatedUser, caseId: string) {
    const provider = await this.profiles.requireOwn(user);
    const previous: any = await this.cases.findById(toObjectId(caseId, "caseId")).lean();
    if (!previous || !sameId(previous.providerId, provider._id))
      throw providerError.notFound("VERIFICATION_CASE_NOT_FOUND", "Verification case not found");
    if (previous.status !== "REJECTED")
      throw providerError.conflict(
        "VERIFICATION_NOT_REJECTED",
        "Only a rejected verification can be resubmitted",
      );
    if (!this.resubmittable(previous.decisionReasonCode))
      throw providerError.conflict(
        "VERIFICATION_NOT_RESUBMITTABLE",
        "This verification was declined and cannot be resubmitted. Contact Tirvona support.",
      );
    const result = await this.open(user, { verificationType: previous.verificationType }, previous);
    await this.audit.log(user, "verification.resubmitted", "verification_case", caseId, {
      newCaseId: result.data.id,
    });
    return result;
  }

  // ------------------------------------------------------------- evidence
  async addEvidence(user: AuthenticatedUser, caseId: string, dto: AddEvidenceDto) {
    const verificationCase = await this.requireCaseFor(user, caseId);
    const reviewer = isVerificationReviewer(user);
    const ownerEditing = !reviewer || sameId(verificationCase.providerUserId, user.id);
    if (ownerEditing) {
      if (verificationCase.status !== "OPEN" || verificationCase.submittedAt)
        throw providerError.conflict(
          "VERIFICATION_CASE_LOCKED",
          "Evidence can only be added before the case is submitted",
        );
    } else if (verificationCase.status !== "IN_REVIEW")
      throw providerError.conflict(
        "VERIFICATION_CASE_LOCKED",
        "Reviewers can add evidence only while the case is in review",
      );
    if (verificationCase.evidenceIds.length >= MAX_EVIDENCE_PER_CASE)
      throw providerError.unprocessable(
        "EVIDENCE_LIMIT_REACHED",
        `A case can hold at most ${MAX_EVIDENCE_PER_CASE} documents`,
      );
    if (!isAcceptableStorageKey(dto.storageKey))
      throw providerError.badRequest(
        "EVIDENCE_REFERENCE_INVALID",
        "storageKey must be the reference returned by the Tirvona upload service",
      );
    const sha256 = dto.sha256.toLowerCase();
    const duplicate = await this.evidence.exists({
      caseId: verificationCase._id,
      sha256,
    });
    if (duplicate)
      throw providerError.conflict("EVIDENCE_DUPLICATE", "That document is already attached to this case");

    const created = await this.transactions.run(async (session) => {
      const [row] = await this.evidence.create(
        [
          {
            providerId: verificationCase.providerId,
            caseId: verificationCase._id,
            uploadedBy: user.id,
            evidenceType: dto.evidenceType,
            objectStorageKey: dto.storageKey,
            sha256,
            mimeType: dto.mimeType,
            sizeBytes: dto.sizeBytes,
            label: dto.label,
            malwareScanStatus: "PENDING",
          },
        ],
        { session },
      );
      const linked = await this.cases.updateOne(
        {
          _id: verificationCase._id,
          status: verificationCase.status,
          submittedAt: verificationCase.submittedAt ?? null,
        },
        { $addToSet: { evidenceIds: row._id } },
        { session },
      );
      if (!linked.matchedCount)
        throw providerError.conflict(
          "VERIFICATION_CASE_LOCKED",
          "The case changed state while the document was being added",
        );
      if (dto.evidenceType === "KYC_ID")
        await this.privates.updateOne(
          { providerId: verificationCase.providerId },
          { $addToSet: { kycRefs: row._id } },
          { session },
        );
      return row;
    });
    // Evidence content, keys and hashes never go to the audit trail.
    await this.audit.log(user, "verification.evidence_added", "verification_evidence", created._id, {
      caseId: idStr(verificationCase._id),
      evidenceType: dto.evidenceType,
    });
    return { success: true, data: this.evidenceView(created.toObject(), false) };
  }

  /** Provider hands the case to the reviewers. Required documents must be present. */
  async submit(user: AuthenticatedUser, caseId: string) {
    const provider = await this.profiles.requireOwn(user);
    this.profiles.assertNotSuspended(provider);
    const verificationCase = await this.requireCaseFor(user, caseId);
    if (!sameId(verificationCase.providerId, provider._id))
      throw providerError.notFound("VERIFICATION_CASE_NOT_FOUND", "Verification case not found");
    if (verificationCase.status !== "OPEN" || verificationCase.submittedAt)
      throw providerError.conflict(
        "VERIFICATION_CASE_LOCKED",
        "This case has already been submitted",
      );
    const evidence: any[] = await this.evidence
      .find({ _id: { $in: verificationCase.evidenceIds } })
      .select("evidenceType malwareScanStatus")
      .lean();
    this.assertRequiredEvidence(verificationCase.verificationType, evidence);

    const now = new Date();
    const updated = await this.cases.findOneAndUpdate(
      { _id: verificationCase._id, status: "OPEN", submittedAt: null },
      {
        $set: { submittedAt: now },
        $push: {
          history: {
            from: "OPEN",
            to: "SUBMITTED",
            actorId: user.id,
            actorRole: "PROVIDER",
            at: now,
          } satisfies Entry,
        },
      },
      { new: true },
    );
    if (!updated)
      throw providerError.conflict("VERIFICATION_CASE_LOCKED", "This case has already been submitted");
    await this.audit.log(user, "verification.case_submitted", "verification_case", caseId, {
      verificationType: verificationCase.verificationType,
    });
    return { success: true, data: await this.view(caseId, user) };
  }

  // --------------------------------------------------------------- review
  /** Reviewer takes a submitted case. The provider's own account can never review itself. */
  async claim(user: AuthenticatedUser, caseId: string) {
    const verificationCase: any = await this.cases.findById(toObjectId(caseId, "caseId")).lean();
    if (!verificationCase)
      throw providerError.notFound("VERIFICATION_CASE_NOT_FOUND", "Verification case not found");
    this.assertNoConflictOfInterest(user, verificationCase);
    const now = new Date();
    const updated = await this.cases.findOneAndUpdate(
      { _id: verificationCase._id, status: "OPEN", submittedAt: { $ne: null } },
      {
        $set: { status: "IN_REVIEW", reviewerUserId: user.id },
        $push: {
          history: {
            from: "OPEN",
            to: "IN_REVIEW",
            actorId: user.id,
            actorRole: "REVIEWER",
            at: now,
          } satisfies Entry,
        },
      },
      { new: true },
    );
    if (!updated)
      throw providerError.conflict(
        "VERIFICATION_NOT_CLAIMABLE",
        "This case is not waiting for review (not submitted, or already taken)",
      );
    await this.audit.log(user, "verification.case_claimed", "verification_case", caseId, {
      verificationType: verificationCase.verificationType,
    });
    return { success: true, data: await this.view(caseId, user, true) };
  }

  async decide(user: AuthenticatedUser, caseId: string, dto: DecideVerificationDto) {
    const verificationCase: any = await this.cases
      .findById(toObjectId(caseId, "caseId"))
      .select("+internalNote")
      .lean();
    if (!verificationCase)
      throw providerError.notFound("VERIFICATION_CASE_NOT_FOUND", "Verification case not found");
    this.assertNoConflictOfInterest(user, verificationCase);
    if (verificationCase.status !== "IN_REVIEW")
      throw providerError.conflict(
        "VERIFICATION_NOT_IN_REVIEW",
        "Only a case that is in review can be decided",
      );
    // The reviewer who took the case decides it; only super_admin may take over.
    if (!sameId(verificationCase.reviewerUserId, user.id) && user.role !== "super_admin")
      throw providerError.forbidden(
        "VERIFICATION_NOT_ASSIGNED",
        "This case is assigned to another reviewer",
      );
    // Maker-checker for the most sensitive badge.
    if (verificationCase.verificationType === "TRUST_REVIEW" && user.role !== "super_admin")
      throw providerError.forbidden(
        "MAKER_CHECKER_REQUIRED",
        "Tirvona Trusted decisions need a second, senior approver",
      );

    const approve = dto.decision === "APPROVE";
    if (approve) {
      if (!(APPROVAL_REASON_CODES as readonly string[]).includes(dto.reasonCode))
        throw providerError.badRequest(
          "REASON_CODE_INVALID",
          `An approval uses reason code ${APPROVAL_REASON_CODES.join(", ")}`,
        );
    } else if (!(dto.reasonCode in REJECTION_REASON_CODES))
      throw providerError.badRequest(
        "REASON_CODE_INVALID",
        `A rejection needs one of: ${Object.keys(REJECTION_REASON_CODES).join(", ")}`,
      );

    const evidence: any[] = await this.evidence
      .find({ _id: { $in: verificationCase.evidenceIds } })
      .select("evidenceType malwareScanStatus")
      .lean();
    if (approve) {
      this.assertRequiredEvidence(verificationCase.verificationType, evidence);
      if (evidence.some((item) => item.malwareScanStatus === "REJECTED"))
        throw providerError.unprocessable(
          "EVIDENCE_REJECTED_BY_SCAN",
          "A document failed the security scan and cannot support an approval",
        );
    }

    const now = new Date();
    const validityDays = dto.validityDays ?? DEFAULT_VERIFICATION_VALIDITY_DAYS;
    const validUntil = approve ? new Date(now.getTime() + validityDays * DAY) : null;
    const to = approve ? "APPROVED" : "REJECTED";
    const entry: Entry = {
      from: "IN_REVIEW",
      to,
      actorId: user.id,
      actorRole: "REVIEWER",
      reasonCode: dto.reasonCode,
      at: now,
    };

    await this.transactions.run(async (session) => {
      const decided = await this.cases.updateOne(
        { _id: verificationCase._id, status: "IN_REVIEW" },
        {
          $set: {
            status: to,
            decisionReasonCode: dto.reasonCode,
            decidedAt: now,
            validUntil,
            providerMessage: dto.providerMessage,
            ...(dto.internalNote ? { internalNote: dto.internalNote } : {}),
            reviewerUserId: user.id,
          },
          $push: { history: entry },
        },
        { session },
      );
      if (!decided.matchedCount)
        throw providerError.conflict(
          "VERIFICATION_STATE_CONFLICT",
          "The case changed while it was being decided",
        );
      if (approve) {
        await this.profileModel.updateOne(
          { _id: verificationCase.providerId },
          {
            $set: {
              [`verification.${verificationCase.verificationType}`]: {
                caseId: verificationCase._id,
                approvedAt: now,
                validUntil,
              },
            },
          },
          { session },
        );
        await this.projection.rebuild(verificationCase.providerId, session);
      }
    });

    await this.audit.log(
      user,
      approve ? "verification.approved" : "verification.rejected",
      "verification_case",
      caseId,
      {
        providerId: idStr(verificationCase.providerId),
        verificationType: verificationCase.verificationType,
        reasonCode: dto.reasonCode,
        ...(approve ? { validUntil } : {}),
      },
    );
    await this.notifier.notifyUsers([String(verificationCase.providerUserId)], {
      title: approve ? "Verification approved" : "Verification needs your attention",
      body: approve
        ? "Your verification was approved."
        : dto.providerMessage || "Your verification was not approved. Open it to see what to fix.",
      deepLink: "/provider/verification",
      kind: approve ? "provider.verification.approved" : "provider.verification.rejected",
    });
    return { success: true, data: await this.view(caseId, user, true) };
  }

  // ---------------------------------------------------------------- reads
  async list(user: AuthenticatedUser, query: VerificationQueueQueryDto) {
    const { page, limit, skip } = pageParams(query);
    const reviewer = isVerificationReviewer(user);
    let filter: Record<string, unknown>;
    let sort: Record<string, 1 | -1>;
    if (reviewer) {
      filter = {};
      if (query.providerId) filter.providerId = toObjectId(query.providerId);
      if (query.verificationType) filter.verificationType = query.verificationType;
      if (query.status) filter.status = query.status;
      else {
        // Default reviewer queue: submitted and waiting, or already being reviewed.
        filter.$or = [
          { status: "OPEN", submittedAt: { $ne: null } },
          { status: "IN_REVIEW" },
        ];
      }
      if (query.assignedToMe) filter.reviewerUserId = toObjectId(user.id);
      sort = { openedAt: 1 };
    } else {
      const provider = await this.profiles.requireOwn(user);
      filter = { providerId: provider._id };
      if (query.verificationType) filter.verificationType = query.verificationType;
      if (query.status) filter.status = query.status;
      sort = { openedAt: -1 };
    }
    const [rows, total] = await Promise.all([
      this.cases.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      this.cases.countDocuments(filter),
    ]);
    // Reviewers see who the provider is; providers only ever see their own cases.
    const names = reviewer ? await this.profiles.displayNames((rows as any[]).map((row) => String(row.providerId))) : new Map<string, string>();
    const data = (rows as any[]).map((row) => ({
      ...this.caseSummary(row, reviewer),
      ...(reviewer ? { providerName: names.get(String(row.providerId)) ?? null } : {}),
    }));
    return paged(data, total, page, limit);
  }

  async get(user: AuthenticatedUser, caseId: string) {
    const verificationCase = await this.requireCaseFor(user, caseId);
    const reviewer = isVerificationReviewer(user) && !sameId(verificationCase.providerUserId, user.id);
    if (reviewer)
      await this.audit.log(user, "verification.case_viewed", "verification_case", caseId, {
        providerId: idStr(verificationCase.providerId),
        restricted: true,
      });
    return { success: true, data: await this.view(caseId, user) };
  }

  // ------------------------------------------------------- maintenance
  /** Marks lapsed approvals EXPIRED and drops the provider's level accordingly. */
  async expireLapsed(now = new Date()): Promise<number> {
    const lapsed: any[] = await this.cases
      .find({ status: "APPROVED", validUntil: { $ne: null, $lte: now } })
      .limit(200)
      .lean();
    let count = 0;
    for (const verificationCase of lapsed) {
      const result = await this.cases.updateOne(
        { _id: verificationCase._id, status: "APPROVED" },
        {
          $set: { status: "EXPIRED" },
          $push: {
            history: {
              from: "APPROVED",
              to: "EXPIRED",
              actorRole: "SYSTEM",
              reasonCode: "VALIDITY_ENDED",
              at: now,
            } satisfies Entry,
          },
        },
      );
      if (!result.modifiedCount) continue;
      count += 1;
      await this.projection.rebuild(verificationCase.providerId);
      await this.audit.log(null, "verification.expired", "verification_case", verificationCase._id, {
        providerId: idStr(verificationCase.providerId),
        verificationType: verificationCase.verificationType,
      });
    }
    return count;
  }

  // ------------------------------------------------------------ internals
  private resubmittable(reasonCode?: string): boolean {
    const rule = REJECTION_REASON_CODES[reasonCode as RejectionReasonCode];
    return Boolean(rule?.resubmittable);
  }

  private assertPrerequisites(provider: any, type: VerificationCaseType) {
    const now = new Date();
    const map = (provider.verification ?? {}) as VerificationMap;
    if (type !== "IDENTITY" && !isEntryValid(map.IDENTITY, now))
      throw providerError.conflict(
        "VERIFICATION_IDENTITY_REQUIRED",
        "Identity must be verified before this verification can be opened",
      );
    if (
      type === "TRUST_REVIEW" &&
      !isEntryValid(map.PROFESSIONAL, now) &&
      !isEntryValid(map.INSTITUTION, now)
    )
      throw providerError.conflict(
        "VERIFICATION_PROFESSIONAL_REQUIRED",
        "A professional or institution verification is required before a trust review",
      );
    const existing = map[type];
    if (existing && isEntryValid(existing, now) && existing.validUntil) {
      const remainingDays = (new Date(existing.validUntil).getTime() - now.getTime()) / DAY;
      if (remainingDays > RENEWAL_WINDOW_DAYS)
        throw providerError.conflict(
          "VERIFICATION_ALREADY_VALID",
          `This verification is still valid. Renewal opens ${RENEWAL_WINDOW_DAYS} days before it ends.`,
        );
    }
  }

  private assertRequiredEvidence(type: VerificationCaseType, evidence: Array<{ evidenceType: EvidenceType }>) {
    const required = REQUIRED_EVIDENCE[type];
    if (!required.length) return;
    // IDENTITY and INSTITUTION list one type; PROFESSIONAL accepts any one of its two.
    if (!evidence.some((item) => required.includes(item.evidenceType)))
      throw providerError.unprocessable(
        "EVIDENCE_REQUIRED",
        `Add at least one of: ${required.join(", ")}`,
      );
  }

  private assertNoConflictOfInterest(user: AuthenticatedUser, verificationCase: any) {
    if (!isVerificationReviewer(user))
      throw providerError.forbidden("REVIEWER_REQUIRED", "Only verification reviewers can do this");
    if (sameId(verificationCase.providerUserId, user.id))
      throw providerError.forbidden(
        "CONFLICT_OF_INTEREST",
        "You cannot review your own provider verification",
      );
  }

  /** The owner of the case, or any reviewer. Everyone else is told the case does not exist. */
  private async requireCaseFor(user: AuthenticatedUser, caseId: string): Promise<any> {
    const verificationCase: any = await this.cases.findById(toObjectId(caseId, "caseId")).lean();
    const allowed =
      verificationCase &&
      (sameId(verificationCase.providerUserId, user.id) || isVerificationReviewer(user));
    if (!allowed)
      throw providerError.notFound("VERIFICATION_CASE_NOT_FOUND", "Verification case not found");
    return verificationCase;
  }

  private async view(caseId: unknown, user: AuthenticatedUser, forceReviewer = false) {
    const row: any = await this.cases
      .findById(toObjectId(caseId, "caseId"))
      .select("+internalNote")
      .lean();
    const reviewer =
      (forceReviewer || isVerificationReviewer(user)) && !sameId(row.providerUserId, user.id);
    let evidenceQuery = this.evidence
      .find({ _id: { $in: row.evidenceIds } })
      .sort({ uploadedAt: 1 });
    // The storage key is select:false; only reviewers ever ask for it.
    if (reviewer) evidenceQuery = evidenceQuery.select("+objectStorageKey");
    const evidence: any[] = row.evidenceIds.length ? await evidenceQuery.lean() : [];
    return {
      ...this.caseSummary(row, reviewer),
      evidence: evidence.map((item) => this.evidenceView(item, reviewer)),
      requiredEvidence: REQUIRED_EVIDENCE[row.verificationType as VerificationCaseType],
      history: (row.history ?? []).map((entry: any) =>
        reviewer
          ? entry
          : { from: entry.from, to: entry.to, reasonCode: entry.reasonCode ?? null, at: entry.at },
      ),
      ...(reviewer ? { internalNote: row.internalNote ?? null } : {}),
    };
  }

  private caseSummary(row: any, reviewer: boolean) {
    return {
      id: idStr(row._id),
      providerId: idStr(row.providerId),
      verificationType: row.verificationType,
      status: row.status,
      submitted: Boolean(row.submittedAt),
      submittedAt: row.submittedAt ?? null,
      openedAt: row.openedAt,
      decidedAt: row.decidedAt ?? null,
      decisionReasonCode: row.decisionReasonCode ?? null,
      providerMessage: row.providerMessage ?? null,
      validUntil: row.validUntil ?? null,
      attempt: row.attempt ?? 1,
      previousCaseId: idStr(row.previousCaseId) ?? null,
      evidenceCount: (row.evidenceIds ?? []).length,
      ...(reviewer
        ? { reviewerUserId: idStr(row.reviewerUserId) ?? null }
        : { underReview: row.status === "IN_REVIEW" }),
    };
  }

  private evidenceView(item: any, reviewer: boolean) {
    return {
      id: idStr(item._id),
      evidenceType: item.evidenceType,
      label: item.label ?? null,
      mimeType: item.mimeType ?? null,
      sizeBytes: item.sizeBytes ?? null,
      malwareScanStatus: item.malwareScanStatus,
      uploadedAt: item.uploadedAt,
      ...(reviewer ? { sha256: item.sha256, objectStorageKey: item.objectStorageKey } : {}),
    };
  }
}
