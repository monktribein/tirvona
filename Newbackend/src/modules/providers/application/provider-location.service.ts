import { Injectable, Optional } from "@nestjs/common";
import { InjectModel } from "../../../database/orm-nest";
import type { Model } from "../../../database/orm";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import {
  isLocationScopedUser,
  locationMatches,
  withLocation,
  type LocationScope,
} from "../../../common/auth/location-scope";
import { HrLocationService } from "../../hr/application/hr-location.service";
import { providerError } from "../domain/provider.errors";

/** Provider profile fields an HR login's office area is matched against. */
export const PROVIDER_LOCATION_FIELDS = ["homeCity", "serviceCities"];

/** The home and service cities of a provider, as text to match. */
export const providerPlaceTexts = (row: any): unknown[] => [
  row?.homeCity,
  row?.serviceCities,
  (Array.isArray(row?.serviceAreas) ? row.serviceAreas : []).map((a: any) => a?.city),
];

/**
 * The pandit console's location rule for an `hr` login: a pandit is in its
 * area when the home city or a service city is, and offerings, bookings,
 * consultations, verification cases and withdrawals follow their pandit.
 * Outside the area is reported as not found. No-op for other roles.
 */
@Injectable()
export class ProviderLocationService {
  constructor(
    @InjectModel("ProviderProfile") private readonly profiles: Model<any>,
    @InjectModel("ProviderOffering") private readonly offerings: Model<any>,
    @InjectModel("ProviderWithdrawal") private readonly withdrawals: Model<any>,
    @Optional() private readonly hrLocation?: HrLocationService,
  ) {}

  async scopeFor(user: AuthenticatedUser): Promise<LocationScope> {
    if (!isLocationScopedUser(user)) return null;
    return this.hrLocation ? this.hrLocation.scopeFor(user) : { city: "", officeName: "", terms: [] };
  }

  /** Pandits in the area; null when unrestricted. */
  async providerIds(scope: LocationScope): Promise<string[] | null> {
    if (scope === null) return null;
    return (
      (await this.profiles
        .find(withLocation({ deletedAt: null }, scope, PROVIDER_LOCATION_FIELDS))
        .select("_id")
        .lean()) as any[]
    ).map((p) => String(p._id));
  }

  /** The caller's pandits, or null for an unrestricted caller. */
  async providerIdsFor(user: AuthenticatedUser): Promise<string[] | null> {
    return this.providerIds(await this.scopeFor(user));
  }

  async assertProvider(user: AuthenticatedUser, providerId: unknown): Promise<void> {
    const ids = await this.providerIdsFor(user);
    if (ids && !ids.includes(String((providerId as any)?._id ?? providerId ?? "")))
      throw providerError.notFound("PROVIDER_NOT_FOUND", "Provider not found");
  }

  async assertOffering(user: AuthenticatedUser, offeringId: string): Promise<void> {
    if (!isLocationScopedUser(user)) return;
    const row = (await this.offerings.findById(offeringId).select("providerId").lean()) as any;
    if (!row) throw providerError.notFound("OFFERING_NOT_FOUND", "Offering not found");
    await this.assertProvider(user, row.providerId);
  }

  async assertWithdrawal(user: AuthenticatedUser, withdrawalId: string): Promise<void> {
    if (!isLocationScopedUser(user)) return;
    const row = (await this.withdrawals.findById(withdrawalId).select("providerId").lean()) as any;
    if (!row) throw providerError.notFound("WITHDRAWAL_NOT_FOUND", "Withdrawal not found");
    await this.assertProvider(user, row.providerId);
  }

  /** For creating or moving a pandit: the new cities must be in the caller's area. */
  async assertPlacesWritable(user: AuthenticatedUser, row: any): Promise<void> {
    const scope = await this.scopeFor(user);
    if (scope && !locationMatches(scope, ...providerPlaceTexts(row)))
      throw providerError.forbidden(
        "OUTSIDE_OFFICE_AREA",
        scope.terms.length
          ? `This pandit's city is outside your office's area (${scope.city}).`
          : "Your HR account has no office assigned yet. Ask a Super Admin to assign one.",
      );
  }
}

/** `filter` restricted to the given pandits (`field` holds the pandit id); unchanged when null. */
export function onlyProviders(
  filter: Record<string, unknown>,
  ids: string[] | null,
  field = "providerId",
): Record<string, unknown> {
  if (!ids) return filter;
  const requested = filter[field];
  if (requested !== undefined) {
    const allowed = ids.includes(String(requested));
    return { ...filter, [field]: allowed ? requested : { $in: [] } };
  }
  return { ...filter, [field]: { $in: ids } };
}
