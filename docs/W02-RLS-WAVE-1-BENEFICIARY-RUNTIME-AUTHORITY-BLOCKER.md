# RESOLVED GATE — W02 RLS Wave 1 Beneficiary Runtime Authority

## Status

**RESOLVED FOR AUDIT RUNTIME ON 2026-08-23.** The former blocker prevented RLS work because the repository used a process-global `PrismaClient` sourced from `DATABASE_URL`. The constrained Beneficiary data-plane path now requires a Broker-issued, one-time lease and a tenant-bound Prisma client supplied by `TenantConnectionProvider`; it does not default to the global client.

This resolution authorizes **only** the next separate scope, `RLS Wave 1 — Beneficiary`, in an audit/staging rehearsal. It does not represent production provider configuration, production identity rollout, or RLS enablement for any other repository.

## Resolved Root Cause

`TenantBoundPrismaExecutor` issues a fresh lease for each repository operation. `TenantAccessBroker` validates membership, session version, policy version, context fingerprint, active principal mapping and one-time lease state. `TenantBoundPrismaCredentialAuthority` invokes an externally owned provider, passes the resulting Prisma client to the operation only, and discards it in `finally`.

The audit provider maps only opaque credential references held in Broker metadata to memory-only disposable credentials. It verifies the client’s PostgreSQL `session_user` equals the issued tenant principal before exposing the client. No Raw GUC, `current_setting`, `set_config`, request-selected database role, global application credential, owner, superuser, or BYPASSRLS role was used.

## Evidence

| Item | Result |
|---|---|
| A01–A15 tenant runtime authority | PASS on disposable PostgreSQL; exact coverage and independent validation passed. |
| A02/A03 | Prisma query observed A/B tenant login `session_user` internally; redacted evidence records only pass/fail. |
| A04/A05 | Per-operation discard and concurrent A/B client partition passed. |
| A06–A08 | Replay, expiry and revoked leases denied before tenant execution. |
| A09–A13 | Direct repository operation, rotation, provider failure, rollback and restart semantics passed. |
| A14/A15 | Static anti-fallback/GUC gate and non-superuser/non-BYPASSRLS audit-role gate passed. |
| O01–O07 | Beneficiary ownership proof rerun through the authority path; lease consumption recorded and cleanup zero residue. |

## Remaining Boundaries

The implementation deliberately has no production provider factory. A deployment owner must later configure workload identity and a provider appropriate for the selected topology without exposing a universal tenant credential to application code. That operational work remains an independent gate before production activation.

No RLS policy or migration was added by this authority scope. The next scope must create a forward-only Beneficiary RLS migration and prove `session_user` to protected role-to-organization mapping under `FORCE ROW LEVEL SECURITY`, including upgrade/rollback/cleanup and full regression.
