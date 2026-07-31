# Serializers

Explicit response shaping for documents that leave the API.

## Purpose

A serializer decides **what a given audience is allowed to see**. Controllers
never hand a Mongoose document straight to `res.json()`; they pass it through a
named view first.

This layer exists because the alternative failed. Before it, user responses were
shaped ad hoc at each call site: eight endpoints returned the raw document
(leaking `passwordHash`, `aadhaarId` and `tokenVersion`), and four more used
partial projections such as `.select('-passwordHash')` that still emitted
`aadhaarId`, `govtId` and `tokenVersion`. Twelve call sites, twelve chances to
forget, and no single place to audit.

### Why not a schema-level transform

Two shortcuts were considered and rejected:

- **`select: false` on the sensitive paths.** Actively unsafe.
  `authMiddleware.protect` revokes sessions by comparing `user.tokenVersion`;
  with the path unloaded the comparison becomes
  `(decoded.tv || 0) !== (undefined || 0)` — always false — silently
  re-validating every revoked token on the platform. `matchPassword` breaks the
  same way without `passwordHash`.

- **A global `toJSON` transform on the User schema.** Safe for authentication,
  but it receives no request context and therefore cannot express *audience*.
  One shape for everyone must be the most restrictive shape, which forces admin
  endpoints to re-add fields ad hoc — the original problem in a new costume. It
  also acts at a distance: reading a controller tells you nothing about what it
  returns, and it silently reshapes debug logging and internal `JSON.stringify`.

Shaping the **response** rather than the **document** keeps authentication
internals fully available to backend logic while giving each audience its own
view.

## Available views — `userSerializer.js`

Ordered narrow to wide. Each extends the previous, so a field cannot reach a
narrower audience than intended.

| View | Audience | Use for |
|---|---|---|
| `publicUser` | Anyone | Review authors, article bylines, an avatar beside a name |
| `selfUser` | The authenticated user, about themselves | `GET /api/auth/me`, own-profile updates |
| `staffUser` | A staff member as seen by their owner or manager | Staff lists and staff management |
| `ownerUser` | An ashram owner as seen by an administrator | Owner directories; adds jurisdiction |
| `adminUser` | Platform / government admin | Account management; adds permissions, suspension and moderation metadata |

Call by name or directly:

```js
import { serializeUser, serializeUsers, adminUser } from '../serializers/userSerializer.js';

res.json({ success: true, data: serializeUser(user, 'self') });
res.json({ success: true, data: serializeUsers(users, 'admin') });
res.json({ success: true, data: adminUser(user) });          // equivalent
```

`serializeUser(user, 'typo')` **throws**. That is deliberate — a typo must never
fall back to the most permissive shape.

### Never serialized, in any view

```
passwordHash · tokenVersion · deviceSessions · resetTokenHash
resetTokenExpiresAt · aadhaarId · govtId · googleId · __v
```

`aadhaarId` and `govtId` are on this list **on evidence**. They are written by
owner registration and admin account creation and read by nothing: the
verification queue verifies *Ashrams*, not Users, and populates `ownerId` with
`'name email phone'` only. If a KYC review screen ever needs them it should get
its own narrow, separately-audited endpoint — not a widening of a general view.

## How to safely add a field

1. **Decide the narrowest audience that genuinely needs it.** Adding to
   `STAFF_FIELDS` also grants it to `ownerUser` and `adminUser` by composition.
2. **Add it to that view's frozen array** in `userSerializer.js`.
3. **Update the exact-shape test** in `tests/userSerializer.test.js`. Those
   tests assert the full key set, so they fail on an unreviewed addition — by
   design. Updating one is how the change gets reviewed.
4. **If it is sensitive, add it to `INTERNAL_ONLY_FIELDS` instead** and do not
   put it in any view.

Because the views are allowlists, a new schema field is invisible by default.
Doing nothing is the safe outcome.

## How to create a new serializer

For a new model, copy the shape of `userSerializer.js`:

1. An `INTERNAL_ONLY_FIELDS` frozen array — everything that must never ship.
2. Frozen field arrays, narrow to wide, each spreading the previous.
3. One exported function per view, plus a `serializeX(doc, view)` dispatcher
   that **throws on an unknown view**.
4. A `serializeMany` array helper.
5. Tests that assert: no view leaks an internal field; no view leaks an internal
   *value* under a different key; each view's key set exactly matches its
   allowlist; and the containment invariants hold.

Add an integration test against a real hydrated document, not just a plain
object — a hydrated Mongoose document carries virtuals, `_doc` and its own
`toJSON`, and a serializer that is correct for a POJO can still leak through one.

## Security guidelines

- **Never bypass the layer.** No `res.json({ data: user })`, no
  `{ ...user.toObject() }`, no hand-rolled `.select('-passwordHash')`. Partial
  projections are exactly how this leak survived twelve call sites.
- **Widen the view, not the call site.** If a view lacks a field you need, add
  it here with a note on why that audience needs it. A one-off exception in a
  controller is invisible to review and to these tests.
- **Prefer narrow, widen on evidence.** Too narrow shows a missing field in the
  UI. Too wide leaks data. Only one of those is recoverable.
- **The field arrays are frozen.** They are security boundaries, and a boundary
  that can be mutated at runtime is not a boundary.
- **For `.populate()` of a user reference**, use the exported
  `PUBLIC_USER_FIELDS` rather than a fresh ad-hoc field list.

## Scope

`userSerializer.js` is not yet adopted by every endpoint. Migration is
deliberately incremental, one controller per pull request:

- **PR-2a** — this infrastructure (no controller changes)
- **PR-2b** — `authController`
- **PR-2c** — `userController`
- **PR-2d** — `genericCrudController`, after a frontend compatibility review

Until a controller is migrated it still returns its previous shape. The
integration suite carries a regression marker asserting the raw document *does*
still leak, so that migration progress cannot be quietly mistaken for completion.
