import { Allow, IsIn, IsInt, IsOptional, IsString, Matches, MaxLength, Min, ValidateIf } from "class-validator";
import { SEO_INDEXING_STATUSES, SEO_PAGE_TYPES, SEO_PUBLICATION_STATUSES } from "../domain/seo-publishing";

/**
 * Shape checks only. The exact limits, plain-text rule and JSON rules are enforced by
 * SeoPublishingService (domain/seo-publishing.ts) so editors get one clear message per problem.
 * null or "" clears an override.
 */
class SeoContentFields {
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(400) seoTitle?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(1000) metaDescription?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(600) h1?: string | null;
  @IsOptional() @IsIn(SEO_INDEXING_STATUSES) indexingStatus?: string;
  /** JSON-LD additions: an object or a list of objects. */
  @IsOptional() @Allow() schemaJson?: unknown;
  /** Static/landing page copy: { intro, sections: [{ heading, body }], faq: [{ question, answer }] }. */
  @IsOptional() @Allow() contentJson?: unknown;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(64) legacyWpId?: string | null;
}

export class CreateSeoPageDto extends SeoContentFields {
  @IsString() @MaxLength(300) path!: string;
  /** Only needed to mark a fixed page as a landing page; entity page types come from the path. */
  @IsOptional() @IsIn(SEO_PAGE_TYPES) pageType?: string;
}

export class UpdateSeoPageDto extends SeoContentFields {
  @IsInt() @Min(1) version!: number;
}

export class SeoTransitionDto {
  @IsInt() @Min(1) version!: number;
  /** Required when sending a page back. */
  @IsOptional() @IsString() @MaxLength(2000) comment?: string;
  /** Retire only: where the page now lives (301). Empty answers 410. */
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(300) redirectTo?: string | null;
}

export class SeoPagesQueryDto {
  @IsOptional() @IsIn(SEO_PAGE_TYPES) type?: string;
  @IsOptional() @IsIn(SEO_PUBLICATION_STATUSES) status?: string;
  @IsOptional() @IsIn(["review"]) queue?: string;
  @IsOptional() @IsString() @MaxLength(200) q?: string;
}

export class SeoMetaQueryDto {
  @IsString()
  @MaxLength(2048)
  @Matches(/^\/[^\s?#\\]*$/, { message: "path must be a site-relative path" })
  path!: string;
}
