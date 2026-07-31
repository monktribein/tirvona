# Changelog

Notable changes to the Tirvona backend. Newest first.

Started during the PR-1 → PR-2 remediation series; entries before that live in
git history only.

## [Unreleased]

### Fixed

- **`genericCrudController` leaked `deviceSessions` and `googleId`** (PR-2d).
  Its `HIDDEN_ON_READ` denylist covered `passwordHash`, `tokenVersion`,
  `aadhaarId` and `govtId` but predated `deviceSessions` and `googleId`, so both
  shipped through every list, create and update on the four User-backed module
  keys. Replaced with a model-keyed serializer registry; the other 28 models
  pass through unchanged. **No serializer bypass remains anywhere in the
  backend.**

- **`userController` returned password hashes on seven endpoints** (PR-2c).
  `suspendUser`, `reactivateUser`, `createAccount`, `changeRole`,
  `updatePermissions`, `softDeleteUser` and `restoreUser` each returned the raw
  Mongoose document, putting the target account's bcrypt hash, Aadhaar number
  and `tokenVersion` on the wire. `listUsers` and `listStaff` used
  `.select('-passwordHash -deviceSessions')`, which still emitted `aadhaarId`,
  `govtId` and `tokenVersion`. All eleven user-returning handlers now go through
  an explicit serializer view.

- **`authController` returned password hashes from `toggleStaffStatus`**
  (PR-2b). `getMe` and `getOwnerStaff` leaked `aadhaarId`, `govtId`,
  `tokenVersion` and `deviceSessions` through partial projections. Five handlers
  migrated to explicit views; `register` and `verifyOTP` left unchanged to
  preserve the session/token contract.

- **`GET /api/auth/me` returned no `id`** (PR-2b). Mongoose omits virtuals from
  `toJSON`, so `user.id` was `undefined` after every page reload while the
  frontend `User` interface declared it. Serialized responses emit both `_id`
  and `id`.

- **Booking creation failed on 100% of requests** (PR-1). `createBooking`
  referenced three identifiers — `bookingId`, `checkInCode`, `roomsCount` — that
  were never bound. ES modules are strict mode, so this threw `ReferenceError`,
  which the handler's own `catch` converted into an opaque 500. The whole
  downstream lifecycle (payment, check-in, check-out, cancellation) was
  unreachable because no booking could exist.

### Added

- **Explicit user serialization layer** (PR-2a) — `src/serializers/`, with five
  allowlist views (`public`, `self`, `staff`, `owner`, `admin`) ordered narrow to
  wide. See [docs/architecture.md](docs/architecture.md#user-serialization-layer).

- **Booking reference generators** (PR-1) — `src/utils/bookingIds.js`.
  `crypto`-backed, time-prefixed to keep the unique index a backstop rather than
  a routine failure path.

- **Test infrastructure** — Node's built-in runner plus `mongodb-memory-server`.
  From zero tests to 78, including integration coverage against a real MongoDB.

### Known issues

- `createAccount` and `resetUserPassword` return a plaintext temporary password
  in the response body. Contract preserved deliberately in PR-2c; see
  [docs/security.md](docs/security.md#open-plaintext-temporary-passwords).
- `admin/shared/genericCrudController` still uses a denylist projection
  (`HIDDEN_ON_READ`). Not currently leaking; scheduled for PR-2d.
