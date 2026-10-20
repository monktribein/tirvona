# 05 — Change checklist (run this before saying "done")

Copy it into your summary and tick honestly. If an item does not apply, write
"n/a". If you did not do it, write "not done" and why.

## Scope
- [ ] I changed only what the task asked for. No extra features, UI, refactors,
      renames or reformatting.
- [ ] I did not touch files unrelated to the task, and I did not disturb other
      people's uncommitted changes.
- [ ] Anything else I noticed is listed under "Observed, not changed".

## Consistency
- [ ] I copied the closest existing pattern (naming, structure, comments).
- [ ] UI: I used the global layout, shared stylesheets and shared components
      (shared table UI for tables, shared status badge, shared page header).
- [ ] UI: no new colours, fonts, shadows, radii, libraries or one-off CSS.
- [ ] UI: looks right in light and dark, desktop and phone width.

## Behaviour
- [ ] No existing route, redirect, role gate, response shape, field name or
      status value changed unless asked.
- [ ] Backend flows (auth, bookings, payments, refunds, wallet, webhooks,
      notifications) behave as before.
- [ ] Existing tests still pass; I added/updated tests for the behaviour I
      changed.

## Security & data
- [ ] New/changed endpoints: authorised, scoped to the caller in the query,
      response is an allow-list, input is a whitelisted DTO.
- [ ] No secrets, tokens, real user data or `.env` content added anywhere.
- [ ] Nothing was run against live/shared data or real integrations.

## Verification (state what you actually ran)
- [ ] Backend: `npm run typecheck`; eslint on changed files; relevant jest specs.
- [ ] Frontend: `cd frontend && npx tsc -b`; `npx oxlint` (no new warnings in
      files I touched); `npm run check:routes` if I added a page.
- [ ] Manually checked in the browser: ______ (or "not checked in a browser").
- [ ] Temporary files/scripts I created are deleted.

## Delivery
- [ ] I did not commit, push, open a PR or deploy (unless explicitly told to).
- [ ] Migrations / env vars / manual steps the owner must do are listed.

## Summary template

```
Changed:        <files and what, one line each>
Reused:         <shared components/stylesheets/services>
Verified:       <commands run + results>
Not verified:   <anything skipped, honestly>
Observed, not changed: <other issues spotted>
Owner actions:  <migrations, env vars, deploy steps, decisions needed>
```
