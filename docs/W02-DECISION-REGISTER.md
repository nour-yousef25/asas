# W02 Decision Register

| ID | Decision | Status | Evidence | Required follow-up |
|---|---|---|---|---|
| W02-D-01 | Organization is canonical tenant and TenantContext is server-side | ACCEPTED | ADR-W02-001; WP5-1 | preserve in every remaining wave |
| W02-D-02 | Raw GUC identity is rejected; tenant-bound `session_user` with protected role mapping is the future RLS anchor | ACCEPTED / RECONCILED DESIGN-ONLY | direct A→B failure; ADR-W02-009 | no `current_setting` identity implementation; lifecycle evidence still mandatory |
| W02-D-03 | Hybrid tenant-bound PostgreSQL login identity passed audit proof | VERIFIED LIMITED | `d86cca9` Hybrid evidence | Broker is still required for full architecture |
| W02-D-04 | Broker B16 must prove exact cross-organization membership reason | ACCEPTED / BLOCKED | `af2008a`; Broker B16 blocker | fixture-only B16 fix, no expected-result change |
| W02-D-05 | W02 phases move only after runtime evidence, regression, docs, and Git evidence | ACCEPTED | Full Closure Directive | enforce gate-by-gate |
| W02-D-06 | Broker PASS must include exact mandatory-ID coverage, not only zero recorded failures | ACCEPTED / VERIFIED AUDIT-ONLY | coverage-gap evidence; clean rerun evidence | rejects false-green harness result | no later scope is implied |
| W02-D-07 | RLS identity contract reconciled by ADR-W02-009: tenant-bound login → protected role map → RLS | RESOLVED DESIGN-ONLY | `ADR-W02-009-TENANT-BOUND-RLS-IDENTITY.md` | no RLS identity implementation or wave may start until lifecycle/prerequisites evidence | Broker lifecycle and Wave 1 scope separately authorized |
| W02-D-08 | Audit harnesses must never persist credential-bearing setup SQL; all audit evidence is `0600` and cleanup is fail-closed/idempotent | ACCEPTED / VERIFIED HYGIENE-ONLY | hygiene final evidence; E-HYG-01..04; strict artifact scan | does not authorize runtime security scopes | preserve in every later audit harness |
