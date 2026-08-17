# Tirvona Smart Contact QR™ — public contact page

The mobile-first page a visitor lands on after scanning a printed Tirvona QR
code. Implements the public half of the *Smart Contact QR™ Developer-Ready
Product & Technical Specification v1.0*.

```
Scan QR → /c/{slug} → Save Contact → .vcf → device contacts
```

## What lives where

| Surface | Location |
| --- | --- |
| Public contact page (this app) | `SmarID/` |
| Admin console pages | `frontend/src/admin/smart-contact/` |
| API, database, QR, vCard, analytics | `Newbackend/src/modules/smart-contact/` |

The admin UI is in `frontend/` rather than here on purpose: the specification
(§18, §55) puts Smart Contacts under the existing **Tirvona Admin** menu and
asks that the existing admin UI be reused, and the sidebar it must appear in
lives in that app. This app stays a single, dependency-light public page.

## Local development

```bash
npm install
npm run dev          # http://localhost:5175
```

The backend must be running (`cd ../Newbackend && npm run start:dev`). Point
the app at it with `VITE_API_URL` if it is not on `http://localhost:5000`:

```bash
VITE_API_URL=http://localhost:5000 npm run dev
```

Open a profile by slug — the app reads the last path segment, so both
`http://localhost:5175/c/ravindr-bhardwaj` and `.../ravindr-bhardwaj` work in
development.

## Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_API_URL` | `http://localhost:5000` | Origin of the Tirvona API |

## Deployment — the one thing to get right

The QR codes encode `https://www.tirvona.com/c/{slug}` and that URL is
**permanent** (spec §2), so `/c/*` has to answer on the main host. Profiles are
also served from the bare site root (`/{slug}`), which is the current scheme —
`/c/` is kept alive for QR codes already in print.

**The build is wired up already.** `frontend`'s `npm run build` runs
[`scripts/build-smart-contact.mjs`](../frontend/scripts/build-smart-contact.mjs),
which builds this app and copies its output next to the SPA's as
`frontend/dist/smart-contact.html`, with assets in `dist/sc-assets/`. One
deployment then serves both: no proxy hop, no second CORS origin, one
certificate. `vite.config.js` sets `base: "/"` and `assetsDir: "sc-assets"` so
the two builds never merge into one `assets/` directory.

**The routing is per-host, and it is the part that breaks.** The rule must be
declared *before* the SPA catch-all, or the catch-all swallows every scanned QR
and renders the marketing homepage:

- nginx / VPS — [`deploy/nginx/tirvona-web.conf`](../deploy/nginx/tirvona-web.conf): `location ^~ /c/` → `smart-contact.html` **(current production)**
- Vercel — [`frontend/vercel.json`](../frontend/vercel.json): `/c/:slug` → `/smart-contact.html`
- Render — [`render.yaml`](../render.yaml): `/c/:slug` → `/smart-contact.html`

This exact failure has happened once: production moved to a VPS and neither
`vercel.json` nor `render.yaml` is read by nginx, so `/c/{slug}` fell through
to the SPA and every profile rendered the homepage. `npm run check:routes` now
validates the nginx snippet too, but the snippet still has to be *installed* on
the host — see the header of that file.

Real files are served from the filesystem before the fallback applies, so
`/sc-assets/*` resolves normally and only slugs hit the rule.

`VITE_API_URL` is inherited from the parent build, and the main app already
sets it — so there is nothing extra to configure.

### Host setting to check

On **Vercel**, if the project's Root Directory is `frontend`, enable
**"Include source files outside of the Root Directory"**. Without it `../SmarID`
is not in the checkout, the build script skips with a warning (it never fails
the main build), and `/c/{slug}` falls through to the homepage — the exact
symptom this section exists to prevent. On **Render**, build from the
repository root.

### Running it on its own host instead

Deploy this app to e.g. `contact.tirvona.com`, set
`SMART_CONTACT_PUBLIC_BASE_URL` on the API to that origin, add that origin to
`CORS_ORIGINS`, and change `base` in `vite.config.js` to `"/"`.

That choice is only available **before cards are printed**. Afterwards the
origin is fixed in physical artwork. This is why
`SMART_CONTACT_PUBLIC_BASE_URL` is a separate setting from `CLIENT_URL` on the
API — moving the marketing site must never be able to invalidate printed cards.

## Social previews (spec §41) — known limitation

WhatsApp, Slack and other link unfurlers do not execute JavaScript. They read
the static `<meta>` tags in `index.html`, so every profile currently previews
with the generic Tirvona card, not the representative's name and photograph.

The page sets `document.title` and the description at runtime, which covers
the browser tab and the OS share sheet but not crawlers. Per-profile previews
need the HTML delivered with the profile already in it — an edge function or a
small server-rendered route that injects `og:title`, `og:description` and
`og:image` before serving `index.html`. That is a deployment-layer change and
was left out of the MVP, which spec §54 scopes to the page, vCard, QR and
analytics.

`<meta name="robots" content="noindex,follow">` is set as spec §40 requires.

## Analytics

The page reports CTA taps to `POST /api/v1/smart-contact/{slug}/event`. Profile
views, scans and vCard downloads are **not** sent from here — the server
records those when it serves the corresponding response, so the numbers behind
the conversion rate cannot be inflated by a client.

Tap reporting uses `fetch(..., { keepalive: true })` because Call and WhatsApp
navigate away immediately; without it the browser cancels the request in
flight and those two actions undercount.

## Performance notes

Spec §39 budgets the page at under two seconds on ordinary mobile internet.

- No CSS framework — hand-written CSS, no Tailwind CDN (that script compiles in
  the browser and blocks first paint).
- No router — the slug is read from `location.pathname`.
- No webfont request; the brand mark is inline SVG.
- The photograph is `fetchpriority="high"`; it is the largest contentful paint.
  Serve it as WebP/AVIF from the upload pipeline where the browser supports it.
