# Instructions for every AI agent, sub-agent and developer

Before you change anything in this repository, **read the [`memory/`](memory/README.md) folder**.
It holds the mandatory rules for this project. Start with
[`memory/00-golden-rules.md`](memory/00-golden-rules.md).

The short version:

1. **Do exactly what was asked, nothing more.** No extra features, UI, refactors
   or cleanups. Report other issues; do not fix them unasked.
2. **Follow what exists.** Use the global layout, shared stylesheets
   (`shared/*.css`, `frontend/src/styles/dashboard-ui.css`) and shared
   components. **Tables use the shared table UI.** Do not invent styles,
   colours, fonts, shadows or alignment.
3. **Do not break the backend.** Keep API contracts, auth, money and booking
   flows intact. Never test against the live/shared database or trigger real
   payments, WhatsApp, SMS or email.
4. **Never leak data between users.** Scope every query to the caller; public
   responses use an allow-list of fields.
5. **Do not commit, push, deploy or delete** unless explicitly told to. Do not
   touch other people's uncommitted work.
6. **Be honest** about what you verified and what you did not.

Sub-agents: you inherit these rules. Whoever spawns you must pass them on.
