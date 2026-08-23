# W02 Global Closure — Dependency-Ordered Execution Plan

## Canonical Execution Baseline

The execution baseline began at `4d687c80991f3b2bb9c5a5084cefd864120b7783` on `w02-global-closure-execution`, descended from the post-remediation readiness decision `a61d4bd`. Authority closure is committed at `32f8468`; Beneficiary RLS Wave 1 is committed at `8177a4b`. Historical worktrees remain untouched. No production credential, deployment, data or active temporary audit resource was changed.

## Execution Rule

The W02 Global Closure Directive is authoritative for execution order, subject to ADR-W02-009 and the accepted security invariants. A domain can begin only after its direct dependencies have evidence, cleanup, regression, documentation, and a clean Git milestone. No design-only, audit-only, or hygiene-only result is promoted to runtime or production readiness.

## Ordered Work Packages

| Order | Internal scope | Why it precedes the next scope | Exit gate |
|---:|---|---|---|
| 1 | Broker lifecycle and operations | ADR-W02-009 makes Broker-issued, tenant-bound runtime identity a prerequisite to RLS | **CLOSED AUDIT RUNTIME** — B01–B60, L01–L10 and A01–A15, including lease/rotation/revocation/pooling/failure evidence; production operations remain separate |
| 2 | Ownership and tenant-sensitive path inventory/cutover | RLS cannot safely protect a family while API/repository/dashboard/direct Prisma paths bypass its context | **CLOSED FOR BENEFICIARY ONLY** — O01–O07 and authority-bound repository path; each later family repeats this gate |
| 3 | Beneficiary RLS Wave 1 | Beneficiary is the first direct-owner candidate; documents remain excluded until storage/ownership closure | **CLOSED AUDIT RUNTIME** — R01–R15 migration/rehearsal/Force RLS/direct A-B/concurrency evidence; production/DR remain separate |
| 4 | Financial/Budget and remaining RLS waves | each family has distinct children, nullable roots, and direct runtime paths | per-family ownership/cutover/migration/rehearsal/evidence closure |
| 5 | Queue/Redis/Cache, Storage/Documents, Reports/Exports | these paths have independent runtime authorities and cannot inherit HTTP context implicitly | real runtime namespaces/envelopes/private delivery/negative A-B/retry/cleanup evidence |
| 6 | IAM/Privacy/Vault/Activation/IDP/Observability | policy, classification, secret, audit and service boundaries must be closed around the converted data plane | domain-specific negative/recovery/evidence gates |
| 7 | Global rehearsal and closure | validates interaction of all closed domains | clean/upgrade/rollback/DR-support rehearsals, global regression, security register and closure matrix |

## Scope Boundary Clarification

W02 requires **operational recovery readiness** for the tenant credential/Broker boundary: documented owners, revocation/rotation behavior, failure handling, clean audit recovery evidence, and a bounded DR rehearsal. The W02 Implementation Plan retains full production deployment, full central-license transfer/recovery, and full production DR as non-goals outside W02. No production service is changed by the W02 audit/staging rehearsals.

## Next Executable Scope

`W02-FINANCIAL-FAMILY-OWNERSHIP-AND-RUNTIME-INVENTORY` begins next. It must inventory Budget, Expense and direct financial Prisma/API/page paths, classify nullable roots and child relations, establish server-side TenantContext plus permission semantics, and create family-specific negative repository/API evidence before any financial RLS migration. It must not create an application-wide global credential, a Raw GUC identity path, or infer ownership for unmapped rows.
