# W02 Closure Matrix

| Work package | Requirement | Runtime evidence | Documentation/Git | Status | Residual risk / dependency |
|---|---|---|---|---|---|
| WP0 | architecture gates | documentation scope | committed historical evidence | COMPLETE | later runtime work still required |
| WP1–WP3 | foundation/IAM/instance contracts | prior audit evidence | historical commits | COMPLETE by prior closure | revalidate after dependent changes |
| WP4 | ownership/backfill | clean/upgrade evidence | prior reports | COMPLETE foundation | later family/runtime gates remain |
| WP5-1/2/3 | context/repository/report generation | A/B evidence | prior reports | PARTIAL | export and remaining surfaces deferred |
| Hybrid Identity | tenant-bound PostgreSQL roles | A/B direct identity PASS | `d86cca9` | COMPLETE limited proof | Broker boundary required |
| Broker B16 contract fix | exact cross-organization membership reason | B16 PASS with user A membership in organization B | current B16 evidence | COMPLETE LIMITED | full Broker rerun required |
| Broker Audit Proof | B01–B60 | exact B01–B60 PASS; Coverage Gate, E1–E8, validation, and cleanup PASS | `W02-BROKER-TEST-COVERAGE-RERUN-EVIDENCE.json` | COMPLETE AUDIT-ONLY | production Broker/RLS gates remain separate |
| Broker lifecycle core | tenant principal/lease/revocation/rotation/authority boundary | L01–L10 PostgreSQL runtime PASS; cleanup zero residue | lifecycle design/report/evidence/validator | COMPLETE AUDIT RUNTIME CORE | production provider/HA/scale acceptance remains separate |
| Beneficiary ownership/API | repository, collection/detail dashboard and forged-owner guard | O01–O07 PostgreSQL runtime PASS via Broker-bound tenant Prisma; cleanup zero residue | cutover design/report/evidence/validator | COMPLETE PREREQUISITE | Documents private delivery and RLS policy remain separate |
| Tenant-Bound Runtime Connection Authority | broker-issued Prisma client, session_user, discard and fail-closed fallback gate | A01–A15 PostgreSQL runtime PASS; exact validation and cleanup zero residue | authority design/completion/evidence/validator | COMPLETE AUDIT RUNTIME | production provider/HA/scale acceptance and other repositories remain separate |
| RLS Wave 1 — Beneficiary | Broker lifecycle, authority and Beneficiary ownership/API prerequisites | not run | authority blocker resolved; no policy/migration added | READY TO START — SEPARATE SCOPE | forward-only RLS migration/rehearsal/rollback evidence required |
| RLS Waves | all tenant-owned families | not run | ADR-W02-009 reconciles identity design only; no current migration | NOT STARTED | runtime authority plus family ownership/repository/permission gates remain |
| Queue/Storage/IAM/Documents | tenant isolation | not started | no closure | NOT STARTED | ordered prerequisites |
| W02 Audit Artifact Hygiene | temporary credentials/evidence/cleanup | strict E-HYG-01..04 and artifact scan PASS | report/evidence recorded | COMPLETE — HYGIENE-ONLY | no implementation implied |
| W02 Full Pre-Execution Audit after remediation | Git/decision/Broker/RLS identity/hygiene/production-safety audit | evidence recorded | post-remediation audit report | READY FOR NEXT EXECUTION WAVE — PLANNING ONLY | no implementation implied; global W02 remains open |
| W02 Global Closure | all W02 gates | not available | identity design and artifact hygiene blockers closed in limited scopes; implementation prerequisites remain | NOT READY FOR IMPLEMENTATION | fresh full pre-execution audit must issue READY or BLOCKED |
