# 01 — Frontend & UI rules

Applies to `frontend/` (main SPA), `SmarID/`, `leadTirvona/`.

**The UI is centralised on purpose. Follow the global layout, the shared
stylesheets and the shared components. Do not invent new visual styles.**

## The one rule

> If the page you are building or editing already has a pattern in the app
> (header, card, table, form, modal/drawer, badge, button, spacing), use that
> pattern as-is. Do not add extra UI, extra decoration, extra sections, extra
> animations or a "better" look that nobody asked for.

## Where the look comes from (use these, do not bypass them)

| Concern | Source of truth |
|---|---|
| Typography | `shared/typography.css`, `shared/typography.ts` |
| Tables | `shared/table-system.css`, `shared/table-columns.ts`, `admin/shared/components/EnterpriseDataTable.tsx` |
| Status pills / badges | `shared/status-badge.css`, `shared/status-badge.ts`, `EnterpriseStatusBadge.tsx` |
| Forms | `shared/form-system.css` |
| Responsive behaviour | `shared/responsive-system.css` |
| Dashboard navbar | `shared/dashboard-navbar.css` |
| Notification badge/sound | `shared/notification-badge.ts`, `shared/notification-sound.ts` |
| Dashboard look (all roles) | `frontend/src/styles/dashboard-ui.css`, scoped to `.dashboard-shell` |
| Dashboard layout | `admin/shared/layouts/DashboardLayout.tsx` |
| Dashboard building blocks | `admin/shared/components/Enterprise*.tsx` (page header, stats card, button, modal, sort dropdown, reset button, module page) |
| Storefront layout | `frontend/src/layouts/PublicLayout.tsx` (root class `tv-storefront`) |
| Storefront soft shadows | the `.tv-storefront main …` block in `frontend/src/index.css` |

Change the look **once, in the shared source**, never page by page.

## Tables

- Every data table uses the **shared table UI** (`EnterpriseDataTable` and
  `table-system.css`). Do not hand-roll a `<table>` with its own classes, its
  own header colours, its own row hover, its own pagination or its own empty
  state.
- Column definitions follow `shared/table-columns.ts`. Status cells use the
  shared status badge, never ad-hoc coloured spans.
- Table + toolbar + footer sit in one surface (`.tv-surface`). No table inside a
  bordered box inside another bordered box.
- Need a column, filter or action that the shared table cannot do? Extend the
  **shared** component in a minimal, backward-compatible way and mention it.
  Do not fork it.

## Dashboards (every authenticated role)

- Square, flat surfaces. **No rounded boxes, no drop shadows on cards.**
- One border per surface; never a bordered box inside a box that already draws
  the same edge (no double borders).
- Record details, forms and confirmations open in the **right-side drawer**
  (`EnterpriseModal`/drawer pattern), not a centred modal and not a new page.
- Stat cards use `.tv-stat*`; page headers use `.tv-page-header` /
  `EnterprisePageHeader`.
- Accent is Tirvona saffron `#F28C28`; ink is navy `#0B192C`. Do not add new
  accent colours.
- Pages must **not** add their own `min-h-screen`, `max-w-7xl mx-auto`, page
  background, or their own page padding inside the dashboard layout; the layout
  provides them.
- Dashboard typography is deliberately restrained (weights are capped by the
  stylesheet). Do not force heavier weights.
- A new admin page must call the API through the shared client
  `frontend/src/lib/api.ts` (it attaches the token). Never use raw `axios` or
  `fetch` to `/api/...` for authenticated calls.

## Storefront (public site and customer area)

- Page header pattern: centred orange `Kalam` title, a sparkle divider
  (two `1.5px` orange lines with the sparkle icon), then a short subtitle. Copy
  the Marketplace page header. No full-width hero banners on inner pages.
- Cards: use the standard card size/shape of the neighbouring sections (rounded
  `3xl`, light border, soft shadow, hover lift) rather than a new card style.
  Carousel cards on the home page use the same width/height as stay cards.
- Soft shadows come from the `.tv-storefront` rule in `index.css`. Do **not**
  put `shadow-*` utilities everywhere to get depth; a global reset
  (`box-shadow: none !important`) deliberately overrides them. Use the opt-in
  class `tv-soft-surface` only for a panel the automatic rule cannot recognise.
- The logo links to `getLogoHomePath(user)` (never a hard-coded `/`, because
  `/` redirects non-customer roles to their dashboard).
- Keep the navbar, footer and global search as provided by the layout. Do not
  add per-page navbars or footers.

## Alignment, spacing, type, colour

- Follow the spacing/alignment of the nearest comparable page. Use the existing
  Tailwind scale; no arbitrary pixel values unless the neighbours already use
  them.
- Use the existing colour tokens/palette (navy `#0B192C`, saffron `#F28C28`,
  `#E58C28`, the greys already in use). No new brand colours, gradients or
  glassmorphism.
- Fonts: the app's existing fonts only (Inter; Roboto on the home page; Kalam
  for storefront headings). Do not import new fonts.
- Icons: `lucide-react`, at the sizes neighbouring components use.
- Support light **and** dark mode wherever the surrounding page does, and keep
  the page usable at phone width (no horizontal page scroll).

## Strictly forbidden

- Adding UI that was not requested: extra buttons, banners, tooltips, badges,
  stats, animations, empty-state illustrations, onboarding hints.
- Inline `style={{…}}` or one-off CSS to "fix" something that belongs in the
  shared stylesheet.
- Editing `shared/*.css` or `dashboard-ui.css` for a one-page tweak. Those files
  affect every role and every page; change them only for a deliberate, global
  design change that was requested, and test several pages.
- Placeholder or invented data in dashboards: show real data or an honest empty
  state. Never hard-code fake figures, names or statuses.
- Swallowing errors in a way that shows "Saved successfully" when the request
  failed. Surface real failures.
- New UI libraries, component kits or CSS frameworks.

## Routing

- All routes live in `frontend/src/App.tsx`. A new **top-level** page must also
  be added to `render.yaml` and `vercel.json`; the build runs
  `scripts/check-spa-routes.mjs` and fails if they drift.
- Do not change an existing route path, redirect or role gate unless asked.
  Role-gated routes keep their `ProtectedRoute allowedRoles`.

## Client-side data hygiene

- Do not store tokens, personal data or per-account caches in `localStorage` /
  `sessionStorage` without clearing them on logout (see `AuthContext.logout`).
- Never render user-supplied HTML without the sanitiser in
  `frontend/src/lib/richText.ts`. No new `dangerouslySetInnerHTML` without it.

## Before you finish a UI change

1. Compare the page side by side with a sibling page that already follows the
   pattern. Does it look like the same product?
2. Check light + dark, desktop + phone width.
3. `cd frontend && npx tsc -b` and `npx oxlint` must not get worse.
4. Say in your summary which shared component/stylesheet you reused.
