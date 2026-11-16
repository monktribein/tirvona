# Tirvona Yatra: verification status (existing Tirvona configuration)

Updated 2026-11-16. Replaces the earlier version, which wrongly assumed a separate Supabase project, Razorpay test account, Cloudinary account and Resend key.

Branch `fix/booking-payment-gaps`: local commits only, **not pushed**.

Production safety held throughout: no production migration, deployment, push, live payment, secret change or production flag change. The existing `.env` files were read only in memory to report which variables are set (yes/no); no value was printed or copied.

## Verdict

**NOT READY.** No real-service verification has been performed, so none is claimed.

The implementation needs nothing new: it uses the existing database, Razorpay, Cloudinary, Resend and configuration (`../integration/infrastructure-audit.md`). What is missing is evidence from running it against those existing services, and that needs decisions that are yours.

## What is verified (evidence exists)

| Area | Result |
|---|---|
| Yatra unit tests | 24/24 |
| Yatra database tests (PostgreSQL 17, throwaway instance) | 64/64 |
| All-modules database tests | 364/364 (earlier run) |
| All-modules unit tests | 2,517 pass; 2 pre-existing failures in the Smart Contact QR tests (`separate-issue-smart-contact-qr-timeouts.md`) |
| Yatra pages, desktop, tablet and mobile | 98/98 |
| Existing modules with the Yatra flags off | passes, apart from the known Pandit page warning (`separate-issue-pandit-withdrawals.md`) |
| Migrations 0015 and 0016: apply, verify, idempotent re-run, rollback of each, re-apply | pass on a throwaway PostgreSQL 17, by hand and again through the kit's `db` phase (10/10) |
| Seat concurrency, expiry, duplicate confirmations, refund and wallet maths, payout rules, permissions | pass (final-QA reports) |
| Razorpay checkout and webhook signature code | pass with test-secret unit tests |
| Kit safety guards | verified: against the live configuration the read-only phase reports and every writing phase refuses |

## What is NOT verified

| # | Item | Why | What it needs |
|---|---|---|---|
| A5 | Migrations 0015/0016 on the existing Tirvona database | Not applied; your approval required | Your explicit approval. They are additive and `yatra_*` only (`migration-review.md`). Apply them through the normal deploy, or with the kit's `db` phase, which on the live database applies only if exactly 0015 and 0016 are pending and never rolls back. |
| A1 | A real Razorpay checkout with Yatra | The existing Razorpay keys are live; none of the Yatra code has taken a real payment | Your explicit authorisation, one of: (a) a single minimum-value live booking and its refund to the wallet, done through the app after A5, with the Yatra flag on only briefly; or (b) Razorpay test keys supplied by you through the same variable names in an isolated environment, using `--env-file`. |
| A2 | Razorpay settlement reconciliation against the real API | Needs real captured payments | After A1, Finance Center → Razorpay reconciliation |
| A3 | Cloudinary private upload and signed link in the real account | Not exercised | After A5, upload one organiser document, one ride partner document and one payout proof through the app and check the plain URL is not public |
| A4 | Resend email in the real account | Not exercised; `YATRA_EMAIL_ENABLED` is off | After A5, send one of each Yatra email through the app, then switch the email flag on |
| — | WhatsApp and SMS | Not implemented | Documented as pending in `docs/yatra/notifications.md` |

## The verification kit (`tools/yatra-staging-check.mjs`)

It reads the application's own variable names from an env file (default `Newbackend/.env`). There are no extra variables and no second file.

| Phase | What it does | Against the live configuration |
|---|---|---|
| `readiness` | Reports yes/no for each variable, the Razorpay key mode, the flags | Allowed (read-only, no connection) |
| `db-plan` | `migrate --plan`: lists pending migrations | Allowed (read-only) |
| `db` | Applies and verifies 0015/0016; with another database it also rolls back and re-applies | Refused unless `--allow-live`; on the live database it never rolls back and applies only if exactly 0015 and 0016 are pending |
| `services` | Razorpay order and signature, Cloudinary upload, Resend email | Refused: it needs a `rzp_test_` key and `--allow-live` |
| `e2e` | Whole stack with a real checkout and webhooks | Refused: it needs a `rzp_test_` key and `--allow-live` |

Current readiness report: all required variables are set (the sender address is derived by the app from its defaults), the Razorpay key is a **live** key, and all four Yatra flags are off. A live key is never used for a payment by the kit.

## Decisions for you

1. **A5:** approve applying 0015/0016 to the existing database (or say when).
2. **A1:** choose (a) one small authorised live payment and refund, (b) test keys through the same variable names in an isolated environment, or (c) go to production approval with A1 explicitly accepted as unverified. I recommend (a) after A5, with a minimum-value booking you make yourself.
3. Worktree deletion, the commit plan and the push remain as before (nothing done without your word).
