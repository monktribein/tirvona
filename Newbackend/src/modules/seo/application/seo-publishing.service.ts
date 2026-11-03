import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "../../../database/orm-nest";
import type { Model } from "../../../database/orm";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import { ROBOTS_INDEX, ROBOTS_NOINDEX_FOLLOW, classifyPath, normalizePath } from "../domain/seo-route-policy";
import {
  SEO_INDEXING_STATUSES,
  SEO_LIMITS,
  SEO_PAGE_TYPES,
  SEO_PAGE_TYPES_WITHOUT_ENTITY,
  SEO_PATH_MAX,
  SEO_PATH_PATTERN,
  SEO_PERMISSIONS,
  SEO_PUBLICATION_STATUSES,
  SEO_SLUG_MAX,
  SEO_SLUG_PATTERN,
  canonicalUrlForPath,
  checkContentJson,
  checkRedirect,
  checkSchemaJson,
  checkTexts,
  cleanText,
  textKey,
  type SeoCapability,
  type SeoPageType,
} from "../domain/seo-publishing";
import { SEO_PAGE_MODEL } from "../infrastructure/seo-page.schema";
import { SeoPagesService } from "./seo-pages.service";
import { SeoRenderService } from "./seo-render.service";

/** The editable SEO fields; a published page keeps a copy of them under review in `pending`. */
const CONTENT_FIELDS = ["seoTitle", "metaDescription", "h1", "contentJson", "schemaJson", "indexingStatus"] as const;
type ContentField = (typeof CONTENT_FIELDS)[number];
type Content = Partial<Record<ContentField, unknown>>;

export interface SeoPageInput {
  seoTitle?: string | null;
  metaDescription?: string | null;
  h1?: string | null;
  indexingStatus?: string;
  schemaJson?: unknown;
  contentJson?: unknown;
  legacyWpId?: string | null;
}

export interface SeoListQuery {
  type?: string;
  status?: string;
  /** "review": everything waiting for a verifier, approver or publisher. */
  queue?: string;
  q?: string;
}

type Stage = "draft" | "in_review" | "approved";
type Action = "submit" | "verify" | "approve" | "reject" | "publish" | "retire";

const LIST_LIMIT = 500;

/**
 * Creates and reviews editorial SEO records (seo_pages) and answers the public meta lookup.
 *
 * Lifecycle: draft → in_review → (verified) → approved → published → retired. Editing a
 * published page stores the change as a revision in `pending`; the live values stay online
 * until that revision is approved and published. Every change sends the version it was
 * based on (409 on conflict) and is written to audit_logs (module "SEO").
 *
 * Four eyes: whoever last edited the content cannot also verify or approve it. A super_admin
 * may do every step (one person runs Tirvona's SEO today); each step still records who did it.
 */
@Injectable()
export class SeoPublishingService {
  private readonly logger = new Logger(SeoPublishingService.name);

  constructor(
    @InjectModel(SEO_PAGE_MODEL) private readonly rows: Model<any>,
    @InjectModel("AuditLog") private readonly audits: Model<any>,
    private readonly pages: SeoPagesService,
    private readonly renderer: SeoRenderService,
  ) {}

  // ── Access ──────────────────────────────────────────────────────────────────

  can(user: AuthenticatedUser, capability: SeoCapability): boolean {
    return user.role === "super_admin" || (user.permissions ?? []).includes(SEO_PERMISSIONS[capability]);
  }

  private assertCan(user: AuthenticatedUser, capability: SeoCapability): void {
    if (!this.can(user, capability)) throw new ForbiddenException(`This needs the ${SEO_PERMISSIONS[capability]} permission.`);
  }

  private assertCanRead(user: AuthenticatedUser): void {
    const any = (Object.keys(SEO_PERMISSIONS) as SeoCapability[]).some((capability) => this.can(user, capability));
    if (!any) throw new ForbiddenException("SEO pages need one of the seo.pages.* permissions.");
  }

  /** What the signed-in user may do, so the screen only offers allowed actions. */
  capabilities(user: AuthenticatedUser): Record<SeoCapability, boolean> {
    return Object.fromEntries((Object.keys(SEO_PERMISSIONS) as SeoCapability[]).map((c) => [c, this.can(user, c)])) as Record<
      SeoCapability,
      boolean
    >;
  }

  // ── Reads ───────────────────────────────────────────────────────────────────

  async list(user: AuthenticatedUser, query: SeoListQuery) {
    this.assertCanRead(user);
    const filter: Record<string, unknown> = {};
    if (query.type && (SEO_PAGE_TYPES as readonly string[]).includes(query.type)) filter.pageType = query.type;
    if (query.status && (SEO_PUBLICATION_STATUSES as readonly string[]).includes(query.status)) filter.publicationStatus = query.status;
    let rows = (await this.rows.find(filter).sort({ updatedAt: -1 }).limit(LIST_LIMIT).lean()) as any[];
    const q = String(query.q ?? "").trim().toLowerCase();
    if (q) rows = rows.filter((r) => [r.path, r.seoTitle, r.h1].some((v) => String(v ?? "").toLowerCase().includes(q)));
    if (query.queue === "review") rows = rows.filter((r) => ["in_review", "approved"].includes(this.stageOf(r).stage));
    return { rows: rows.map((r) => this.view(r)), capabilities: this.capabilities(user) };
  }

  async get(user: AuthenticatedUser, id: string) {
    this.assertCanRead(user);
    const row = await this.load(id);
    const recent = (await this.audits.find({ module: "SEO" }).sort({ timestamp: -1 }).limit(LIST_LIMIT).lean()) as any[];
    const history = recent
      .filter((entry) => String(entry.details?.pageId ?? "") === id)
      .map((entry) => ({
        action: entry.action,
        userId: entry.userId ? String(entry.userId) : null,
        at: entry.timestamp ?? entry.createdAt,
        comment: entry.details?.comment ?? null,
      }));
    return { page: this.view(row), history, capabilities: this.capabilities(user) };
  }

  /**
   * Public, read-only: the published overrides for one path (only allow-listed fields), so
   * in-app navigation shows what the server-rendered HTML shows. Drafts, rows under review
   * and paths without a row are not found; a retired page reports where it went.
   */
  async publicMeta(rawPath: string) {
    const path = normalizePath(rawPath);
    const row = (await this.rows
      .findOne({ path, publicationStatus: { $in: ["published", "retired"] } })
      .select("path canonicalUrl seoTitle metaDescription h1 indexingStatus schemaJson publicationStatus redirectTo")
      .lean()) as any;
    if (!row) return { status: 404 as const };
    if (row.publicationStatus === "retired") return { status: 410 as const, redirectTo: row.redirectTo ?? null };
    return {
      status: 200 as const,
      meta: {
        path: row.path,
        canonicalUrl: row.canonicalUrl,
        title: row.seoTitle ?? null,
        description: row.metaDescription ?? null,
        h1: row.h1 ?? null,
        robots: row.indexingStatus === "noindex" ? ROBOTS_NOINDEX_FOLLOW : ROBOTS_INDEX,
        schema: row.schemaJson ?? null,
      },
    };
  }

  // ── Writes ──────────────────────────────────────────────────────────────────

  async create(user: AuthenticatedUser, input: SeoPageInput & { path: string; pageType?: string }) {
    this.assertCan(user, "edit");
    const path = String(input.path ?? "").trim();
    if (!SEO_PATH_PATTERN.test(path) || path.length > SEO_PATH_MAX || normalizePath(path) !== path) {
      throw new BadRequestException("Path must be a lowercase site path such as /temples/banke-bihari (no query, no trailing slash).");
    }
    const target = await this.describePath(path, input.pageType);
    if (await this.rows.exists({ path })) throw new ConflictException(`There is already an SEO record for ${path}.`);
    if (target.entityId && (await this.rows.exists({ pageType: target.pageType, entityId: target.entityId }))) {
      throw new ConflictException("This record already has an SEO record under another path.");
    }

    const content = this.readContent(input, {}, target.pageType);
    const legacyWpId = await this.readLegacyId(input.legacyWpId, null);
    const warnings = await this.validateContent(content, target.pageType, null);
    let row: any;
    try {
      row = await this.rows.create({
        ...target,
        canonicalUrl: canonicalUrlForPath(path),
        ...content,
        legacyWpId,
        publicationStatus: "draft",
        version: 1,
        createdBy: user.id,
        updatedBy: user.id,
      });
    } catch (error) {
      if ((error as { code?: number }).code === 11000) throw new ConflictException("An SEO record for this page or WordPress id already exists.");
      throw error;
    }
    await this.audit(user, "SEO_PAGE_CREATED", row);
    return { page: this.view(row.toObject ? row.toObject() : row), warnings };
  }

  async update(user: AuthenticatedUser, id: string, input: SeoPageInput & { version: number }) {
    this.assertCan(user, "edit");
    const row = await this.load(id);
    this.assertVersion(row, input.version);
    if (row.publicationStatus === "retired") throw new ConflictException("A retired page cannot be edited.");

    const base: Content = row.publicationStatus === "published" && row.pending ? row.pending : row;
    const content = this.readContent(input, base, row.pageType);
    const warnings = await this.validateContent(content, row.pageType, row);
    const changes: Record<string, unknown> = {};
    if (input.legacyWpId !== undefined) changes.legacyWpId = await this.readLegacyId(input.legacyWpId, row);

    if (row.publicationStatus === "published") {
      // The live page stays as it is; the change goes through review as a revision.
      changes.pending = { ...content, stage: "draft", verifiedAt: null, verifiedBy: null, approvedBy: null, editedBy: user.id, editedAt: new Date() };
    } else {
      // Any edit restarts the review.
      Object.assign(changes, content, { publicationStatus: "draft", verifiedAt: null, verifiedBy: null, approvedBy: null, updatedBy: user.id });
    }
    const saved = await this.commit(row, changes);
    await this.audit(user, "SEO_PAGE_EDITED", saved);
    return { page: this.view(saved), warnings };
  }

  async transition(user: AuthenticatedUser, id: string, action: Action, input: { version: number; comment?: string; redirectTo?: string | null }) {
    const capability: Record<Action, SeoCapability> = {
      submit: "edit",
      verify: "verify",
      approve: "approve",
      reject: "approve",
      publish: "publish",
      retire: "retire",
    };
    this.assertCan(user, capability[action]);
    const row = await this.load(id);
    this.assertVersion(row, input.version);
    const { target, stage, content, lastEditor } = this.stageOf(row);
    const now = new Date();
    const onTarget = (fields: Record<string, unknown>): Record<string, unknown> =>
      target === "pending" ? { pending: { ...row.pending, ...fields } } : fields;
    const stageField = (next: Stage | "published"): Record<string, unknown> =>
      target === "pending" ? { stage: next } : { publicationStatus: next };
    let changes: Record<string, unknown>;
    let comment: string | null = null;

    switch (action) {
      case "submit": {
        this.expectStage(stage, ["draft"], "Only a draft can be submitted for review.");
        const warnings = await this.validateContent(content, row.pageType, row);
        changes = onTarget({ ...stageField("in_review") });
        const saved = await this.commit(row, changes);
        await this.audit(user, "SEO_PAGE_SUBMITTED", saved);
        return { page: this.view(saved), warnings };
      }
      case "verify":
        this.expectStage(stage, ["in_review"], "Facts are verified while the page is in review.");
        this.assertFourEyes(user, lastEditor, "verify the facts of");
        changes = onTarget({ verifiedAt: now, verifiedBy: user.id });
        break;
      case "approve": {
        this.expectStage(stage, ["in_review"], "Only a page in review can be approved.");
        const verified = target === "pending" ? row.pending?.verifiedAt : row.verifiedAt;
        if (!verified) throw new BadRequestException("Verify the facts before approving.");
        this.assertFourEyes(user, lastEditor, "approve");
        changes = { ...onTarget({ ...stageField("approved"), approvedBy: user.id }), reviewedBy: user.id };
        break;
      }
      case "reject":
        this.expectStage(stage, ["in_review", "approved"], "Only a page in review or approved can be sent back.");
        comment = this.readComment(input.comment);
        changes = { ...onTarget({ ...stageField("draft"), verifiedAt: null, verifiedBy: null, approvedBy: null }), reviewedBy: user.id };
        break;
      case "publish": {
        this.expectStage(stage, ["approved"], "Only an approved page can be published.");
        await this.assertPagePublic(row.path);
        await this.assertUniqueTexts(content, row);
        changes =
          target === "pending"
            ? {
                ...this.pick(row.pending, CONTENT_FIELDS),
                verifiedAt: row.pending.verifiedAt,
                verifiedBy: row.pending.verifiedBy,
                approvedBy: row.pending.approvedBy,
                updatedBy: row.pending.editedBy ?? row.updatedBy,
                publishedAt: now,
                pending: null,
              }
            : { publicationStatus: "published", publishedAt: now };
        break;
      }
      case "retire": {
        if (row.publicationStatus !== "published") throw new ConflictException("Only a published page can be retired.");
        const redirectTo = cleanText(input.redirectTo);
        if (redirectTo) {
          const errors = checkRedirect(redirectTo, row.path);
          if (errors.length) throw new BadRequestException(errors.join(" "));
          const live = await this.pages.resolve(redirectTo);
          if (live.status !== 200) throw new BadRequestException(`${redirectTo} is not a live page, so it cannot be the new home.`);
        }
        changes = { publicationStatus: "retired", retiredAt: now, redirectTo: redirectTo ?? null, pending: null };
        break;
      }
    }

    const saved = await this.commit(row, changes);
    if (action === "publish" || action === "retire") this.renderer.invalidate([row.path, ...(saved.redirectTo ? [saved.redirectTo] : [])]);
    const done: Record<Action, string> = {
      submit: "SEO_PAGE_SUBMITTED",
      verify: "SEO_PAGE_VERIFIED",
      approve: "SEO_PAGE_APPROVED",
      reject: "SEO_PAGE_REJECTED",
      publish: "SEO_PAGE_PUBLISHED",
      retire: "SEO_PAGE_RETIRED",
    };
    await this.audit(user, done[action], saved, comment);
    return { page: this.view(saved), warnings: [] as string[] };
  }

  // ── Rules ───────────────────────────────────────────────────────────────────

  /**
   * Which page a path is, by the shared route policy: its page type, slug and (for entity
   * pages) the public record behind it. The path must already be the page's canonical URL.
   */
  private async describePath(path: string, requestedType?: string): Promise<{ pageType: SeoPageType; entityId: string | null; slug: string; path: string }> {
    const match = classifyPath(path);
    let pageType: SeoPageType;
    let entityId: string | null = null;
    let slug = path.split("/").filter(Boolean).pop() ?? "";
    if (match.kind === "static") {
      if (requestedType && !["static", "landing"].includes(requestedType)) {
        throw new BadRequestException(`${path} is a fixed site page, so its type is static or landing.`);
      }
      pageType = requestedType === "landing" ? "landing" : "static";
    } else if (match.kind === "entity") {
      if (requestedType && requestedType !== match.entity) throw new BadRequestException(`${path} is a ${match.entity} page.`);
      pageType = match.entity;
      slug = match.params.slug ?? match.params.id ?? slug;
      if (!SEO_PAGE_TYPES_WITHOUT_ENTITY.includes(pageType)) {
        const entity = await this.pages.entityFor(match.entity, match.params);
        if (!entity) throw new BadRequestException(`There is no public ${match.entity} at ${path}.`);
        entityId = String(entity._id);
      }
    } else {
      throw new BadRequestException(`${path} is not a public page that search engines index, so it cannot have an SEO record.`);
    }
    const generated = await this.pages.resolveDefault(path);
    if (generated.status !== 200) throw new BadRequestException(`${path} is not publicly visible right now.`);
    const canonical = new URL(generated.page.canonicalUrl).pathname;
    if (canonical !== path) throw new BadRequestException(`Use the page's own address, ${canonical}.`);
    if (!SEO_SLUG_PATTERN.test(slug) || slug.length > SEO_SLUG_MAX) {
      throw new BadRequestException(`The page's slug "${slug}" is not lowercase letters, digits and dashes; rename it first.`);
    }
    return { pageType, entityId, slug, path };
  }

  /** The new content: given fields replace the base, empty text clears an override. */
  private readContent(input: SeoPageInput, base: Content, pageType: SeoPageType): Content {
    const next: Content = this.pick(base, CONTENT_FIELDS);
    for (const field of ["seoTitle", "metaDescription", "h1"] as const) {
      if (input[field] !== undefined) next[field] = cleanText(input[field]);
    }
    if (input.indexingStatus !== undefined) {
      if (!(SEO_INDEXING_STATUSES as readonly string[]).includes(input.indexingStatus)) throw new BadRequestException("Indexing must be index or noindex.");
      next.indexingStatus = input.indexingStatus;
    }
    next.indexingStatus ??= "index";
    if (input.schemaJson !== undefined) next.schemaJson = input.schemaJson ?? null;
    if (input.contentJson !== undefined) {
      if (input.contentJson !== null && !["static", "landing"].includes(pageType)) {
        throw new BadRequestException("Page copy (content) is only for static and landing pages; an entity page's content lives in the entity.");
      }
      next.contentJson = input.contentJson ?? null;
    }
    return next;
  }

  /** Errors stop the save; warnings (lengths outside the recommended range) are returned. */
  private async validateContent(content: Content, pageType: SeoPageType, row: any): Promise<string[]> {
    const { errors, warnings } = checkTexts({
      seoTitle: content.seoTitle as string | null,
      metaDescription: content.metaDescription as string | null,
      h1: content.h1 as string | null,
    });
    errors.push(...checkSchemaJson(content.schemaJson), ...checkContentJson(content.contentJson));
    if (content.contentJson && !["static", "landing"].includes(pageType)) errors.push("Page copy (content) is only for static and landing pages.");
    if (errors.length) throw new BadRequestException(errors);
    await this.assertUniqueTexts(content, row);
    return warnings;
  }

  /** A title or description may be used by one published page only (search engines treat repeats as duplicates). */
  private async assertUniqueTexts(content: Content, row: any): Promise<void> {
    const checks: Array<[ContentField, string]> = [
      ["seoTitle", "SEO title"],
      ["metaDescription", "meta description"],
    ];
    const wanted = checks.filter(([field]) => textKey(content[field] as string));
    if (!wanted.length) return;
    const published = (await this.rows
      .find({ publicationStatus: "published" })
      .select("path seoTitle metaDescription")
      .lean()) as any[];
    for (const [field, label] of wanted) {
      const clash = published.find((other) => String(other._id) !== String(row?._id ?? "") && textKey(other[field]) === textKey(content[field] as string));
      if (clash) throw new ConflictException(`The same ${label} is already live on ${clash.path}; make it unique.`);
    }
  }

  private async readLegacyId(value: string | null | undefined, row: any): Promise<string | null> {
    const id = cleanText(value);
    if (id && id.length > 64) throw new BadRequestException("WordPress id is too long.");
    if (id && (await this.rows.exists({ legacyWpId: id, _id: { $ne: row?._id ?? null } }))) {
      throw new ConflictException(`WordPress id ${id} is already mapped to another page.`);
    }
    return id;
  }

  private readComment(value: string | undefined): string {
    const comment = cleanText(value);
    if (!comment) throw new BadRequestException("Say what needs to change.");
    if (comment.length > SEO_LIMITS.comment) throw new BadRequestException(`Keep the comment under ${SEO_LIMITS.comment} characters.`);
    return comment;
  }

  /** Publishing never makes a hidden record public: the page itself must be live today. */
  private async assertPagePublic(path: string): Promise<void> {
    const generated = await this.pages.resolveDefault(path);
    if (generated.status !== 200 || new URL(generated.page.canonicalUrl).pathname !== path) {
      throw new ConflictException(`${path} is not publicly visible right now, so its SEO record cannot go live.`);
    }
  }

  private assertFourEyes(user: AuthenticatedUser, lastEditor: string | null, verb: string): void {
    if (user.role === "super_admin") return;
    if (lastEditor && String(lastEditor) === String(user.id)) {
      throw new ForbiddenException(`You edited this page last, so someone else must ${verb} it.`);
    }
  }

  private expectStage(stage: string, allowed: string[], message: string): void {
    if (!allowed.includes(stage)) throw new ConflictException(message);
  }

  private assertVersion(row: any, version: unknown): void {
    if (Number(version) !== Number(row.version)) {
      throw new ConflictException("This page was changed by someone else. Reload it and try again.");
    }
  }

  /** Where the workflow is: the row itself, or the revision of a published page. */
  private stageOf(row: any): { target: "row" | "pending"; stage: string; content: Content; lastEditor: string | null } {
    if (row.publicationStatus === "published" && row.pending) {
      return { target: "pending", stage: row.pending.stage, content: row.pending, lastEditor: row.pending.editedBy ?? null };
    }
    return { target: "row", stage: row.publicationStatus, content: row, lastEditor: row.updatedBy ? String(row.updatedBy) : null };
  }

  // ── Persistence ─────────────────────────────────────────────────────────────

  private async load(id: string): Promise<any> {
    const row = /^[a-f0-9]{24}$/i.test(String(id)) ? await this.rows.findById(id).lean() : null;
    if (!row) throw new NotFoundException("SEO record not found.");
    return row;
  }

  /** Writes only if nobody changed the row since it was read (optimistic lock). */
  private async commit(row: any, changes: Record<string, unknown>): Promise<any> {
    const saved = await this.rows
      .findOneAndUpdate({ _id: row._id, version: row.version }, { $set: { ...changes, version: Number(row.version) + 1 } }, { new: true })
      .lean();
    if (!saved) throw new ConflictException("This page was changed by someone else. Reload it and try again.");
    return saved;
  }

  private pick(source: any, fields: readonly ContentField[]): Content {
    const out: Content = {};
    for (const field of fields) if (source?.[field] !== undefined) out[field] = source[field];
    return out;
  }

  private async audit(user: AuthenticatedUser, action: string, row: any, comment: string | null = null): Promise<void> {
    try {
      await this.audits.create({
        userId: user.id,
        action,
        module: "SEO",
        details: { pageId: String(row._id), path: row.path, version: row.version, ...(comment ? { comment } : {}) },
      });
    } catch (error) {
      // The change itself already succeeded; a failed audit write is logged loudly, not hidden.
      this.logger.error(`SEO audit write failed for ${action}: ${(error as Error).message}`);
    }
  }

  /** The admin view of a row. Everything here is editorial metadata; user ids, never names or contacts. */
  private view(row: any) {
    const id = (v: unknown) => (v ? String(v) : null);
    return {
      id: String(row._id),
      pageType: row.pageType,
      entityId: id(row.entityId),
      slug: row.slug ?? "",
      path: row.path,
      canonicalUrl: row.canonicalUrl,
      seoTitle: row.seoTitle ?? null,
      metaDescription: row.metaDescription ?? null,
      h1: row.h1 ?? null,
      contentJson: row.contentJson ?? null,
      schemaJson: row.schemaJson ?? null,
      indexingStatus: row.indexingStatus ?? "index",
      publicationStatus: row.publicationStatus,
      redirectTo: row.redirectTo ?? null,
      publishedAt: row.publishedAt ?? null,
      verifiedAt: row.verifiedAt ?? null,
      verifiedBy: id(row.verifiedBy),
      reviewedBy: id(row.reviewedBy),
      approvedBy: id(row.approvedBy),
      retiredAt: row.retiredAt ?? null,
      legacyWpId: row.legacyWpId ?? null,
      version: row.version,
      pending: row.pending ?? null,
      stage: this.stageOf(row).stage,
      createdBy: id(row.createdBy),
      updatedBy: id(row.updatedBy),
      createdAt: row.createdAt ?? null,
      updatedAt: row.updatedAt ?? null,
    };
  }
}
