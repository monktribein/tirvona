# Yatra integration audit: what already exists and what Yatra reuses

2026-11-16 audit of the committed code (branch `fix/booking-payment-gaps`). Names only; no secret value was read into this document.

**Conclusion: the Yatra application code already uses the existing Tirvona infrastructure. No second database, Razorpay account, Cloudinary account, Resend configuration or environment system is needed by the implementation.** The only parallel configuration was in the staging kit and staging documents added in commits after the implementation; those are corrected in this change.

## 1. Existing infrastructure and how Yatra uses it

| Area | Existing in the repo | Yatra |
|---|---|---|
| Backend | One NestJS app (`Newbackend/src`), modules under `modules/`, shared code in `common/`. | `modules/yatra` (domain / application / infrastructure / presentation), imported in `app.module.ts`. No separate backend. |
| Frontend | One React app (`frontend/src`): `modules/<name>` and `admin/<name>`, routes in `App.tsx`, one `DashboardLayout` with role-based sidebar groups. | `modules/yatra` (public, journey, organiser, ride partner, ops) and `admin/yatra`; routes in the same `App.tsx`; sidebar groups in the same `DashboardLayout`. No separate site, admin app or login. |
| Database | `SUPABASE_DB_URL` read in `config/environment.ts`; one pool in `database/database.ts`; migrations `database/migrations/0001…0014`; models through the Mongoose-style layer over the Postgres driver. | Models registered through the same ORM; tables created by migrations `0015` and `0016` in the same folder and naming style. No second connection or config. |
| Auth and RBAC | Global JWT guard, `RolesGuard`, `@Roles`, `@Public`, shared users table. | The same guards and decorators. Organiser and ride partner are ordinary user accounts with a membership record. |
| Razorpay | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` read as `razorpayKeyId`, `razorpayKeySecret`, `razorpayWebhookSecret`. One webhook endpoint `POST /payments/razorpay/webhook` verifies the signature, records the event id (idempotent) and dispatches to each module in turn. | Same config keys. Yatra is one more branch in the existing dispatcher (last). Yatra creates orders with the same keys. |
| Cloudinary | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_FOLDER`; `UploadsService` for general uploads. | Same config keys. KYC and proof files are uploaded as `type: authenticated` and opened only through 5-minute signed links. |
| Resend / email | `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `EMAIL_REPLY_TO`; shared layout `notifications/email-template.ts`; direct sends in `auth.service`, queued sends in `notification.worker`. | Same config keys and the same shared template (`renderEmail`). |
| Wallet and refunds | `WalletService`; `refunds/domain/refund-calculator`; the refund queue for gateway refunds. | `WalletService.credit` for eligible refunds (module `"yatra"`, idempotent keys) and the shared refund calculator. No gateway refund and no second ledger for wallet money. |
| Payouts | `payouts/infrastructure/bank-account.crypto` (AES-256-GCM). | Reused for bank details. Yatra payouts are manual records (no payout API call). |
| Notifications | `InAppNotificationService`, gateway, FCM, `NotificationsModule`. | Reused for in-app notifications. |
| Audit | Shared `audit_logs` model. | Reused. |
| HR and Executive scope | `HrLocationService.scopeFor` (office city). | Reused for Destination Ops. |
| Other modules | Stay, Food, Pandit/providers, Parking, Aarti, Marketplace, Events. | Read-only references to their data and read-only booking links. Existing code is unchanged apart from the shared dispatcher branch and the `"yatra"` wallet module value. |

## 2. Environment variable mapping (names only)

| Purpose | Existing variable (read by `config/environment.ts`) | Used by Yatra |
|---|---|---|
| Database | `SUPABASE_DB_URL` (optional `SUPABASE_MIGRATION_URL` for the migration tools) | yes (through the shared pool) |
| JWT / payment-link signing | `JWT_SECRET` (and `PAYMENT_LINK_SECRET` fallback) | yes |
| Razorpay | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | yes |
| Cloudinary | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_FOLDER` | yes |
| Resend | `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `EMAIL_REPLY_TO` | yes |
| Bank detail encryption | `PAYOUT_ENCRYPTION_KEY` | yes |
| Site links | `FRONTEND_URL` | yes |
| New, Yatra-only **feature flags** (default `false`, same pattern as `AARTI_MAINTENANCE_ENABLED`) | `YATRA_ENABLED`, `YATRA_MAINTENANCE_ENABLED`, `YATRA_EMAIL_ENABLED`, `YATRA_RECONCILIATION_ENABLED` | these are on/off switches, not services or credentials |

No Yatra application file reads `process.env` directly (only the test harness sets it); everything goes through `ConfigService` with the keys above.

## 3. Database connection mapping

One pool, built from `SUPABASE_DB_URL` in `database/database.ts`; the migration tools (`db:migrate`, `db:verify`) use the same URL through `database/lib.js`. Yatra adds no connection and no config. It adds 22 tables (0015: 15, 0016: 7) plus nullable columns on its own tables, and nothing else. See `../staging/migration-review.md`.

## 4. Razorpay mapping

| Concern | Existing | Yatra |
|---|---|---|
| Config | the three keys above | same |
| Client | There is **no shared Razorpay client**: 11 places build `new Razorpay({ key_id, key_secret })` from the config (aarti, bookings, day-stay, food ×2, marketplace, parking, providers ×3, refunds) | Yatra does the same in 2 places (order creation in `YatraGatewayService`; a read-only payment lookup for reconciliation). This follows the existing convention; it is not a second integration. |
| Webhook | one endpoint + dispatcher, signature check, event-id idempotency | one more dispatcher branch |
| Signature and idempotency | checkout HMAC per module; unique gateway ids in each payments table | same pattern; unique `orderId` and `paymentId` on `yatra_payments` |

## 5. Cloudinary and Resend mapping

- **Cloudinary:** `UploadsService` configures the shared account from the config keys. Yatra's `YatraDocumentStorage` configures the **same account from the same keys**. It exists because KYC files must be private (`authenticated` + signed links), which I did not find as an option in `UploadsService` (I read its config and `upload_stream` call; I did not audit every caller). No second account.
- **Resend:** `auth.service` and `notification.worker` both construct `new Resend(resendApiKey)` from the config. Yatra does the same and reuses the shared `renderEmail` template. Optional later consolidation: route Yatra emails through the notification worker's queue (needs Redis). Not required for correctness.

## 6. Duplicate staging configuration created earlier (all in commit `134ac9d`, documentation and tooling only)

| Item | Problem |
|---|---|
| `Newbackend/.env.staging` requirement and `.gitignore` reliance | A second environment file |
| 10 `STAGING_*` variables (`STAGING_SUPABASE_DB_URL`, `STAGING_RAZORPAY_*`, `STAGING_CLOUDINARY_*`, `STAGING_RESEND_*`, `STAGING_TEST_EMAIL_TO`) | Parallel names for services that already have names |
| `staging/env.staging.example` | Template for the above |
| `staging/tools/yatra-staging-check.mjs` | Read only the `STAGING_*` names and refused cloud names, keys or projects shared with the existing configuration, which is the opposite of the intended reuse |
| `staging/staging-report.md`, final-QA `payment-refund-audit.md`, `pending-issues.md`, `production-readiness.md` | Said new Supabase / Razorpay test / Cloudinary / Resend accounts were required |
| `staging/results/preflight-….json` | Output of the old kit (refusals only) |

No application code, migration, route or schema was affected.

## 7. Files that need correction

See `corrections.md` in this folder for the list and what changed.

## 8. Yatra functionality retained unchanged

All of the implementation (backend module, frontend pages, migrations, rollbacks, tests, QA reports, SOPs, notification doc). Nothing in it depends on the duplicate staging configuration.

## 9. Changes required to integrate safely

1. Replace the `STAGING_*` mechanism with the existing variable names, read the way the app reads them.
2. Keep the safety rules as guards: live-environment checks are read-only; anything that writes, creates an order or moves money needs an explicit flag, and Razorpay-moving phases need a `rzp_test_` key.
3. Remove the second-environment instructions from the documents, and state what really needs the owner (below).
4. Keep the unit and database tests as the evidence they are. Real-service checks stay **unverified** until performed.

## 10. Confirmation

No second database, payment gateway, Razorpay account, Cloudinary account, Resend configuration or env system is required by the implementation. The remaining real-service checks (A1–A5 in `pending-issues.md`) are still **not done**. How to run them with the existing configuration, and what needs your authorization, is in `../staging/staging-report.md`.
