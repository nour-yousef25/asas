# W02 Blocker Register

| ID | Area | Severity | Status | Root cause | Blocks | Next safe scope |
|---|---|---|---|---|---|---|
| W02-RLS-CONTEXT-BINDING | RLS identity | Critical | Superseded by Hybrid proof direction | raw GUC allowed role context switching | raw-GUC RLS design | tenant-bound identity retained |
| W02-RLS-VERIFIER | Context attestation | High | Superseded by Hybrid proof direction | no supported asymmetric verifier adapter | verifier design implementation | hybrid identity retained |
| W02-BROKER-B16 | Broker membership authority | High | RESOLVED LIMITED | B16 fixture lacked an existing user A / organization B membership | Broker rerun required before later W02 phases | rerun B01–B60 from clean audit database |
| W02-BROKER-COVERAGE | Broker security proof | Critical | RESOLVED AUDIT-ONLY | internal PASS did not verify mandatory-ID completeness; rerun now validates exact B01–B60 coverage and cleanup | production Broker/RLS still require their own approved scopes | stop; separate authorization required |
| W02-RLS-IDENTITY-CONTRACT-CONFLICT | RLS identity contract | Critical | RESOLVED DESIGN-ONLY | ADR-W02-009 supersedes raw-GUC identity text with tenant-bound `session_user` plus protected mapping | RLS remains blocked by lifecycle/support/family gates | separately authorized Broker lifecycle and Wave 1 scopes |
| W02-TEMPORARY-AUDIT-CREDENTIAL-ARTIFACT | Audit credential hygiene | High | RESOLVED HYGIENE-ONLY | password-named files were removed after audit-role/database revocation; harnesses no longer write credential setup SQL; strict scan passes | no W02 implementation is implied | fresh full pre-execution audit only |
| W02-RLS-WAVE-1-RUNTIME-AUTHORITY | Beneficiary RLS runtime identity | Critical | RESOLVED AUDIT RUNTIME | Beneficiary repository now requires Broker-bound tenant Prisma; A01–A15 and R01–R15 pass | production activation and other W02 domains remain independently gated | provider/workload identity, DR/HA/scale, then each family scope |
| W02-FINANCIAL-FAMILY-RLS-PREREQUISITES | Financial RLS | Critical | OPEN | F01–F10 وBE01–BE10 أغلقتا runtime العائلات المحددة فقط؛ nullable-root hardening، mixed dashboard ownership aggregation وproduction provider/DR/HA/scale ما زالت غير مثبتة | any Financial RLS migration or activation | close each remaining prerequisite independently; retain session_user-only identity |
| W02-MIXED-DASHBOARD-OWNERSHIP | Mixed dashboard | Critical | BLOCKED FOR CUTOVER | `Member` و`KPI/KPIRecord` بلا organization ownership قانوني؛ الصفحة تجمعها مع عائلات أخرى عبر global Prisma | dashboard tenant-bound cutover وFinancial RLS inclusion | nullable-root ownership/backfill contract ثم repository/runtime proof مستقل؛ لا activeOrganization/default membership inference |

No active blocker may be bypassed by default tenant selection, `organizationMemberships[0]`, a global credential, a role fallback, a changed expected result, or an incomplete proof result.
