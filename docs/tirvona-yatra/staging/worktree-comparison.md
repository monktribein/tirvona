# Worktree comparison: `tirvona-yatra` vs `tirvona-main`

Prepared 2026-11-15, read-only. **Nothing was deleted.** Deletion of `D:\desktop\tirvona-main\tirvona-yatra` waits for the owner's approval.

## Branches

| | Main folder | Old worktree |
|---|---|---|
| Path | `D:\desktop\tirvona-main\tirvona-main` | `D:\desktop\tirvona-main\tirvona-yatra` |
| Branch | `fix/booking-payment-gaps` | `feature/yatra` |
| HEAD | `4c3948a` feat(lead-tracking): … | `bc15e57` Merge pull request #138 (= `origin/main`, live) |
| Relationship | — | `feature/yatra` is 8 commits ahead of `4c3948a`. All 8 are GitHub merge commits (#131–#138) whose second parents are already in `4c3948a`'s history. |
| Code difference between the two heads | — | **None:** `git diff 4c3948a bc15e57` is empty (identical trees) |
| Commits only on the worktree branch with code | — | **None** |

## Uncommitted work

| | Main folder | Old worktree |
|---|---|---|
| Contents | Yatra P0–P6 + QA fixes, the booking-payment-gap fixes, the stale-tab 401 fix, the mongoose bump, QA reports | Yatra **P0–P4 only** (the first build, before it was moved into the main folder) |
| Modified tracked files | 40 | 20 |
| Untracked items | migrations 0015/0016 + rollbacks, Yatra modules, docs, payment-gap files | migration 0015 + rollback, `Newbackend/src/modules/yatra/`, `docs/yatra/`, `frontend/src/admin/yatra/`, `frontend/src/modules/yatra/` |

## File-by-file comparison of everything the worktree changed (52 files)

| Result | Files |
|---|---|
| Identical in both | 22 |
| Different (main folder newer) | 30 |
| Present only in the worktree | **0** |

For the 30 differing files, every line that exists only in the worktree was checked. Each one is an **older version that the main folder replaced on purpose**. Examples:

| File | Worktree-only lines | What they are |
|---|---|---|
| `frontend/src/modules/yatra/operator/OperatorSalesPages.tsx` | 35 | The P0–P4 earnings component, replaced by the shared payout view in P5 |
| `Newbackend/src/modules/yatra/application/yatra-insights.service.ts` | 31 | Earnings read from the booking ledger, replaced by the payee ledger in P5 |
| `docs/yatra/README.md` | 18 | The old "P5 not built" status text |
| `yatra-operator.service.ts` | 4 | The pre-fix lines of QA bugs 1–2 (KYC queue) |
| `frontend/src/i18n/resources.ts` | 2 | The pre-fix Hindi "From"/"To" (QA bug 6) |
| `payments.module.ts`, `App.tsx`, `yatra.module.ts`, `yatra.constants.ts` | 1–2 each | Lines extended later (new controllers, routes, payment purposes) |

**Conclusion:**
- The old worktree contains no work that is missing from the main folder.
- Its branch adds no code over the main folder's base.
- Deleting it would lose only an outdated P0–P4 copy, plus its own `node_modules` and `dist` folders (disk space). It has no `.env`.

## Other repository state noticed (not changed)

- `git stash` holds 2 older entries from branch `ashram-lead-ui` ("My local changes before pull", "Changes before pulling main"). They are unrelated to Yatra. Left untouched.
- Local `main` is 52 commits behind `origin/main` (not used by this work).

## If deletion is approved later

This is the safe order:

1. `git worktree remove D:/desktop/tirvona-main/tirvona-yatra`
   - Git refuses while the worktree has changes.
   - The P0–P4 copy is superseded, so the owner may approve `--force`.
2. Optionally, delete the branch with `git branch -D feature/yatra`. It carries no unique code.

**Waiting for owner approval. Not done.**
