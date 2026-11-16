# Corrections made for the existing-infrastructure requirement

No application code, migration, route, schema or test changed. Only the verification kit and documents did.

| File | Problem | Change |
|---|---|---|
| `staging/tools/yatra-staging-check.mjs` | Read ten `STAGING_*` variables from `Newbackend/.env.staging` and refused to run if a service matched the existing configuration | Reads the **existing** variable names from an env file (default `Newbackend/.env`); no extra variables; new `readiness` and `db-plan` read-only phases; writing phases refuse against the live configuration unless `--allow-live`; money phases need a `rzp_test_` key; on the live database `db` never rolls back and applies only if exactly 0015 and 0016 are pending; sender address derived as the app derives it |
| `staging/env.staging.example` | Template for the parallel variables | Deleted (it contained no values) |
| `staging/results/preflight-2026-11-15…json` | Output of the old kit, refusals only | Deleted |
| `staging/staging-report.md` | Required new Supabase, Razorpay test, Cloudinary and Resend accounts | Rewritten: status under the existing configuration, what is and is not verified, the owner decisions |
| `staging/migration-review.md` | Ended by requiring a separate staging Supabase project | Conclusion corrected |
| `final-qa-report/payment-refund-audit.md`, `p0-p4-verification.md`, `pending-issues.md`, `production-readiness.md` | Said steps needed staging, test keys or test accounts | Reworded: existing configuration, migrations approved first, owner authorisation for anything that moves money |

## Kept on purpose

- All safety checks, now as guards that fit the existing configuration (verified by running them).
- `worktree-comparison.md` and both `separate-issue-*.md` files (unrelated to configuration).
- The final-QA reports and every test.

## Verified by running

- `readiness` against the existing file: variables reported yes/no, no values.
- `db`, `services`, `e2e` against the live configuration: refused before any connection.
- `db` through `--env-file` against a throwaway PostgreSQL 17: 10/10 (apply, verify, no-op, rollback of 0016, re-apply, full rollback, re-apply).

## Not done, by design

- No migration applied; no real payment; no live key used; no existing secret changed; the old worktree and `docs/seo/publishing/` untouched.
