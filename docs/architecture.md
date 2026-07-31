# Architecture

Maintained incrementally: sections are added as pull requests touch the areas
they describe. Absence of a section means it has not been documented yet, not
that it does not exist.

---

## User serialization layer

**Added:** PR-2a · **Adopted:** PR-2b (`authController`), PR-2c (`userController`)
**Location:** `backend/src/serializers/`

### Problem

Twelve endpoints returned user data, each shaping the response at the call site.
Eight returned the raw Mongoose document; four used partial projections such as
`.select('-passwordHash')` that still emitted `aadhaarId`, `govtId` and
`tokenVersion`. Twelve places to forget, and no single place to audit.

### Design

Controllers never hand a document to `res.json()`. They pass it through a named
view:

```js
import { serializeUser, serializeUsers } from '../serializers/userSerializer.js';

res.json({ success: true, data: serializeUser(user, 'self') });
res.json({ success: true, data: serializeUsers(users, 'admin') });
```

Five views, ordered narrow to wide, each extending the previous so a field
cannot reach a narrower audience than intended:

| View | Audience |
|---|---|
| `public` | Anyone — bylines, avatars |
| `self` | The authenticated user, about themselves |
| `staff` | A staff member as seen by their owner or manager |
| `owner` | An owner as seen by an administrator |
| `admin` | Account management |

Views are **allowlists**. A field added to the schema tomorrow is invisible
until named, which is the opposite of a denylist such as
`genericCrudController`'s `HIDDEN_ON_READ` — that one omits `deviceSessions`
precisely because denylists fail open.

### Why not a schema-level transform

Two shortcuts were considered and rejected.

**`select: false` on the sensitive paths** is actively unsafe.
`authMiddleware.protect` revokes sessions by comparing `user.tokenVersion`; with
the path unloaded that comparison becomes `(decoded.tv || 0) !== (undefined || 0)`
— always false — silently re-validating every revoked token on the platform.
`matchPassword` breaks the same way without `passwordHash`.

**A global `toJSON` transform** avoids that but receives no request context, so
it cannot express *audience*. One shape for everyone must be the most
restrictive shape, which forces admin endpoints to re-add fields ad hoc — the
original problem in a new costume. It also acts at a distance, silently
reshaping debug logging and internal `JSON.stringify`.

Shaping the **response** rather than the **document** keeps authentication
internals fully available to backend logic while giving each audience its own
view. This is enforced by tests: after serialization, `matchPassword()` still
succeeds and the `protect` revocation comparison still rejects a stale token.

### Invariants (test-enforced)

- No view emits any `INTERNAL_ONLY_FIELDS` key or value.
- `public ⊆ staff ⊆ owner ⊆ admin`, and `admin ⊇ self`.
- Each view's key set exactly matches its declared allowlist — catching
  accidental *hiding* as well as accidental exposure.
- An unknown view name throws rather than defaulting to a permissive shape.
- Both `_id` and `id` are emitted (the frontend reads `_id` on user records; the
  auth session payload has always used `id`).

### Scope

`buildSessionPayload` in `services/authenticationService.js` remains a separate
explicit allowlist — effectively `self` + `token`. It is not migrated because it
carries the session contract; unifying it is a future cleanup, not a security
fix.

The 29 `.populate()` sites for user references all specify field allowlists and
are not part of the migration. `PUBLIC_USER_FIELDS` is exported so they can
converge as they are touched for other reasons.

See [`backend/src/serializers/README.md`](../backend/src/serializers/README.md)
for usage rules and [`ENDPOINT_CONTRACTS.md`](../backend/src/serializers/ENDPOINT_CONTRACTS.md)
for the endpoint → view mapping.

---

## Testing

**Added:** PR-1 · **Extended:** PR-2a, PR-2b, PR-2c

Node's built-in test runner (`node --test`) with `mongodb-memory-server`. No
external test framework, so the only new dependency is a devDependency that
provisions a real MongoDB.

Integration tests run against a **real hydrated Mongoose document**, not a plain
object — a hydrated document carries virtuals, `_doc` and its own `toJSON`, and
a serializer correct for a POJO can still leak through one.

Response-shape **contract tests** pin the exact key set of each migrated
endpoint. Explicit key lists rather than generated snapshots: a snapshot is
regenerated with a flag, and regenerating on red is how an added field slips
through unreviewed.

```
npm test              # full suite
node --test "tests/<file>.test.js"
```
