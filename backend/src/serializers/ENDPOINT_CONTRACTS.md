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

## `userController` — migrated (PR-2c)

| Endpoint | Handler | View | Why this view |
|---|---|---|---|
| `GET /api/users` | `listUsers` | `admin` (list) | `UserManagementPage` renders permissions and the full suspension block. |
| `GET /api/users/staff` | `listStaff` | `staff` (list) | `StaffManagementPage` reads only name/email/phone/role/status and the populated `employerAshramId`. Narrowest view that covers it. |
| `POST /api/users/staff` | `createStaff` | `staff` | Echoes the record just created; same audience as the list. `employerAshramId` is preserved because the document carries the value the handler wrote. |
| `PATCH /api/users/:id/status` | `updateUserStatus` | `admin` | Account management. |
| `PATCH /api/users/:id/suspend` | `suspendUser` | `admin` | Returns the suspension block the admin UI reads back. |
| `PATCH /api/users/:id/reactivate` | `reactivateUser` | `admin` | Same. |
| `POST /api/users/create-account` | `createAccount` | `admin` | **`tempPassword` remains a sibling of `data`** — the admin UI reads `res.data.tempPassword`. Unchanged by this migration. |
| `PATCH /api/users/:id/role` | `changeRole` | `admin` | Account management. |
| `PATCH /api/users/:id/permissions` | `updatePermissions` | `admin` | Returns `permissions`. |
| `DELETE /api/users/:id/soft-delete` | `softDeleteUser` | `admin` | Returns `isDeleted`/`deletedAt`. |
| `PATCH /api/users/:id/restore` | `restoreUser` | `admin` | Same. |

### Not serialized (no user document in the response)

`removeStaff`, `resetUserPassword` (returns `tempPassword` only) and
`permanentDeleteUser` return a message, not a user.

---

## `genericCrudController` — migrated (PR-2d)

This controller is model-agnostic: 43 module keys resolve to 29 models at
runtime. Rather than a per-endpoint view, it carries a **`RESPONSE_VIEWS`
registry** keyed by Mongoose model name. A model with no entry is returned
unchanged.

| Module keys | Model | View | Why |
|---|---|---|---|
| `users`, `pilgrims`, `owners`, `staff` | `User` | `admin` | The caller is a Super Admin / Govt Admin / District Officer managing accounts; the console renders permissions and the full suspension block. |
| The other 39 keys | 28 other models | **none — pass through** | Audited: none carries a credential-class field. What they hold is PII (`email`, `phone`, `address`) which is the legitimate content of an admin CRUD screen. |

Applies at all three response sites — list, update and create. Replaced the
`HIDDEN_ON_READ` denylist, which omitted `deviceSessions` and `googleId`
because it predated both fields.

### Adjacent, not addressed here

`Payment.gatewayResponse` (reachable via the `payments` key) stores
`{ razorpay_order_id, razorpay_payment_id, razorpay_signature }`. The signature
cannot be forged without the key secret, but it is gateway internal state with
no UI use. A narrow projection is warranted as its own change — it is not a user
serialization concern.

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
