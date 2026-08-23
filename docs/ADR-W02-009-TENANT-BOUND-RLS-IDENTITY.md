# ADR-W02-009 — Tenant-Bound PostgreSQL Identity for Phased RLS

**Gate:** G-W02-2 successor decision.
**Status:** `ACCEPTED — DESIGN-ONLY; NOT IMPLEMENTATION-READY`.
**Supersedes:** the RLS **identity-anchor section only** of ADR-W02-002. Its phased-family, forward-only migration, non-owner runtime, and `FORCE RLS` gating principles remain in force where consistent with this ADR.

## Decision

The database tenant identity anchor is the PostgreSQL authenticated `session_user` of a tenant-bound login principal. A protected `security.role_to_org` mapping, owned outside the tenant data plane, maps that role OID to exactly one organization. RLS policy later reads that protected mapping; it does **not** infer tenant identity from a custom GUC, a client payload, a first membership, a global application role, HMAC, a key stored in PostgreSQL, or an application-selected tenant string.

The approved future relationship is:

```text
server-authenticated TenantContext
  → independent Tenant Access Broker validation
  → short-lived tenant-specific lease/connection
  → tenant-bound PostgreSQL LOGIN principal (`session_user`)
  → protected role-OID-to-organization mapping
  → phased RLS policy
```

This ADR authorizes no production role, credential, Broker deployment, RLS migration, Prisma change, database extension, or audit runtime proof. It resolves the contract language only.

## Security Invariants

| Class | Requirement |
|---|---|
| Identity anchor | `session_user` from the authenticated tenant login principal is the sole database tenant identity anchor. |
| Rejected mechanisms | `current_setting`, `set_config`, client `organizationId`, `organizationMemberships[0]`, default tenant, global app role, HMAC/key surrogate, owner/superuser/`BYPASSRLS`, and policy bypass are never tenant identity. |
| Broker boundary | Broker validates active membership, session version, policy snapshot, exact organization mapping, and correlation ID before selecting one tenant principal. Application runtime receives neither universal credentials nor role-selection authority. |
| Lease | Tenant-specific, non-transferable, connection-bound, correlation-bound, expiring, revocable, and auditable without credential material. |
| Database mapping | Role OID mapping is protected under security ownership; one active tenant role maps to one active organization only. |
| Fail-closed | Broker, authority, PostgreSQL, mapping, membership, session, policy, lease, role-rotation, and pool uncertainty deny access. |
| Pooling | Pools are partitioned by authenticated tenant role. A connection returns only to its own role partition after reset/discard; no transaction/session pool crosses `session_user`. |

## Required Future Lifecycle

| Stage | Design requirement | Evidence requirement before RLS implementation |
|---|---|---|
| Authentication | Broker has distinct workload identity | no universal application credential / authority proof |
| Validation | exact membership, session, and policy versions are checked server-side | stale/revoked membership/session/policy denial |
| Lease | role, organization, connection, expiry and correlation are bound | transfer/replay/expiry/revocation denial |
| Role binding | exactly one protected active role mapping per organization | ambiguous/absent/revoked mapping denial |
| Pooling | per-role partition and reset/discard | reuse, A/B concurrency, stale connection proof |
| Rotation | credential rotation and revocation terminate/expire old access | old credential and old lease denial |
| Failure | bounded retries never choose another role or fallback | broker/authority/PostgreSQL failure denial |
| DR | new instance identity, old lease revocation, role/map reprovisioning | recovery rehearsal and audit evidence |

## Mandatory Evidence Contract Before Wave 1

Future implementation must register independent IDs in the RLS wave matrix for: own A/B access; A→B and B→A direct SQL denial; same-transaction A→B and B→A switch denial; client organization spoof denial; `SET ROLE` and raw-GUC irrelevance; no-context denial; pool reuse; parallel A/B execution; joins/children; writes; rollback; migration rehearsal; role/credential rotation; revocation; and Broker/authority/PostgreSQL failure. These tests require real PostgreSQL tenant login roles that are non-owner and `NOBYPASSRLS`; mocks cannot substitute.

## Support and Responsibility Matrix

| Concern | Cloud SaaS | Dedicated | Self-Hosted | DR requirement |
|---|---|---|---|---|
| Role/mapping lifecycle | ASAS security operations | contract-assigned owner | operator | reprovision protected role map |
| Broker availability/audit | ASAS | contracted owner | operator | revoke old leases; audit recovery |
| Credential authority | provider-neutral managed authority | contract-specific authority | operator authority | rotate/reissue tenant credentials |
| Superuser boundary | provider/ASAS operational boundary | shared responsibility | operator boundary | never RLS evidence |
| Role scale/pooling | benchmark/provider limits required | rehearsal required | operator capacity rehearsal | restore/failover capacity evidence |

A deployment without per-tenant credential lifecycle, protected role mapping, bounded lease revocation, and its assigned support owner remains blocked for RLS implementation.

## Consequences

`W02-D-02` remains binding. Raw GUC code cannot re-enter M6 under any alternative name. RLS Waves remain **NOT STARTED** until Broker lifecycle, credential authority, support/DR ownership, family ownership, repository/API cutover, permissions, clean audit database, and all mandatory negative evidence are independently complete.
