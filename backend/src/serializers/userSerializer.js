/**
 * @file Explicit response shaping for User documents.
 *
 * ## Why explicit serializers, and not a schema-level transform
 *
 * The obvious alternatives — a `toJSON` transform on the User schema, or
 * `select: false` on the sensitive paths — were both considered and rejected.
 *
 * `select: false` is actively unsafe here. `authMiddleware.protect` revokes
 * sessions by comparing `user.tokenVersion`; if that path were not loaded the
 * comparison becomes `(decoded.tv || 0) !== (undefined || 0)`, which is always
 * false, silently re-validating every revoked token on the platform.
 * `matchPassword` fails the same way without `passwordHash`.
 *
 * A global `toJSON` transform avoids that, but it cannot express *audience*: it
 * receives no request context, so it must apply one shape to everyone. That
 * shape has to be the most restrictive one, which forces admin endpoints to
 * re-add fields ad hoc — the original problem in a new costume. It also acts at
 * a distance: reading a controller tells you nothing about what it returns, and
 * it silently reshapes debug logging and any internal `JSON.stringify`.
 *
 * Shaping the RESPONSE instead of the DOCUMENT keeps authentication internals
 * fully available to backend logic while giving each audience its own view.
 *
 * ## Security principles
 *
 * 1. **Allowlist, never denylist.** A field added to the schema tomorrow is
 *    invisible until someone names it here. Contrast `HIDDEN_ON_READ` in
 *    admin/shared/genericCrudController.js, which omits `deviceSessions`
 *    precisely because denylists fail open.
 * 2. **Least privilege.** Views are ordered narrow to wide and each extends the
 *    previous, so a field cannot reach a narrower audience than intended. The
 *    containment invariants are asserted by tests, not assumed.
 * 3. **Fail loudly.** An unknown view name throws. A typo must never fall back
 *    to the most permissive shape.
 * 4. **Fail in the safe direction.** Choosing too narrow a view shows a missing
 *    field in the UI. Choosing too wide leaks data. Prefer narrow and widen on
 *    evidence.
 *
 * ## Rule: never bypass this layer
 *
 * Do not return a User document — or an array, or a nested user object — from a
 * controller without passing it through a view. Not `res.json({ data: user })`,
 * not `{ ...user.toObject() }`, not a hand-rolled `.select('-passwordHash')`.
 * Partial projections are how this leak survived eight separate call sites:
 * `.select('-passwordHash')` still emits `aadhaarId`, `govtId` and
 * `tokenVersion`.
 *
 * If a view lacks a field you need, widen the view here — with a note on why
 * that audience needs it — rather than working around it at the call site. A
 * one-off exception in a controller is invisible to review and to these tests.
 *
 * For a `.populate()` of a user reference, use {@link PUBLIC_USER_FIELDS}.
 *
 * @see ./README.md for how to add a field or a new view.
 */

/**
 * Fields that must never appear in any response, in any view.
 *
 * `aadhaarId` and `govtId` are on this list on evidence, not by assumption:
 * they are written by owner registration and admin account creation and read by
 * NOTHING. The verification queue verifies Ashrams, not Users, and populates
 * `ownerId` with `'name email phone'` only. If a KYC review screen ever needs
 * them it should get its own narrow, separately-audited endpoint rather than a
 * widening of a general user view.
 */
export const INTERNAL_ONLY_FIELDS = Object.freeze([
  'passwordHash',
  'tokenVersion',
  'deviceSessions',
  'resetTokenHash',
  'resetTokenExpiresAt',
  'aadhaarId',
  'govtId',
  'googleId',
  '__v',
]);

// Both key spellings are emitted on purpose. The frontend reads `_id` on user
// records (UserManagementPage), while the auth session payload has always used
// `id`. Emitting one would break the other.
const identity = (u) => ({ _id: u._id, id: u._id === undefined ? undefined : String(u._id) });

const pick = (u, fields) => {
  const out = identity(u);
  for (const f of fields) out[f] = u[f];
  return out;
};

// ── View field sets ─────────────────────────────────────────────────────────
// Ordered narrow -> wide. Each set extends the previous one, so a field can
// never reach a narrower audience than intended; the tests assert that
// containment holds rather than trusting it.

// Every set is frozen: these are security boundaries, and a boundary that can
// be mutated at runtime is not a boundary. Freezing turns an accidental
// `ADMIN_FIELDS.push('passwordHash')` into a thrown TypeError in strict mode
// rather than a silent, permanent leak. Spreading a frozen array still works,
// so the narrow-to-wide composition below is unaffected.

/** Anyone. Review authors, article bylines, avatars beside a name. */
const PUBLIC_FIELDS = Object.freeze(['name', 'avatarUrl']);

/** A staff member as seen by the owner or manager they report to. */
const STAFF_FIELDS = Object.freeze([
  ...PUBLIC_FIELDS,
  'email', 'phone', 'role', 'status',
  'employeeId', 'designation', 'department',
  'employerAshramId', 'assignedAshram', 'joiningDate',
]);

/** An ashram owner as seen by an administrator. Adds jurisdiction. */
const OWNER_FIELDS = Object.freeze([...STAFF_FIELDS, 'district', 'state', 'isVerified', 'createdAt']);

/** Platform / government admin managing accounts. The widest non-internal view. */
const ADMIN_FIELDS = Object.freeze([
  ...OWNER_FIELDS,
  'username', 'permissions', 'remarks',
  'isSuspended', 'suspensionType', 'suspensionReason',
  'suspendedAt', 'suspensionEndDate', 'visibleMessage', 'internalNotes',
  'reactivatedAt', 'isDeleted', 'deletedAt',
  'gender', 'dob', 'lastLoginAt', 'authProvider',
  'phoneVerifiedAt', 'emailVerifiedAt', 'updatedAt',
]);

/**
 * The authenticated user looking at their own account.
 *
 * Not part of the staff->owner->admin chain: it is a different axis (more
 * personal detail, no operational or moderation metadata). ADMIN_FIELDS is a
 * superset of it, which the tests assert.
 */
const SELF_FIELDS = Object.freeze([
  ...PUBLIC_FIELDS,
  'email', 'phone', 'role', 'status', 'isVerified',
  'authProvider', 'gender', 'dob', 'lastLoginAt', 'createdAt',
]);

// ── Views ───────────────────────────────────────────────────────────────────

export const publicUser = (user) => (user ? pick(user, PUBLIC_FIELDS) : null);
export const selfUser = (user) => (user ? pick(user, SELF_FIELDS) : null);
export const staffUser = (user) => (user ? pick(user, STAFF_FIELDS) : null);
export const ownerUser = (user) => (user ? pick(user, OWNER_FIELDS) : null);
export const adminUser = (user) => (user ? pick(user, ADMIN_FIELDS) : null);

const VIEWS = Object.freeze({
  public: publicUser,
  self: selfUser,
  staff: staffUser,
  owner: ownerUser,
  admin: adminUser,
});

export const USER_VIEWS = Object.freeze(Object.keys(VIEWS));

/**
 * Serialize one user under a named view.
 *
 * Throws on an unknown view rather than falling back to a default. A typo must
 * fail loudly at the call site, not quietly pick the most permissive shape —
 * that failure mode is how this class of leak happens in the first place.
 */
export const serializeUser = (user, view) => {
  const fn = VIEWS[view];
  if (!fn) {
    throw new TypeError(`Unknown user view '${view}'. Expected one of: ${USER_VIEWS.join(', ')}`);
  }
  return fn(user);
};

/** Array helper. Non-array input yields an empty array rather than throwing. */
export const serializeUsers = (users, view) => {
  if (!VIEWS[view]) {
    throw new TypeError(`Unknown user view '${view}'. Expected one of: ${USER_VIEWS.join(', ')}`);
  }
  return Array.isArray(users) ? users.map((u) => serializeUser(u, view)) : [];
};

/**
 * Field list for `.populate('someUserRef', PUBLIC_USER_FIELDS)`.
 *
 * The 29 existing User populates each carry their own ad-hoc field list — eight
 * different spellings of the same idea. They are safe (all are allowlists), so
 * they are deliberately NOT changed here; this export exists so they can
 * converge on one definition as they are touched for other reasons.
 */
export const PUBLIC_USER_FIELDS = PUBLIC_FIELDS.join(' ');

export default Object.freeze({
  serializeUser,
  serializeUsers,
  publicUser,
  selfUser,
  staffUser,
  ownerUser,
  adminUser,
  USER_VIEWS,
  INTERNAL_ONLY_FIELDS,
  PUBLIC_USER_FIELDS,
});
