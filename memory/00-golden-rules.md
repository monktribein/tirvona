# 00 — Golden rules

These are the guardrails. They override convenience.

## 1. Do exactly what was asked — nothing more

- Make the requested change and only that change.
- **No extra features, no extra UI, no "while I'm here" cleanups, no refactors,
  no renames, no reformatting of lines you did not need to touch.**
- If you notice something else that is wrong or could be better, **report it in
  your summary; do not fix it** unless you were asked to.
- If the request is ambiguous, ask one short question or pick the smallest
  reasonable reading and say which one you picked. Never pick the bigger one.
- Do not add dependencies, config, env vars, scripts, folders or files that the
  task does not strictly need.

## 2. Follow what already exists

- Before writing anything, find the closest existing page/service/component and
  copy its structure, naming, comment style and idiom.
- Reuse shared components, helpers and stylesheets. Do not create a second way
  of doing something that already has a first way.
- The code should look like the same person wrote the whole repo.

## 3. Do not break the flow

- A change must not alter behaviour that was not part of the request: routes,
  redirects, permissions, response shapes, field names, status values, payment
  and booking state machines.
- Existing tests describe intended behaviour. If a test fails after your
  change, **your change is probably wrong**, not the test. Only change a test
  when the requested behaviour itself changed, and say so.
- Prefer additive, reversible changes. Avoid anything that needs a data fix,
  a coordinated deploy, or breaks old app builds.

## 4. Never touch what you were not given

- Do not edit, revert, stash, delete or "tidy" other people's uncommitted work.
  The working tree often contains someone else's in-progress changes. Touch
  only the files your task needs; leave the rest exactly as found.
- Do not run destructive commands (`git reset --hard`, `git checkout -- .`,
  `git clean`, force-push, dropping tables, deleting folders) unless explicitly
  told to, for that exact target.
- Do not run anything against the live/shared database or production services
  to "test". See `02-backend-rules.md`.

## 5. Be honest about the result

- Say what you changed, what you verified and how, and what you did **not**
  verify. "Typecheck passes" is not "I tested it in the browser".
- If something failed or you skipped a step, say so plainly. Never claim a
  check passed that you did not run.
- Do not fabricate data, numbers, statuses, test results or "it works".

## 6. Ask before anything hard to undo or outward-facing

Get explicit permission first for: commits, pushes, PRs, deploys, database
migrations, deleting data or files, sending email/SMS/WhatsApp, calling paid
third-party APIs, changing environment variables or secrets, and changing
anyone's access. Permission for one of these does not carry over to the next.

## 7. Secrets and personal data

- Never commit secrets, tokens, `.env` files, keys, or real customer data.
  `.env.example` holds placeholders only.
- Never paste real user data (names, phones, emails, ID numbers) into code,
  tests, docs, logs, issues or chat.
- Do not print or log tokens, OTPs, passwords or payment details.

## 8. When in doubt, stop

A short question costs minutes. A wrong guess in billing, bookings, auth or
user data can cost users and money. When the blast radius is unclear, stop and
ask.
