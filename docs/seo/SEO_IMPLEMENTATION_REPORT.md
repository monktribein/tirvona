# Tirvona SEO: release package and Manager SOP v1.0 compliance report

> **Current status (revision 4, 2026-11-03) — read this first.** Sections 0–14 are the history of
> revisions 1–3 and some of their instructions are now out of date. What changed since:
> - **nginx**: the SEO routing is part of `deploy/nginx/tirvona-web.conf` (section 3b). The separate
>   `tirvona-web.seo.conf` and the manual edit in §9.2 step 3 are gone: every deploy installs the
>   snippet, runs `nginx -t`, restores the previous copy on failure, and reloads only when it passes.
> - **GA4**: the single page-view fix is applied in `frontend/index.html`; the patch file is gone and
>   `frontend/scripts/analytics-pageviews.test.mjs` passes 6/6.
> - **Publishing system**: built. Migration `Newbackend/database/migrations/0014_seo_pages.sql` (applied
>   automatically by the next production deploy), API under `/api/seo/pages` and `/api/seo/meta`,
>   admin screen Content → SEO Pages. See §15 and [`README.md`](README.md).
> - **Also done**: `Host:` removed from robots.txt (static file and API fallback); `vercel.json` CSP
>   allows gtag; every `<img>` in the web apps has an `alt`; `SEO_SHELL_PATH`/`TRUST_PROXY` documented
>   in `.env.example`.
> - **Still for people, not code**: §15.4.

Revision 2 · 2026-10-30 · Scope: https://www.tirvona.com
Status (revision 2): code complete and verified locally; not deployed.

---

## 0. What changed in revision 2

Independent re-verification found **two production blockers that the revision-1 tests could not
catch**. Both are fixed and covered by tests.

| # | Finding | Impact if deployed as in rev. 1 | Fix |
|---|---|---|---|
| B1 | `main.ts` applies `helmet()` to every response, so the rendered HTML carried helmet's default `Content-Security-Policy: default-src 'self'; script-src 'self'; img-src 'self' data:`, plus `Cross-Origin-Opener-Policy: same-origin` and `Referrer-Policy: no-referrer`. The rev-1 test harness did not install helmet. | **Site-wide breakage** the moment nginx switched: inline gtag blocked (no analytics), calls to `api.tirvona.com` blocked (no data, no login), remote images blocked, Razorpay iframe blocked (no payments) | `seo.controller.ts` removes helmet's headers from the HTML response only, so the page is sent with the same headers as today's static `index.html`. JSON API routes keep helmet. The test harness now installs helmet the way `main.ts` does, and a new test asserts both behaviours |
| B2 | `deploy/nginx/tirvona-web.seo.conf` used `proxy_pass http://127.0.0.1:5000/api/seo/render;` inside a **named** location | `nginx -t` fails ("proxy_pass cannot have URI part … inside named location"); the reload is refused | `rewrite ^ /api/seo/render? break;` + `proxy_pass http://127.0.0.1:5000;`. The SPA regex block is now written out in full instead of as a placeholder |
| R1 | The renderer shared the global throttler (120 requests/min per tracker). `TRUST_PROXY` defaults to `false`, so if production leaves it unset, every visitor proxied by nginx shares one `ip:127.0.0.1` bucket | Above 120 page loads/min, crawlers silently get the plain shell (fail-safe, but no SEO) | `@SkipThrottle({ default: true })` on `GET /api/seo/render`; the `ipAbuse` ceiling (30,000/min) still applies |

Also in revision 2: a visible H1 on the stays listing (§3), the GA4 root cause with a tested,
**unapplied** fix (§5), the full publishing-workflow plan with a migration tested on throwaway
Postgres (§6), extended HTTP coverage (home, marketplace, destination, food, pandit,
retired URLs), and the deployment and rollback runbook (§9–§11).

## 1. Architecture (unchanged, re-verified)

```
browser / crawler ──► nginx ──(SPA path)──► GET /api/seo/render   (X-Seo-Path = original URI)
                        │                        ├ classify path (shared route policy)
                        │                        ├ read public record (read-only, field allow-list)
                        │                        └ inject title, description, canonical, robots,
                        │                          OG, JSON-LD and a crawlable summary into index.html
                        │◄──── 200 / 301 / 404 ───┘
                        └─(429, 5xx, timeout)──► static index.html (exactly today's behaviour)
```
React's `createRoot` replaces the summary when it mounts. One route policy, with byte-identical
copies at `frontend/src/seo/routePolicy.ts` and `Newbackend/src/modules/seo/domain/seo-route-policy.ts`
(a unit test fails on drift). Unknown top-level paths still go to Smart Contact, by design.

## 2. Independent verification of the rev-1 implementation

| Item | Result | Evidence |
|---|---|---|
| `/api/seo/render` | PASS after B1 and R1 fixes | `seo.http.pg-spec.ts` 13/13 |
| Metadata + meaningful server content | PASS | Title, description, canonical, robots, H1, intro, facts, internal links and breadcrumbs asserted per template |
| 404 / 301 | PASS | Drafts, unapproved and missing records, unknown paths, a pending product and an unknown destination or pandit return 404. Moves (case, trailing slash, `/marketplace/product/`) return 301 and keep the query string |
| DB-driven sitemap | PASS | Valid, unique, canonical-only, no drafts, aliases or private URLs; `lastmod` only from real `updatedAt` |
| Canonical / noindex policy | PASS | Aliases render with one canonical; private pages get `noindex,nofollow` + `private, no-store`; thin store and category pages get `noindex,follow` |
| Frontend/backend policy consistency | PASS | `seo-route-policy.spec.ts`: identical copies; every `App.tsx` route classified |
| JSON-LD | PASS | Organization/WebSite, LodgingBusiness, Product, BreadcrumbList, ItemList etc.; safe serialisation; no fake geo |
| nginx proposal | **FAIL → fixed** (B2) | Static review against nginx rules (§9.3); `nginx -t` not run locally, see §12 |
| Response headers | **FAIL → fixed** (B1) | New test |
| Throttling | **RISK → fixed** (R1) | Code review |

## 3. Stays listing H1 (`/ashrams`, `/ashrams/:city`)

- **Solution**: one visible `<h1>` heading the results column, directly above the existing
  "Found N Tirvona Verified Ashrams…" bar (`SearchPage.tsx`). It uses the page's existing heading
  style (`font-extrabold`, `text-[#0B192C]`/`dark:text-white`, `text-base sm:text-lg`) and the
  column's existing `space-y-3` spacing. Nothing else moved; no hidden text.
- **Text**: identical to the server-rendered H1. `/ashrams` → "Ashram & Dharamshala Stays"
  (`STATIC_PAGES["/ashrams"].h1`); `/ashrams/haridwar` → "Stays in Haridwar"; `/search?destination=x`
  → "Stays in X" (noindex page).
- **Verified**: production build served with `vite preview` and captured in headless Chrome at
  1366 px and 390 px. The heading sits above the status bar on desktop and under the filter bar on
  mobile, with no layout shift elsewhere. Rendered DOM: exactly one `<h1>`.
- `/ashrams/vrindavan` is a separate landing page (`VrindavanStaysPage`) and already had its H1.

## 4. Files

### Revision 2
| File | Change |
|---|---|
| `Newbackend/src/modules/seo/presentation/seo.controller.ts` | B1: drop helmet headers from the HTML response; R1: `@SkipThrottle({ default: true })` on render |
| `Newbackend/src/modules/seo/seo.http.pg-spec.ts` | Harness installs helmet like `main.ts`; +2 tests (headers; home/marketplace/destination/food/pandit/retired URLs; GA4/Ads snippet once in rendered HTML) |
| `Newbackend/src/modules/seo/seo-pages-migration.pg-spec.ts` | **New**: applies the proposed migration and rollback to throwaway Postgres |
| `deploy/nginx/tirvona-web.seo.conf` | B2 fix; full SPA regex inlined |
| `frontend/src/pages/SearchPage.tsx` | Visible H1 (§3) |
| `frontend/scripts/analytics-pageviews.test.mjs` | **New**: GA4/Ads page-view tests (`node --test`) |
| `docs/seo/ga4-single-pageview.patch` | **New, not applied**: one-line GA4 fix |
| `docs/seo/publishing/0014_seo_pages.sql`, `0014_seo_pages.down.sql` | **New, not applied**: migration + rollback |
| `docs/seo/publishing-model-proposal.md` | Rewritten as the full implementation plan |
| `docs/seo/SEO_IMPLEMENTATION_REPORT.md` | This report |

### Revision 1 (unchanged)
Created: `frontend/src/seo/routePolicy.ts`; `Newbackend/src/modules/seo/` (`domain/seo-route-policy.ts`,
`domain/seo-html.ts`, `application/seo-catalog.ts`, `seo-pages.service.ts`, `seo-render.service.ts`,
`seo-sitemap.ts`, `presentation/seo.controller.ts`, `seo.module.ts`, both specs).
Modified: `Newbackend/src/app.module.ts` (registers `SeoModule`), `common/sitemap.controller.ts`
(sitemap from the SEO catalog), `frontend/src/lib/useCanonicalUrl.ts`, `seo/seoLandingConfigs.ts`, and the
metadata hook or H1 tag in `AshramDetailPage`, `TempleDetailPage`, `EventDetailPage`, `CircuitDetailPage`,
`EventsHubPage`, `CircuitsHubPage`, `MarketplaceHubPage`, `BlogListPage`, `PublicProviderDetailPage`,
`MarketplaceProductDetailPage`, `MarketplaceCategoryDetailPage`, `MarketplaceStorePage`, `BlogDetailPage`,
`DestinationOverviewPage`. Deleted (authorised): `frontend/public/sitemap.xml`.

### Not touched
The pre-existing uncommitted changes (`config/environment.ts`, food payment/webhook, payments
webhook + its spec, `LeadTrackingPage.tsx`, the `memory/` deletions) are preserved as found.

## 5. GA4 duplicate page view: approval required

**Root cause (exact):** on every full page load GA4 receives two `page_view` hits:
1. `frontend/index.html` line 35, `gtag('config', 'G-5S7XM8N389');`: `send_page_view` defaults to
   true, so gtag sends an automatic page_view.
2. `PageViewTracker` (`frontend/src/App.tsx` line 554) calls `trackPageView()` on mount, which sends
   a second GA4 page_view (and one to Ads).

SPA navigations only trigger #2, so each one is counted once. Server rendering adds no tracking. The
rendered HTML contains each gtag loader and config exactly once (pg-spec), and React mounts with
`createRoot` rather than hydrating twice. `StrictMode` doubles effects in `vite dev` only, never in
production builds.

**Fix (not applied):** `docs/seo/ga4-single-pageview.patch`, a one-line change to
`gtag('config', 'G-5S7XM8N389', { send_page_view: false });`. `git apply --check` passes.

**Tests**: `node --test frontend/scripts/analytics-pageviews.test.mjs` runs the real inline snippet
and the real `analytics.ts`:

| Test | Result today |
|---|---|
| Current index.html: one GA4 page_view per load | **TODO** (measures 2; becomes PASS once the patch is applied) |
| Proposed: 1 per load, +1 per SPA navigation, none for re-render or React replacing the server summary, query change counts | PASS |
| Google Ads: loader + `send_page_view:false` config once, 1 Ads page_view per load/navigation, unchanged by the fix | PASS |
| `purchase` sent once per booking (dedup) | PASS |
| `PageViewTracker` wiring: one call, `[pathname, search]` deps, mounted once | PASS |

No Google Ads `conversion` event exists in code today. Ads tracking consists of the `AW-` config plus
the Ads page_view, and both are unchanged by the fix.

**Impact on historical comparisons** (for the analytics owner): from the deploy date, GA4
`page_view` counts and Views per session fall. Landing-page views go from 2 to 1 per session start,
so the total drops by roughly one view per full page load (at least one per session). Measure the
exact share in GA4 for the week before the change rather than assuming a percentage. Sessions, users, engagement and conversions are **unaffected**, because the
session_start, user and `purchase` logic doesn't change. Annotate the deploy date in GA4 and compare
page_view-based metrics only across the boundary, or use sessions for trends. **Also check in GA4
Admin → Data streams → Enhanced measurement** whether "Page changes based on browser history events"
is on: if it is, SPA navigations are *also* double-counted today, and turning that setting off is
part of the same change.

**Approval:** analytics owner, in writing, before `git apply`.

## 6. Publishing workflow (plan + tested migration, not applied)

Full plan: `docs/seo/publishing-model-proposal.md`. Summary:
- One additive table `seo_pages` with all 15 SOP fields plus workflow columns. Content stays in the
  entity tables, and a page without a row behaves exactly as today, so no backfill is needed.
- Uniqueness: `path`; `(page_type, entity_id)`; `legacy_wp_id`. Nine CHECK constraints cover
  canonical = origin + path, path and slug format, lengths, JSON shape, status vocabularies, and
  lifecycle (no approve/publish without `verified_at` + `approved_by`; retired needs `retired_at`;
  only on-site redirects).
- Lifecycle `draft → in_review → approved → published → retired` (301 if `redirect_to`, else 410),
  with four-eyes approval, optimistic locking and audit.
- Permissions `seo.pages.edit|verify|approve|publish|retire` through the existing `PermissionsGuard`;
  `super_admin` passes all.
- Public read-only `GET /api/seo/meta?path=` (published rows only, allow-listed fields).
- Sitemap excludes noindex and retired rows; `lastmod = max(entity, row)`.
- Cache: invalidate on every transition and entity update; the 5-minute TTL is the backstop.
- Migration test: **7/7 pass** on throwaway Postgres 17, including rollback followed by re-apply.

## 7. Compliance matrix (Manager SOP v1.0)

| # | Requirement | Status | Evidence | Remaining / owner |
|---|---|---|---|---|
| 1 | URL architecture | **PASS** (code) | Aliases → one canonical; 301 for certain moves; no query strings in canonicals (pg-spec) | Live behaviour after nginx change |
| 2 | Unique metadata & one visible H1 | **PASS** (code) | Unique static metadata (unit); 1 H1 per template incl. the **new stays-listing H1** (§3, Chrome DOM check); entity formulas shared server/browser | Generic aarti/pooja/parking/video detail routes get section-level metadata only (low value, not indexed by sitemap) |
| 3 | Server-rendered crawlable HTML | **BLOCKED** (deploy) | Verified locally on every template (§8) | Deploy + nginx · operator |
| 4 | Correct HTTP status & indexing | **BLOCKED** (deploy) / PARTIAL | 404/301/noindex tested; **410 needs the publishing model** | Deploy; §6 for 410 |
| 5 | Canonicals, redirects, duplicates | **PASS** (code) | pg-spec + policy unit tests; off-site canonicals ignored | — |
| 6 | Sitemap & robots | **PASS** (code) / BLOCKED (live) | DB sitemap tested; static file removed; robots.txt reviewed | Deploy; submit in Search Console · SEO lead |
| 7 | Content quality & internal links | **PARTIAL** | Only real fields; hubs ↔ records linked; thin pages noindex | Editorial review of empty descriptions · content owner |
| 8 | Structured data | **PASS** (code) | Types per template, safe serialisation, no fake ratings or geo | Rich Results Test after deploy |
| 9 | Mobile & accessibility | **PARTIAL** | New H1 checked at 390 px; breadcrumbs `nav aria-label` | Image alt-text audit not done |
| 10 | Core Web Vitals | **BLOCKED** | No field data locally; renderer adds one cached hop with 2 s/5 s timeouts | CrUX/Search Console p75 after deploy |
| 11 | AI SEO / GEO / AEO | **PARTIAL** | Facts in initial HTML; consistent entities | FAQ/answer content via `content_json` · content owner |
| 12 | Security & public API | **PASS** | Read-only, allow-listed fields, escaping, no SSRF, path validation, cookies/auth stripped by nginx, renderer output independent of the user, **API headers no longer leak onto HTML (B1)**, private routes render only the empty shell + noindex | — |
| 13 | Publishing fields & editorial workflow | **PARTIAL** (plan ready) | §6: migration + rollback tested, API/roles/lifecycle designed | Build after backend + content owner approval |
| 14 | Cache invalidation | **PARTIAL** | 5-minute TTL, auto-clear on frontend deploy, super_admin invalidate endpoint | Event hooks with §6 |
| 15 | Search Console, GA4, conversions | **PARTIAL** (approval) | Tags preserved once in server HTML; root cause + tested fix (§5) | Analytics owner approval; Ads conversion label · marketing |
| 16 | Automated tests & regression | **PASS** (local) | §8 | Re-run on staging |
| 17 | nginx integration safety | **PASS** (review) / BLOCKED (`nginx -t`) | §9.3 | Operator runs `nginx -t` |

## 8. Test results (actually executed, 2026-10-30, local)

| Command | Result |
|---|---|
| `Newbackend: npm run test:pg -- seo.http` (throwaway Postgres 17, helmet installed) | **13/13 pass** |
| `Newbackend: npm run test:pg -- seo-pages-migration` | **7/7 pass** |
| `Newbackend: npx jest` (full unit suite, incl. 12 SEO policy tests) | **186 suites, 2,415 tests pass** |
| `Newbackend: npm run typecheck` · `npx nest build` · `npx eslint src/modules/seo src/common/sitemap.controller.ts` | pass · pass · clean |
| `frontend: npm run build` (route check, `tsc -b`, vite, smart-contact) | pass; `dist/sitemap.xml` absent |
| `frontend: npx oxlint src/pages/SearchPage.tsx` | 2 warnings, both pre-existing (lines 171, 223), none new |
| `frontend: node --test scripts/analytics-pageviews.test.mjs` | 4 pass, 1 TODO (the unapproved GA4 fix), 0 fail |
| `git apply --check docs/seo/ga4-single-pageview.patch` | applies cleanly |
| Headless Chrome on the production build, `/ashrams` 1366 px + `/ashrams/haridwar` 390 px | one visible H1, layout intact |

Template coverage over HTTP (pg-spec): **home** (canonical, 1 H1, Organization/WebSite, GA4 + Ads once) ·
**stay listing + city + detail** · **temple** · **pandit** (hub canonical, alias `/pandit`, missing profile 404) ·
**marketplace** product (Product JSON-LD, pending product 404, legacy 301), category, store (thin store noindex) ·
**food** (hub, `/restaurants` alias) · **event, circuit, blog** (no view counters incremented) ·
**destination** (records, alias canonical, unknown 404) · **private routes** (noindex,nofollow + no-store) ·
**missing** (404 + noindex) · **retired/moved** (301 case and trailing slash, query kept) · **sitemap**.

**Not tested:** a provider *detail* page against real Postgres (needs a fully verified provider
fixture; the code reuses the providers module's `listingBlockers`/`toPublicProvider`); `nginx -t` (§12);
booking/payment/auth in a browser (no code in those flows changed; full unit suite passes); real data
volumes; Lighthouse/CWV; anything on the live site.

## 9. Production deployment plan (operator; each step needs approval)

### 9.1 Prerequisites
- [ ] Approval for this release (backend, frontend, nginx).
- [ ] Backend host: `SEO_SHELL_PATH=/var/www/tirvona/frontend/dist/index.html` set, unless the API runs
      from `/var/www/tirvona/Newbackend` (default resolves `../frontend/dist/index.html`).
- [ ] Confirm `TRUST_PROXY=true` in the API environment (correct client IPs in logs and rate limits;
      R1 makes the renderer safe either way).
- [ ] Back up `/etc/nginx/snippets/tirvona-web.conf` → `tirvona-web.conf.bak-<date>`.
- [ ] Note the current backend and frontend release ids/commits for rollback.
- [ ] **No** database migration is part of this release.

### 9.2 Order
1. **Backend** build + deploy (`npm ci && npx nest build`, restart via the usual process manager).
   Safe alone: nothing routes to the renderer yet, and `/sitemap.xml` still serves the old static file.
   Check: `curl -s -H 'X-Seo-Path: /temples' http://127.0.0.1:5000/api/seo/render | grep -E '<title>|canonical'`
   and `curl -sI -H 'X-Seo-Path: /temples' http://127.0.0.1:5000/api/seo/render | grep -i content-security` (**must print nothing**).
2. **Frontend** build + deploy (`npm ci && npm run build`, sync `dist/` to `/var/www/tirvona/frontend/dist`).
   `dist/` has no `sitemap.xml`, so nginx's existing `try_files /sitemap.xml @backend_sitemap` now
   reaches the DB sitemap. Check: `curl -s https://www.tirvona.com/sitemap.xml | head`.
3. **nginx**: in `/etc/nginx/snippets/tirvona-web.conf`, replace the `location = /` block and the
   body of the section-3 SPA block with the ones in `deploy/nginx/tirvona-web.seo.conf`, and add
   `@seo_render` + `@spa_shell`. Then `sudo nginx -t` (must say "syntax is ok" / "test is successful")
   and `sudo systemctl reload nginx` (reload, not restart: no dropped connections).
4. Run §10 immediately. On any failure, roll back with §11.1 (seconds).

### 9.3 nginx safety review
- **No proxy recursion**: the renderer reads `index.html` from disk and makes no HTTP requests;
  `@spa_shell` serves a file. Neither location proxies back to `www.tirvona.com`.
- **No routing conflicts**: exact `location = /` wins first; `^~ /c/` (Smart Contact QR),
  `.map`, the legacy-id regex and `/assets` keep their positions and precedence; only the *body*
  of the SPA regex block changes (`try_files $uri @seo_render`, so real files are still served
  first). `/robots.txt` and `/sitemap.xml` exact locations are untouched. The final `location /`
  Smart Contact fallback is untouched.
- **No private exposure**: the renderer is public-by-design and path-only. nginx blanks `Cookie` and
  `Authorization`, the output never depends on the user, private routes return only the empty shell
  with `noindex,nofollow` + `Cache-Control: private, no-store`, and no record data is read for them.
  The client cannot inject `X-Seo-Path` (nginx overwrites it).
- **Fail-safe**: `proxy_intercept_errors on` + `error_page 429 500 502 503 504 = @spa_shell` (with
  2 s connect / 5 s read timeouts) means API trouble serves today's static shell with 200. A 404 or
  301 from the renderer passes through unchanged (only the listed codes are intercepted).
- **Upstream path**: fixed (B2). The query string is dropped from the upstream URL; the renderer
  reads it from `X-Seo-Path`. Renderer 301s use site-relative `Location`, passed through as is.
- **Sync rule**: the SPA segment list in the SEO block must equal `tirvona-web.conf` section 3 at
  apply time (copied verbatim on 2026-10-30).

### 9.4 Cache invalidation at deploy
- Renderer cache clears itself when `dist/index.html` changes (checked every 5 s).
- Manual: `POST /api/seo/cache/invalidate` with a super_admin token (body `{}` clears all, or `{"paths":[…]}`).
- Browser caches: HTML is `no-cache`; hashed assets are immutable. Sitemap `max-age=3600`.
- If a CDN or proxy cache sits in front of nginx, purge `/`, `/sitemap.xml` and the hub pages.

## 10. Post-deployment verification checklist

```
# Rendering, status, canonical, robots
curl -s  https://www.tirvona.com/ | grep -cE "<title>|rel=\"canonical\"|<h1>"          # 3
curl -s  https://www.tirvona.com/ashrams | grep -E '<h1>|canonical'
curl -s  https://www.tirvona.com/ashrams/<city>/<slug> | grep -E '<title>|canonical|ld\+json'
curl -s  https://www.tirvona.com/temples/<slug>  | grep -E '<title>|canonical'
curl -s  https://www.tirvona.com/pandit/<slug>   | grep -E '<title>|canonical'
curl -s  https://www.tirvona.com/marketplace/products/<slug> | grep -E '<title>|Product'
curl -sI https://www.tirvona.com/about/not-a-page                  # 404
curl -sI https://www.tirvona.com/Stays-near-prem-mandir-vrindavan   # 301 → lowercase
curl -sI https://www.tirvona.com/temples/                           # 301 → /temples
curl -sI https://www.tirvona.com/profile | grep -i x-robots-tag     # noindex,nofollow
curl -s  https://www.tirvona.com/stays | grep canonical             # …/ashrams
# Headers must match the old static page (B1)
curl -sI https://www.tirvona.com/temples | grep -iE "content-security|cross-origin-opener|referrer-policy"   # nothing
# Untouched routes
curl -sI https://www.tirvona.com/c/<smart-contact-slug>             # 200 Smart Contact
curl -sI https://www.tirvona.com/<smart-contact-slug>               # 200 Smart Contact
curl -sI https://www.tirvona.com/ashram/<24-hex-id>                 # 301 via /url/resolve
curl -sI https://www.tirvona.com/robots.txt ; curl -sI https://www.tirvona.com/sitemap.xml   # 200, xml
# Fail-safe drill (optional, low traffic): stop the API for 30 s → pages still 200 with the static shell
```
Browser regression (real Chrome, logged out and logged in):
- [ ] Login (OTP/password), logout, `/profile`, `/wallet` render and stay noindex.
- [ ] Stay search → detail → `/book` → payment page opens the Razorpay checkout (stop before paying).
- [ ] Pandit booking, marketplace cart → checkout, food order page load.
- [ ] DevTools console: no CSP errors; Network: `gtag/js` loads, `collect` hits fire.
- [ ] GA4 DebugView: page_view on load and on SPA navigation, booking events.
- [ ] Search Console: submit `https://www.tirvona.com/sitemap.xml`; URL-inspect a stay, temple,
      pandit and product page; Rich Results Test on the same URLs.
- [ ] Watch the API logs for `SEO render failed` warnings and 5xx rates for 24 h.

## 11. Production rollback

1. **nginx (instant, first resort)**: `sudo cp /etc/nginx/snippets/tirvona-web.conf.bak-<date> /etc/nginx/snippets/tirvona-web.conf && sudo nginx -t && sudo systemctl reload nginx`. The site returns to client-only rendering; the backend and frontend can stay.
2. **Sitemap**: restore `frontend/public/sitemap.xml` from git, rebuild and redeploy the frontend (nginx prefers the static file). Or leave the DB sitemap in place; it doesn't depend on the renderer.
3. **Frontend**: redeploy the previous release. The rev-2 frontend changes are metadata hooks, heading tags and one H1, so rollback is not needed for safety.
4. **Backend**: redeploy the previous release. `SeoModule` is additive; reverting `app.module.ts` and `sitemap.controller.ts` restores the old API exactly.
5. **Database**: nothing to roll back (no migration in this release). For the future `seo_pages` table, see `docs/seo/publishing/0014_seo_pages.down.sql`.

## 12. Open items and approvals

| Item | Owner | Blocking deploy? |
|---|---|---|
| Release approval and execution of §9 | Operator / engineering lead | Yes |
| `sudo nginx -t` on the server: not run locally (no nginx on this machine; downloading a binary was declined) | Operator | Yes, part of §9.2 step 3 |
| GA4 fix `docs/seo/ga4-single-pageview.patch` + Enhanced-measurement check | Analytics owner | No (independent) |
| Publishing model build + migration 0014 (staging first) | Backend + content owner; prod migration needs separate approval | No |
| Google Ads conversion action/label for `purchase` | Marketing | No |
| Image alt-text audit; editorial copy for thin records | Content owner | No |
| CWV field data after deploy | SEO lead | No |

Observed, not changed: `frontend/vercel.json` CSP would block gtag if Vercel ever served production;
the `render.yaml` comment calls Vercel production; `AllAshramsPage.tsx` is unrouted; `robots.txt` has a
non-standard `Host:` line (harmless).

## 13. Production safety confirmation

No deploy, restart of any server or service, commit, push, migration, environment change, DNS change
or hosted-database access was made. Tests used embedded throwaway Postgres only. The GA4 change and
the `seo_pages` migration are files for review and are **not applied**. The migration SQL lives
outside `database/migrations/`, so no routine `db:migrate` can pick it up.

---

## 14. Revision 3 (2026-10-31): every public content type is crawlable and in the sitemap

**Goal:** anything listed on Tirvona can be found on Google at its www.tirvona.com URL.

| Content type | URL | Before | Now |
|---|---|---|---|
| Video posts | `/video/:slug` | Sitemap listed `/blog/:slug` (a URL the site never links to); `/video/:slug` had no server HTML | One canonical `/video/:slug` in sitemap, renderer and browser; the wrong prefix 301-redirects both ways |
| Aarti sessions | `/aarti/:slug` | Generic "Aarti" title, not in sitemap | Own title/H1/description/canonical, timings + venue + facilities, in sitemap, listed on `/aarti` |
| Parking locations | `/parking/:slug` | Generic, not in sitemap | Own metadata, address, `ParkingFacility` JSON-LD (geo only when real), in sitemap, listed on `/parking` |
| Volunteer jobs | `/volunteer/:id` | Generic, not in sitemap | Own metadata, details, `JobPosting` JSON-LD (only when description, organisation, city and date exist), in sitemap, listed on `/volunteer`; `/volunteer/job/:id` 301s; closed jobs 404 |

Visibility rules copied from each module's own public endpoint: aarti `status: "approved"`, parking `status: "active"`, jobs `status: "open"`.
Still section-only (not in sitemap, deliberately): ashram-scoped `/aarti|pooja|parking/:city/:ashram` lists, `/offers/*`, `/featured-banner/*` (promotional/duplicative).

H1/H2/H3 work from the master task (rev. 3): one visible H1 on all 57 audited routes (mobile + desktop, server + hydrated), level jumps removed across stay detail, home, landing pages, food, events, circuits, destinations, blog, marketplace, footer; headings-as-labels converted with an identical-look utility class (`.tv-heading-face`). Server HTML section headings made descriptive; temple ↔ stay ↔ destination links by city.

Tests (2026-10-31): `seo.http.pg-spec` **15/15**; backend unit suite all SEO suites pass (food-partner and QR specs flaked once under parallel load and pass on re-run; not SEO code); frontend `npm run build` pass; analytics tests 4 pass / 1 TODO (unapproved GA4 fix).

**For pages to actually appear in Google** (cannot be done from code): deploy backend + frontend, apply `deploy/nginx/tirvona-web.seo.conf` (§9), add the property in Google Search Console, submit `https://www.tirvona.com/sitemap.xml`, and request indexing for key URLs. Google decides ranking; indexing of a new site typically takes days to weeks.

## 15. Revision 4 (2026-11-03): everything that was pending, done in code

### 15.1 Changes

| Area | Change |
|---|---|
| nginx | `deploy/nginx/tirvona-web.conf`: `location = /` and the SPA block use `@seo_render`; `@seo_render` + `@spa_shell` added (section 3b). `tirvona-web.seo.conf` merged and removed. |
| Deploy | `.github/workflows/deploy.yml`: runs only after "Tirvona CI" passes for the exact commit; backs up nginx snippets and restores them if `nginx -t` fails or the site stops answering; builds the frontend into `dist-next` and swaps it in; keeps the previous API build and restores it if the new one does not start; warns when pages are not server-rendered. |
| GA4 | `frontend/index.html`: `gtag('config', 'G-5S7XM8N389', { send_page_view: false })`. |
| robots.txt | Non-standard `Host:` line removed from `frontend/public/robots.txt` and `common/robots.controller.ts`. |
| Vercel CSP | `frontend/vercel.json` allows `https://www.googletagmanager.com`, the inline gtag snippet's sha256 and the Ads iframes; a test fails if the snippet changes without the hash. |
| Publishing | Model `seo/infrastructure/seo-page.schema.ts`; migration 0014 (+ `database/rollback/0014_seo_pages.down.sql`); rules `seo/domain/seo-publishing.ts`; `SeoPublishingService` + controller; renderer applies published overrides, 301/410 for retired rows; sitemap drops noindex/retired rows and uses the newer `lastmod`; browser applies overrides on in-app navigation (`frontend/src/lib/seoOverrides.ts`); admin screen `frontend/src/admin/seo/SeoPagesPage.tsx`; permissions `seo.pages.*` in User Management. |

### 15.2 Differences from the publishing plan

- `page_type` follows the route policy's current kinds (`pandit`, `marketplaceCategory`, `marketplaceStore`,
  `aarti`, `parking`, `volunteerJob`), not the older names in the first draft of the migration.
- A `pending` jsonb column holds the revision of a published page (the plan said `_extra.pending`),
  so it is typed, checked (`jsonb_typeof = 'object'`) and not re-proposed by every `db:generate`.
- Four eyes is enforced for staff; a `super_admin` may run every step (one person runs SEO today).
  Every step is recorded in `audit_logs` (module `SEO`).
- The H1 override is applied in the server-rendered HTML; in the browser the page keeps rendering its own H1.
- `content_json` is validated and stored for fixed/landing pages; the page text in code is not yet read from it.
- Entity services do not call cache invalidation yet; an entity edit shows within the 5-minute render cache.

### 15.3 Tests (2026-11-03, local, throwaway Postgres only)

`seo-pages-migration.pg-spec` 8/8 (real migration and rollback files), `seo-publishing.http.pg-spec` 10/10,
`seo.http.pg-spec` 15/15, `seo-publishing.spec` + `seo-route-policy.spec` 19/19, analytics tests 6/6.
The deploy script was replayed against a fake server in six scenarios (27 checks): happy path,
out-of-order CI run, API that does not start, failing `nginx -t`, site down after reload, failed
frontend build.

### 15.4 Still for people (cannot be done from code)

1. Merge to `main` (this deploys, applies migration 0014 to the production database and switches nginx).
   Watch the first deploy log; `nginx -t` has never run against the real server config.
2. Server: set `TRUST_PROXY=true` in the API's `.env` (correct visitor IPs behind nginx).
3. GitHub → Settings → Branches: protect `main` and require the "Tirvona CI" checks.
4. Google Search Console: add the property, submit `https://www.tirvona.com/sitemap.xml`, request
   indexing for key pages; Google decides when and how pages rank.
5. Grant `seo.pages.*` permissions to the people who write, check, approve and publish.
6. Marketing: the Google Ads conversion label for `purchase`. Content team: copy for thin records.
7. After a few weeks: Core Web Vitals field data in Search Console.
