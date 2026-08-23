# W02 Broker Rerun — Worktree Preservation

## Purpose and Baseline

This record preserves the exact pre-rerun Coverage Fix worktree before a clean rerun branch is created. The preservation baseline is commit `42a1832fab55cd57fcc5d503ce1321deeed0f689` (`test(w02): block broker proof on mandatory coverage`). The preservation branch is `w02-broker-coverage-worktree-preservation`.

The branch was created directly from the dirty worktree without using `stash`, `reset`, `clean`, `restore`, or any destructive operation. No production database, credential, environment, migration, RLS policy, lease contract, or expected Broker result was changed during preservation.

## Pre-Preservation Git Evidence

| Command | Result |
|---|---|
| `git status --short` | five tracked modifications and five untracked paths; no staged changes |
| `git branch --show-current` | `w02-broker-test-coverage-fix` before preservation branch creation |
| `git log --oneline -n 20` | legal baseline headed by `42a1832` |
| `git diff --stat` | 5 tracked files, 139 insertions, 13 deletions |
| `git diff --cached` | empty |
| `git ls-files --others --exclude-standard` | three docs, one coverage-gate library, and one guard script |

The complete command snapshot, including the uncommitted `git diff`, was captured before preservation with SHA-256 `53984008121e3954c4f01fb9a06d378b19ad5b5cf12d939d4821477ab919f5b1`. The same tracked diff is retained losslessly by this preservation commit against its parent; it is therefore reviewable through `git show --stat` and `git diff 42a1832..HEAD` after the commit is created.

### Captured File Inventory

| Path | State before preservation | Classification | Reason and later handling |
|---|---|---|---|
| `scripts/w02-rls-tenant-access-broker-proof.mjs` | modified | KEEP-FOR-RERUN | Adds mandatory-ID coverage mechanics, missing independent B05/B06/B09/B27/B45/B46 assertions, cleanup, and the attempted Evidence Recorder correction. Must be reviewed and selectively ported; the failed full rerun means none of it is accepted as proof. |
| `scripts/lib/w02-broker-coverage-gate.mjs` | new | KEEP-FOR-RERUN | Pure mandatory B01–B60 validator; candidate for reuse after recorder-specific tests are added and reviewed. |
| `scripts/w02-broker-test-coverage-guard.mjs` | new | KEEP-FOR-RERUN | No-database false-green guard; candidate for reuse, not a substitute for PostgreSQL proof. |
| `package.json` | modified | KEEP-FOR-RERUN | Adds explicit commands for the guard and Broker harness only; no dependency or lockfile change. |
| `docs/W02-BROKER-TEST-COVERAGE-FIX-DESIGN.md` | new | KEEP-FOR-RERUN | Describes the coverage-gate design and independent missing IDs. |
| `docs/W02-BROKER-TEST-COVERAGE-FIX-TEST-MATRIX.md` | new | KEEP-FOR-RERUN | Documents the guard and missing-ID matrix. |
| `docs/W02-BROKER-TEST-COVERAGE-FIX-RERUN-BLOCKER.md` | new | HISTORICAL / DO-NOT-MERGE | Records the invalid first rerun and successful cleanup; preserve as history, do not present as a fresh rerun outcome. |
| `docs/W02-BLOCKER-REGISTER.md` | modified | HISTORICAL / DO-NOT-MERGE | Adds the earlier harness-rerun blocker; later branch must update its own current blocker state, not copy history blindly. |
| `docs/W02-CURRENT-STATE.md` | modified | POSSIBLE-LATER | Accurate for the prior failed attempt but branch-specific state must be recreated from new evidence. |
| `todo.md` | modified | POSSIBLE-LATER | Planning entries only; no security proof and no runtime contract. |

No file was classified as unrelated. The source review found no change to a recorded security expected result, Broker membership contract, lease semantics, production credential, package dependency, or lockfile.

## Staged and Unstaged State

Before preservation, the staged diff was empty. All listed tracked changes were unstaged, and all listed new files were untracked. The preservation commit includes them without alteration except for this preservation record.

## Acceptance Boundary

This commit is an archival checkpoint only. It does not claim `PASS_BROKER_AUDIT_PROOF`, does not close `W02-BROKER-COVERAGE`, and does not authorize Broker lifecycle, RLS Wave 1, Queue/Cache, Storage, Users/Memberships, Documents, or W03.

## Final Preservation Hash

The preservation checkpoint is commit `987c05c586c6af3164f2c1a807b7e12f430dd1b6` (`chore(w02): preserve pre-rerun broker coverage worktree`). This follow-up documentation-only commit records that hash without amending or rewriting the preservation history.
