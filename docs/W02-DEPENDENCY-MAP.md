# W02 Dependency Map

| Dependency | Status | Blocks | Resolution authority |
|---|---|---|---|
| canonical Organization tenant | CLOSED | all tenant waves | ADR-W02-001 |
| server-side TenantContext | CLOSED foundation | broker session lookup | WP5-1 contract |
| raw GUC RLS identity | REJECTED | ADR-W02-002 implementation text | successor ADR approval |
| RLS identity contract reconciliation | RESOLVED DESIGN-ONLY | implementation remains blocked by lifecycle/support/family gates | ADR-W02-009 |
| tenant-bound login/broker architecture | ACCEPTED DESIGN-ONLY | all RLS waves | Broker lifecycle/Operations implementation scope |
| Broker B01–B60 audit coverage | COMPLETE AUDIT-ONLY | production Broker lifecycle and RLS Wave 1 remain separately gated | separate Security/Architecture authorization |
| provider role/credential lifecycle | OPEN | Cloud/Dedicated/Self-Hosted rollout | Operations/hosting owner |
| role scale/pooling benchmarks | OPEN | 1,000+ organization rollout | DBA/Operations |
| family ownership/cutover | PARTIAL | wave entry | each WP5 family closure |
| legacy manifest/backfill | CLOSED foundation, family-specific | nullable/unmapped roots | Data owner + WP4 contract |
| Queue/Storage/IAM/Documents | DEFERRED | their own RLS waves | separate authorization |
