# Bugs fixed

Defects found while integrating and auditing P5–P6, each fixed with the smallest change. None of
these fixes changes a business rule, an existing financial service, an existing schema, or an
unrelated production module.

| # | Severity | Defect | How found / reproduced | Root cause | Affected | Fix | Files changed | Regression test | Rerun |
|---|---|---|---|---|---|---|---|---|---|
| 1 | High | Super Admin "KYC and vehicle documents" queue failed with `400` once any ride partner had uploaded a document | UI smoke: `GET /v1/yatra/admin/documents?status=pending` → 400 after the P5 seed | Ride partner documents share `yatra_documents` with `operator_id = null`. The queue mapped organiser names with `String(null)` → `"null"`, which failed as an id. | Organiser KYC review (P1) | Queue and its count list organiser documents only (`operatorId != null`); null ids are filtered before lookup | `Newbackend/src/modules/yatra/application/yatra-operator.service.ts` | `yatra-p5.http.pg-spec.ts` › onboarding: queue returns 200 with organiser names only | Yatra pg 63/63; UI smoke |
| 2 | Medium | Super Admin could "approve" a ride partner document from the organiser queue, and the overview "Documents to verify" count included ride partner documents | Code review after bug 1 | Same shared table, unscoped `findById` | Organiser KYC review | Review and count restricted to organiser documents; a ride partner document id now returns `404` there | `yatra-operator.service.ts`, `yatra-insights.service.ts` | `yatra-p5` › onboarding: review of a partner document → 404; count unchanged by partner uploads | as above |
| 3 | Medium | Ride partner documents stayed `pending` forever, even after the partner was approved | Code review | No per-document review exists for partners, and approval did not update the documents | Ride partner console | Partner approval marks that partner's pending documents `approved` (with reviewer and time) | `yatra-ride.service.ts` | `yatra-p5` › onboarding: all 4 documents `approved` after approval | as above |
| 4 | Medium | Admin overview never showed the P5 counts (ride partners to review, rides needing a partner, open incidents, payouts to process) | UI smoke: the labels were missing on `/admin/yatra` | Frontend read `data.p5Counts.*`; the API returns the counts at the top level | Super Admin overview | Read the top-level fields | `frontend/src/admin/yatra/AdminYatraPages.tsx` | UI smoke "admin · overview P5 counts" | UI smoke |
| 5 | Medium | Pilgrim, partner and organiser issue reports and payout requests had only the global rate limit (120/min). Every issue report notifies all Super Admins, so this was a spam vector. | Security review | Per-route `YatraWriteThrottle` missing on 5 write routes | Notifications, Finance queue | Added limits: issue reports 10 per 10 min; payout requests 10 per hour | `Newbackend/src/modules/yatra/presentation/yatra-p5.controller.ts` | `yatra-qa-security.spec.ts` › "throttles pilgrim / partner issue reports and payout requests" | unit 2515/2515 |
| 6 | Low | Hindi mode: the new keys "From"/"To" were translated as "कहाँ से / कहाँ तक" ("from where / to where"). The app translates text globally, so existing date filters (for example HR Attendance) would have shown the wrong words. | Regression review of the global Hindi dictionary | Generic keys added with a route-specific translation | All Hindi pages with From/To labels | Neutral translations "से / तक" (correct for both routes and dates) | `frontend/src/i18n/resources.ts` | No frontend test runner exists in the project; verified by inspection, `tsc -b` and the build | frontend build |
| 7 | Low | The new Yatra test harness (`src/modules/yatra/testing/`) would have been compiled into the production API build, shipping test-only code | Build review (deploy compiles `tsconfig.build.json`) | Build exclude list had the providers test folder but not the new Yatra one | Production build | Added `src/modules/yatra/testing` to the build excludes | `Newbackend/tsconfig.build.json` | Built with `tsc -p tsconfig.build.json`: no `modules/yatra/testing` in the output | build |
| 8 | Low | Yatra Settings could not save the three new P5 settings (ride refund window, partner response time, reminder time) | Building the settings form | `SettingsDto` did not declare them; the whitelist rejected them | Super Admin settings | Added the three optional integer fields; the service already enforces their limits | `Newbackend/src/modules/yatra/presentation/yatra.dto.ts` | UI smoke "admin · settings P5 fields" | UI smoke |

## Not product defects (test corrections)

These failures were in the tests themselves; the application behaved correctly.

| Where | What was wrong in the test | Correction |
|---|---|---|
| UI smoke, Finance payables/payouts | Looked for "Statement" / "Start review" in visible text. The shared dashboard shell folds two or more row actions into an "Actions" menu. | The smoke now opens the menu, then checks the buttons |
| UI smoke, ride partner vehicles and profile | Looked for values that live inside `<input>` fields | Checks input values instead |
| UI smoke, audit log | Expected an early action on page 1 of a 30-row log | Expects a recent action |
| `yatra-qa`, ride isolation | Looked for a paid ride under "accepted"; paid rides are under "active" | Corrected the tab |

## Pre-existing defect found, not fixed (outside scope)

| Where | Defect | Why not fixed |
|---|---|---|
| `frontend/src/modules/pandit/admin/AdminPanditWithdrawalsPage.tsx:179` | While loading, a `<Skeleton>` (a `<div>`) is rendered inside a `<p>`, which React reports as invalid DOM nesting. Found by the dark-deploy regression smoke. | Existing Pandit module, unchanged for 5 weeks and unrelated to Yatra. The rules say not to modify unrelated production pages. A one-line fix (`<p>` → `<div>`) is recommended separately. |
