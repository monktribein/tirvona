# Pass 2: P5–P6 verification

## P5: rides, finance and operations

| Area | Checks | Passed | Failed | Blocked | Detail |
|---|---|---|---|---|---|
| Ride partner and ride lifecycle | 18 | 18 | 0 | 0 | `rides-integration-report.md` (2 defects fixed in this audit) |
| Commission and ledger (recalculated by hand) | 8 + 12 ledger lines | all | 0 | 0 | `finance-payout-audit.md` |
| Manual payout | 12 | 12 | 0 | 0 | `finance-payout-audit.md` |
| Super Admin finance dashboard and reports | 3 | 3 | 0 | 0 | `finance-payout-audit.md` |
| Razorpay settlement reconciliation | 1 | 1 (fake client) | 0 | 1 (real API) | `payment-refund-audit.md` |
| Destination Ops | see below | all | 0 | 0 | below |

### Destination Ops

| Requirement | Expected | Actual | Test | Status |
|---|---|---|---|---|
| City-based data access | HR / Executive see only their office area; Super Admin all or a chosen city | As expected (Vrindavan vs Haridwar offices) | `yatra-p5` › "shows HR / Executive only their own office city"; `yatra-qa` scope test | PASS |
| Today's arrivals and departures | Groups arriving or on the ground, and groups leaving the area | Listed with organiser contact and passenger counts | `yatra-p5`; UI smoke | PASS |
| Supplier requests | Meal and puja confirmations around the day | Listed | `yatra-p5`; UI smoke | PASS |
| Ride requests | Rides in the area; assign an approved partner | Listed; assign works; outside the area refused | `yatra-p5`, `yatra-qa` | PASS |
| Issue management | Create, start, resolve (resolution required), close | As expected; other city `404` / `403` | `yatra-p5` | PASS |
| Unauthorised city access | Refused | Lookup, passengers, issue update, assign in another city refused; no office → empty | `yatra-qa` | PASS |
| Passenger list for coordination | Confirmed travellers only, area-checked | As expected | `yatra-qa` | PASS |

## P6: complete system integration

### End-to-end scenario (website booking)

| Step | Verified by | Status |
|---|---|---|
| 1. Organiser registers | `yatra.http`, `yatra-qa` seed, UI smoke seed | PASS |
| 2. Super Admin approves organiser | same | PASS |
| 3. Organiser creates a tour | same | PASS |
| 4. Super Admin approves and publishes it | same | PASS |
| 5. Customer searches the tour | `yatra.http` › "shows the open departure to everyone"; UI smoke `/yatra` | PASS |
| 6. Customer books a seat | `yatra.http`, `yatra-qa` | PASS |
| 7. Payment through Tirvona Razorpay | demo payment + HMAC unit tests | PASS (real gateway BLOCKED, A1) |
| 8. Booking confirmed | same | PASS |
| 9. Journey created | same | PASS |
| 10. Customer requests an add-on | `yatra.http` food and puja; UI smoke | PASS |
| 11. Organiser manages passengers and boarding | `yatra.http` › manifest and boarding (ticket check-in) | PASS |
| 12. Cancellation processed | `yatra.http`, `yatra-qa` | PASS |
| 13. Refund credited to the wallet | same (exact amount, once) | PASS |
| 14. Organiser payable recalculated | `yatra-qa` (hand calculation = ledger = API) | PASS |
| 15. Finance records the manual transfer | `yatra-qa`, `yatra-p5` | PASS |
| 16. Super Admin verifies the transfer (reconciliation and audit) | same | PASS |

### Organiser-assisted repeat

| Step | Verified by | Status |
|---|---|---|
| Staff books from the same inventory; the booking records the staff member | `yatra.http` › organiser-assisted booking | PASS |
| Customer claims the signed link and pays Tirvona; nobody else can | `yatra.http` | PASS |
| Customer vs organiser race on one seat | `yatra-qa` Scenario B | PASS |
| Organiser earning for the assisted channel uses the channel's rule | `yatra-qa` › "applies the organiser-channel (DIRECT) rule…" (3% → ₹45, GST ₹8.10; a website booking at the same time keeps 10%); rule selection also unit-tested | PASS |

### Connected modules

| Module | How Yatra connects | Verified | Status |
|---|---|---|---|
| Razorpay | Tirvona orders; shared webhook routes Yatra last | HMAC + routing unit tests; demo flows | PASS (real BLOCKED) |
| Wallet / refunds | `WalletService.credit`, module `yatra`, idempotent keys | exact-amount and once-only tests | PASS |
| Stay, Parking, Aarti | Read-only links to the pilgrim's own bookings | link tests (stay, parking) | PASS |
| Food, Puja | Supplier request lifecycle with payment | `yatra.http` | PASS |
| Marketplace | Link from the Journey Hub | review + page renders | PASS |
| Notifications | Existing in-app service; Resend email behind a flag | review (calls on each step) | PASS (review) |
| HR / Executive | Office-city scope reused read-only | Ops tests; HR suites still pass | PASS |
| Payouts | Own Yatra payout records; reuses BankAccountCrypto | payout tests | PASS |
| Audit logs | Shared `audit_logs`, append-only from Yatra | audit assertions | PASS |

### P6 operations

- Pilot checklists, SOPs, the activation plan, the rollback plan and the notification and WhatsApp template list are in `docs/yatra/`.
- The rollback plan was exercised on a database: rollback of 0016, then of 0016 + 0015, then re-apply.

## Counts (pass 2)

| Source | Passed | Failed | Skipped | Blocked |
|---|---|---|---|---|
| `yatra-p5.http.pg-spec.ts` | 18 | 0 | 0 | 0 |
| P5 scenarios in `yatra-qa.http.pg-spec.ts` (money recalculation, payouts, ride isolation, role matrix, ops scope, organiser-channel rule) | 6 | 0 | 0 | 0 |
| End-to-end steps (16 + 4) | 20 | 0 | 0 | 1 (real gateway) |
| Real Razorpay reconciliation | — | — | — | 1 |

## Verdict for pass 2

P5 and P6 behave as specified on an isolated database, and the defects found were fixed with regression tests. Real external integrations remain to be confirmed on staging.
