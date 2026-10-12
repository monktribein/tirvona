import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import { TransactionService } from "../../../common/database/transaction.service";
import bcrypt from "bcryptjs";
import { canonicalPhone, phoneCandidates } from "../../../common/phone/phone.util";
import { uniqueSlug } from "../../../common/slug/slug.util";
import { escapeRegex } from "../../../common/utils/escape-regex";
import {
  VERIFICATION_RANK,
  type ProviderStatus,
  type VerificationLevel,
} from "../domain/provider.constants";
import { providerError } from "../domain/provider.errors";
import {
  listingBlockers,
  profileCompletion,
  toPublicProvider,
} from "../domain/provider-visibility";
import type {
  AdminProviderQueryDto,
} from "../presentation/dto/verification.dto";
import { pageParams } from "../presentation/dto/common.dto";
import type {
  AdminCreateProviderDto,
  AdminUpdateProviderDto,
  CreateProviderProfileDto,
  ProviderAdminActionDto,
  UpdateProviderProfileDto,
} from "../presentation/dto/provider.dto";
import { ProviderAuditService } from "./provider-audit.service";
import { ProviderProjectionService } from "./provider-projection.service";
import {
  idStr,
  paged,
  providerConfig,
  toObjectId,
  uniqueLower,
} from "./provider.helpers";

type Dto = CreateProviderProfileDto | UpdateProviderProfileDto;

const PUBLIC_FIELDS = [
  "providerType",
  "displayName",
  "bio",
  "avatarUrl",
  "languages",
  "traditions",
  "specializations",
  "experienceYears",
  "homeCity",
  "homeState",
] as const;

@Injectable()
export class ProviderProfileService {
  constructor(
    @InjectModel("ProviderProfile") private readonly profiles: Model<any>,
    @InjectModel("ProviderPrivateProfile") private readonly privates: Model<any>,
    @InjectModel("ProviderOffering") private readonly offerings: Model<any>,
    @InjectModel("ProviderAvailabilityRule") private readonly rules: Model<any>,
    @InjectModel("ProviderVerificationCase") private readonly verificationCases: Model<any>,
    @InjectModel("ProviderBooking") private readonly bookings: Model<any>,
    @InjectModel("ProviderConsultation") private readonly consultations: Model<any>,
    @InjectModel("User") private readonly users: Model<any>,
    private readonly transactions: TransactionService,
    private readonly audit: ProviderAuditService,
    private readonly projection: ProviderProjectionService,
  ) {}

  // ------------------------------------------------------------ ownership
  /** The caller's own provider profile (document) or 404. Never trusts a client-supplied id. */
  async requireOwn(user: AuthenticatedUser): Promise<any> {
    const profile = await this.profiles.findOne({ userId: toObjectId(user.id), deletedAt: null });
    if (!profile)
      throw providerError.notFound(
        "PROVIDER_PROFILE_NOT_FOUND",
        "You have not created a provider profile yet",
      );
    return profile;
  }

  /** Suspended providers keep read access but cannot change what they sell or when. */
  assertNotSuspended(profile: { status: string }) {
    if (profile.status === "SUSPENDED")
      throw providerError.forbidden(
        "PROVIDER_SUSPENDED",
        "Your provider account is suspended. Contact Tirvona support.",
      );
  }

  // --------------------------------------------------------------- create
  async create(user: AuthenticatedUser, dto: CreateProviderProfileDto) {
    return this.createFor(user, dto, user, "profile.created");
  }

  /**
   * Creates the profile and its private profile together (one transaction) for
   * `user`, on their own behalf or on behalf of an administrator. A new
   * provider always starts ONBOARDING and UNVERIFIED: verification only ever
   * comes from a reviewed case.
   */
  private async createFor(
    user: { id: string; name?: string; email?: string; phone?: string },
    dto: CreateProviderProfileDto,
    actor: AuthenticatedUser,
    auditAction: string,
  ) {
    if (await this.profiles.exists({ userId: toObjectId(user.id) }))
      throw providerError.conflict(
        "PROVIDER_PROFILE_EXISTS",
        "This account already has a provider profile",
      );
    this.assertConsultation(dto.providerType ?? "PANDIT", dto.consultation);

    const slug = await uniqueSlug(dto.displayName, {
      exists: async (candidate) =>
        Boolean(await this.profiles.exists({ slug: candidate })),
      fallback: "provider",
    });
    const publicFields = this.publicFields(dto);
    const mobile = dto.contactPhone ?? user.phone;

    let created: any;
    try {
      created = await this.transactions.run(async (session) => {
        const [profile] = await this.profiles.create(
          [
            {
              userId: toObjectId(user.id),
              slug,
              providerType: "PANDIT",
              languages: [],
              ...publicFields,
              serviceAreas: dto.serviceAreas ?? [],
              serviceCities: this.serviceCities(dto),
              travelProfile: dto.travelProfile ?? {},
              consultation: this.consultationValue(dto.consultation),
              status: "ONBOARDING",
              verificationLevel: "UNVERIFIED",
              verificationRank: 0,
              verification: {},
              isDevFixture: false,
            },
          ],
          { session },
        );
        await this.privates.create(
          [
            {
              providerId: profile._id,
              legalName: dto.legalName ?? user.name ?? dto.displayName,
              mobile: mobile ? canonicalPhone(mobile) : undefined,
              email: (dto.contactEmail ?? user.email)?.toLowerCase(),
              address: dto.address ?? null,
            },
          ],
          { session },
        );
        return profile;
      });
    } catch (error) {
      if ((error as { code?: number }).code === 11000)
        throw providerError.conflict(
          "PROVIDER_PROFILE_EXISTS",
          "You already have a provider profile",
        );
      throw error;
    }
    await this.projection.rebuild(created._id);
    await this.audit.log(actor, auditAction, "provider_profile", created._id, {
      providerType: created.providerType,
      ...(String(actor.id) !== String(user.id) ? { targetUserId: String(user.id) } : {}),
    });
    return { success: true, data: await this.ownerView(created._id) };
  }

  // ---------------------------------------------------------------- read
  async getOwn(user: AuthenticatedUser) {
    const profile = await this.requireOwn(user);
    return { success: true, data: await this.ownerView(profile._id) };
  }

  /** Public detail. Anything not publicly listable is "not found", not "forbidden". */
  async getPublic(idOrSlug: string) {
    const profile = await this.findPublicProfile(idOrSlug);
    return { success: true, data: toPublicProvider(profile) };
  }

  /** Resolves a publicly listable provider by id or slug, re-checking every listing rule at read time. */
  async findPublicProfile(idOrSlug: string): Promise<any> {
    const key = String(idOrSlug ?? "").trim().toLowerCase();
    const profile: any = /^[a-f0-9]{24}$/.test(key)
      ? await this.profiles.findOne({ _id: key, deletedAt: null }).lean()
      : await this.profiles.findOne({ slug: key, deletedAt: null }).lean();
    if (
      !profile ||
      listingBlockers(profile, {
        allowDevFixtures: providerConfig().allowDevFixtures,
      }).length > 0 ||
      !profile.isPubliclyListed
    )
      throw providerError.notFound("PROVIDER_NOT_FOUND", "Provider not found");
    return profile;
  }

  // -------------------------------------------------------------- update
  async update(user: AuthenticatedUser, dto: UpdateProviderProfileDto) {
    const profile = await this.requireOwn(user);
    this.assertNotSuspended(profile);
    const locked = (profile.verificationRank ?? 0) >= VERIFICATION_RANK.IDENTITY_VERIFIED;

    if (dto.providerType && dto.providerType !== profile.providerType && locked)
      throw providerError.conflict(
        "PROVIDER_TYPE_LOCKED",
        "The provider type cannot be changed after verification. Contact support.",
      );
    const priv: any = await this.privates.findOne({ providerId: profile._id });
    if (dto.legalName && locked && dto.legalName !== priv?.legalName)
      throw providerError.conflict(
        "LEGAL_NAME_LOCKED",
        "The legal name is tied to your verified identity. Open a new identity verification to change it.",
      );
    this.assertConsultation(dto.providerType ?? profile.providerType, dto.consultation);

    const publicFields = this.publicFields(dto);
    Object.assign(profile, publicFields);
    if (dto.serviceAreas !== undefined) profile.serviceAreas = dto.serviceAreas;
    if (dto.travelProfile !== undefined) profile.travelProfile = dto.travelProfile;
    if (dto.consultation !== undefined)
      profile.consultation = this.consultationValue(dto.consultation);
    if (
      dto.serviceAreas !== undefined ||
      dto.homeCity !== undefined
    )
      profile.serviceCities = this.serviceCities({
        homeCity: dto.homeCity ?? profile.homeCity,
        serviceAreas: dto.serviceAreas ?? profile.serviceAreas,
      });
    await profile.save();

    const privateFields: Record<string, unknown> = {};
    if (dto.legalName) privateFields.legalName = dto.legalName;
    if (dto.contactPhone) privateFields.mobile = canonicalPhone(dto.contactPhone);
    if (dto.contactEmail) privateFields.email = dto.contactEmail.toLowerCase();
    if (dto.address) privateFields.address = dto.address;
    if (Object.keys(privateFields).length)
      await this.privates.updateOne({ providerId: profile._id }, { $set: privateFields });

    await this.projection.rebuild(profile._id);
    await this.audit.log(user, "profile.updated", "provider_profile", profile._id, {
      fields: [...Object.keys(publicFields), ...Object.keys(privateFields)].map((field) =>
        field === "legalName" || field === "mobile" || field === "email" || field === "address"
          ? `private.${field}`
          : field,
      ),
    });
    return { success: true, data: await this.ownerView(profile._id) };
  }

  /** Provider-permitted status moves: ONBOARDING/INACTIVE -> ACTIVE (needs verified identity), ACTIVE -> INACTIVE. */
  async setOwnStatus(user: AuthenticatedUser, status: "ACTIVE" | "INACTIVE") {
    const profile = await this.requireOwn(user);
    this.assertNotSuspended(profile);
    if (profile.status === status) return { success: true, data: await this.ownerView(profile._id) };
    if (status === "ACTIVE") {
      const blockers = listingBlockers(
        { ...profile.toObject(), status: "ACTIVE" },
        { allowDevFixtures: true },
      ).filter((blocker) => blocker === "IDENTITY_NOT_VERIFIED" || blocker === "VERIFICATION_EXPIRED");
      if (blockers.length)
        throw providerError.conflict(
          "IDENTITY_VERIFICATION_REQUIRED",
          "Your identity must be verified before your profile can go live",
        );
    }
    const from = profile.status as ProviderStatus;
    const updated = await this.profiles.findOneAndUpdate(
      { _id: profile._id, status: from },
      { $set: { status, statusChangedAt: new Date(), statusChangedBy: user.id, statusReason: null } },
      { new: true },
    );
    if (!updated)
      throw providerError.conflict("PROVIDER_STATE_CONFLICT", "Your status changed; reload and retry");
    await this.projection.rebuild(profile._id);
    await this.audit.log(user, "profile.status_changed", "provider_profile", profile._id, { from, to: status });
    return { success: true, data: await this.ownerView(profile._id) };
  }

  // --------------------------------------------------------------- admin
  async listAdmin(query: AdminProviderQueryDto) {
    const { page, limit, skip } = pageParams(query);
    const filter: Record<string, unknown> = { deletedAt: null };
    if (query.status) filter.status = query.status;
    if (query.verificationLevel) filter.verificationLevel = query.verificationLevel;
    if (query.q) {
      const pattern = { $regex: escapeRegex(query.q), $options: "i" };
      filter.$or = [{ displayName: pattern }, { homeCity: pattern }];
    }
    const [rows, total] = await Promise.all([
      this.profiles.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      this.profiles.countDocuments(filter),
    ]);
    return paged(
      rows.map((row: any) => ({
        id: idStr(row._id),
        slug: row.slug,
        displayName: row.displayName,
        providerType: row.providerType,
        homeCity: row.homeCity ?? null,
        homeState: row.homeState ?? null,
        status: row.status,
        verificationLevel: row.verificationLevel,
        isPubliclyListed: Boolean(row.isPubliclyListed),
        activeOfferingCount: row.activeOfferingCount ?? 0,
        isDevFixture: Boolean(row.isDevFixture),
        createdAt: row.createdAt,
      })),
      total,
      page,
      limit,
    );
  }

  /** Public display names for a set of provider ids, for admin tables that only hold ids. */
  async displayNames(ids: string[]): Promise<Map<string, string>> {
    const unique = [...new Set(ids.filter((id) => /^[a-f0-9]{24}$/i.test(id)))];
    if (!unique.length) return new Map();
    const rows: any[] = await this.profiles.find({ _id: { $in: unique.map((id) => toObjectId(id)) } }).select("displayName").lean();
    return new Map(rows.map((row) => [idStr(row._id) as string, row.displayName as string]));
  }

  /** Restricted: includes the private profile. Every call is audited. */
  async getAdmin(actor: AuthenticatedUser, providerId: string) {
    const id = toObjectId(providerId, "providerId");
    const owner: any = await this.profiles.findById(id).select("userId").lean();
    if (!owner) throw providerError.notFound("PROVIDER_NOT_FOUND", "Provider not found");
    await this.audit.log(actor, "profile.private_viewed", "provider_profile", id);
    // The account id lets an administrator find the login that owns this profile.
    return { success: true, data: { ...(await this.ownerView(id)), userId: idStr(owner.userId) } };
  }

  async suspend(actor: AuthenticatedUser, providerId: string, dto: ProviderAdminActionDto) {
    const id = toObjectId(providerId, "providerId");
    const profile: any = await this.profiles.findById(id).lean();
    if (!profile) throw providerError.notFound("PROVIDER_NOT_FOUND", "Provider not found");
    if (profile.status === "SUSPENDED")
      throw providerError.conflict("PROVIDER_ALREADY_SUSPENDED", "Provider is already suspended");
    const updated = await this.profiles.findOneAndUpdate(
      { _id: id, status: profile.status },
      {
        $set: {
          status: "SUSPENDED",
          statusReason: dto.reasonCode,
          statusChangedAt: new Date(),
          statusChangedBy: actor.id,
        },
      },
      { new: true },
    );
    if (!updated)
      throw providerError.conflict("PROVIDER_STATE_CONFLICT", "Provider changed state; reload and retry");
    await this.projection.rebuild(id);
    await this.audit.log(actor, "profile.suspended", "provider_profile", id, {
      from: profile.status,
      reasonCode: dto.reasonCode,
    });
    return { success: true, data: await this.ownerView(id) };
  }

  /** Reinstates to INACTIVE; the provider then reactivates themselves once ready. */
  async reinstate(actor: AuthenticatedUser, providerId: string, dto: ProviderAdminActionDto) {
    const id = toObjectId(providerId, "providerId");
    const updated = await this.profiles.findOneAndUpdate(
      { _id: id, status: "SUSPENDED" },
      {
        $set: {
          status: "INACTIVE",
          statusReason: null,
          statusChangedAt: new Date(),
          statusChangedBy: actor.id,
        },
      },
      { new: true },
    );
    if (!updated)
      throw providerError.conflict("PROVIDER_NOT_SUSPENDED", "Provider is not suspended");
    await this.projection.rebuild(id);
    await this.audit.log(actor, "profile.reinstated", "provider_profile", id, {
      reasonCode: dto.reasonCode,
    });
    return { success: true, data: await this.ownerView(id) };
  }

  /** Dashboard counters, all computed from the database at request time. */
  async overview(_actor: AuthenticatedUser) {
    const live = { deletedAt: null };
    const [
      totalProviders, activeProviders, inactiveProviders, suspendedProviders, onboardingProviders,
      totalOfferings, publishedOfferings,
      awaitingReview, inReview, approvedVerifications, rejectedVerifications,
      totalBookings, upcomingBookings, awaitingPayment, completedBookings,
      totalConsultations, pendingConsultations,
      recentBookings, recentVerifications,
    ] = await Promise.all([
      this.profiles.countDocuments(live),
      this.profiles.countDocuments({ ...live, status: "ACTIVE" }),
      this.profiles.countDocuments({ ...live, status: "INACTIVE" }),
      this.profiles.countDocuments({ ...live, status: "SUSPENDED" }),
      this.profiles.countDocuments({ ...live, status: "ONBOARDING" }),
      this.offerings.countDocuments({}),
      this.offerings.countDocuments({ status: "ACTIVE" }),
      this.verificationCases.countDocuments({ status: "OPEN", submittedAt: { $ne: null } }),
      this.verificationCases.countDocuments({ status: "IN_REVIEW" }),
      this.verificationCases.countDocuments({ status: "APPROVED" }),
      this.verificationCases.countDocuments({ status: "REJECTED" }),
      this.bookings.countDocuments({}),
      this.bookings.countDocuments({
        status: { $in: ["CONFIRMED", "PROVIDER_ACCEPTED", "PREPARATION_IN_PROGRESS", "READY_FOR_FULFILMENT", "IN_PROGRESS"] },
      }),
      this.bookings.countDocuments({ status: "PAYMENT_PENDING" }),
      this.bookings.countDocuments({ status: { $in: ["COMPLETED", "SETTLEMENT_PENDING", "CLOSED"] } }),
      this.consultations.countDocuments({}),
      this.consultations.countDocuments({ status: "REQUESTED" }),
      this.bookings.find({}).sort({ createdAt: -1 }).limit(5).lean(),
      this.verificationCases.find({}).sort({ openedAt: -1 }).limit(5).lean(),
    ]);
    return {
      success: true,
      data: {
        totalProviders, activeProviders, inactiveProviders, suspendedProviders, onboardingProviders,
        totalOfferings, publishedOfferings,
        pendingVerifications: awaitingReview + inReview,
        awaitingReview, inReview, approvedVerifications, rejectedVerifications,
        totalBookings, upcomingBookings, awaitingPayment, completedBookings,
        totalConsultations, pendingConsultations,
        recentBookings: (recentBookings as any[]).map((b) => ({
          id: idStr(b._id), bookingNumber: b.bookingNumber, status: b.status,
          scheduledStartAt: b.scheduledStartAt, createdAt: b.createdAt,
        })),
        recentVerifications: (recentVerifications as any[]).map((v) => ({
          id: idStr(v._id), providerId: idStr(v.providerId), verificationType: v.verificationType,
          status: v.status, openedAt: v.openedAt,
        })),
      },
    };
  }

  /** Super Admin onboarding of a provider for an existing account. Same ownership, status and verification rules as self-service. */
  async createAdmin(actor: AuthenticatedUser, dto: AdminCreateProviderDto) {
    const { userId, email, phone, password, ...profile } = dto;
    if (userId) {
      if (email || phone || password)
        throw providerError.badRequest("ACCOUNT_FIELDS_NOT_ALLOWED", "Email, phone and password apply only when a new account is created.");
      const account: any = await this.users
        .findOne({ _id: toObjectId(userId, "userId"), isDeleted: { $ne: true } })
        .select("name email phone status")
        .lean();
      if (!account || account.status !== "active")
        throw providerError.notFound("USER_NOT_FOUND", "No active account with that id");
      return this.createFor(
        { id: String(account._id), name: account.name, email: account.email, phone: account.phone },
        profile as CreateProviderProfileDto,
        actor,
        "profile.admin_created",
      );
    }
    if (!email || !phone || !password)
      throw providerError.badRequest("ACCOUNT_DETAILS_REQUIRED", "Email, phone and password are required to create the provider's login.");

    const loginEmail = email.trim().toLowerCase();
    const loginPhone = canonicalPhone(phone);
    if (await this.users.exists({ email: loginEmail }))
      throw providerError.conflict("EMAIL_ALREADY_REGISTERED", "An account with this email already exists");
    if (await this.users.exists({ phone: { $in: phoneCandidates(phone) } }))
      throw providerError.conflict("PHONE_ALREADY_REGISTERED", "An account with this phone number already exists");

    // The account is created active and verified with the pandit role; the provider signs in with the password the administrator set.
    const account: any = await this.users.create({
      name: profile.legalName ?? profile.displayName,
      email: loginEmail,
      phone: loginPhone,
      passwordHash: await bcrypt.hash(password, 12),
      role: "pandit_provider",
      status: "active",
      isVerified: true,
    });
    try {
      return await this.createFor(
        { id: String(account._id), name: account.name, email: loginEmail, phone: loginPhone },
        profile as CreateProviderProfileDto,
        actor,
        "profile.admin_created",
      );
    } catch (error) {
      // Do not leave a login without a profile behind.
      await this.users.deleteOne({ _id: account._id });
      throw error;
    }
  }

  /** Public-profile edits by an administrator. Status moves only to ACTIVE/INACTIVE and never past a missing identity check or a suspension. */
  async updateAdmin(actor: AuthenticatedUser, providerId: string, dto: AdminUpdateProviderDto) {
    const id = toObjectId(providerId, "providerId");
    const profile: any = await this.profiles.findOne({ _id: id, deletedAt: null });
    if (!profile) throw providerError.notFound("PROVIDER_NOT_FOUND", "Provider not found");
    const locked = (profile.verificationRank ?? 0) >= VERIFICATION_RANK.IDENTITY_VERIFIED;
    if (dto.providerType && dto.providerType !== profile.providerType && locked)
      throw providerError.conflict("PROVIDER_TYPE_LOCKED", "The provider type cannot be changed after verification.");

    const fields: Record<string, unknown> = this.publicFields(dto);
    if (dto.status) {
      if (profile.status === "SUSPENDED")
        throw providerError.conflict("PROVIDER_SUSPENDED", "Reinstate the provider before changing its status");
      if (
        dto.status === "ACTIVE" &&
        (!profile.verificationRank || (profile.identityVerifiedUntil && profile.identityVerifiedUntil <= new Date()))
      )
        throw providerError.conflict("IDENTITY_VERIFICATION_REQUIRED", "Identity must be verified before the profile can go live");
      Object.assign(fields, { status: dto.status, statusChangedAt: new Date(), statusChangedBy: actor.id, statusReason: null });
    }
    if (!Object.keys(fields).length)
      throw providerError.badRequest("NOTHING_TO_UPDATE", "No changes supplied");
    Object.assign(profile, fields);
    if (dto.homeCity !== undefined)
      profile.serviceCities = this.serviceCities({ homeCity: profile.homeCity, serviceAreas: profile.serviceAreas });
    await profile.save();
    await this.projection.rebuild(id);
    // Field names only: the values may be personal.
    await this.audit.log(actor, "profile.admin_updated", "provider_profile", id, { fields: Object.keys(fields) });
    return { success: true, data: await this.ownerView(id) };
  }

  // ----------------------------------------------------------- internals
  async ownerView(providerId: unknown) {
    const id = toObjectId(providerId, "providerId");
    const [profile, priv, offeringCount, ruleCount]: [any, any, number, number] =
      await Promise.all([
        this.profiles.findById(id).lean(),
        this.privates.findOne({ providerId: id }).lean(),
        this.offerings.countDocuments({ providerId: id, status: "ACTIVE" }),
        this.rules.countDocuments({ resourceType: "PROVIDER", resourceId: id, status: "ACTIVE" }),
      ]);
    if (!profile) throw providerError.notFound("PROVIDER_NOT_FOUND", "Provider not found");
    const completion = profileCompletion(profile, {
      hasOffering: offeringCount > 0,
      hasAvailability: ruleCount > 0,
    });
    const verification = Object.fromEntries(
      Object.entries(profile.verification ?? {}).map(([type, entry]: [string, any]) => [
        type,
        {
          caseId: idStr(entry.caseId),
          approvedAt: entry.approvedAt ?? null,
          validUntil: entry.validUntil ?? null,
        },
      ]),
    );
    return {
      id: idStr(profile._id),
      slug: profile.slug,
      providerType: profile.providerType,
      displayName: profile.displayName,
      bio: profile.bio ?? null,
      avatarUrl: profile.avatarUrl ?? null,
      languages: profile.languages ?? [],
      traditions: profile.traditions ?? [],
      specializations: profile.specializations ?? [],
      experienceYears: profile.experienceYears ?? null,
      homeCity: profile.homeCity ?? null,
      homeState: profile.homeState ?? null,
      serviceAreas: profile.serviceAreas ?? [],
      travelProfile: profile.travelProfile ?? {},
      consultation: profile.consultation ?? { enabled: false },
      status: profile.status,
      statusReason: profile.statusReason ?? null,
      verificationLevel: profile.verificationLevel as VerificationLevel,
      verification,
      contactEmail: priv?.email ?? null,
      contactPhone: priv?.mobile ?? null,
      legalName: priv?.legalName ?? null,
      address: priv?.address ?? null,
      isActive: profile.status === "ACTIVE",
      profileCompletionPercent: completion.percent,
      missingSteps: completion.missing,
      listing: {
        isPubliclyListed: Boolean(profile.isPubliclyListed),
        blockers: listingBlockers(profile, {
          allowDevFixtures: providerConfig().allowDevFixtures,
        }),
      },
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };
  }

  private publicFields(dto: Dto): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const field of PUBLIC_FIELDS)
      if (dto[field] !== undefined) out[field] = dto[field];
    return out;
  }

  private serviceCities(source: {
    homeCity?: string;
    serviceAreas?: Array<{ city: string }>;
  }): string[] {
    return uniqueLower([
      source.homeCity,
      ...(source.serviceAreas ?? []).map((area) => area.city),
    ]);
  }

  private consultationValue(input?: {
    enabled: boolean;
    feeMinor?: number;
    currency?: string;
    slotMinutes?: number;
    channels?: string[];
  }) {
    if (!input || !input.enabled) return { enabled: false };
    return {
      enabled: true,
      feeMinor: input.feeMinor ?? 0,
      currency: input.currency ?? "INR",
      slotMinutes: input.slotMinutes ?? 30,
      channels: input.channels?.length ? input.channels : ["CHAT"],
    };
  }

  private assertConsultation(
    providerType: string,
    consultation?: { enabled: boolean },
  ) {
    if (consultation?.enabled && providerType === "PROVIDER_TEAM")
      throw providerError.unprocessable(
        "CONSULTATION_NOT_SUPPORTED",
        "A provider team cannot offer one-to-one consultations",
      );
  }
}
