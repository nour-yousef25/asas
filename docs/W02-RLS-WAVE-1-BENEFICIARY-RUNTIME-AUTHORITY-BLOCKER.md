# BLOCKER — W02 RLS Wave 1 Beneficiary Runtime Authority

## Status

**BLOCKED — Critical security prerequisite.** No Beneficiary RLS policy or migration has been introduced.

## Root Cause

The existing application database layer is a process-global `PrismaClient` backed by the process `DATABASE_URL`. The Beneficiary repository correctly scopes its predicates using server-side `TenantContext`, but its database calls still use this global client. The new Broker lifecycle core can issue and validate tenant-bound leases on a disposable audit database, yet its authority interface does not provision a production/runtime tenant-bound Prisma or PostgreSQL connection for application repository operations.

ADR-W02-009 and the RLS design require that RLS derives organization from tenant-bound PostgreSQL `session_user` through protected mapping. Reusing the global `DATABASE_URL`, setting a Raw GUC, choosing a role from request input, or falling back to an owner/superuser/BYPASSRLS client would violate the accepted contract. Therefore RLS-I12 and the non-owner runtime requirement cannot be truthfully proved at this point.

## Evidence

| Item | Finding |
|---|---|
| Broker lifecycle L01–L10 | PASS on disposable PostgreSQL audit runtime; external authority is deliberately ephemeral |
| Beneficiary ownership O01–O06 | PASS using context-scoped repository predicates and a non-owner audit role |
| Application database layer | global Prisma client initialized from `DATABASE_URL` |
| Repository execution path | direct global Prisma calls; no Broker-provided tenant-bound connection factory |
| RLS test matrix | RLS-I12 requires every runtime path to use Broker-bound tenant principal |

## Security Impact

Enabling `ENABLE ROW LEVEL SECURITY` or `FORCE ROW LEVEL SECURITY` now could cause either unavailable application access or a prohibited global/owner fallback. Treating context predicates as equivalent to database identity would create a false-green RLS result. The remaining W02 domains depend on this boundary and cannot begin under the Global Closure Directive.

## Minimal Safe Next Scope

`W02-TENANT-BOUND-RUNTIME-CONNECTION-AUTHORITY` must provide an externally owned, deployment-specific authority that returns only a short-lived tenant-bound connection or client operation to the Broker. It must prove process/workload identity, no durable universal tenant credential in application code/configuration, per-principal pool partition, revocation/rotation behavior, and direct repository operation under non-owner `session_user`. Only then may the Beneficiary RLS migration/rehearsal begin.

No Queue, Storage, Documents, IAM, remaining RLS wave, or W03 scope may substitute for or bypass this boundary.
