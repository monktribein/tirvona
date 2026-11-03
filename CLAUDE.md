# Tirvona — instructions for Claude Code and other agents

**Read [`AGENTS.md`](AGENTS.md) before making any change**, and [`README.md`](README.md) for where
each part of the code lives. The same rules apply to sub-agents you spawn; pass them on.

Non-negotiables:

- Do only what was asked. No extra features, UI, refactors or cleanups.
- UI: follow the global layout and shared UI (shared table UI, shared
  stylesheets, Enterprise* components). Add no new styles.
- Backend: do not change existing APIs, auth, money or booking flows. Never run
  against the live database or real integrations.
- Never leak one user's data to another; scope queries and allow-list responses.
- No commit, push, deploy or deletion unless explicitly asked.
- Report honestly what you verified and what you did not.
