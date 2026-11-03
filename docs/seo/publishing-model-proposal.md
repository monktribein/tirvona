# SEO publishing workflow — implementation plan (Manager SOP "Central SEO publishing system")

Status: **implemented (2026-11-03), owner-approved.** This file is the design; how it works today
and where the code is: [`README.md`](README.md). Differences from this plan are listed in
`SEO_IMPLEMENTATION_REPORT.md` §15.2.

Files:
- `Newbackend/database/migrations/0014_seo_pages.sql`: the migration (applied by the next production deploy)
- `Newbackend/database/rollback/0014_seo_pages.down.sql`: rollback
- `Newbackend/src/modules/seo/seo-pages-migration.pg-spec.ts`: applies both to throwaway
  Postgres 17 and checks every constraint (8/8).

## 1. Design principle: reuse entity data, store only what is missing

Ashrams, temples, providers, products, events, circuits and blog posts already hold their
content, slug, status and `updatedAt`. Copying that content into a second table would create
two sources of truth that drift apart. The new `seo_pages` table holds **only** the SOP fields
that don't exist today: editorial overrides, workflow state, verification, and legacy ids.

A page **without** a `seo_pages` row behaves exactly as it does now (entity status governs,
title from the shared formula). So the table can ship empty, and no backfill is required.

| SOP field | Source after this change |
|---|---|
| `page_id` | `seo_pages.id`. For entity pages, `entity_id` links to the entity's `_id` |
| `page_type` | `seo_pages.page_type` (= `SeoEntityKind` in `routePolicy.ts`, plus `static`/`landing`) |
| `slug` | Entity `slug`, mirrored into `seo_pages.slug` when a row is created; static pages: path segment |
| `canonical_url` | Stored, but a CHECK forces it to equal `https://www.tirvona.com` + `path`. It can never point off-site or disagree with the route policy |
| `seo_title` / `meta_description` / `h1` | Optional overrides. NULL means use the shared formula (today's behaviour). Temples' existing `seo.seoTitle`/`seo.seoDescription` remain valid and are read first, so nothing has to migrate |
| `content_json` | NULL for entity pages (content stays in the entity). Used only for static/landing pages whose copy is in code today (`seoLandingConfigs.ts`), once editors take them over |
| `schema_json` | Optional **additions** (e.g. FAQPage) merged into generated JSON-LD. Generated schema stays authoritative, so visible content and schema can't drift |
| `indexing_status` | `index` / `noindex` (an editor can de-index a thin page) |
| `publication_status` | `draft → in_review → approved → published → retired` (§3) |
| `published_at` / `updated_at` | Stored; `updated_at` feeds sitemap `lastmod` as `max(entity.updatedAt, seo_pages.updated_at)` |
| `verified_at` (+ `verified_by`) | Stored; required before approve/publish (DB CHECK) |
| `legacy_wp_id` | Stored, unique when set. No WordPress import exists in this codebase today; the column costs nothing and is ready if one is planned |

Extra columns needed for the workflow: `entity_id`, `path`, `redirect_to`, `reviewed_by`,
`approved_by`, `retired_at`, `version` (optimistic locking), `created_by`, `updated_by`.

## 2. Migration, uniqueness and rollback

**Up**: `0014_seo_pages.sql`, one additive table, in the generator's exact layout (`id text`,
`COLLATE "C"`, `_nulls`, `_extra`, RLS on), followed by a hand-written constraints section.

Uniqueness:
- `path` unique: one record per public URL
- `(page_type, entity_id)` unique where `entity_id` is set: one record per entity
- `legacy_wp_id` unique where set

CHECK constraints (tested): allowed `page_type`; entity required for entity types and forbidden
for static ones; lowercase path with no query, `//` or trailing slash; slug format; canonical =
origin + path; title ≤ 70, description ≤ 170, H1 ≤ 120 characters; `content_json` is an object
and `schema_json` an object or array; status vocabularies; lifecycle facts (approved/published
needs `verified_at` and `approved_by`; published needs `published_at`; retired needs
`retired_at`; `redirect_to` only on retired rows, on-site, and not to itself).

**Rollback**: `0014_seo_pages.down.sql`. Deploy code without the model first, export the rows,
then drop the table and clear the ledger entry. Only override rows are lost; entity content is
untouched. The test applies the rollback and then re-applies the migration.

**How it becomes a real migration (after approval):**
1. Add `SeoPageSchema` (collection `seo_pages`, fields as in §1, the same unique indexes) under
   `src/modules/seo/infrastructure/` and register it in `SeoModule`.
2. `npm run db:generate` → `database/migrations/0014_seo_pages.sql`. Diff it against the docs
   copy: the generated part must match. Then append the "hand-written constraints" section.
3. Copy the down file to `database/rollback/0014_seo_pages.down.sql`.
4. `npm run test:pg` (the spec then points at the real files), then `npm run db:migrate -- --plan`
   against a **staging copy**. The production migration needs separate written approval.

## 3. Lifecycle

```
          submit            approve (needs verified_at)        publish
 draft ───────────► in_review ───────────────────► approved ──────────► published
   ▲   ◄─────────── │  reject (comment)                │                  │  edit → new draft revision*
   └────────────────┘                                  └── back to draft ◄┘
                                                                          │ retire
                                                                          ▼
                                                                       retired ── redirect_to? → 301, else 410
```
\* Editing a published row's SEO fields does not unpublish it: the edit is stored in `_extra.pending`
and goes through review; the live values change only when the revision is published. This keeps
pages online while a change is reviewed.

| Transition | Who (permission) | Rules (service layer, plus DB CHECK) |
|---|---|---|
| create / edit draft | `seo.pages.edit` | Path must classify through the shared route policy to the stated `page_type`; entity must exist |
| draft → in_review | `seo.pages.edit` | All validation (§4) passes |
| verify facts | `seo.pages.verify` | Sets `verified_at`, `verified_by`. Must be a different user from the last editor |
| in_review → approved | `seo.pages.approve` | `verified_at` set; approver ≠ editor (four-eyes) |
| approved → published | `seo.pages.publish` | Entity itself is publicly visible (approved / published / active) |
| published → retired | `seo.pages.retire` | `redirect_to` optional (301); otherwise the renderer answers **410** |
| any change | — | `version` must match (optimistic lock, 409 on conflict); audit entry via the existing `AuditModule` |

Roles: `super_admin` passes every check (the existing `PermissionsGuard` behaviour). Other
staff get the dotted permissions above, granted per user, the same mechanism HR uses
(`HR_PERMISSIONS`). Suggested mapping, for the content owner to confirm: content writer = edit;
fact-checker = verify; SEO lead = approve + publish + retire.

## 4. Validation rules (service layer)

- `seo_title` 30–65 characters recommended (warning), 70 hard limit; must be unique across
  published pages (case-insensitive) or the save is refused with the clashing path.
- `meta_description` 70–160 recommended, 170 hard limit, unique across published pages.
- `h1` ≤ 120, one per page (the template renders it; editors cannot add a second).
- No HTML in any text field (stripped and rejected); text is escaped at render time anyway.
- `schema_json`: only allow-listed `@type`s (FAQPage, HowTo, Event additions); no
  `aggregateRating`/`review` unless backed by real reviews; URLs must be on www.tirvona.com or
  the image CDN; size ≤ 16 KB.
- `content_json`: allow-listed keys per page type (`intro`, `sections[{heading, body}]`, `faq[]`);
  ≤ 64 KB.
- `redirect_to` must itself resolve (200) through the renderer, so no chains or loops.

## 5. API design

Admin (authenticated, `PermissionsGuard`):
```
GET    /api/seo/pages?type=&status=&q=          list (seo.pages.edit)
GET    /api/seo/pages/:id                        read with revision + history
POST   /api/seo/pages                            create draft
PATCH  /api/seo/pages/:id      {version, ...}    edit
POST   /api/seo/pages/:id/submit|verify|approve|publish|retire|reject   transitions (§3)
```

**Public read-only** (no auth, no write paths, cached):
```
GET /api/seo/meta?path=/temples/har-ki-pauri
→ 200 { canonicalUrl, title, description, h1, robots, schema }   only published rows
→ 404 for drafts/in_review/approved; 410 for retired
```
It returns only the allow-listed public fields, never `verified_by`, `approved_by`, `_extra` or
pending revisions. The browser needs this so client-side navigation shows the same overrides as
the server HTML. It sits behind the same `@SkipThrottle({ default: true })` + `ipAbuse` limits as
`/api/seo/render`.

## 6. Renderer and sitemap integration

In `SeoPagesService.resolve` (after the entity lookup, before building the page):
- published row → apply `seo_title` / `meta_description` / `h1`, merge `schema_json`;
  `indexing_status = noindex` → `noindex,follow` + `X-Robots-Tag`.
- retired row → 301 to `redirect_to`, or **410** with the not-found template + `noindex`.
- draft/in_review/approved row → ignored (live page stays as it is today).

`seo-sitemap.ts`: exclude paths whose row is `noindex` or `retired`; `lastmod` =
`max(entity.updatedAt, row.updated_at)` when a published row exists. One extra query per
sitemap build (`SELECT path, indexing_status, publication_status, updated_at FROM seo_pages
WHERE publication_status IN ('published','retired') OR indexing_status = 'noindex'`), covered by
`seo_pages_ix_status`.

## 7. Cache invalidation

Today: a 5-minute in-process render cache, cleared when a new frontend build lands, plus
`POST /api/seo/cache/invalidate` (super_admin).

With publishing:
1. Every publish/retire/edit-of-published transition calls `SeoRenderService.invalidate([path,
   redirect_to, parent hub paths])` in the same request, after the DB commit.
2. Entity services (ashram approve/edit, temple publish, product approve, …) call the same
   method through an exported `SeoInvalidationService` (a thin wrapper, so modules don't depend
   on render internals). Missing hooks degrade only to the 5-minute TTL.
3. The sitemap has `Cache-Control: max-age=3600`. A publish doesn't purge it; Google rereads it
   on its own schedule.
4. Multi-instance (if the API is ever scaled out): the in-process cache becomes per-instance, so
   either keep the TTL at 5 minutes or move invalidation to a Postgres `LISTEN/NOTIFY` channel.
   This isn't needed while production runs one API process.

## 8. Build estimate and order

1. Model + generated migration + down file (½ day) → staging migrate.
2. Admin service/controller + validation + audit + tests (2 days).
3. Renderer/sitemap integration + public `/api/seo/meta` + browser hook (1 day).
4. Admin UI screen (list, edit, review queue) (2 days, frontend owner).
5. Invalidation hooks in entity services (½ day).
