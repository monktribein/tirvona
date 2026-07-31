# Endpoint → Serializer Contracts

The authoritative record of which view each endpoint returns, and why. Update it
in the same pull request that changes a mapping — a contract nobody updated is
worse than no contract.

Each row's response shape is pinned by a contract test. Widening a view breaks
the tests of every endpoint using it, which is the intent: a reviewer must see
the delta rather than discover it in production.

See [`README.md`](./README.md) for the views themselves and the rules.

---

## `authController` — migrated (PR-2b)

| Endpoint | Handler | View | Why this view |
|---|---|---|---|
| `GET /api/auth/me` | `getMe` | `self` | Own account. The frontend reads `role`, `name`, `phone`, `email`, `id`; all are present. `district`/`state` are deliberately excluded — declared optional on the frontend `User` interface, verified never read. |
| `PUT /api/auth/me` | `updateMe` | `self` | Same audience as `getMe`; the two must not drift. |
| `GET /api/auth/owner-staff` | `getOwnerStaff` | `staff` (list) | Renders name/email/phone/role/status only. `admin` would work but grants suspension and moderation metadata this screen never shows. |
| `POST /api/auth/owner-staff` | `createOwnerStaff` | `staff` | Echoes back the record just created, same audience as the list above. |
| `PUT /api/auth/owner-staff/:id/status` | `toggleStaffStatus` | `admin` | Account moderation. The caller is the master owner or a super admin acting on suspension state, which is what `admin` carries. |

### Deliberately not serialized

| Endpoint | Handler | Why |
|---|---|---|
| `POST /api/auth/register` | `register` | Carries the session/token contract. `AuthContext.persistSession` destructures `token` off `data`; a view would drop it and break registration platform-wide. Already a safe explicit allowlist. |
| `POST /api/auth/otp/verify` | `verifyOTP` | Same session/token contract. |
| Login / OTP / Google session responses | `buildSessionPayload` (`services/authenticationService.js`) | Already an explicit allowlist — effectively `self` + `token`. Lives in the service layer, outside `authController`. Unifying it with `selfUser` is a worthwhile later cleanup, not a security fix. |

---

## Pending migration

| Controller | Sites | Status |
|---|---|---|
| `userController` | 8 raw-document returns, 2 partial projections | **PR-2c** |
| `admin/shared/genericCrudController` | `users`, `pilgrims`, `owners`, `staff` module keys | **PR-2d**, after a frontend compatibility review. Denylist-based (`HIDDEN_ON_READ`) and not currently leaking, so it carries UI risk without security gain — deliberately excluded from the security PRs. |

Until a controller appears above as migrated it still returns its previous
shape. The integration suite carries a regression marker asserting the raw
document *does* still leak, so partial migration cannot be mistaken for
completion.

---

## Populated user references

29 call sites populate a user reference (`customerId`, `ownerId`, `visitorId`,
`reviewedBy`, …). All specify a field allowlist, so none leaks — but they use
eight different ad-hoc field lists for what is conceptually one "public user
summary".

They are **not** part of the serializer migration: changing them touches fifteen
controllers for zero security gain. `PUBLIC_USER_FIELDS` is exported so they can
converge on one definition as they are touched for other reasons.

---

## Adding an endpoint

1. Pick the **narrowest** view that covers what the consumer actually renders.
   Verify against the frontend rather than assuming.
2. Add a row above, with the reason — not just the view name.
3. Add a contract test pinning the response key set.

If no existing view fits, widen one in `userSerializer.js` and note why that
audience needs the field. Do not shape the response at the call site.
