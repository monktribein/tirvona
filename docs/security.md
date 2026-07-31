# Security

Maintained incrementally as pull requests close findings. Sections cover only
areas that have been remediated or explicitly triaged.

---

## Sensitive-field disclosure in user responses

**Status:** closed for `authController` (PR-2b) and `userController` (PR-2c).
Open for `admin/shared/genericCrudController` (PR-2d).

### What was exposed

| Field | Why it matters |
|---|---|
| `passwordHash` | bcrypt hash — enables offline cracking |
| `aadhaarId` | Government ID, stored in plaintext (see below) |
| `govtId.idNumber` | Same |
| `tokenVersion` | Session-revocation counter |
| `deviceSessions[].token` | Session identifiers |
| `googleId` | Stable external identity linkage |

Eight endpoints returned the raw Mongoose document. Four more used
`.select('-passwordHash')` or `.select('-passwordHash -deviceSessions')`, which
reads as protection but never covered `aadhaarId`, `govtId` or `tokenVersion`.

`GET /api/auth/me` returned the caller's own Aadhaar number on every profile
load. The seven `userController` admin endpoints returned *other users'*
credentials and Aadhaar numbers.

### Remediation

An explicit allowlist serializer — see
[architecture.md](architecture.md#user-serialization-layer). Allowlists rather
than denylists, so a sensitive field added later is excluded by default.

### Verification

Integration tests assert that no `INTERNAL_ONLY_FIELDS` **key** and no secret
**value** appears anywhere in a response, at any depth, including every element
of a list — plus a check that no bcrypt-shaped string (`/\$2[aby]\$\d{2}\$/`)
reaches the wire.

### Note on rollback

Reverting the fix does not un-leak. Any hash exposed before remediation should
be treated as compromised; bumping `tokenVersion` forces affected accounts to
re-authenticate.

---

## Aadhaar and government IDs are stored in plaintext

**Status:** open. Partially mitigated.

`aadhaarId` and `govtId.idNumber` are written by owner registration and admin
account creation and stored unencrypted. `src/utils/encryption.js` exists but
has **zero importers** — it is dead code, and its fallback key is hardcoded in
source with a static scrypt salt and an unauthenticated AES-CBC cipher.

**Mitigated by PR-2b/2c** in that these fields no longer leave the API. The data
at rest is still cleartext, readable in any database dump or backup.

**Fix:** AES-256-GCM with a required `ENCRYPTION_KEY`, per-record salt, plus
`select: false` on the paths and a batched, resumable migration. Key escrow is a
prerequisite — losing the key means permanent data loss.

These fields are excluded from every serializer view **on evidence**: they are
written by two flows and read by none. The verification queue verifies Ashrams,
not Users, and populates `ownerId` with `'name email phone'` only. If a KYC
review screen ever needs them it should get its own narrow, separately-audited
endpoint rather than a widening of a general view.

---

## Open: plaintext temporary passwords

**Status:** open. Contract deliberately preserved in PR-2c.

`POST /api/users/create-account` returns `tempPassword` at the top level of the
response, and `POST /api/users/:id/reset-password` returns the generated
password the same way. Both are plaintext credentials in a response body: they
land in proxy logs, browser history and any client-side error reporting.

This is the intended UX — an administrator relays the password to the new user —
so it is not a serialization defect, and changing it was out of scope for a
serialization pull request. A `TODO(security)` marks the site in
`userController.createAccount`.

**Proposed fix:** replace with a one-time activation link (single-use, short
TTL, hashed at rest like the existing password-reset token) or force a
reset-on-first-login. The password-reset flow in `authController` already
implements the correct pattern and can be reused.

---

## Session revocation depends on `tokenVersion` being loaded

**Status:** by design, guarded by tests.

`authMiddleware.protect` rejects a token when `decoded.tv !== user.tokenVersion`.
If `tokenVersion` were ever made `select: false`, or stripped from the document
rather than from the response, that comparison silently becomes
`(decoded.tv || 0) !== (undefined || 0)` — always false — and **every revoked
token on the platform starts working again**.

This is why the serialization layer shapes responses rather than documents, and
why a test asserts the revocation comparison still rejects a stale token after
serialization. Do not "optimise" the `protect` lookup by projecting
`tokenVersion` away.
