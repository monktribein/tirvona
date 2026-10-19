# 04 — Git & delivery

## Do not do unless explicitly told

- Do **not** commit, push, merge, rebase, open or merge a PR, tag, or deploy on
  your own. Make the change in the working tree and report. The owner decides
  when to commit and push.
- Do not switch or create branches. Work on the branch you were given.
- Do not amend, squash, force-push, or rewrite history.
- Do not `git add -A` blindly. The working tree usually holds other people's
  in-progress changes; stage only the files for your task.
- Do not modify `.github/workflows`, `render.yaml`, `vercel.json`, `deploy/`
  or `nginx` config unless the task is about deployment.

## Never commit

`.env`, `.env.*` (except `.env.example`), keys/certs (`*.pem`, `*.key`),
service-account JSON, `node_modules`, `dist`, `coverage`, build output,
logs, temp/scratch files, screenshots with real user data.

## If you are asked to commit

- Small, focused commits: one concern each. Do not mix a bug fix with a
  refactor or a style change.
- Message: `type(scope): what and why`, e.g. `fix(refunds): scope list to owner`.
  Types in use: `feat`, `fix`, `refactor`, `docs`, `chore`, `test`.
- Include only intended files; check `git status` and `git diff --staged` first.
- Never skip hooks or signing (`--no-verify` etc.).
- Do not include secrets, personal data or customer data in messages.
- Follow any attribution lines the tool or team requires.

## PRs

- Describe: what changed, why, how it was verified, what was **not** verified,
  and anything the reviewer must watch (migrations, env vars, role changes).
- A PR with a migration, env var, route or role change says so in the first
  lines.
- Keep PRs reviewable. Unrelated changes go in separate PRs.

## Deploy awareness

- Backend runs on Render (`render.yaml`, health `/api/health`,
  `/api/health/ready` needs DB + Redis); frontend on Vercel, mirrored on Render
  static.
- A new top-level frontend page must be added to `render.yaml` and `vercel.json`
  (the build fails otherwise).
- A DB migration must be applied before or with the code that needs it; the
  backend refuses to boot on a schema mismatch.
- New env var ⇒ add to `.env.example`, `src/config/environment.ts`, and tell the
  owner to set it in Render. Default must be safe/off.

## Environment notes

- Development machines are often Windows (PowerShell/Git Bash). Write portable
  commands and paths; do not hard-code a drive or user path.
- Run backend scripts from `Newbackend/` so `node_modules` resolves.
- Put throw-away scripts and outputs outside the repo (a temp/scratch folder),
  not in `src/`. If you create a temporary file in the repo to test something,
  delete it before you finish.
