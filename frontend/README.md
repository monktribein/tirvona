# Tirvona web app (`frontend/`)

React 19 + TypeScript + Vite + Tailwind single-page app: the public website (www.tirvona.com) and
every logged-in dashboard. It talks to the API in `../Newbackend` under `/api`.

```bash
npm ci
npm run dev            # http://localhost:5173, proxies /api to http://localhost:5000
npm run build          # route check + type check + production build (also builds ../SmarID)
npx oxlint             # lint
```

## Where things are (`src/`)

| Folder | What it holds |
|---|---|
| `App.tsx` | Every route and its role gate |
| `main.tsx` | Entry point |
| `pages/` | Public storefront pages (home, stays, blog, search, booking, help) plus owner and profile pages |
| `modules/` | Feature areas with their own pages and components: `aarti`, `events`, `food`, `marketplace`, `pandit`, `parking`, `pilgrimage`, `support` |
| `admin/` | Dashboard screens for Super Admin, HR / Executive, owners and staff (see `admin/README.md`) |
| `seo/` | Vrindavan SEO landing pages and `routePolicy.ts` (which URLs are indexable; a byte-identical copy lives in the backend) |
| `layouts/` | `PublicLayout` (storefront header and footer); `DashboardLayout` re-exports `admin/shared/layouts/DashboardLayout` |
| `components/` | Components shared across pages (maps, date pickers, uploads, assistant, wallet, dashboard widgets) |
| `design-system/` | Material icon shim used in place of `lucide-react`, and premium UI pieces |
| `services/` | API clients, one per backend area |
| `contexts/` | App-wide state: auth, wallet, cart, booking search, language, currency, notifications |
| `hooks/`, `lib/`, `utils/` | Reusable hooks, integrations (API client, analytics, Razorpay, maps, canonical URL) and helpers |
| `constants/`, `data/`, `i18n/` | Fixed values, static stay and destination data, translations |
| `styles/` | `dashboard-ui.css`, the shared dashboard look |

Shared styles for all Tirvona UIs come from `../shared/*.css` (imported in `src/index.css`).

## Scripts (`scripts/`)

- `check-spa-routes.mjs`: every page in `App.tsx` must be in the rewrite lists (`vercel.json`,
  `../render.yaml`, `../deploy/nginx/tirvona-web.conf`). Runs as part of `npm run build`.
- `build-smart-contact.mjs`: builds `../SmarID` and copies it into `dist/` as `smart-contact.html`.
- `seo-audit.mjs`: headless-Chrome audit of rendered pages (one H1, alt text, canonical).
- `analytics-pageviews.test.mjs`: GA4/Google Ads page-view tests (`node --test`).
