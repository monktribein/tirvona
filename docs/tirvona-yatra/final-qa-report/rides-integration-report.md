# Rides integration report (P5)

Method:
- integration tests (`yatra-p5.http.pg-spec.ts`, `yatra-qa.http.pg-spec.ts`) on isolated PostgreSQL 17;
- the UI smoke drove the ride partner console, the Journey Hub rides panel, admin rides and Ops rides in headless Chrome at desktop, tablet and mobile widths.

## Ride partner

| # | Requirement | Expected | Actual | Test | Status |
|---|---|---|---|---|---|
| 1 | Registration | One partner account per user | Registered. A non-partner calling partner routes gets `404` | `yatra-p5`, `yatra-qa` | PASS |
| 2 | KYC | PAN, driving licence, RC and insurance before submission | Submission refused (`400`, lists missing items) until all are uploaded | `yatra-p5` › onboarding | PASS |
| 3 | Admin approval | Only Super Admin; approval verifies the submitted documents | Finance Manager `403`. Approval sets the partner's pending documents to `approved`. **Fixed in this audit:** documents stayed `pending` forever. | `yatra-p5` (extended), UI smoke | PASS (after fix) |
| 4 | Vehicle details | Registration, type, seats, AC; normalised registration | Stored as `UP85CB7777` | UI smoke + tests | PASS |
| 5 | Service areas | Requests only for cities the partner serves | Assign or request outside the area refused | `yatra-p5` | PASS |
| 6 | Only approved partners | Unapproved partners never listed or assignable | `409 PARTNER_NOT_APPROVED`; the list shows only approved and accepting partners | `yatra-p5` | PASS |
| 7 | Document privacy | Private storage, own or admin only | Other partner `404`; partner on the admin link `403` | `yatra-qa` | PASS |
| 8 | Organiser KYC queue unaffected | Organiser queue lists organiser documents only | **Fixed in this audit:** ride-partner documents (no organiser) made `/admin/documents` fail with `400`. Now excluded. Overview count fixed too. | `yatra-p5` (new assertions), UI smoke | PASS (after fix) |

## Ride lifecycle

| # | Requirement | Expected | Actual | Test | Status |
|---|---|---|---|---|---|
| 9 | Ride request | From a confirmed journey; pickup ≥ 30 min ahead and inside the journey (±1 day) | As expected; outside the journey → `DATE_OUTSIDE_JOURNEY` | `yatra-p5` | PASS |
| 10 | Accept / reject | Partner accepts with fare and a big-enough vehicle, or declines (back to Tirvona) | As expected; another partner `404` | `yatra-p5`, `yatra-qa` | PASS |
| 11 | Confirmation | Confirmed only after the pilgrim pays Tirvona | `accepted` → pay → `confirmed`; vehicle and driver details shown to the pilgrim only after payment; pilgrim contact shown to the partner only after payment | `yatra-p5`, `yatra-qa` | PASS |
| 12 | Start and complete | Start within 2 h of pickup; completion posts the partner earning (fare − commission − GST) | As expected | `yatra-p5` › lifecycle | PASS |
| 13 | Cancellation | Pilgrim early → 100% wallet refund, late → none; partner or Tirvona → 100% plus a high-severity incident (partner case) | As expected | `yatra-p5` › refund test | PASS |
| 14 | Unanswered requests | Returned to Tirvona after the response window | Released by the sweep, once | `yatra-p5` › background jobs | PASS |
| 15 | Issue reports | Pilgrim and partner can report; reaches Ops and Super Admin | Recorded with city; listed in Ops; rate-limited (fixed) | `yatra-p5`, `yatra-qa-security` | PASS |
| 16 | Notifications | In-app to partner, pilgrim and admins at each step | Calls present for every transition (code review); delivery is the existing notification service | review | PASS (review) |
| 17 | Pilgrim isolation | Nobody else can see, request, pay for or cancel a pilgrim's rides | 6 cross-account attempts, all `404` | `yatra-qa` | PASS |
| 18 | UI | Ride partner console (7 pages), Journey Hub rides panel, admin partners and rides, Ops rides, at 3 widths, no overflow | 98/98 smoke pages passed | UI smoke | PASS |

## Counts

| Passed | Failed | Skipped | Blocked |
|---|---|---|---|
| 18 | 0 | 0 | 0 |

## Remaining risk

- **Stuck rides.** No admin action can complete or start a ride. If a partner never presses "complete", the earning is not posted; Super Admin can cancel, or Finance can adjust.
- **No per-document review.** Approval verifies all submitted documents together.
- **Notifications are in-app only.** WhatsApp and SMS are not implemented (templates are listed in `docs/yatra/notifications.md`).
