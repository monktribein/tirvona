# Frontend UI and responsiveness report

Method:
- **Browser smoke.** A headless Chrome driver (Chrome DevTools Protocol) opened every new Yatra page against the real API build, Vite and a seeded throwaway database. Each page was checked for expected content, runtime errors, failed API calls, and **horizontal overflow** (`scrollWidth > clientWidth`, with the offending elements named).
- **Viewports.** Desktop 1366×900, tablet 820×1180, mobile 390×844.
- **Screenshots.** Taken of key pages and reviewed by eye.
- **Static checks.** `tsc -b`, `oxlint`, `check:routes`, production `vite build`.

The project has no frontend unit-test runner, so none could be run.

## Pages covered

| Area | Pages | Viewports | Result |
|---|---|---|---|
| Public | `/yatra`, departure page, `/yatra-partner` (with the ride partner link), organiser link, payment link | desktop + mobile | PASS |
| Pilgrim | checkout, My Journeys, Journey Hub (ticket, travellers, itinerary, add-ons, **local rides**, **Report a problem**), profile menu | desktop, tablet, mobile | PASS |
| Organiser | dashboard, register, profile, documents, staff, vehicles, tours, tour editor, new tour, departures, departure detail (seat map, manifest, check-in), bookings, new assisted booking, booking detail, links and QR, **earnings and payouts**, reports, notifications | desktop (+ mobile and tablet for dashboard and earnings) | PASS |
| Ride partner | register, dashboard, profile, vehicles, documents, requests, earnings and payouts, notifications | desktop, tablet, mobile | PASS |
| Super Admin | overview (with P5 counts), organisers, organiser detail, documents, vehicles, tours, tour detail, departures, departure detail (global seat inventory), bookings, booking detail, cancellations, add-on requests, **ride partners**, **ride partner detail**, **local rides**, collections and ledger, audit, settings (with the P5 fields) | desktop (+ tablet and mobile for rides, partner detail, overview, settings) | PASS |
| Finance Center | overview, payables (+ statement / payout / adjust via the Actions menu), payouts (+ review / approve / transfer / reconcile / proof), commission rules, Razorpay reconciliation, reports and CSV | desktop, tablet, mobile; as Super Admin and as Finance Manager | PASS |
| Destination Ops | Super Admin (all cities), HR (own area): KPIs, arrivals, departures, meal and puja, rides with assign, incidents, booking assistance, area report | desktop, tablet, mobile | PASS |
| Access | Pilgrim opening the Finance Center; Finance Manager opening Ops | — | blocked as expected |

## Results

| Requirement | Expected | Actual | Status |
|---|---|---|---|
| Desktop, tablet, mobile layouts | No horizontal overflow; readable | 98/98 pages without overflow. Tables become stacked cards below `md`; tab chips scroll inside their own row | PASS |
| Navigation and sidebar | Role-based groups; Yatra groups only while enabled | Super Admin Yatra group (with Ride Partners, Local Rides, Destination Ops, Finance Center, Collections & Ledger); Finance Manager "Tirvona Yatra → Yatra Finance Center"; HR / Executive "Destination Ops"; ride partner console sidebar; role pill "Ride Partner" | PASS |
| Forms and validation | Required fields, limits, server errors shown | HTML constraints (required, min/max, pattern for UTR) plus server messages shown inline or as toasts | PASS |
| Tables, pagination, filters | Paged lists with status chips | Present on every queue | PASS |
| Modals | Shared `EnterpriseModal` | Accept ride, assign ride, transfer, reconcile, rule, payout, adjustment, statement, passengers, incident | PASS |
| Buttons and actions | Work; row actions in the shared Actions menu | The smoke opened the Actions menu and found Start review, Approve, Statement | PASS |
| Empty, loading, error states | Shared `PanelState` / `Empty` | Used throughout; seen in the smoke (empty Ops sections, no rides yet) | PASS |
| Dead links | None | Journey Hub links to `/stays`, `/parking`, `/aarti`, `/marketplace` exist; the route check covers all 84 SPA paths in the hosting rewrites | PASS |
| Hindi / English | New labels translated | Sidebar labels and page headings translated; body text mostly English (B7 in `pending-issues.md`). **Fixed:** "From"/"To" now use neutral Hindi so existing date filters are not mistranslated | PARTIAL |
| Homepage untouched | Not modified | `HomePage` unchanged (git). The shared footer shows a Yatra link only when the flag is on. The homepage passed the regression smoke at all 3 widths. | PASS |
| Static checks | Clean | `tsc -b` 0 errors; `oxlint` 0 errors, 88 warnings, all pre-existing (changed files have the same count as at HEAD; none in Yatra files); `check:routes` OK (84 pages); `vite build` OK | PASS |

## Fixed in this audit

- Admin overview P5 counts were not displayed (bug 4 in `bugs-fixed.md`).
- Hindi "From"/"To" wording (bug 6).

## Counts

| Run | Passed | Failed | Skipped | Blocked |
|---|---|---|---|---|
| Yatra UI smoke (98 page visits across 3 viewports) | 98 | 0 | 0 | 0 |

## Remaining risk

- **Smoke checks only.** The browser checks prove that pages load, render the expected data and have no overflow or errors. They do not click through every form submission; the APIs behind them are covered by the integration suites.
- **Partial Hindi.** Hindi coverage is incomplete.
