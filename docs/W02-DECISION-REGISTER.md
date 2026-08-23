# W02 Decision Register

| ID | Decision | Status | Evidence | Required follow-up |
|---|---|---|---|---|
| W02-D-01 | Organization is canonical tenant and TenantContext is server-side | ACCEPTED | ADR-W02-001; WP5-1 | preserve in every remaining wave |
| W02-D-02 | Raw GUC identity is rejected | ACCEPTED | direct A→B failure; RLS alternative decision | no current_setting identity implementation |
| W02-D-03 | Hybrid tenant-bound PostgreSQL login identity passed audit proof | VERIFIED LIMITED | `d86cca9` Hybrid evidence | Broker is still required for full architecture |
| W02-D-04 | Broker B16 must prove exact cross-organization membership reason | ACCEPTED / BLOCKED | `af2008a`; Broker B16 blocker | fixture-only B16 fix, no expected-result change |
| W02-D-05 | W02 phases move only after runtime evidence, regression, docs, and Git evidence | ACCEPTED | Full Closure Directive | enforce gate-by-gate |
| W02-D-06 | Broker PASS must include exact mandatory-ID coverage, not only zero recorded failures | ACCEPTED / VERIFIED AUDIT-ONLY | coverage-gap evidence; clean rerun evidence | rejects false-green harness result | no later scope is implied |
| W02-D-07 | RLS identity contract must be reconciled before implementation because M6 raw-GUC text conflicts with accepted D-02 rejection | BLOCKED — NO INFERENCE | `W02-FULL-CONTINUOUS-CONTRACT-CONFLICT-BLOCKER.md` | no RLS identity implementation or wave may start | explicit Architecture/Security decision required |
