# W02 RLS Identity Contract Reconciliation — Final Report

## Status

**COMPLETE — DESIGN-ONLY.** This scope resolves the documentary conflict between M6/ADR-W02-002 and W02-D-02. It does not implement RLS, a Broker lifecycle, PostgreSQL roles, credentials, a KMS/Vault, database extensions, Prisma schema changes, migrations, application runtime, or a new audit database proof.

## Resolution

ADR-W02-009 is the successor identity decision. It preserves phased-family RLS, non-owner runtime, forward-only migrations, and FORCE-after-negative-proof gates from ADR-W02-002, but replaces the Raw GUC identity section.

| Classification | Reconciled requirement |
|---|---|
| Architecture decision | tenant-bound PostgreSQL login `session_user` maps through protected role OID mapping to one organization |
| Implementation requirement | future RLS policies use the protected `session_user` map; no custom GUC identity path |
| Operational requirement | separate Broker workload identity, external per-tenant credential authority, lifecycle owner, support runbook, pool partition, rotation/revocation/DR plan |
| Security invariant | no `current_setting`, `set_config`, client tenant, first membership, global runtime role, HMAC/key surrogate, owner/superuser/`BYPASSRLS`, or bypass path acts as tenant identity |
| Evidence requirement | real PostgreSQL A/B direct SQL, same-transaction A→B/B→A, pool reuse, concurrency, revocation, rotation, failure, migration rehearsal, and cleanup evidence |

## Contract Relationship

```text
server-validated TenantContext
  → Tenant Access Broker validates membership/session/policy
  → tenant-specific bound lease and connection
  → tenant PostgreSQL LOGIN role (`session_user`)
  → protected role-to-organization mapping
  → phased RLS policy
```

Broker B01–B60 remains audit-only evidence for the harness. It does not replace the lifecycle, support, provider, scale, family ownership, repository/API cutover, permission, or Wave 1 evidence required later.

## Support Matrix and Remaining Dependencies

Cloud SaaS, Dedicated, and Self-Hosted remain design-defined but runtime-blocked until their assigned tenant-role owner, credential authority owner, Broker/incident owner, DBA boundary, scale benchmark, and DR rehearsal are evidenced. A deployment without per-tenant credential lifecycle and protected mapping is not eligible for RLS implementation.

## Tests Performed

This scope performed documentation consistency checks only: successor ADR existence, M6/ADR-002 absence of Raw GUC identity language, test matrix IDs RLS-I01–RLS-I15, required A/B/switch/reuse/concurrency evidence clauses, and no runtime file changes. No regression result is treated as RLS evidence.

## Residual Blockers and Next Scope

`W02-TEMPORARY-AUDIT-CREDENTIAL-ARTIFACT` remains active and is the only next authorized remediation scope under the current directive. After it closes, a full pre-execution audit must decide READY or BLOCKED. No implementation scope begins automatically.
