# 03 — Security & data isolation

Core promise of the platform: **one user's data must never reach another
user.** Treat every endpoint and every query as a potential leak.

## Every endpoint — ask these four questions

1. **Who can call it?** `@Public()`, any logged-in user, or specific roles? A
   route without `@Roles` is open to customers too.
2. **Whose data does it touch?** Is the record filtered by the caller
   (`customerId`/`userId`/ashram scope) in the **query itself**, not just in a
   check after loading?
3. **What does it return?** Only fields the caller is entitled to.
4. **What can a malicious caller change?** Fields they should never set (role,
   status, owner, price, amount, ids).

## Ownership & scoping

- Customer-owned records: always `{ _id: id, customerId: user.id }` (or the
  equivalent) so a guessed id returns "not found", never someone else's record.
- Staff/owner records: scope by ashram/temple using
  `common/auth/ashram-scope.ts` (`resolveAshramScope`, `assertAshramInScope`,
  `ashramScopeFilter`). `null` scope means unrestricted; an empty list means
  nothing. Do not treat empty as "all".
- Default-deny: unknown role ⇒ least access. Never write
  `if (role !== X) return everything`. Write the allowed cases and deny the
  rest.
- `super_admin` bypasses roles, **not** financial or state-machine rules.
- "Global" lists (activity logs, notifications, stats, approvals, audit data)
  must be scoped per caller unless the caller is platform staff.

## Responses

- **Public endpoints return an explicit allow-list of fields**, never the raw
  database document. Never expose: owner/user ids, PAN or tax ids, ID-proof
  numbers, KYC/document URLs, inspection or rejection notes, internal flags,
  bank/payout details, tokens, hashes, OTPs, QR secrets, API keys.
  (Smart-contact `toPublicView` is the model to copy; the ashram public view
  strips private fields through `withoutPrivateAshramFields`.)
- Use `select`/projection or a mapper. Do not `...spread` a lean document into a
  response.
- Never populate a user and return the whole user. Select only what the screen
  needs (name, not email/phone, unless required and authorised).
- Hide secrets on read even for admins (`passwordHash`, `tokenVersion`, reset
  tokens, `googleId`, device sessions, Aadhaar/govt id).

## Input

- Whitelisted DTOs only. Never pass `req.body` straight into a create/update.
- Never let the client set: `role`, `status`, `ownerId`, `customerId`,
  `userId`, `amount`, `price`, `commission`, `isVerified`, `permissions`,
  `tokenVersion`.
- Validate ids (`ObjectId`-shape) before querying.
- Escape user text used in regex. Reject unexpected operators (`$…`) in
  filters.
- Uploads: magic-byte type check, size limit, sanitised folder (see
  `UploadsService`). Do not trust the file name or MIME header.

## Auth, sessions, secrets

- JWT: issuer/audience checked; `tokenVersion` revocation enforced in
  `JwtStrategy`; half-finished OTP tokens (`purpose`) are not sessions — keep
  them rejected everywhere (including sockets).
- OTP and login flows keep their attempt caps and phone/account-keyed
  throttles. Do not remove or loosen them.
- Never log tokens, OTPs, passwords, Authorization headers, or payment payloads.
- Never commit `.env` or real keys; production secrets are `sync: false` in
  `render.yaml`.
- CORS: production allows the listed Tirvona origins only; wildcard
  `localhost:*` is development-only. Do not widen it.

## Frontend side of data isolation

- Per-account caches must be cleared on logout and on account switch.
- Authenticated calls go through `frontend/src/lib/api.ts`.
- Do not render user HTML unsanitised; do not build URLs/redirects from
  unvalidated input (open redirect).

## Known intentional behaviours (do not "fix")

- Unregistered phone numbers are told to sign up on OTP login.
- Partner API with empty `scopedAshramIds` is global by design.
- Default test credentials and `pentest_*` accounts exist in the test
  environment and are left in place by owner decision; do not rotate or purge
  them unless asked. (Revisit before any production promotion.)

## If you find a vulnerability

Do not exploit it, do not publish details in a public place, and do not
silently patch it in an unrelated change. Tell the owner what it is, where, and
how to reproduce it, then fix it in a focused change with a regression test.
