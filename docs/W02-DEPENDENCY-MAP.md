# W02 Dependency Map

| Dependency | Status | Blocks | Resolution authority |
|---|---|---|---|
| canonical Organization tenant | CLOSED | all tenant waves | ADR-W02-001 |
| server-side TenantContext | CLOSED foundation | broker session lookup | WP5-1 contract |
| raw GUC RLS identity | REJECTED | ADR-W02-002 implementation text | successor ADR approval |
| RLS identity contract reconciliation | RESOLVED DESIGN-ONLY | implementation remains blocked by lifecycle/support/family gates | ADR-W02-009 |
| tenant-bound login/broker architecture | COMPLETE AUDIT RUNTIME CORE | all RLS waves still require family cutover and production operations acceptance | L01–L10 proof; external authority boundary |
| Broker B01–B60 audit coverage | COMPLETE AUDIT-ONLY | production Broker lifecycle and RLS Wave 1 remain separately gated | separate Security/Architecture authorization |
| audit credential artifact hygiene | RESOLVED HYGIENE-ONLY | full pre-execution integrity scan | E-HYG-01..04 and strict redacted scan |
| provider role/credential lifecycle | OPEN | Cloud/Dedicated/Self-Hosted rollout | Operations/hosting owner |
| role scale/pooling benchmarks | OPEN | 1,000+ organization rollout | DBA/Operations |
| Beneficiary ownership/cutover | COMPLETE PREREQUISITE | Beneficiary RLS Wave 1 only | O01–O06 proof; Documents delivery excluded |
| tenant-bound runtime connection authority | RESOLVED FOR AUDIT RUNTIME | opens Beneficiary RLS Wave 1 only | A01–A15 PostgreSQL proof; production provider/workload identity remains OPEN |
| Beneficiary RLS Wave 1 | COMPLETE AUDIT RUNTIME | later family waves retain independent gates | R01–R15 PostgreSQL proof; production provider/DR/scale remain OPEN |
| Financial Donor/Donation runtime | COMPLETE LIMITED AUDIT RUNTIME | Financial RLS remains prohibited | F01–F10 tenant LOGIN/session_user/Broker/Prisma proof; no production provider, RLS policy or nullable-root backfill |
| Financial Budget/Expense runtime | COMPLETE LIMITED AUDIT RUNTIME | Financial RLS remains prohibited | BE01–BE10 tenant LOGIN/session_user/Broker/Prisma proof; no production provider, RLS policy or nullable-root hardening |
| Mixed dashboard ownership aggregation | BLOCKED FOR CUTOVER | Financial RLS is prohibited | `Member` و`KPI/KPIRecord` يفتقدان legal organization owner؛ يلزم nullable-root ownership/backfill قبل tenant-bound aggregation proof |
| Nullable-root and operational readiness | OPEN | Financial RLS is prohibited | hardening/backfill compatibility plus provider DR/HA/scale evidence required |
| remaining family ownership/cutover | PARTIAL | later RLS waves | each WP5 family closure |
| legacy manifest/backfill | CLOSED foundation, family-specific | nullable/unmapped roots | Data owner + WP4 contract |
| Queue/Storage/IAM/Documents | DEFERRED | their own RLS waves | separate authorization |
