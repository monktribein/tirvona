# Super Admin and role permissions report

Method:
- an integration test calls each protected action as every role (`yatra-qa` › "lets only the right roles reach admin, finance and ops endpoints");
- the P0–P4 and P5 suites check each workflow's permissions;
- the UI smoke checks the menus each role sees.

## API role matrix (tested)

✔ = allowed and returned 200/201. ✖ = refused with 403. "own" = only the caller's own records (others get 404).

| Action | super_admin | finance_manager | hr / executive | support | organiser (customer account) | ride partner (customer account) | pilgrim | no login |
|---|---|---|---|---|---|---|---|---|
| Yatra admin overview | ✔ | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ | 401 |
| Approve / reject organisers, documents, vehicles | ✔ | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ | 401 |
| Approve / publish / unpublish tours | ✔ | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ | 401 |
| Cancel a departure (100% refunds) | ✔ | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ | 401 |
| Decide a cancellation refund | ✔ | ✖ | — | — | ✖ | — | — | 401 |
| Approve / suspend ride partners | ✔ | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ | 401 |
| Finance dashboard, rules, payables | ✔ | ✔ | ✖ | ✖ | ✖ | ✖ | ✖ | 401 |
| Review / approve payout, record transfer, reconcile | ✔ | ✔ | — | — | ✖ | ✖ | — | 401 |
| Destination Ops | ✔ all cities | ✖ | ✔ own office city | ✖ | ✖ | ✖ | ✖ | 401 |
| Request a payout | — | — | — | — | own | own | — | 401 |
| Organiser console | — | — | — | — | own organiser, by staff role | — | — | 401 |
| Ride partner console | — | — | — | — | — | own | — | 401 |
| Journey Hub, rides, issues | — | — | — | — | — | — | own | 401 |

## Results

| # | Requirement | Expected | Actual | Status |
|---|---|---|---|---|
| 1 | Only Super Admin approves and publishes | Others 403 | 7 roles × 4 admin actions → all 403 | PASS |
| 2 | Finance Manager has finance only | Finance yes; admin and ops no | As expected | PASS |
| 3 | HR / Executive limited to their office city | Other city 404/403; no office → empty | Dashboard, lookup, passengers, issue create and update, assign: other city refused; no office → "No office assigned" with empty lists | PASS |
| 4 | Menus follow permissions | Yatra groups only for allowed roles and only while enabled | UI smoke: Super Admin sees the Yatra group; Finance Manager sees only the "Yatra Finance Center" link; HR sees "Destination Ops"; with the flag off none appear (dark-deploy smoke) | PASS |
| 5 | Frontend routes guarded | ProtectedRoute matches backend roles | `/admin/yatra/*` super_admin; `/admin/yatra/finance` super_admin + finance_manager; `/ops/yatra` super_admin + hr + executive. Pilgrim on Finance Center and Finance Manager on Ops are blocked (UI smoke). | PASS |
| 6 | Super Admin cannot bypass money rules | No payout without approval; transfer = approved amount; UTR unique | Same validations apply to Super Admin | PASS |

## Counts

| Passed | Failed | Skipped | Blocked |
|---|---|---|---|
| 6 (matrix: 48 role/action checks) | 0 | 0 | 0 |

## Remaining risk

- Super Admin and Finance Manager can both record transfers, which is intended. There is no four-eyes rule (approver ≠ recorder). Consider it for larger payouts.
