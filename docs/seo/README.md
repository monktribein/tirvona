# SEO on www.tirvona.com

How search engines see Tirvona, how editors change what they see, and what is left for people to do.
History and test evidence: [`SEO_IMPLEMENTATION_REPORT.md`](SEO_IMPLEMENTATION_REPORT.md).

## How a public page reaches a search engine

1. nginx (`deploy/nginx/tirvona-web.conf`, section 3b) asks the API's renderer for every public
   page: `GET /api/seo/render` with the original URL in `X-Seo-Path`.
2. The renderer (`Newbackend/src/modules/seo`) returns the built `index.html` with the page's own
   title, description, canonical, robots, JSON-LD, one H1 and a crawlable summary, or a real 301 /
   404 / 410. It reads only public records, never cookies or the signed-in user.
3. If the API is down, slow or answers 429/5xx, nginx serves the plain `index.html` instead, so the
   site never depends on the renderer.
4. `https://www.tirvona.com/sitemap.xml` lists every indexable canonical URL with real `lastmod`
   dates (`common/sitemap.controller.ts` → `seo/application/seo-sitemap.ts`).

**Route policy:** which URLs are indexable, private or redirects lives in two byte-identical copies,
`frontend/src/seo/routePolicy.ts` and `Newbackend/src/modules/seo/domain/seo-route-policy.ts`. Edit
one and copy it over the other; `seo-route-policy.spec.ts` fails when they drift or when a route in
`App.tsx` is not classified.

## Changing a page's title, description or H1 (SEO publishing)

Admin → **Content & Promotions → SEO Pages** (`/admin/seo/pages`).

1. **Create** a record for a public page's own path (e.g. `/temples/banke-bihari`): SEO title,
   meta description, H1, index/noindex, optional FAQ/HowTo/Event JSON-LD, optional old WordPress id.
   Empty fields keep the generated values.
2. **Submit for review** → someone **verifies the facts** → an approver **approves** → **publish**.
   Only then does the page change, for search engines (server HTML and sitemap) and in the browser.
3. Editing a published page creates a **revision**; the live version stays online until the
   revision goes through the same steps.
4. **Retire** a page with a new home (301) or without one (410 "gone"). It leaves the sitemap.

Who can do what is set per user in User Management (permissions): `seo.pages.edit`,
`seo.pages.verify`, `seo.pages.approve`, `seo.pages.publish`, `seo.pages.retire`. Super Admin holds
all of them. For staff, the person who last edited a page cannot verify or approve it. Every step is
written to the audit log. Titles and descriptions must be unique among published pages; ratings and
reviews cannot be added as schema; links in schema must stay on www.tirvona.com.

Code: model `seo/infrastructure/seo-page.schema.ts`, rules `seo/domain/seo-publishing.ts`, service
`seo/application/seo-publishing.service.ts`, API `seo/presentation/seo-publishing.controller.ts`
(`/api/seo/pages…` for staff, public `/api/seo/meta?path=`), table `seo_pages` from migration
`Newbackend/database/migrations/0014_seo_pages.sql` (rollback: `database/rollback/0014_seo_pages.down.sql`).

## Analytics

`frontend/index.html` loads GA4 and Google Ads; `PageViewTracker` in `App.tsx` sends exactly one
page view per page load and per in-app navigation (`frontend/scripts/analytics-pageviews.test.mjs`).

## Still for people (cannot be done from code)

1. Merge to `main`: the deploy applies migration 0014, installs the nginx routing and restarts the
   API. Watch the first deploy log; `nginx -t` has never run against the real server config.
2. Server: `TRUST_PROXY=true` in the API's `.env`.
3. GitHub: protect `main` and require the "Tirvona CI" checks before merging.
4. Google Search Console: add the property, submit the sitemap, request indexing for key pages.
5. Give the SEO team their `seo.pages.*` permissions.
6. Marketing: Google Ads conversion label for `purchase`. Content team: copy for thin records.

## Folders here

| Path | What it is |
|---|---|
| `SEO_IMPLEMENTATION_REPORT.md` | Revisions 1–4: what was built, tests, deployment and rollback notes |
| `publishing-model-proposal.md` | The design of the publishing workflow |
| `keyword-research/` | The SEO team's keyword mappings and approved landing-page copy |
