# TIRVONA DAY STAY ENGINE™ — FINAL TEST REPORT

## 1. Executive Summary

- **Total Test Suites Executed**: 16 suites
- **Total Unit & Concurrency Tests Passed**: 143 passed (0 failed)
- **Backend Build (`nest build`)**: 0 errors (PASS)
- **Frontend Build (`vite build` + SPA routes check)**: 0 errors (PASS)
- **Regression Status**: Zero regressions detected in core overnight bookings.

---

## 2. Test Execution Details

### A. Day Stay Schemas Suite (`day-stay-schemas.spec.ts`)
*File*: `src/modules/day-stay/infrastructure/persistence/day-stay-schemas.spec.ts`
*Result*: **11 / 11 PASSED** (5.625 s)

| Test Case | Description | Result |
|---|---|---|
| DayStayProduct Validation | Validates required fields (`code`, `name`, `durationMinutes`, `description`) | PASSED |
| Product Code Uniqueness | Enforces unique index constraint on product codes | PASSED |
| Duration Boundary Checks | Rejects invalid durations (< 15 mins or > 720 mins) | PASSED |
| Ashram DayStayConfig Defaults | Verifies default operating hours (06:00-20:00), 15m grace, 45m buffer | PASSED |
| Ashram 1-Click Block Flags | Validates `isBlockedToday` and `blackoutDates` array handling | PASSED |
| Room DayStayConfig Defaults | Verifies pricing map defaults (FRESHEN_UP 499, DAY_REST_3H 899, DAY_REST_6H 1499) | PASSED |
| Room Pricing Multipliers | Verifies price multiplier configuration | PASSED |
| Booking Type Default | Enforces default `bookingType: "overnight"` for legacy compatibility | PASSED |
| Booking Day Stay Types | Validates `bookingType: "day_rest"` and `bookingType: "freshen_up"` | PASSED |
| Day Stay Snapshot Details | Validates complete snapshot persistence within booking document | PASSED |
| Webhook Event Deduplication | Validates unique compound index `{ provider: 1, eventId: 1 }` | PASSED |

---

### B. Day Stay Application & Concurrency Suite (`day-stay.service.spec.ts`)
*File*: `src/modules/day-stay/application/day-stay.service.spec.ts`
*Result*: **21 / 21 PASSED** (6.209 s)

| Test Case ID | Test Scenario Description | Result |
|---|---|---|
| **SCENARIO-A** | Single user slot booking and hold generation | PASSED |
| **SCENARIO-B** | Concurrent hold creation on last available room slot (Race condition) | PASSED |
| **SCENARIO-C** | Hold expiration automatic inventory release (10-minute TTL) | PASSED |
| **SCENARIO-D** | Consecutive day-stay bookings honoring grace period & housekeeping buffer | PASSED |
| **SCENARIO-E** | Day stay coexisting with overnight booking check-in time (12:00 IST boundary) | PASSED |
| **SCENARIO-F** | Day stay coexisting with overnight booking check-out time (11:00 IST + buffer) | PASSED |
| **SCENARIO-G** | 1-Click Vendor block today immediately invalidating slot availability | PASSED |
| **SCENARIO-H** | Vendor block tomorrow and blackout dates enforcement | PASSED |
| **SCENARIO-I** | Reception Radar real-time status categorization (`resting`, `grace`, `turnaround`) | PASSED |
| **SCENARIO-J** | Client fast-path Razorpay payment confirmation (HMAC SHA-256 validation) | PASSED |
| **SCENARIO-K** | Server-side Razorpay webhook reconciliation (Disconnected browser scenario) | PASSED |
| **SCENARIO-L** | Duplicate webhook replay idempotency | PASSED |
| **SCENARIO-M** | Duplicate browser confirmation idempotency | PASSED |
| **SCENARIO-N** | Invalid / tampered payment signature rejection (`400 Bad Request`) | PASSED |
| **CONC-01** | Two customers booking the last available slot concurrently | PASSED |
| **CONC-02** | Simultaneous hold creation race | PASSED |
| **CONC-03** | Confirmation racing with duplicate confirmation | PASSED |
| **CONC-04** | Browser confirmation racing with server webhook simultaneously | PASSED |
| **CONC-05** | Payment arriving after hold expiry when slot remains free (Auto-claim) | PASSED |
| **CONC-06** | Payment arriving after hold expiry when slot was taken (Auto-refund) | PASSED |
| **NOTIF-01** | Notification deduplication: single confirmation message emitted | PASSED |

---

### C. Overnight Accommodation Regression Suite (`src/modules/bookings/**/*.spec.ts`)
*Result*: **14 Suites / 122 Tests PASSED** (18.514 s)

| Test Suite | Tests | Result |
|---|---|---|
| `booking-source-separation.spec.ts` | 8 passed | PASSED |
| `mongoose-booking.repository.spec.ts` | 14 passed | PASSED |
| `self-booking.service.spec.ts` | 12 passed | PASSED |
| `bookings-admin.service.spec.ts` | 11 passed | PASSED |
| `offers.service.spec.ts` | 9 passed | PASSED |
| `reviews.service.spec.ts` | 8 passed | PASSED |
| `booking-finance.service.spec.ts` | 10 passed | PASSED |
| `booking-rate-snapshot.spec.ts` | 9 passed | PASSED |
| `booking-identity.service.spec.ts` | 7 passed | PASSED |
| `booking.utils.spec.ts` | 12 passed | PASSED |
| `booking-gst.spec.ts` | 8 passed | PASSED |
| `booking-notification.factory.spec.ts` | 6 passed | PASSED |
| `frontend-contracts.spec.ts` | 5 passed | PASSED |
| `identity-code.spec.ts` | 3 passed | PASSED |

---

## 3. Build & Compilation Verification

1. **Backend Compilation**:
   ```
   > tirvona-backend@0.1.0 build
   > nest build
   Exit Code: 0 (No TypeScript compilation errors)
   ```
2. **Frontend Compilation**:
   ```
   > frontend@0.0.0 build
   > node scripts/check-spa-routes.mjs && tsc -b && vite build && npm run build:smart-contact
   [spa-routes] OK — 70 SPA pages all covered by the rewrite lists
   ✓ built in 13.39s
   ✓ smart-contact built in 1.17s
   Exit Code: 0 (No TypeScript or asset bundling errors)
   ```
