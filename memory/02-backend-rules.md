# 02 — Backend rules

Applies to `Newbackend/` (NestJS). It is the only backend; the legacy Express
`backend/` no longer exists.

**Do not break the backend. Change only what the task needs, keep every
existing API contract, and never experiment on live data.**

## Hard guardrails

- **Do not change existing API behaviour you were not asked to change**: URL,
  method, auth requirement, request fields, response shape, field names, status
  codes, enum values. The web app, mobile builds, partners, WhatsApp flows and
  webhooks depend on them. Additive and backward-compatible only.
- **Do not run the backend, scripts or tests against the live/shared database.**
  Local dev shares real infrastructure (Supabase Postgres, Redis, Cloudinary).
  A "quick test" can write to, or notify, real users. Use unit tests with mocks
  or the dedicated test database (`npm run test:pg`, `PG_TEST_URL`). Run live
  checks only on a staging database the owner explicitly gave you.
- **Do not trigger real side effects**: payments/refunds/payouts, WhatsApp, SMS,
  email, push notifications. Integrations are env-gated and OFF by default; do
  not turn them on, and do not call them from tests.
- Do not touch money logic (payments, wallet, refunds, payouts, commissions,
  settlements, pricing) unless the task is specifically about it. Booking and
  payment state machines and financial invariants are never bypassed, not even
  for `super_admin`.
- Never hard-delete business records or weaken validation to make a test pass.

## Architecture — follow it

- Domain modules live in `src/modules/<name>/` with `application/` (services,
  specs), `domain/` (constants, pure logic), `infrastructure/persistence/`
  (schemas), `presentation/` (controllers + DTOs). Put new code in the right
  layer; do not put business logic in controllers or HTTP concerns in services.
- Modules are deliberately isolated: own collections, own secrets, no reading
  of another domain's money records. Do not add cross-module reads or shortcuts.
- Reuse existing building blocks instead of writing new ones: `audit_logs`,
  `InAppNotificationService`, `TransactionService`, `POST /api/uploads`,
  `common/auth/ashram-scope.ts`, `common/utils/escape-regex.ts`,
  `common/throttling/*`.
- Style: match the surrounding file (double quotes, existing naming, comment
  density). Do not reformat files you only touched in one place.

## Database

- Code uses Mongoose-style schemas but a custom driver maps every model to a
  Postgres table. **Never run raw ad-hoc SQL against the shared DB.**
- Changing a model means: update the schema, then
  `npm run db:generate -- <name>` (writes `database/migrations/NNNN_<name>.sql`),
  review the SQL, `npm run db:migrate`, `npm run db:verify`. The app refuses to
  boot if schema and code disagree, so never edit generated files
  (`registry.generated.ts`, `schema.generated.ts`) by hand.
- Do not edit or reorder an existing migration that has been applied; add a new
  one.
- There are no foreign keys: integrity is enforced in services/transactions.
  Keep it that way and use `TransactionService` for multi-record changes.
- Indexes are not created at runtime. Do not rely on auto-index.
- Do not add a text index for ashram search; substring `$regex` (escaped) is a
  deliberate decision.

## Validation, errors, config

- Global `ValidationPipe` is `whitelist + forbidNonWhitelisted`. New request
  fields need a DTO with decorators, or they are rejected (400).
- Throw Nest exceptions; the global `ApiExceptionFilter` shapes errors. Do not
  leak stack traces, SQL or internal ids in error messages.
- Config comes from `src/config/environment.ts` (validated at boot). Add new env
  vars there **and** to `.env.example` with a safe placeholder, and keep the
  feature OFF by default. Never hard-code secrets or URLs.
- Scripts under `src/scripts/` that create an app context must call
  `applyDnsServersFromEnvironment()` first (a jest guard enforces this).

## Auth & routing

- Global guard order: `JwtAuthGuard` → `RolesGuard` → `PermissionsGuard` →
  `ThrottlerGuard`. A route with **no** `@Roles` is open to **every logged-in
  user, including customers**. Add `@Roles(...)`/`@Permissions(...)` or enforce
  ownership in the service. `@Public()` means the whole internet.
- Do not widen the roles on an existing route. Do not add `@Public()` without
  the owner's approval.
- Sensitive endpoints (login, OTP, password, payments, uploads, public forms)
  need a throttle (`common/throttling`).
- Webhooks: verify the signature on the **raw body** with a timing-safe compare
  and fail closed when the secret is missing.

## Versioning of the API surface

- URI versioning: default is version-neutral; `/api/v1` (smart-contact,
  partners, food) and `/api/v2` (providers/pandit) exist. Do not move
  endpoints between versions.
- Partner API (`/api/v1` with `X-API-Key`): a partner with an empty
  `scopedAshramIds` is **intentionally global** (covered by tests). Do not
  change that default without the owner's decision.

## Testing the backend

- `npm run typecheck` (or `npx tsc --noEmit --incremental false`) must pass.
- `npx eslint` on the files you changed must pass. On this repo a full
  `eslint "src/**/*.ts"` needs a bigger heap:
  `NODE_OPTIONS=--max-old-space-size=6144`.
- Add or update a unit test for behaviour you change, next to the code
  (`*.spec.ts`), mocking repositories. Do not call real services in specs.
- The default `jest` run type-checks every file through ts-jest and is very
  slow on this codebase (a handful of specs can take minutes). It is fine to
  run a targeted set of specs, or to run jest with ts-jest `isolatedModules`
  and `diagnostics: false` since `tsc` already covers types. Say which you ran.
- `*.pg-spec.ts` files need `PG_TEST_URL` (`npm run test:pg`) and are not part
  of the default run.
- Never skip, delete or `xit` a failing test to get green.

## Performance & safety defaults

- No unbounded queries: always paginate/limit lists. Avoid loading whole
  collections into memory; aggregate in the database.
- Escape any user text used in a regex (`escapeRegex`).
- No N+1 loops in request paths when a single query can do it.
- Idempotency: payment/refund/webhook handlers must be safe to run twice.
