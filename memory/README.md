# Tirvona — Project Memory & Rules

**Read this folder BEFORE you change anything in this repository.**
This applies to every contributor, without exception: human developers, outside
teams and vendors, AI coding agents, and sub-agents spawned by an agent.
A sub-agent inherits these rules from whoever started it; the starter must pass
them on.

If you only have one minute, read `00-golden-rules.md`. If you are about to
touch the UI read `01-frontend-ui-rules.md`; the backend, `02-backend-rules.md`;
anything that returns user data, `03-security-and-data-isolation.md`.

## Index

| File | Read it when |
|---|---|
| [00-golden-rules.md](00-golden-rules.md) | Always. Scope, honesty, "do only what was asked". |
| [01-frontend-ui-rules.md](01-frontend-ui-rules.md) | Any change under `frontend/`, `SmarID/`, `leadTirvona/`. |
| [02-backend-rules.md](02-backend-rules.md) | Any change under `Newbackend/`. |
| [03-security-and-data-isolation.md](03-security-and-data-isolation.md) | New or changed endpoints, queries, responses, auth. |
| [04-git-and-delivery.md](04-git-and-delivery.md) | Before you commit, push, open a PR or deploy. |
| [05-change-checklist.md](05-change-checklist.md) | Before you say "done". |
| [06-project-map.md](06-project-map.md) | You are new to the repo and need to know where things live. |

## Precedence

1. What the person who asked for the change told you, in this task.
2. These rules.
3. Your own preferences and "improvements".

If (1) conflicts with these rules in a way that could hurt users, data, money or
security, **stop and ask**; do not silently pick a side.

## Keeping these rules alive

- A rule here exists because something went wrong or because the owner decided
  it. Do not delete or weaken a rule to make your change easier.
- To add or change a rule, edit the file in a PR of its own and say why in the
  description.
- Rules describe the repo as it is. If the code changes so a rule becomes
  wrong, fix the rule in the same PR.
