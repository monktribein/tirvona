import api from "../lib/api";

export type SeoPublicationStatus = "draft" | "in_review" | "approved" | "published" | "retired";
export type SeoAction = "submit" | "verify" | "approve" | "reject" | "publish" | "retire";

export interface SeoRevision {
  seoTitle?: string | null;
  metaDescription?: string | null;
  h1?: string | null;
  indexingStatus?: "index" | "noindex";
  schemaJson?: unknown;
  contentJson?: unknown;
  stage: "draft" | "in_review" | "approved";
  verifiedAt?: string | null;
  verifiedBy?: string | null;
  approvedBy?: string | null;
  editedBy?: string | null;
  editedAt?: string | null;
}

export interface SeoPageRecord {
  id: string;
  pageType: string;
  entityId: string | null;
  slug: string;
  path: string;
  canonicalUrl: string;
  seoTitle: string | null;
  metaDescription: string | null;
  h1: string | null;
  contentJson: unknown;
  schemaJson: unknown;
  indexingStatus: "index" | "noindex";
  publicationStatus: SeoPublicationStatus;
  redirectTo: string | null;
  publishedAt: string | null;
  verifiedAt: string | null;
  verifiedBy: string | null;
  reviewedBy: string | null;
  approvedBy: string | null;
  retiredAt: string | null;
  legacyWpId: string | null;
  version: number;
  /** A reviewed change to a published page; the live values above stay online until it is published. */
  pending: SeoRevision | null;
  /** Where the workflow is: the row's status, or the revision's stage for a published page. */
  stage: string;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface SeoCapabilities {
  edit: boolean;
  verify: boolean;
  approve: boolean;
  publish: boolean;
  retire: boolean;
}

export interface SeoHistoryEntry {
  action: string;
  userId: string | null;
  at: string;
  comment: string | null;
}

export interface SeoPageInput {
  path?: string;
  pageType?: string;
  seoTitle?: string | null;
  metaDescription?: string | null;
  h1?: string | null;
  indexingStatus?: "index" | "noindex";
  schemaJson?: unknown;
  contentJson?: unknown;
  legacyWpId?: string | null;
  version?: number;
}

/** The published overrides for one public path (null fields: the page keeps its own). */
export interface SeoPublicMeta {
  path: string;
  canonicalUrl: string;
  title: string | null;
  description: string | null;
  h1: string | null;
  robots: string;
  schema: unknown;
}

/** SEO publishing API (Newbackend/src/modules/seo). */
export const seoService = {
  list: (params: { status?: string; type?: string; queue?: string; q?: string }) => api.get("/seo/pages", { params }),
  get: (id: string) => api.get(`/seo/pages/${id}`),
  create: (body: SeoPageInput) => api.post("/seo/pages", body),
  update: (id: string, body: SeoPageInput & { version: number }) => api.patch(`/seo/pages/${id}`, body),
  act: (id: string, action: SeoAction, body: { version: number; comment?: string; redirectTo?: string | null }) =>
    api.post(`/seo/pages/${id}/${action}`, body),
  /** Public. A 404 (no published record) is normal, so it never shows an error toast. */
  meta: (path: string) => api.get("/seo/meta", { params: { path }, skipToast: true }),
};
