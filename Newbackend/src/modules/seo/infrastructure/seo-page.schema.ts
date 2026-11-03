import { Schema, SchemaTypes } from "../../../database/orm";
import { SEO_INDEXING_STATUSES, SEO_PAGE_TYPES, SEO_PUBLICATION_STATUSES } from "../domain/seo-publishing";

export const SEO_PAGE_MODEL = "SeoPage";

const userRef = { type: SchemaTypes.ObjectId, ref: "User", default: null };

/**
 * seo_pages: editorial SEO overrides for one public URL and their review workflow.
 * Holds only what the entity itself does not: overrides, workflow state, verification and
 * legacy ids. Migration 0014 adds CHECK constraints for the same rules the service enforces.
 */
export const SeoPageSchema = new Schema(
  {
    pageType: { type: String, required: true, enum: SEO_PAGE_TYPES },
    /** The record behind an entity page (null for static/landing/city pages). */
    entityId: { type: SchemaTypes.ObjectId, default: null },
    /** Mirrors the entity slug ("" for the home page). */
    slug: { type: String, default: "" },
    /** The canonical public path, e.g. /temples/banke-bihari. One row per path. */
    path: { type: String, required: true },
    /** Always https://www.tirvona.com + path (a DB CHECK enforces it). */
    canonicalUrl: { type: String, required: true },
    /** Overrides; null means the shared formula is used. */
    seoTitle: { type: String, default: null },
    metaDescription: { type: String, default: null },
    h1: { type: String, default: null },
    /** Page copy for static/landing pages that editors take over from code. */
    contentJson: { type: SchemaTypes.Mixed, default: null },
    /** JSON-LD additions (FAQPage, HowTo, Event), merged into the generated schema. */
    schemaJson: { type: SchemaTypes.Mixed, default: null },
    indexingStatus: { type: String, enum: SEO_INDEXING_STATUSES, default: "index" },
    publicationStatus: { type: String, enum: SEO_PUBLICATION_STATUSES, default: "draft" },
    /** Only on retired rows: where the page now lives (301). None means 410. */
    redirectTo: { type: String, default: null },
    publishedAt: { type: Date, default: null },
    verifiedAt: { type: Date, default: null },
    verifiedBy: userRef,
    reviewedBy: userRef,
    approvedBy: userRef,
    retiredAt: { type: Date, default: null },
    legacyWpId: { type: String, default: null },
    /** Optimistic lock: every change must send the version it was based on. */
    version: { type: Number, default: 1 },
    /**
     * A revision of a published page under review. The live values stay online until the
     * revision is published: { seoTitle, metaDescription, h1, contentJson, schemaJson,
     * indexingStatus, stage: draft | in_review | approved, verifiedAt, verifiedBy, approvedBy,
     * editedBy }.
     */
    pending: { type: SchemaTypes.Mixed, default: null },
    createdBy: userRef,
    updatedBy: userRef,
  },
  { timestamps: true, collection: "seo_pages", versionKey: false },
);
// One row per public URL.
SeoPageSchema.index({ path: 1 }, { unique: true });
// One row per entity (a temple cannot have two SEO records).
SeoPageSchema.index({ pageType: 1, entityId: 1 }, { unique: true, partialFilterExpression: { entityId: { $exists: true } } });
// A WordPress post maps to at most one page.
SeoPageSchema.index({ legacyWpId: 1 }, { unique: true, partialFilterExpression: { legacyWpId: { $exists: true } } });
// Renderer, sitemap and review-queue reads.
SeoPageSchema.index({ publicationStatus: 1, indexingStatus: 1 });
SeoPageSchema.index({ pageType: 1, publicationStatus: 1 });
