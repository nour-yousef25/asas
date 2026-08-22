# W02 RLS Alternative Architecture — Decision, Security, and Operations Matrices

## Negative Proof Design

| # | Setup | Attack | Expected result | Evidence | Failure interpretation |
|---:|---|---|---|---|---|
| 1 | app connection lacks tenant login | direct SQL | DENY/zero rows | app-role SQL transcript | missing deny is release blocker |
| 2–3 | tenant A/B authenticated roles | read own rows | ALLOW own rows only | A/B fixtures | role-map/RLS mismatch |
| 4–5 | A/B role with foreign row ID | direct SELECT/UPDATE/DELETE | DENY/zero rows | direct SQL | cross-tenant RLS failure |
| 6–7 | A then B / B then A attempted in one XID | `SET ROLE`, GUC, broker API replay | DENY; no foreign row | same-XID transcript | switch boundary failure |
| 8–9 | A connection | forged org ID/client payload | no identity change; DENY foreign row | API + direct SQL | client-controlled authority |
| 10–12 | broker session/membership/policy revoked | request/lease renewal | no tenant login or terminated lease | broker/audit reason | revocation contract failure |
| 13–15 | pooled/reused/rollback/concurrent A/B | reuse and race | no retained cross-tenant visibility | backend IDs + results | pool isolation failure |
| 16–17 | direct tenant SQL/child relation B | bypass route and join child | same RLS isolation | SQL transcript | route-only enforcement |
| 18–20 | invalid/revoked identity or broker initialization failure | connect/lease | fail closed | reason code/audit | insecure availability fallback |

Tests 6 و7 لا تقبل mock أو helper-only evidence؛ تنفذ على PostgreSQL حقيقية بدور tenant login غير مالك وغير `BYPASSRLS`.

## Scale and Pooling Risks

| Scale | Role count baseline | Primary risk | Required evidence before production |
|---:|---:|---|---|
| 10 | 10–20 tenant rw/ro roles | workflow correctness | provisioning/revocation rehearsal |
| 100 | 100–200 roles | secret/role lifecycle | broker batch rotation and monitoring |
| 1,000 | 1,000–2,000 roles | pool fan-out/catalog/operations | connection-budget and catalog benchmark |
| 10,000 | 10,000–20,000 roles | credential distribution, idling pools, restore/failover | load test, supported provider limit and DR rehearsal |

الأرقام تصف عدد principals فقط ولا تثبت performance. يمنع إنشاء idle pool لكل منظمة؛ يستخدم broker pools on-demand ومقسمة حسب authenticated tenant role، ويعيد connection فقط إلى pool الدور نفسه بعد reset/discard. لا يخلط transaction pool بين `session_user` مختلفين.

## Hosting and Responsibility Matrix

| Aspect | Cloud SaaS | Dedicated | Self-Hosted |
|---|---|---|---|
| Tenant roles/mapping | ASAS security operations | ASAS/customer حسب العقد | operator |
| Broker availability and audit | ASAS | contracted owner | operator |
| Credential store | managed provider-neutral secret authority | contract-specific | operator secret authority |
| DB superuser boundary | provider/ASAS controlled | shared responsibility | operator, خارج RLS boundary |
| Backup/restore | restore role map and rotate credentials/leases | rehearsal required | operator rehearsal required |
| DR | new instance identity, revoke old leases, reprovision roles/map | same contract | same contract |

لا يفترض core وجود HSM أو KMS محدد؛ يجب أن يوفر deployment chosen secret authority قادراً على per-tenant credential lifecycle أو يبقى deployment BLOCKED.

## Performance and Migration Strategy

| Area | Risk/assumption | Required measurement or control |
|---|---|---|
| transaction overhead | role identity lookup/RLS per query | query-plan and latency benchmarks per family |
| connection overhead | tenant role authentication/lease | checkout latency, pool saturation, concurrency |
| RLS | policy function and `organizationId` predicates | indexes beginning with `organizationId`, A/B plans |
| provisioning | role/map/credential atomicity | idempotent onboarding and compensating deprovision test |
| rotation/revocation | active sessions may persist | terminate/expire leases, audit and re-auth proof |
| legacy | NULL/unmapped owner roots | existing manifest/backfill contract; no assignment fallback |

## Phased RLS Dependency Map

| Wave | Scope gate | Runtime gate | RLS gate |
|---|---|---|---|
| 0 | successor ADR + broker/role contract approved | no implementation | architecture only |
| 1 | Beneficiary ownership complete | every route/page/job uses tenant-bound connection | A/B direct SQL, migration rehearsal, `FORCE RLS` evidence |
| 2 | Donation/Donor/Campaign/Project complete | no direct global Prisma path | same negative proof plus joins/aggregates |
| 3 | Budget graph + permission contract complete | finance/backfill separation | same proof |
| later | Documents/IAM/communications after ownership and phase contracts | storage/queue/user dependencies closed | separate wave evidence |

No legacy NULL root joins a wave; no family enters before explicit ownership manifest, repository/API cutover, permission contract, app/broker role contract, and negative proof.
