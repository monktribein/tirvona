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
**permanent** (spec §2). This is a separate Vite build from the main SPA, so
something has to route `/c/*` to this app's `dist/`. Two workable options:

1. **Path rewrite at the edge** (recommended) — publish this build and add a
   rule on the `www.tirvona.com` host sending `/c/*` here, with an SPA
   fallback to `index.html`. The printed URL stays exactly as specified.
2. **Its own subdomain** — deploy to e.g. `contact.tirvona.com` and set
   `SMART_CONTACT_PUBLIC_BASE_URL` on the API to match, so generated QR codes
   encode that origin instead.

Option 2 is only available *before* cards are printed. After that the origin
is fixed in physical artwork and only option 1 remains, which is why
`SMART_CONTACT_PUBLIC_BASE_URL` is a separate setting from `CLIENT_URL` on the
API — moving the marketing site must not be able to invalidate printed cards.

`vite.config.js` sets `base: "/c/"` for option 1. Change it to `"/"` for
option 2.

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
