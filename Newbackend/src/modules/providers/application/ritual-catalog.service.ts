import type { RitualProcessDto } from "../presentation/dto/catalog.dto";
import { Injectable } from "@nestjs/common";
import { InjectModel } from "../../../database/orm-nest";
import type { Model } from "../../../database/orm";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import { uniqueSlug } from "../../../common/slug/slug.util";
import { escapeRegex } from "../../../common/utils/escape-regex";
import {
  RITUAL_TRANSITIONS,
  type RitualStatus,
} from "../domain/provider.constants";
import { providerError } from "../domain/provider.errors";
import type {
  AdminRitualQueryDto,
  CreateRitualDto,
  CreateRitualVariantDto,
  RitualSearchQueryDto,
  UpdateRitualDto,
  UpdateRitualVariantDto,
} from "../presentation/dto/catalog.dto";
import { pageParams } from "../presentation/dto/common.dto";
import { ProviderAuditService } from "./provider-audit.service";
import { ProviderProjectionService } from "./provider-projection.service";
import { idStr, paged, providerConfig, sameId, toObjectId } from "./provider.helpers";

const SCOPE_KEYS = new Set([
  "inclusions",
  "indicativeMantraCount",
  "durationBand",
  "teamSize",
  "steps",
  "notes",
]);

/** Variant scope is schema-validated (Data Dictionary 7.18); unknown keys are refused, not stored. */
export const validateVariantScope = (scope: Record<string, unknown>): void => {
  const invalid = (message: string) =>
    providerError.badRequest("VARIANT_SCOPE_INVALID", message);
  if (!scope || typeof scope !== "object" || Array.isArray(scope))
    throw invalid("scope must be an object");
  for (const key of Object.keys(scope))
    if (!SCOPE_KEYS.has(key)) throw invalid(`scope.${key} is not a supported field`);
  const strings = (name: string, max: number, itemMax: number) => {
    const value = scope[name];
    if (value === undefined) return;
    if (
      !Array.isArray(value) ||
      value.length > max ||
      value.some((item) => typeof item !== "string" || !item.trim() || item.length > itemMax)
    )
      throw invalid(`scope.${name} must be up to ${max} short texts`);
  };
  strings("inclusions", 30, 200);
  strings("steps", 40, 300);
  if (scope.notes !== undefined && (typeof scope.notes !== "string" || scope.notes.length > 1000))
    throw invalid("scope.notes must be text up to 1000 characters");
  const count = scope.indicativeMantraCount;
  if (count !== undefined && (!Number.isInteger(count) || (count as number) < 1 || (count as number) > 100_000))
    throw invalid("scope.indicativeMantraCount must be a positive whole number");
  const range = (name: string, minKey: string, maxKey: string, ceiling: number) => {
    const value = scope[name] as Record<string, unknown> | undefined;
    if (value === undefined) return;
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw invalid(`scope.${name} must be an object`);
    const min = value[minKey];
    const max = value[maxKey];
    const ok = (n: unknown) => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= ceiling;
    if (!ok(min) || !ok(max) || (min as number) > (max as number))
      throw invalid(`scope.${name} needs whole numbers ${minKey} <= ${maxKey} (max ${ceiling})`);
  };
  range("durationBand", "minMinutes", "maxMinutes", 2880);
  range("teamSize", "min", "max", 50);
};

const searchTextOf = (content: any): string =>
  [
    ...Object.values(content.titles ?? {}),
    ...(content.aliases ?? []),
    content.category ?? "",
  ]
    .map((part) => String(part).toLowerCase())
    .join(" ");

/** Public ritual page = the last published snapshot, never the working draft. */
export const toPublicRitual = (ritual: any) => {
  const content = ritual.publishedContent ?? {};
  return {
    id: idStr(ritual._id),
    slug: ritual.slug,
    titles: content.titles ?? {},
    summary: content.summary ?? {},
    category: content.category ?? null,
    aliases: content.aliases ?? [],
    applicableFulfilmentTypes: content.applicableFulfilmentTypes ?? [],
    defaultDurationMinutes: content.defaultDurationMinutes ?? null,
    contentVersion: content.version ?? 1,
    publishedAt: ritual.publishedAt ?? null,
    process: ritual.process ?? null,
  };
};

export const toPublicVariant = (variant: any) => ({
  id: idStr(variant._id),
  ritualId: idStr(variant.ritualId),
  code: variant.code,
  titles: variant.titles,
  scope: variant.scope,
});

const adminRitual = (ritual: any) => ({
  id: idStr(ritual._id),
  slug: ritual.slug,
  titles: ritual.titles,
  summary: ritual.summary,
  category: ritual.category ?? null,
  aliases: ritual.aliases ?? [],
  applicableFulfilmentTypes: ritual.applicableFulfilmentTypes ?? [],
  defaultDurationMinutes: ritual.defaultDurationMinutes ?? null,
  status: ritual.status,
  contentVersion: ritual.contentVersion,
  isListed: Boolean(ritual.isListed),
  publishedVersion: ritual.publishedContent?.version ?? null,
  publishedAt: ritual.publishedAt ?? null,
  createdBy: idStr(ritual.createdBy) ?? null,
  submittedBy: idStr(ritual.submittedBy) ?? null,
  approvedBy: idStr(ritual.approvedBy) ?? null,
  createdAt: ritual.createdAt,
  updatedAt: ritual.updatedAt,
  process: ritual.process ?? null,
  processUpdatedAt: ritual.processUpdatedAt ?? null,
});

@Injectable()
export class RitualCatalogService {
  constructor(
    @InjectModel("ProviderRitual") private readonly rituals: Model<any>,
    @InjectModel("ProviderRitualVariant") private readonly variants: Model<any>,
    private readonly audit: ProviderAuditService,
    private readonly projection: ProviderProjectionService,
  ) {}

  // ------------------------------------------------------------- public
  async listPublic(query: RitualSearchQueryDto) {
    const { page, limit, skip } = pageParams(query);
    const filter: Record<string, unknown> = { isListed: true };
    if (!providerConfig().allowDevFixtures) filter.isDevFixture = { $ne: true };
    if (query.category) filter.category = query.category;
    if (query.q)
      filter.searchText = { $regex: escapeRegex(query.q.toLowerCase()) };
    if (query.fulfilmentType)
      filter["publishedContent.applicableFulfilmentTypes"] = query.fulfilmentType;
    const [rows, total] = await Promise.all([
      this.rituals.find(filter).sort({ slug: 1 }).skip(skip).limit(limit).lean(),
      this.rituals.countDocuments(filter),
    ]);
    return paged(rows.map(toPublicRitual), total, page, limit);
  }

  async findListed(idOrSlug: string): Promise<any> {
    const ritual = await this.findByIdOrSlug(idOrSlug);
    if (!ritual?.isListed || (ritual.isDevFixture && !providerConfig().allowDevFixtures))
      throw providerError.notFound("RITUAL_NOT_FOUND", "Ritual not found");
    return ritual;
  }

  async getPublic(idOrSlug: string) {
    return { success: true, data: toPublicRitual(await this.findListed(idOrSlug)) };
  }

  async listPublicVariants(idOrSlug: string) {
    const ritual = await this.findListed(idOrSlug);
    const variants = await this.variants
      .find({ ritualId: ritual._id, status: "ACTIVE" })
      .sort({ code: 1 })
      .lean();
    return { success: true, data: variants.map(toPublicVariant) };
  }

  // -------------------------------------------------------------- admin
  async list(query: AdminRitualQueryDto) {
    const { page, limit, skip } = pageParams(query);
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    if (query.q) filter.slug = { $regex: escapeRegex(query.q.toLowerCase()) };
    const [rows, total] = await Promise.all([
      this.rituals.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean(),
      this.rituals.countDocuments(filter),
    ]);
    return paged(rows.map(adminRitual), total, page, limit);
  }

  async get(id: string) {
    const ritual = await this.requireRitual(id);
    const variants = await this.variants.find({ ritualId: ritual._id }).sort({ code: 1 }).lean();
    return {
      success: true,
      data: {
        ...adminRitual(ritual),
        variants: variants.map((v: any) => ({
          id: idStr(v._id),
          code: v.code,
          titles: v.titles,
          scope: v.scope,
          status: v.status,
        })),
      },
    };
  }

  async create(user: AuthenticatedUser, dto: CreateRitualDto) {
    const slug =
      dto.slug ??
      (await uniqueSlug(dto.titles.en, {
        exists: async (candidate) => Boolean(await this.rituals.exists({ slug: candidate })),
        fallback: "ritual",
      }));
    try {
      const ritual = await this.rituals.create({
        slug,
        titles: dto.titles,
        summary: dto.summary,
        category: dto.category,
        aliases: dto.aliases ?? [],
        applicableFulfilmentTypes: dto.applicableFulfilmentTypes,
        defaultDurationMinutes: dto.defaultDurationMinutes ?? null,
        status: "DRAFT",
        contentVersion: 1,
        createdBy: user.id,
      });
      await this.audit.log(user, "ritual.created", "ritual", ritual._id, { slug });
      return { success: true, data: adminRitual(ritual.toObject()) };
    } catch (error) {
      if ((error as { code?: number }).code === 11000)
        throw providerError.conflict("RITUAL_SLUG_TAKEN", `The slug "${slug}" is already used`);
      throw error;
    }
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateRitualDto) {
    const ritual = await this.requireRitual(id);
    if (ritual.status !== "DRAFT")
      throw providerError.conflict(
        "RITUAL_NOT_EDITABLE",
        "Only a draft can be edited. Use revise to start a new version of reviewed or published content.",
      );
    const fields: Record<string, unknown> = {};
    for (const key of [
      "titles",
      "summary",
      "category",
      "aliases",
      "applicableFulfilmentTypes",
      "defaultDurationMinutes",
    ] as const)
      if (dto[key] !== undefined) fields[key] = dto[key];
    if (dto.slug && dto.slug !== ritual.slug)
      throw providerError.badRequest("RITUAL_SLUG_IMMUTABLE", "A ritual's slug cannot be changed");
    const updated = await this.rituals.findOneAndUpdate(
      { _id: ritual._id, status: "DRAFT" },
      { $set: fields },
      { new: true },
    );
    if (!updated)
      throw providerError.conflict("RITUAL_STATE_CONFLICT", "The ritual changed state; reload and retry");
    await this.audit.log(user, "ritual.updated", "ritual", ritual._id, {
      fields: Object.keys(fields),
    });
    return { success: true, data: adminRitual(updated.toObject()) };
  }

  /** DRAFT -> DOMAIN_REVIEW. */
  async submitReview(user: AuthenticatedUser, id: string) {
    const ritual = await this.requireRitual(id);
    this.assertTransition(ritual.status, "DOMAIN_REVIEW");
    if (!ritual.titles?.en || !ritual.summary?.en || !ritual.applicableFulfilmentTypes?.length)
      throw providerError.unprocessable(
        "RITUAL_INCOMPLETE",
        "An English title, an English summary and at least one fulfilment type are required before review",
      );
    return this.move(user, ritual, "DOMAIN_REVIEW", { submittedBy: user.id }, "ritual.submitted");
  }

  /** DOMAIN_REVIEW -> APPROVED. The reviewer must not be the person who submitted it. */
  async approve(user: AuthenticatedUser, id: string, note?: string) {
    const ritual = await this.requireRitual(id);
    this.assertTransition(ritual.status, "APPROVED");
    const selfReview =
      sameId(ritual.submittedBy, user.id) || sameId(ritual.createdBy, user.id);
    if (selfReview && user.role !== "super_admin")
      throw providerError.forbidden(
        "MAKER_CHECKER_VIOLATION",
        "Content must be approved by someone other than its author or submitter",
      );
    return this.move(user, ritual, "APPROVED", { approvedBy: user.id }, "ritual.approved", {
      selfApproved: selfReview,
      note,
    });
  }

  /** APPROVED -> PUBLISHED: snapshots the working copy as the live page. */
  async publish(user: AuthenticatedUser, id: string) {
    const ritual = await this.requireRitual(id);
    this.assertTransition(ritual.status, "PUBLISHED");
    const content = {
      titles: ritual.titles,
      summary: ritual.summary,
      category: ritual.category ?? null,
      aliases: ritual.aliases ?? [],
      applicableFulfilmentTypes: ritual.applicableFulfilmentTypes,
      defaultDurationMinutes: ritual.defaultDurationMinutes ?? null,
      version: ritual.contentVersion,
    };
    const result = await this.move(
      user,
      ritual,
      "PUBLISHED",
      {
        publishedBy: user.id,
        publishedAt: new Date(),
        publishedContent: content,
        searchText: searchTextOf(content),
        isListed: true,
      },
      "ritual.published",
      { version: ritual.contentVersion },
    );
    await this.projection.rebuildForRitual(ritual._id);
    return result;
  }

  /**
   * Sends reviewed or published content back to DRAFT. A published page stays
   * live (public reads use `publishedContent`) while the next version is
   * edited; the working copy moves to version + 1.
   */
  async revise(user: AuthenticatedUser, id: string, note?: string) {
    const ritual = await this.requireRitual(id);
    this.assertTransition(ritual.status, "DRAFT");
    const bump = ritual.status === "PUBLISHED" ? { contentVersion: ritual.contentVersion + 1 } : {};
    return this.move(user, ritual, "DRAFT", bump, "ritual.revised", { note });
  }

  /** Takes the ritual out of the catalogue. Existing bookings keep their snapshot. */
  async archive(user: AuthenticatedUser, id: string, note?: string) {
    const ritual = await this.requireRitual(id);
    this.assertTransition(ritual.status, "ARCHIVED");
    const result = await this.move(
      user,
      ritual,
      "ARCHIVED",
      { isListed: false },
      "ritual.archived",
      { note },
    );
    await this.projection.rebuildForRitual(ritual._id);
    return result;
  }

  // ----------------------------------------------------------- variants
  async createVariant(user: AuthenticatedUser, ritualId: string, dto: CreateRitualVariantDto) {
    const ritual = await this.requireRitual(ritualId);
    if (ritual.status === "ARCHIVED")
      throw providerError.conflict("RITUAL_ARCHIVED", "Variants cannot be added to an archived ritual");
    validateVariantScope(dto.scope);
    try {
      const variant = await this.variants.create({
        ritualId: ritual._id,
        code: dto.code,
        titles: dto.titles,
        scope: dto.scope,
        status: "ACTIVE",
        createdBy: user.id,
      });
      await this.audit.log(user, "ritual_variant.created", "ritual_variant", variant._id, {
        ritualId: idStr(ritual._id),
        code: dto.code,
      });
      return { success: true, data: this.adminVariant(variant.toObject()) };
    } catch (error) {
      if ((error as { code?: number }).code === 11000)
        throw providerError.conflict(
          "VARIANT_CODE_TAKEN",
          `This ritual already has a variant "${dto.code}"`,
        );
      throw error;
    }
  }

  async updateVariant(user: AuthenticatedUser, variantId: string, dto: UpdateRitualVariantDto) {
    const variant: any = await this.variants.findById(toObjectId(variantId, "variantId"));
    if (!variant) throw providerError.notFound("VARIANT_NOT_FOUND", "Variant not found");
    const fields: Record<string, unknown> = {};
    if (dto.titles) fields.titles = dto.titles;
    if (dto.scope) {
      validateVariantScope(dto.scope);
      fields.scope = dto.scope;
    }
    if (dto.status) fields.status = dto.status;
    if (!Object.keys(fields).length)
      throw providerError.badRequest("NOTHING_TO_UPDATE", "No changes supplied");
    const updated = await this.variants.findOneAndUpdate(
      { _id: variant._id },
      { $set: fields },
      { new: true },
    );
    await this.audit.log(user, "ritual_variant.updated", "ritual_variant", variant._id, {
      fields: Object.keys(fields),
    });
    if (dto.status && dto.status !== variant.status)
      await this.projection.rebuildForVariant(variant._id);
    return { success: true, data: this.adminVariant(updated!.toObject()) };
  }

  // ------------------------------------------------------------ helpers
  /** Used by offerings: the variant, its ritual, and whether both are currently sellable. */
  async resolveSellableVariant(variantId: string): Promise<{ variant: any; ritual: any }> {
    const variant: any = await this.variants.findById(toObjectId(variantId, "ritualVariantId")).lean();
    if (!variant || variant.status !== "ACTIVE")
      throw providerError.unprocessable(
        "VARIANT_NOT_AVAILABLE",
        "That ritual variant does not exist or is not active",
      );
    const ritual: any = await this.rituals.findById(variant.ritualId).lean();
    if (
      !ritual?.isListed ||
      ritual.status === "ARCHIVED" ||
      (ritual.isDevFixture && !providerConfig().allowDevFixtures)
    )
      throw providerError.unprocessable(
        "RITUAL_NOT_PUBLISHED",
        "That ritual is not published in the catalogue",
      );
    return { variant, ritual };
  }

  async titlesFor(
    variantIds: string[],
  ): Promise<Map<string, { variant: any; ritual: any }>> {
    const out = new Map<string, { variant: any; ritual: any }>();
    if (!variantIds.length) return out;
    const variants: any[] = await this.variants
      .find({ _id: { $in: variantIds.map((id) => toObjectId(id)) } })
      .lean();
    const rituals: any[] = variants.length
      ? await this.rituals
          .find({ _id: { $in: [...new Set(variants.map((v) => String(v.ritualId)))].map((id) => toObjectId(id)) } })
          .lean()
      : [];
    const ritualById = new Map(rituals.map((r) => [String(r._id), r]));
    for (const variant of variants) {
      const ritual = ritualById.get(String(variant.ritualId));
      out.set(String(variant._id), {
        variant: { id: idStr(variant._id), code: variant.code, titles: variant.titles },
        ritual: ritual
          ? {
              id: idStr(ritual._id),
              slug: ritual.slug,
              titles: ritual.publishedContent?.titles ?? ritual.titles,
              version: ritual.publishedContent?.version ?? null,
            }
          : null,
      });
    }
    return out;
  }

  private adminVariant(variant: any) {
    return {
      id: idStr(variant._id),
      ritualId: idStr(variant.ritualId),
      code: variant.code,
      titles: variant.titles,
      scope: variant.scope,
      status: variant.status,
    };
  }

  private assertTransition(from: RitualStatus, to: RitualStatus) {
    if (!RITUAL_TRANSITIONS[from]?.includes(to))
      throw providerError.conflict(
        "RITUAL_INVALID_TRANSITION",
        `A ritual in ${from} cannot move to ${to}`,
      );
  }

  /** Conditional move: two reviewers acting at once cannot both succeed. */
  private async move(
    user: AuthenticatedUser,
    ritual: any,
    to: RitualStatus,
    set: Record<string, unknown>,
    action: string,
    details: Record<string, unknown> = {},
  ) {
    const updated = await this.rituals.findOneAndUpdate(
      { _id: ritual._id, status: ritual.status },
      { $set: { ...set, status: to } },
      { new: true },
    );
    if (!updated)
      throw providerError.conflict(
        "RITUAL_STATE_CONFLICT",
        "The ritual changed state while you were working; reload and retry",
      );
    await this.audit.log(user, action, "ritual", ritual._id, {
      from: ritual.status,
      to,
      ...details,
    });
    return { success: true, data: adminRitual(updated.toObject()) };
  }

  private async findByIdOrSlug(idOrSlug: string): Promise<any | null> {
    const key = String(idOrSlug ?? "").trim().toLowerCase();
    if (/^[a-f0-9]{24}$/.test(key)) {
      const byId = await this.rituals.findById(key).lean();
      if (byId) return byId;
    }
    return this.rituals.findOne({ slug: key }).lean();
  }

  /**
   * Sets the puja's step-by-step guide (before the pandit arrives, during, after).
   * Shown to devotees and pandits at once; it is guidance, not the reviewed
   * catalogue content, so it does not go through draft/review/publish.
   */
  async setProcess(user: AuthenticatedUser, id: string, dto: RitualProcessDto) {
    const ritual = await this.requireRitual(id);
    const clean = (steps?: Array<{ title: string; detail?: string; owner?: string }>) =>
      (steps ?? [])
        .map((step) => ({ title: step.title.trim(), detail: step.detail?.trim() || null, owner: step.owner ?? "BOTH" }))
        .filter((step) => step.title.length > 0);
    const process = { before: clean(dto.before), during: clean(dto.during), after: clean(dto.after) };
    const empty = !process.before.length && !process.during.length && !process.after.length;
    await this.rituals.updateOne(
      { _id: ritual._id },
      { $set: { process: empty ? null : process, processUpdatedAt: new Date(), processUpdatedBy: toObjectId(user.id) } },
    );
    await this.audit.log(user, "ritual.process.updated", "ritual", ritual._id, {
      before: process.before.length,
      during: process.during.length,
      after: process.after.length,
    });
    return this.get(String(ritual._id));
  }

  private async requireRitual(id: string): Promise<any> {
    const ritual: any = await this.findByIdOrSlug(id);
    if (!ritual) throw providerError.notFound("RITUAL_NOT_FOUND", "Ritual not found");
    return ritual;
  }
}
