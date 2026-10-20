import { Injectable } from "@nestjs/common";
import { InjectModel } from "../../../database/orm-nest";
import type { Model } from "../../../database/orm";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import { toPublicOffering } from "../domain/provider-visibility";
import { providerError } from "../domain/provider.errors";
import { pageParams } from "../presentation/dto/common.dto";
import type {
  AdminOfferingQueryDto,
  CreateOfferingDto,
  PublicOfferingsQueryDto,
  UpdateOfferingDto,
} from "../presentation/dto/provider.dto";
import { ProviderAuditService } from "./provider-audit.service";
import { ProviderProfileService } from "./provider-profile.service";
import { ProviderProjectionService, isSellable } from "./provider-projection.service";
import { RitualCatalogService } from "./ritual-catalog.service";
import { idStr, paged, sameId, toObjectId } from "./provider.helpers";

const MAX_OFFERINGS_PER_PROVIDER = 100;

/** Owner's view: unlike the public one it includes lifecycle state. */
const ownerOffering = (offering: any, catalogue?: { ritual?: any; variant?: any }) => ({
  ...toPublicOffering(offering, catalogue),
  status: offering.status,
  createdAt: offering.createdAt,
  updatedAt: offering.updatedAt,
});

@Injectable()
export class ProviderOfferingService {
  constructor(
    @InjectModel("ProviderOffering") private readonly offerings: Model<any>,
    @InjectModel("ProviderRitual") private readonly rituals: Model<any>,
    @InjectModel("ProviderRitualVariant") private readonly variants: Model<any>,
    private readonly profiles: ProviderProfileService,
    private readonly catalogue: RitualCatalogService,
    private readonly projection: ProviderProjectionService,
    private readonly audit: ProviderAuditService,
  ) {}

  async create(user: AuthenticatedUser, dto: CreateOfferingDto) {
    const provider = await this.profiles.requireOwn(user);
    this.profiles.assertNotSuspended(provider);
    if (provider.providerType === "JYOTISHI")
      throw providerError.unprocessable(
        "PROVIDER_TYPE_CANNOT_OFFER_RITUALS",
        "Jyotish guidance stays separate from puja booking. Jyotishi providers offer consultations instead of ritual services.",
      );
    if (
      (await this.offerings.countDocuments({
        providerId: provider._id,
        status: { $ne: "INACTIVE" },
      })) >= MAX_OFFERINGS_PER_PROVIDER
    )
      throw providerError.unprocessable(
        "OFFERING_LIMIT_REACHED",
        `A provider can have at most ${MAX_OFFERINGS_PER_PROVIDER} live offerings`,
      );

    const { variant, ritual } = await this.catalogue.resolveSellableVariant(dto.ritualVariantId);
    this.assertRules(dto, ritual);

    let offering: any;
    try {
      offering = await this.offerings.create({
        providerId: provider._id,
        ritualId: ritual._id,
        ritualVariantId: variant._id,
        fulfilmentType: dto.fulfilmentType,
        title: dto.title,
        description: dto.description,
        destination: dto.destination ?? null,
        durationMinutes: dto.durationMinutes,
        teamSize: dto.teamSize ?? 1,
        minNoticeHours: dto.minNoticeHours ?? 24,
        baseProfessionalFeeMinor: dto.baseProfessionalFeeMinor,
        currency: dto.currency ?? "INR",
        travelCharge: this.travelCharge(dto.travelCharge),
        inclusions: dto.inclusions ?? [],
        exclusions: dto.exclusions ?? [],
        samagriIncluded: dto.samagriIncluded ?? false,
        voluntaryDakshinaAllowed: dto.voluntaryDakshinaAllowed ?? true,
        tags: dto.tags ?? [],
        status: dto.status ?? "ACTIVE",
        serviceType: dto.serviceType ?? "INDIVIDUAL",
        groupCapacity: dto.groupCapacity ?? null,
        kathaDetails: dto.kathaDetails ?? null,
        advancePercentage: dto.advancePercentage ?? 50,
      });
    } catch (error) {
      if ((error as { code?: number }).code === 11000)
        throw providerError.conflict(
          "OFFERING_ALREADY_EXISTS",
          "You already offer this ritual variant with this fulfilment type. Edit that offering instead.",
        );
      throw error;
    }
    await this.projection.rebuild(provider._id);
    await this.audit.log(user, "offering.created", "provider_offering", offering._id, {
      providerId: idStr(provider._id),
      ritualVariantId: idStr(variant._id),
      fulfilmentType: dto.fulfilmentType,
    });
    return { success: true, data: await this.ownerOne(offering.toObject()) };
  }

  async update(user: AuthenticatedUser, offeringId: string, dto: UpdateOfferingDto) {
    const provider = await this.profiles.requireOwn(user);
    this.profiles.assertNotSuspended(provider);
    const offering: any = await this.offerings.findById(toObjectId(offeringId, "offeringId"));
    // Another provider's offering is indistinguishable from a missing one.
    if (!offering || !sameId(offering.providerId, provider._id))
      throw providerError.notFound("OFFERING_NOT_FOUND", "Offering not found");

    const next = { ...offering.toObject(), ...dto };
    if (dto.travelCharge) next.travelCharge = this.travelCharge(dto.travelCharge);
    // Only an offering that will be live must still be sellable under the current catalogue;
    // pausing or retiring one must keep working after its ritual is archived.
    let known: { variant: any; ritual: any } | undefined;
    if ((dto.status ?? offering.status) === "ACTIVE") {
      known = await this.catalogue.resolveSellableVariant(String(offering.ritualVariantId));
      this.assertRules(next, known.ritual);
    } else this.assertShape(next);

    const fields: Record<string, unknown> = {};
    for (const key of [
      "title",
      "description",
      "destination",
      "durationMinutes",
      "teamSize",
      "minNoticeHours",
      "baseProfessionalFeeMinor",
      "currency",
      "inclusions",
      "exclusions",
      "samagriIncluded",
      "voluntaryDakshinaAllowed",
      "tags",
      "status",
      "serviceType",
      "groupCapacity",
      "kathaDetails",
      "advancePercentage",
    ] as const)
      if (dto[key as keyof UpdateOfferingDto] !== undefined) fields[key] = dto[key as keyof UpdateOfferingDto];
    if (dto.travelCharge) fields.travelCharge = next.travelCharge;
    if (!Object.keys(fields).length)
      throw providerError.badRequest("NOTHING_TO_UPDATE", "No changes supplied");

    try {
      const updated = await this.offerings.findOneAndUpdate(
        { _id: offering._id, providerId: provider._id },
        { $set: fields },
        { new: true },
      );
      await this.projection.rebuild(provider._id);
      await this.audit.log(user, "offering.updated", "provider_offering", offering._id, {
        fields: Object.keys(fields),
        ...(dto.status ? { from: offering.status, to: dto.status } : {}),
      });
      return {
        success: true,
        data: await this.ownerOne(updated!.toObject(), known),
      };
    } catch (error) {
      if ((error as { code?: number }).code === 11000)
        throw providerError.conflict(
          "OFFERING_ALREADY_EXISTS",
          "Another live offering already covers this ritual variant and fulfilment type",
        );
      throw error;
    }
  }

  async listOwn(user: AuthenticatedUser, status?: string) {
    const provider = await this.profiles.requireOwn(user);
    const rows: any[] = await this.offerings
      .find({ providerId: provider._id, ...(status ? { status } : {}) })
      .sort({ createdAt: -1 })
      .lean();
    const titles = await this.catalogue.titlesFor(
      [...new Set(rows.map((row) => String(row.ritualVariantId)))],
    );
    return {
      success: true,
      data: rows.map((row) => ownerOffering(row, titles.get(String(row.ritualVariantId)))),
    };
  }

  async getOwn(user: AuthenticatedUser, offeringId: string) {
    const provider = await this.profiles.requireOwn(user);
    const offering: any = await this.offerings.findById(toObjectId(offeringId, "offeringId")).lean();
    if (!offering || !sameId(offering.providerId, provider._id))
      throw providerError.notFound("OFFERING_NOT_FOUND", "Offering not found");
    return { success: true, data: await this.ownerOne(offering) };
  }

  /** Public catalogue of one provider: only offerings the catalogue currently lets them sell. */
  async listPublic(idOrSlug: string, query: PublicOfferingsQueryDto) {
    const provider = await this.profiles.findPublicProfile(idOrSlug);
    const filter: Record<string, unknown> = { providerId: provider._id, status: "ACTIVE" };
    if (query.fulfilmentType) filter.fulfilmentType = query.fulfilmentType;
    if (query.ritualVariantId) filter.ritualVariantId = toObjectId(query.ritualVariantId);
    const rows: any[] = await this.offerings.find(filter).sort({ baseProfessionalFeeMinor: 1 }).lean();
    const ids = [...new Set(rows.map((row) => String(row.ritualVariantId)))];
    const [variants, rituals] = await Promise.all([
      ids.length ? this.variants.find({ _id: { $in: ids.map((id) => toObjectId(id)) } }).lean() : [],
      rows.length
        ? this.rituals
            .find({ _id: { $in: [...new Set(rows.map((r) => String(r.ritualId)))].map((id) => toObjectId(id)) } })
            .lean()
        : [],
    ]);
    const variantById = new Map((variants as any[]).map((v) => [String(v._id), v]));
    const ritualById = new Map((rituals as any[]).map((r) => [String(r._id), r]));
    const data = rows
      .filter((row) =>
        isSellable(row, variantById.get(String(row.ritualVariantId)), ritualById.get(String(row.ritualId))),
      )
      .map((row) => {
        const variant = variantById.get(String(row.ritualVariantId));
        const ritual = ritualById.get(String(row.ritualId));
        return toPublicOffering(row, {
          ritual: {
            id: idStr(ritual._id),
            slug: ritual.slug,
            titles: ritual.publishedContent?.titles ?? ritual.titles,
          },
          variant: { id: idStr(variant._id), code: variant.code, titles: variant.titles },
        });
      });
    return { success: true, data };
  }

  /** Loads an offering for booking: the offering plus the live catalogue rows it depends on. */
  async loadSellable(offeringId: string): Promise<{ offering: any; variant: any; ritual: any }> {
    const offering: any = await this.offerings.findById(toObjectId(offeringId, "offeringId")).lean();
    if (!offering)
      throw providerError.notFound("OFFERING_NOT_FOUND", "Offering not found");
    const [variant, ritual]: any[] = await Promise.all([
      this.variants.findById(offering.ritualVariantId).lean(),
      this.rituals.findById(offering.ritualId).lean(),
    ]);
    if (!isSellable(offering, variant, ritual))
      throw providerError.unprocessable(
        "OFFERING_NOT_AVAILABLE",
        "This service is not currently available for booking",
      );
    return { offering, variant, ritual };
  }

  // ---------------------------------------------------------------- admin
  async listAdmin(query: AdminOfferingQueryDto) {
    const { page, limit, skip } = pageParams(query);
    const filter: Record<string, unknown> = {};
    if (query.providerId) filter.providerId = toObjectId(query.providerId);
    if (query.status) filter.status = query.status;
    const [rows, total] = await Promise.all([
      this.offerings.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      this.offerings.countDocuments(filter),
    ]);
    const titles = await this.catalogue.titlesFor([...new Set((rows as any[]).map((r) => String(r.ritualVariantId)))]);
    const names = await this.profiles.displayNames((rows as any[]).map((r) => String(r.providerId)));
    return paged(
      (rows as any[]).map((row) => ({
        ...ownerOffering(row, titles.get(String(row.ritualVariantId))),
        providerId: idStr(row.providerId),
        providerName: names.get(String(row.providerId)) ?? null,
      })),
      total,
      page,
      limit,
    );
  }

  /**
   * Operations can pause or retire any offering. Putting one back on sale
   * applies the same rules as the provider: the catalogue must still allow it.
   */
  async setStatusAdmin(actor: AuthenticatedUser, offeringId: string, status: string) {
    const offering: any = await this.offerings.findById(toObjectId(offeringId, "offeringId")).lean();
    if (!offering) throw providerError.notFound("OFFERING_NOT_FOUND", "Offering not found");
    let known: { variant: any; ritual: any } | undefined;
    if (status === "ACTIVE") {
      known = await this.catalogue.resolveSellableVariant(String(offering.ritualVariantId));
      this.assertRules(offering, known.ritual);
    }
    try {
      const updated = await this.offerings.findOneAndUpdate({ _id: offering._id }, { $set: { status } }, { new: true });
      await this.projection.rebuild(offering.providerId);
      await this.audit.log(actor, "offering.admin_status_changed", "provider_offering", offering._id, {
        providerId: idStr(offering.providerId),
        from: offering.status,
        to: status,
      });
      return { success: true, data: await this.ownerOne(updated!.toObject(), known) };
    } catch (error) {
      if ((error as { code?: number }).code === 11000)
        throw providerError.conflict("OFFERING_ALREADY_EXISTS", "Another live offering already covers this ritual variant and fulfilment type");
      throw error;
    }
  }

  // ------------------------------------------------------------ internals
  private async ownerOne(offering: any, known?: { variant: any; ritual: any }) {
    const catalogue = known
      ? {
          ritual: {
            id: idStr(known.ritual._id),
            slug: known.ritual.slug,
            titles: known.ritual.publishedContent?.titles ?? known.ritual.titles,
          },
          variant: { id: idStr(known.variant._id), code: known.variant.code, titles: known.variant.titles },
        }
      : (await this.catalogue.titlesFor([String(offering.ritualVariantId)])).get(
          String(offering.ritualVariantId),
        );
    return ownerOffering(offering, catalogue);
  }

  /** Business rules that need the ritual (fulfilment applicability) as well as the offering itself. */
  private assertRules(
    offering: { fulfilmentType: string; destination?: any; travelCharge?: any },
    ritual: any,
  ) {
    const applicable: string[] = ritual.publishedContent?.applicableFulfilmentTypes ?? [];
    if (!applicable.includes(offering.fulfilmentType))
      throw providerError.unprocessable(
        "FULFILMENT_NOT_APPLICABLE",
        `This ritual is not offered as ${offering.fulfilmentType}. Applicable: ${applicable.join(", ") || "none"}`,
      );
    this.assertShape(offering);
  }

  private assertShape(offering: { fulfilmentType: string; destination?: any; travelCharge?: any }) {
    if (offering.fulfilmentType === "AT_DESTINATION" && !offering.destination?.city)
      throw providerError.unprocessable(
        "DESTINATION_REQUIRED",
        "A destination city is required for services performed at a sacred destination",
      );
    const charge = offering.travelCharge;
    if (charge?.policy === "FLAT" && !(charge.flatMinor >= 0 && charge.flatMinor !== undefined))
      throw providerError.unprocessable(
        "TRAVEL_CHARGE_AMOUNT_REQUIRED",
        "A flat travel charge needs an amount",
      );
    if (charge && charge.policy !== "FLAT" && charge.flatMinor)
      throw providerError.unprocessable(
        "TRAVEL_CHARGE_AMOUNT_NOT_ALLOWED",
        "Only a flat travel charge carries an amount",
      );
  }

  private travelCharge(input?: { policy: string; flatMinor?: number; notes?: string }) {
    if (!input) return { policy: "NONE" };
    return {
      policy: input.policy,
      ...(input.policy === "FLAT" ? { flatMinor: input.flatMinor } : {}),
      ...(input.notes ? { notes: input.notes } : {}),
    };
  }
}
