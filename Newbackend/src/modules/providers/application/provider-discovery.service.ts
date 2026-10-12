import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import { escapeRegex } from "../../../common/utils/escape-regex";
import {
  VERIFICATION_LEVELS,
  VERIFICATION_RANK,
  type VerificationLevel,
} from "../domain/provider.constants";
import { providerError } from "../domain/provider.errors";
import { toPublicProvider } from "../domain/provider-visibility";
import { isRealIsoDate } from "../domain/provider-time.util";
import { pageParams } from "../presentation/dto/common.dto";
import type { ProviderSearchQueryDto } from "../presentation/dto/provider.dto";
import { ProviderAvailabilityService } from "./provider-availability.service";
import { RitualCatalogService } from "./ritual-catalog.service";
import { paged, providerConfig, toObjectId } from "./provider.helpers";

/** With a date filter, availability is evaluated for at most this many candidates. */
const AVAILABILITY_CANDIDATE_CAP = 300;

const SORTS: Record<string, Record<string, 1 | -1>> = {
  relevance: { verificationRank: -1, activeOfferingCount: -1, createdAt: -1, _id: 1 },
  verification: { verificationRank: -1, _id: 1 },
  price_asc: { minFeeMinor: 1, _id: 1 },
  price_desc: { maxFeeMinor: -1, _id: 1 },
  newest: { createdAt: -1, _id: 1 },
  experience: { experienceYears: -1, _id: 1 },
};

/**
 * Public directory search. Everything is filtered and sorted on the server
 * against the denormalised, search-safe provider fields; only providers that
 * are ACTIVE, verified, unexpired and have something to offer can appear
 * (BR-002, FR-SM-002). Private, KYC, contact and financial data are never read.
 */
@Injectable()
export class ProviderDiscoveryService {
  constructor(
    @InjectModel("ProviderProfile") private readonly profiles: Model<any>,
    private readonly catalogue: RitualCatalogService,
    private readonly availability: ProviderAvailabilityService,
  ) {}

  async search(query: ProviderSearchQueryDto) {
    const { page, limit, skip } = pageParams(query);
    const now = new Date();
    const and: Record<string, unknown>[] = [
      { deletedAt: null },
      { status: "ACTIVE" },
      { isPubliclyListed: true },
      { $or: [{ identityVerifiedUntil: null }, { identityVerifiedUntil: { $gt: now } }] },
    ];
    if (!providerConfig().allowDevFixtures) and.push({ isDevFixture: { $ne: true } });

    const minRank = this.minRank(query.minVerification);
    and.push({ verificationRank: { $gte: Math.max(minRank, 1) } });

    if (query.providerType) and.push({ providerType: query.providerType });
    if (query.language) and.push({ languages: query.language });
    if (query.fulfilmentType) and.push({ fulfilmentTypes: query.fulfilmentType });
    if (query.city) and.push({ serviceCities: query.city.trim().toLowerCase() });
    if (query.state)
      and.push({ homeState: { $regex: `^${escapeRegex(query.state.trim())}$`, $options: "i" } });
    if (query.hasConsultation) and.push({ "consultation.enabled": true });
    if (query.ritualVariantId) and.push({ ritualVariantIds: toObjectId(query.ritualVariantId) });

    if (query.ritual) {
      const ritualId = await this.resolveRitualId(query.ritual);
      if (!ritualId) return paged([], 0, page, limit);
      and.push({ ritualIds: ritualId });
    }
    if (query.q) and.push(await this.textClause(query.q));

    if (query.minFeeMinor !== undefined) and.push({ maxFeeMinor: { $gte: query.minFeeMinor } });
    if (query.maxFeeMinor !== undefined) and.push({ minFeeMinor: { $lte: query.maxFeeMinor } });
    if (
      query.minFeeMinor !== undefined &&
      query.maxFeeMinor !== undefined &&
      query.minFeeMinor > query.maxFeeMinor
    )
      throw providerError.badRequest("INVALID_RANGE", "minFeeMinor cannot exceed maxFeeMinor");

    const sortKey = query.sort ?? "relevance";
    if (sortKey === "price_asc" || sortKey === "price_desc")
      and.push({ minFeeMinor: { $ne: null } }); // consultation-only providers have no price to sort on
    const sort = SORTS[sortKey];
    const filter = { $and: and };

    if (query.date) {
      if (!isRealIsoDate(query.date))
        throw providerError.badRequest("INVALID_DATE", "date must be a real calendar date (YYYY-MM-DD)");
      const candidates: any[] = await this.profiles
        .find(filter)
        .sort(sort)
        .limit(AVAILABILITY_CANDIDATE_CAP)
        .lean();
      const free = await this.availability.hasFreeWindow(
        candidates.map((row) => row._id),
        query.date,
        query.durationMinutes ?? 30,
      );
      const available = candidates.filter((row) => free.has(String(row._id)));
      return paged(
        available.slice(skip, skip + limit).map((row) => toPublicProvider(row, now)),
        available.length,
        page,
        limit,
      );
    }

    const [rows, total] = await Promise.all([
      this.profiles.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      this.profiles.countDocuments(filter),
    ]);
    return paged((rows as any[]).map((row) => toPublicProvider(row, now)), total, page, limit);
  }

  private minRank(level?: string): number {
    if (!level) return 1;
    if (!(VERIFICATION_LEVELS as readonly string[]).includes(level))
      throw providerError.badRequest(
        "INVALID_VERIFICATION_LEVEL",
        `minVerification must be one of ${VERIFICATION_LEVELS.join(", ")}`,
      );
    return VERIFICATION_RANK[level as VerificationLevel];
  }

  private async resolveRitualId(idOrSlug: string) {
    try {
      const ritual = await this.catalogue.findListed(idOrSlug);
      return ritual._id;
    } catch {
      return null;
    }
  }

  /** Free text matches provider names, declared specialisations and published ritual names. */
  private async textClause(text: string): Promise<Record<string, unknown>> {
    const term = text.trim();
    const pattern = escapeRegex(term);
    const matched = await this.catalogue.listPublic({ q: term, limit: 50, page: 1 });
    const ritualIds = matched.data.map((ritual) => toObjectId(ritual.id));
    return {
      $or: [
        { displayName: { $regex: pattern, $options: "i" } },
        { specializations: { $regex: pattern, $options: "i" } },
        ...(ritualIds.length ? [{ ritualIds: { $in: ritualIds } }] : []),
      ],
    };
  }
}
