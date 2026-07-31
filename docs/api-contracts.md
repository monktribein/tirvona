# API Contracts

Response conventions and the guarantees callers may rely on. Maintained
incrementally; endpoints appear here as pull requests touch them.

For the endpoint → serializer view mapping, see
[`backend/src/serializers/ENDPOINT_CONTRACTS.md`](../backend/src/serializers/ENDPOINT_CONTRACTS.md)
— that file is the single source of truth for *which* view each endpoint
returns. This document covers the envelope around it.

---

## Response envelope

Every JSON response uses the same outer shape:

```jsonc
{
  "success": true,
  "message": "…",   // present on most mutations, absent on plain reads
  "data": { }       // object, array, or absent
}
```

Errors:

```jsonc
{ "success": false, "message": "…" }
```

`count` accompanies `data` on list endpoints and always equals `data.length`.

**Envelope keys are part of the contract.** The serialization work in PR-2b and
PR-2c changed only what is inside `data`; envelope keys, HTTP status codes and
`message` strings are byte-identical, and contract tests pin all three.

---

## User objects

Since PR-2b/PR-2c, every user object returned by `authController` and
`userController` is produced by an explicit serializer view.

**Guaranteed present on every user object, in every view:**

| Key | Notes |
|---|---|
| `_id` | Mongo ObjectId. The admin and staff tables address records by this. |
| `id` | String form of `_id`. The auth session payload has always used this. |
| `name` | |
| `avatarUrl` | May be `""`. |

Both `_id` and `id` are emitted deliberately: the frontend reads `_id` on user
records and `id` on the session user. Consumers may rely on either.

**Guaranteed absent from every user object, in every view:**

```
passwordHash · tokenVersion · deviceSessions · resetTokenHash
resetTokenExpiresAt · aadhaarId · govtId · googleId · __v
```

Do not build a client feature that depends on any of these. They are excluded by
allowlist and their absence is asserted by tests.

**Not guaranteed:** any field outside a view's declared allowlist. Widening a
view is a reviewed change with a contract-test update; narrowing one is a
breaking change.

---

## Endpoints with non-standard payloads

Two endpoints carry a key alongside `data` rather than inside it. Both are
existing contracts preserved verbatim:

| Endpoint | Extra key | Notes |
|---|---|---|
| `POST /api/users/create-account` | `tempPassword` | Sibling of `data`, read by the admin UI as `res.data.tempPassword`. Plaintext credential — see [security.md](security.md#open-plaintext-temporary-passwords). |
| `POST /api/users/:id/reset-password` | `tempPassword` | Same, and returns no `data`. |

Session endpoints (`POST /api/auth/register`, `POST /api/auth/otp/verify`, and
the login/OTP/Google flows via `buildSessionPayload`) return `token` **inside**
`data`. `AuthContext.persistSession` destructures it off:

```js
const { token: userToken, ...userData } = data;
```

These are deliberately **not** serialized — a view would drop `token` and break
authentication platform-wide.

---

## Pagination

Not yet standardised. `listUsers` caps at 500 records with no `skip`;
`getOwnerStaff`, `listStaff`, `getBookingHistory` and `getDashboardBookings` are
unbounded. Introducing pagination changes `data` from a bare array to a paged
object and is a **breaking change** requiring coordinated frontend work — it is
tracked separately and is not part of the serialization series.
