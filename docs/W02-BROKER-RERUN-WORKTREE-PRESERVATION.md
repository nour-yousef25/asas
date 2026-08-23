# W02 Broker Rerun — Worktree Preservation

The dirty Coverage Fix worktree was preserved before rerun work began. The archival baseline was `42a1832`; the preservation branch is `w02-broker-coverage-worktree-preservation`.

| Preservation item | Commit |
|---|---|
| Complete pre-rerun worktree snapshot | `987c05c586c6af3164f2c1a807b7e12f430dd1b6` |
| Immutable record of preservation hash | `901b993` |

The snapshot retained the prior harness/coverage guard candidate, package scripts, planning, and historical blocker notes without deleting, stashing, resetting, cleaning, or rewriting history. The clean rerun branch was then created directly from `42a1832`; only code classified **KEEP-FOR-RERUN** was selectively moved. Historical failure reports and branch-specific state were not used as new evidence.
