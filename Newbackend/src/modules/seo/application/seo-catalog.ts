import type { Connection } from "../../../database/orm";
import { citySlug, slugify } from "../../../common/slug/slug.util";
import { providerConfig } from "../../providers/application/provider.helpers";
import { listingBlockers, toPublicProvider } from "../../providers/domain/provider-visibility";
import { VENDOR_CATEGORY_SCOPE, VISIBLE_STATUS } from "../../marketplace/domain/marketplace.constants";
import { EVENT_MODEL } from "../../events/domain/event.constants";
import { PILGRIMAGE_MODEL } from "../../pilgrimage/domain/pilgrimage.constants";
import { AARTI_MODEL } from "../../aarti/domain/aarti.constants";
import { PARKING_MODEL } from "../../parking/domain/parking.constants";

/**
 * Read-only access to the public records that SEO pages and the sitemap are
 * built from. Every query repeats the visibility rule of the module's own
 * public endpoint (approved / published / active, not deleted) and selects an
 * explicit allow-list of fields, so nothing private can reach page source.
 *
 * It never writes: the public detail endpoints for blog posts, events and
 * circuits increment view counters, which is why this reads the models
 * directly instead of calling them.
 */

const OBJECT_ID = /^[0-9a-f]{24}$/i;
/** Cap on rows per type for hub pages. */
export const HUB_LIMIT = 60;
/** Cap on rows per type for the sitemap; far above current volumes, below the 50k sitemap limit. */
export const SITEMAP_LIMIT = 10_000;

const ASHRAM_FIELDS =
  "name slug citySlug description shortDescription address amenities images coverImage propertyType type updatedAt createdAt";
const TEMPLE_FIELDS =
  "name templeShortName slug shortDescription description deity templeType address media.coverImage timings visitorInfo.bestTimeToVisit visitorInfo.dressCode visitorInfo.entryFee visitorInfo.templeContactNumber seo status updatedAt createdAt";
const PRODUCT_FIELDS =
  "name slug description images price salePrice currency stock inventory.trackInventory vendorId categoryId updatedAt createdAt";
const EVENT_FIELDS =
  "name slug eventType deity tagline description highlights images coverImage venue startDate endDate startTime timezone facilities requiresRegistration updatedAt createdAt";
const CIRCUIT_FIELDS =
  "name slug circuitType summary description highlights images coverImage startCity endCity state region durationDays totalDistanceKm difficulty bestSeasons idealFor updatedAt createdAt";
const BLOG_FIELDS = "title slug excerpt content coverImage youtubeUrl category contentType authorId authorName createdAt updatedAt publishedAt";

const AARTI_FIELDS =
  "name slug kind deity description dressCode images coverImage venue latitude longitude startTime durationMinutes daysOfWeek facilities updatedAt createdAt";
const PARKING_FIELDS = "name slug description images coverImage address latitude longitude updatedAt createdAt";
const JOB_FIELDS =
  "title slug ashramName department city state type duration accommodation food responsibilities description openingsCount updatedAt createdAt";

const ASHRAM_PUBLIC = { status: "approved", deletedAt: null };
// Same rules as AartiDiscoveryService, ParkingDiscoveryService and CommunityService.jobs.
const AARTI_PUBLIC = { status: "approved" };
const PARKING_PUBLIC = { status: "active" };
const JOB_PUBLIC = { status: "open" };
const TEMPLE_PUBLIC = { status: { $in: ["published", "active"] }, deletedAt: null };
const PRODUCT_PUBLIC = {
  status: VISIBLE_STATUS,
  approvalStatus: "approved",
  listingStatus: "active",
  deletedAt: null,
};
const CATEGORY_PUBLIC = { scope: VENDOR_CATEGORY_SCOPE, status: "active" };
const STORE_PUBLIC = { status: "active", deletedAt: null };
const EVENT_PUBLIC = { status: "approved" };
const CIRCUIT_PUBLIC = { status: "approved" };
const BLOG_PUBLIC = { status: "published" };

export class SeoCatalog {
  constructor(private readonly connection: Connection) {}

  private model(name: string): any | null {
    return (this.connection as any)?.models?.[name] ?? null;
  }

  private async one(name: string, filter: Record<string, unknown>, fields: string): Promise<any | null> {
    const model = this.model(name);
    if (!model) return null;
    return model.findOne(filter).select(fields).lean().exec();
  }

  private async many(
    name: string,
    filter: Record<string, unknown>,
    fields: string,
    limit: number,
    sort: Record<string, 1 | -1> = { updatedAt: -1 },
  ): Promise<any[]> {
    const model = this.model(name);
    if (!model) return [];
    return (await model.find(filter).select(fields).sort(sort).limit(limit).lean().exec()) ?? [];
  }

  /** Same resolution as AshramSlugService.findByPath, restricted to approved stays. */
  async ashram(city: string | undefined, slug: string): Promise<any | null> {
    if (!slug) return null;
    if (OBJECT_ID.test(slug)) return this.one("Ashram", { ...ASHRAM_PUBLIC, _id: slug }, ASHRAM_FIELDS);
    if (city) {
      const scoped = await this.one(
        "Ashram",
        { ...ASHRAM_PUBLIC, citySlug: citySlug(city), slug: slugify(slug) },
        ASHRAM_FIELDS,
      );
      if (scoped) return scoped;
    }
    return this.one("Ashram", { ...ASHRAM_PUBLIC, slug: slugify(slug) }, ASHRAM_FIELDS);
  }

  ashrams(limit = HUB_LIMIT, city?: string): Promise<any[]> {
    const filter: Record<string, unknown> = { ...ASHRAM_PUBLIC };
    if (city) filter.citySlug = citySlug(city);
    return this.many("Ashram", filter, ASHRAM_FIELDS, limit);
  }

  temple(slug: string): Promise<any | null> {
    return this.one("Temple", { ...TEMPLE_PUBLIC, slug }, TEMPLE_FIELDS);
  }

  /** Public temples whose address city matches (case-insensitive, whole name), for internal links. */
  templesInCity(city: unknown, limit = 12): Promise<any[]> {
    const name = String(city ?? "").trim();
    if (!name) return Promise.resolve([]);
    const exact = new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
    return this.many("Temple", { ...TEMPLE_PUBLIC, "address.city": exact }, "name slug", limit);
  }

  temples(limit = HUB_LIMIT): Promise<any[]> {
    return this.many("Temple", TEMPLE_PUBLIC, TEMPLE_FIELDS, limit);
  }

  /** Mirrors ProviderProfileService.findPublicProfile, then keeps only toPublicProvider fields. */
  async pandit(idOrSlug: string): Promise<any | null> {
    const key = String(idOrSlug ?? "").trim().toLowerCase();
    const model = this.model("ProviderProfile");
    if (!model || !key) return null;
    const profile = await model
      .findOne(OBJECT_ID.test(key) ? { _id: key, deletedAt: null } : { slug: key, deletedAt: null })
      .lean()
      .exec();
    if (!this.isListable(profile)) return null;
    return { ...toPublicProvider(profile), updatedAt: profile.updatedAt };
  }

  async pandits(limit = HUB_LIMIT): Promise<any[]> {
    const model = this.model("ProviderProfile");
    if (!model) return [];
    const rows: any[] =
      (await model
        .find({ isPubliclyListed: true, deletedAt: null })
        .sort({ updatedAt: -1 })
        .limit(limit * 4)
        .lean()
        .exec()) ?? [];
    return rows
      .filter((row) => this.isListable(row))
      .slice(0, limit)
      .map((row) => ({ ...toPublicProvider(row), updatedAt: row.updatedAt }));
  }

  private isListable(profile: any): boolean {
    return Boolean(
      profile &&
        profile.isPubliclyListed &&
        listingBlockers(profile, { allowDevFixtures: providerConfig().allowDevFixtures }).length === 0,
    );
  }

  async product(idOrSlug: string): Promise<any | null> {
    const model = this.model("MpProduct");
    if (!model || !idOrSlug) return null;
    const clauses: Record<string, unknown>[] = [{ slug: idOrSlug }];
    if (OBJECT_ID.test(idOrSlug)) clauses.push({ _id: idOrSlug });
    return model
      .findOne({ $or: clauses, ...PRODUCT_PUBLIC })
      .select(PRODUCT_FIELDS)
      .populate("vendorId", "storeName slug address.city address.state")
      .populate("categoryId", "name slug")
      .lean()
      .exec();
  }

  products(limit = HUB_LIMIT): Promise<any[]> {
    return this.many("MpProduct", PRODUCT_PUBLIC, PRODUCT_FIELDS, limit);
  }

  marketplaceCategory(slug: string): Promise<any | null> {
    return this.one("MpCategory", { ...CATEGORY_PUBLIC, slug: String(slug).toLowerCase() }, "name slug description image parentId updatedAt");
  }

  marketplaceCategories(limit = HUB_LIMIT): Promise<any[]> {
    return this.many("MpCategory", CATEGORY_PUBLIC, "name slug description parentId updatedAt", limit, { name: 1 });
  }

  /** Products listed in one category, for the category page summary. */
  productsInCategory(categoryId: unknown, limit = HUB_LIMIT): Promise<any[]> {
    return this.many("MpProduct", { ...PRODUCT_PUBLIC, categoryId }, "name slug updatedAt", limit);
  }

  marketplaceStore(slug: string): Promise<any | null> {
    return this.one(
      "MpVendor",
      { ...STORE_PUBLIC, slug: String(slug).toLowerCase() },
      "storeName slug description logoUrl address.city address.state updatedAt",
    );
  }

  marketplaceStores(limit = SITEMAP_LIMIT): Promise<any[]> {
    return this.many("MpVendor", STORE_PUBLIC, "storeName slug updatedAt", limit);
  }

  productsInStore(vendorId: unknown, limit = HUB_LIMIT): Promise<any[]> {
    return this.many("MpProduct", { ...PRODUCT_PUBLIC, vendorId }, "name slug updatedAt", limit);
  }

  event(idOrSlug: string): Promise<any | null> {
    const filter = OBJECT_ID.test(idOrSlug) ? { _id: idOrSlug } : { slug: String(idOrSlug).toLowerCase() };
    return this.one(EVENT_MODEL.Event, { ...filter, ...EVENT_PUBLIC }, EVENT_FIELDS);
  }

  events(limit = HUB_LIMIT): Promise<any[]> {
    return this.many(EVENT_MODEL.Event, EVENT_PUBLIC, EVENT_FIELDS, limit, { startDate: -1 });
  }

  circuit(idOrSlug: string): Promise<any | null> {
    const filter = OBJECT_ID.test(idOrSlug) ? { _id: idOrSlug } : { slug: String(idOrSlug).toLowerCase() };
    return this.one(PILGRIMAGE_MODEL.Circuit, { ...filter, ...CIRCUIT_PUBLIC }, CIRCUIT_FIELDS);
  }

  circuits(limit = HUB_LIMIT): Promise<any[]> {
    return this.many(PILGRIMAGE_MODEL.Circuit, CIRCUIT_PUBLIC, CIRCUIT_FIELDS, limit);
  }

  async blog(slug: string): Promise<any | null> {
    const model = this.model("BlogPost");
    if (!model || !slug) return null;
    return model
      .findOne({ ...BLOG_PUBLIC, slug })
      .select(BLOG_FIELDS)
      .populate("authorId", "name")
      .lean()
      .exec();
  }

  blogPosts(limit = HUB_LIMIT): Promise<any[]> {
    return this.many("BlogPost", BLOG_PUBLIC, "title slug excerpt contentType youtubeUrl updatedAt createdAt", limit, { createdAt: -1 });
  }

  aarti(idOrSlug: string): Promise<any | null> {
    const filter = OBJECT_ID.test(idOrSlug) ? { _id: idOrSlug } : { slug: String(idOrSlug).toLowerCase() };
    return this.one(AARTI_MODEL.Session, { ...filter, ...AARTI_PUBLIC }, AARTI_FIELDS);
  }

  aartis(limit = HUB_LIMIT): Promise<any[]> {
    return this.many(AARTI_MODEL.Session, AARTI_PUBLIC, "name slug venue updatedAt", limit);
  }

  parking(idOrSlug: string): Promise<any | null> {
    const filter = OBJECT_ID.test(idOrSlug) ? { _id: idOrSlug } : { slug: String(idOrSlug).toLowerCase() };
    return this.one(PARKING_MODEL.Location, { ...filter, ...PARKING_PUBLIC }, PARKING_FIELDS);
  }

  parkings(limit = HUB_LIMIT): Promise<any[]> {
    return this.many(PARKING_MODEL.Location, PARKING_PUBLIC, "name slug address updatedAt", limit);
  }

  volunteerJob(idOrSlug: string): Promise<any | null> {
    const filter = OBJECT_ID.test(idOrSlug) ? { _id: idOrSlug } : { slug: String(idOrSlug).toLowerCase() };
    return this.one("VolunteerJob", { ...filter, ...JOB_PUBLIC }, JOB_FIELDS);
  }

  volunteerJobs(limit = HUB_LIMIT): Promise<any[]> {
    return this.many("VolunteerJob", JOB_PUBLIC, "title ashramName city updatedAt", limit, { createdAt: -1 });
  }

  /** Cities that have at least one approved stay, with their latest stay update. */
  async stayCities(): Promise<Array<{ citySlug: string; city: string; updatedAt?: Date }>> {
    const rows = await this.ashrams(SITEMAP_LIMIT);
    const byCity = new Map<string, { citySlug: string; city: string; updatedAt?: Date }>();
    for (const row of rows) {
      const slug = row.citySlug || (row.address?.city ? citySlug(row.address.city) : "");
      if (!slug) continue;
      const existing = byCity.get(slug);
      const updatedAt = row.updatedAt ? new Date(row.updatedAt) : undefined;
      if (!existing) byCity.set(slug, { citySlug: slug, city: row.address?.city ?? slug, updatedAt });
      else if (updatedAt && (!existing.updatedAt || updatedAt > existing.updatedAt)) existing.updatedAt = updatedAt;
    }
    return [...byCity.values()];
  }
}

/** `/ashrams/:city/:slug` for a stay, or null when it has no slug yet. */
export const ashramCanonicalPath = (row: any): string | null => {
  const slug = String(row?.slug ?? "").trim().toLowerCase();
  const city = String(row?.citySlug ?? "").trim().toLowerCase() || (row?.address?.city ? citySlug(row.address.city) : "");
  return slug && city ? `/ashrams/${city}/${slug}` : null;
};
