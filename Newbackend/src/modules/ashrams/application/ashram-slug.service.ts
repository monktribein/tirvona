import { Injectable, OnModuleInit } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import { citySlug, slugify, uniqueSlug } from "../../../common/slug/slug.util";
import {
  UrlResolverService,
  isObjectIdLike,
} from "../../urls/application/url-resolver.service";

export interface AshramUrlParts {
  citySlug: string;
  slug: string;
}

/** Public path for an ashram. Database ids never appear here. */
export const ashramPath = (parts: AshramUrlParts): string =>
  `/ashrams/${parts.citySlug}/${parts.slug}`;

export const ashramBookingPath = (parts: AshramUrlParts): string =>
  `${ashramPath(parts)}/book`;

@Injectable()
export class AshramSlugService implements OnModuleInit {
  constructor(
    @InjectModel("Ashram") private readonly ashrams: Model<any>,
    private readonly urls: UrlResolverService,
  ) {}

  /** Teaches the resolver how the old /ashram/<id> URLs map forward. */
  onModuleInit(): void {
    this.urls.register({
      pattern: /^\/ashram\/([0-9a-f]{24})(?:\/.*)?$/i,
      resolve: async (match) => {
        const row = await this.ashrams
          .findById(match[1])
          .select("slug citySlug name address deletedAt")
          .lean();
        if (!row || (row as any).deletedAt) return null;
        const parts = await this.ensureSlug(row);
        return parts ? ashramPath(parts) : null;
      },
    });
  }

  private cityOf(row: any): string {
    // address.city is the live field, so a corrected city reaches the URL.
    // The stored citySlug is only a fallback for rows with no address.
    return citySlug(
      row?.address?.city ||
        row?.address?.district ||
        row?.citySlug ||
        "india",
    );
  }

  /**
   * Returns the ashram's url parts, filling in and persisting a clean slug for
   * rows created before slug-based routing.
   */
  async ensureSlug(row: any): Promise<AshramUrlParts | null> {
    if (!row?._id) return null;
    const city = this.cityOf(row) || "india";

    if (row.slug && row.citySlug) return { citySlug: row.citySlug, slug: row.slug };

    const slug = await this.allocate(row.name, city, String(row._id));
    await this.ashrams.updateOne(
      { _id: row._id },
      { $set: { slug, citySlug: city } },
    );
    return { citySlug: city, slug };
  }

  /** Allocates the cleanest slug free within the given city. */
  async allocate(
    name: string,
    city: string,
    ignoreId?: string,
  ): Promise<string> {
    return uniqueSlug(name, {
      fallback: "ashram",
      exists: async (candidate) =>
        Boolean(
          await this.ashrams.exists({
            citySlug: city,
            slug: candidate,
            ...(ignoreId ? { _id: { $ne: ignoreId } } : {}),
          }),
        ),
    });
  }

  /**
   * Keeps the public URL in step with a renamed ashram or a corrected city,
   * recording the previous path so it keeps answering with a 301.
   */
  async syncSlug(row: any): Promise<AshramUrlParts> {
    const city = this.cityOf(row) || "india";
    const previous =
      row.slug && row.citySlug
        ? ashramPath({ citySlug: row.citySlug, slug: row.slug })
        : null;

    const desired = slugify(row.name) || "ashram";
    const unchanged = row.citySlug === city && row.slug === desired;
    const slug = unchanged
      ? row.slug
      : await this.allocate(row.name, city, String(row._id));

    if (row.slug !== slug || row.citySlug !== city)
      await this.ashrams.updateOne(
        { _id: row._id },
        { $set: { slug, citySlug: city } },
      );

    const parts = { citySlug: city, slug };
    const next = ashramPath(parts);
    if (previous && previous !== next)
      await this.urls.remember({
        fromPath: previous,
        toPath: next,
        entityType: "ashram",
        entityId: row._id,
        reason: "ashram slug or city changed",
      });
    return parts;
  }

  /**
   * Resolves a public /ashrams/:city/:slug pair. Also accepts a raw id so
   * internal callers and old bookmarks keep working while links are migrated.
   */
  async findByPath(city: string, slug: string): Promise<any | null> {
    if (!slug) return null;
    if (isObjectIdLike(slug))
      return this.ashrams.findOne({ _id: slug, deletedAt: null }).lean();

    const scoped = await this.ashrams
      .findOne({ citySlug: citySlug(city), slug: slugify(slug), deletedAt: null })
      .lean();
    if (scoped) return scoped;

    // Falls back to a city-agnostic match so a listing whose city was edited
    // still resolves instead of 404ing before the redirect is recorded.
    return this.ashrams.findOne({ slug: slugify(slug), deletedAt: null }).lean();
  }
}
