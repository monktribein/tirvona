# 06 — Project map

Tirvona is an Indian pilgrimage super-app: ashram/stay booking (Vrindavan,
Rishikesh, Haridwar, Varanasi), parking, aarti/live pooja, free events,
pilgrimage circuits, pandit/puja, marketplace, food ("Tirvona Bhojan"),
day-stay, wallet, WhatsApp channel, partner API.

## Apps (each has its own `package.json`; no workspace at the root)

| Folder | What it is |
|---|---|
| `Newbackend/` | NestJS API. Port 5000, prefix `/api`. The only backend. |
| `frontend/` | Main React 19 + Vite + TypeScript + Tailwind SPA. All routes in `src/App.tsx`. |
| `SmarID/` | Public Smart Contact QR page (Vite). Built into `frontend` as `/smart-contact.html`. |
| `leadTirvona/` | "Ashram Lead" field-agent UI. Backend: `lead-collection` module (own JWT, own `leads` schema). |
| `shared/` | CSS/TS shared by the UIs: table, form, status badge, typography, responsive, dashboard navbar. |
| `pandit/frontend` | Old prototype, superseded by `frontend/src/modules/pandit`. Do not extend. |
| `seo/`, `docs/`, `deploy/` | SEO assets, audits/docs, nginx config. |
| `memory/` | These rules. |

## Backend modules (`Newbackend/src/modules/`)

aarti, account-deletion, analytics, ashrams, audit, auth, bookings, commerce,
community, content, day-stay, events, food, governance, housekeeping,
lead-collection, marketplace, notifications, parking, partners, payments,
payouts, pilgrimage, platform-settings, providers (pandit), refunds, search,
smart-contact, support, temples, uploads, urls, users, verification, wallet,
whatsapp-channel.

## Roles

`super_admin`, `national_admin`, `state_admin`, `govt_admin`/`government_admin`,
`district_officer`, `ashram_admin`/`ashram_owner` (canonical; `owner` and
`stay_admin` are aliases), `temple_owner`, `manager`, `reception`,
`housekeeping`, content/offer/blog/local/marketplace/service/finance managers,
`support`, `inspector`, `pandit_provider`, `verification_reviewer`, `staff`,
`volunteer`, `customer`.

Role gating: `@Roles()`, `@Permissions()`, ownership via `employerAshramId` /
`scopedAshramIds` / `employerTempleId` (`common/auth/ashram-scope.ts`).

## Data

Supabase Postgres via a custom driver that maps Mongoose-style models to
tables. Schemas: `public`, `leads`, `smart_contact`. Migrations in
`Newbackend/database/migrations`. See `02-backend-rules.md` before touching it.

## Where the UI look lives

- Storefront: `frontend/src/layouts/PublicLayout.tsx` + `frontend/src/index.css`.
- Dashboards (all roles): `frontend/src/admin/shared/layouts/DashboardLayout.tsx`
  + `frontend/src/styles/dashboard-ui.css`.
- Shared systems: `shared/*.css`. Shared dashboard components:
  `frontend/src/admin/shared/components/Enterprise*.tsx`.

## Integrations (env-gated, OFF by default)

WhatsApp (Meta templates), OTP SMS/email, Razorpay / RazorpayX payouts,
Cloudinary uploads, FCM push, Redis/BullMQ queues, Zoom (providers). Never
trigger them from tests or local experiments.

## Useful commands

```bash
# backend (from Newbackend/)
npm run typecheck
npx eslint <changed files>
npx jest <path>                # targeted; full run is slow
npm run test:pg                # needs PG_TEST_URL
npm run db:generate -- <name> && npm run db:migrate && npm run db:verify

# frontend (from frontend/)
npx tsc -b
npx oxlint
npm run check:routes
npm run build
```
