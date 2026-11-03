# Instructions for every AI agent, sub-agent and developer

These are the mandatory rules for this project. [`README.md`](README.md) explains where each
part of the code lives.

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

## Production facts that change how you work

- A merge to `main` deploys to the production VPS automatically
  (`.github/workflows/deploy.yml`). That deploy runs `npm run db:migrate` against the
  production database, so every file in `Newbackend/database/migrations/` reaches production with
  the merge. Migrations are additive only (never alter or drop), are generated with
  `npm run db:generate`, and need the owner's approval.
- The API refuses to start when its models and the database tables disagree. Apply a migration
  with, or before, the code that needs it.
- A new environment variable goes into `.env.example` and `src/config/environment.ts`, with a safe
  default that keeps the feature off. Tell the owner to set it on the server.
- A new top-level frontend page must be added to the rewrite lists in `frontend/vercel.json`,
  `render.yaml` and `deploy/nginx/tirvona-web.conf`; `npm run check:routes` fails the build otherwise.
- Never commit `.env` files, keys, tokens, `node_modules`, build output, logs or real customer data.
  `.env.example` holds placeholders only.

## Checks before you say "done"

```bash
# backend (from Newbackend/)
npm run lint && npm run typecheck && npx jest
npm run test:pg            # real Postgres tests on a throwaway embedded database

# frontend (from frontend/)
npx tsc -b && npx oxlint && npm run check:routes && npm run build
```

Put throw-away scripts and their output outside the repository, and delete any temporary file you
created inside it.
