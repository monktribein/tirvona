import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { ClientSession, Model } from "mongoose";
import { availableWeekdays } from "../domain/availability.util";
import { deriveVerification, isPubliclyListable } from "../domain/provider-visibility";
import { providerConfig, toObjectId } from "./provider.helpers";

/** True when the catalogue currently allows this offering to be sold. */
export const isSellable = (offering: any, variant: any, ritual: any): boolean =>
  offering?.status === "ACTIVE" &&
  variant?.status === "ACTIVE" &&
  Boolean(ritual?.isListed) &&
  (!ritual.isDevFixture || providerConfig().allowDevFixtures) &&
  ritual?.status !== "ARCHIVED" &&
  Boolean(
    (ritual?.publishedContent?.applicableFulfilmentTypes ?? []).includes(
      offering.fulfilmentType,
    ),
  );

/**
 * Rebuilds the denormalised, search-safe fields of a provider profile
 * (Architecture 18: the search index is a read model; transactional truth stays
 * in the owning collections). Called after every change that can alter what the
 * public sees: offerings, availability, verification, status, catalogue.
 *
 * Only search-safe values are written: no contact, KYC or financial data.
 */
@Injectable()
export class ProviderProjectionService {
  constructor(
    @InjectModel("ProviderProfile") private readonly profiles: Model<any>,
    @InjectModel("ProviderOffering") private readonly offerings: Model<any>,
    @InjectModel("ProviderRitual") private readonly rituals: Model<any>,
    @InjectModel("ProviderRitualVariant") private readonly variants: Model<any>,
    @InjectModel("ProviderAvailabilityRule") private readonly rules: Model<any>,
  ) {}

  async rebuild(providerId: unknown, session?: ClientSession): Promise<any | null> {
    const id = toObjectId(providerId, "providerId");
    const profile: any = await this.profiles.findById(id).session(session ?? null).lean();
    if (!profile) return null;

    const [offerings, rules] = await Promise.all([
      this.offerings
        .find({ providerId: id, status: "ACTIVE" })
        .session(session ?? null)
        .lean(),
      this.rules
        .find({ resourceType: "PROVIDER", resourceId: id, status: "ACTIVE" })
        .session(session ?? null)
        .lean(),
    ]);
    const variantIds = [...new Set(offerings.map((o: any) => String(o.ritualVariantId)))];
    const ritualIds = [...new Set(offerings.map((o: any) => String(o.ritualId)))];
    const [variants, rituals] = await Promise.all([
      variantIds.length
        ? this.variants.find({ _id: { $in: variantIds.map((v) => toObjectId(v)) } }).session(session ?? null).lean()
        : [],
      ritualIds.length
        ? this.rituals.find({ _id: { $in: ritualIds.map((v) => toObjectId(v)) } }).session(session ?? null).lean()
        : [],
    ]);
    const variantById = new Map(variants.map((v: any) => [String(v._id), v]));
    const ritualById = new Map(rituals.map((r: any) => [String(r._id), r]));
    const sellable = offerings.filter((offering: any) =>
      isSellable(
        offering,
        variantById.get(String(offering.ritualVariantId)),
        ritualById.get(String(offering.ritualId)),
      ),
    );

    const derived = deriveVerification(profile.verification);
    const fees = sellable.map((o: any) => o.baseProfessionalFeeMinor as number);
    const projection = {
      verificationLevel: derived.level,
      verificationRank: derived.rank,
      identityVerifiedUntil: derived.identityVerifiedUntil,
      ritualIds: [...new Set(sellable.map((o: any) => String(o.ritualId)))].map((v) => toObjectId(v)),
      ritualVariantIds: [...new Set(sellable.map((o: any) => String(o.ritualVariantId)))].map((v) => toObjectId(v)),
      fulfilmentTypes: [...new Set(sellable.map((o: any) => o.fulfilmentType as string))],
      minFeeMinor: fees.length ? Math.min(...fees) : null,
      maxFeeMinor: fees.length ? Math.max(...fees) : null,
      feeCurrency: sellable[0]?.currency ?? profile.feeCurrency ?? "INR",
      activeOfferingCount: sellable.length,
      availableWeekdays: availableWeekdays(rules),
    };
    const isPubliclyListed = isPubliclyListable(
      { ...profile, ...projection },
      { allowDevFixtures: providerConfig().allowDevFixtures },
    );
    await this.profiles.updateOne(
      { _id: id },
      { $set: { ...projection, isPubliclyListed } },
      { session },
    );
    return { ...profile, ...projection, isPubliclyListed };
  }

  /** Catalogue changes (variant disabled, ritual archived/republished) affect every provider offering it. */
  async rebuildForRitual(ritualId: unknown): Promise<number> {
    const providerIds = await this.offerings.distinct("providerId", {
      ritualId: toObjectId(ritualId, "ritualId"),
    });
    for (const providerId of providerIds) await this.rebuild(providerId);
    return providerIds.length;
  }

  async rebuildForVariant(variantId: unknown): Promise<number> {
    const providerIds = await this.offerings.distinct("providerId", {
      ritualVariantId: toObjectId(variantId, "variantId"),
    });
    for (const providerId of providerIds) await this.rebuild(providerId);
    return providerIds.length;
  }
}
