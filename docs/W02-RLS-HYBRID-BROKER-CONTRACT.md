# W02 RLS Hybrid Tenant-Bound Identity Proof — Tenant Access Broker Contract

## Boundary

The Tenant Access Broker is a separate security boundary, not a global data-plane application role. It validates server-side `TenantContext`—user, organization, active membership, session version, policy snapshot, and correlation ID—then selects **only** that organization’s tenant login principal. The application runtime receives an operation/connection bound to that identity; it never receives a universal credential set or authority to name an arbitrary tenant role.

## Contract

| Concern | Requirement |
|---|---|
| Broker identity | separate workload identity; non-login PostgreSQL metadata role is not the broker |
| Credential authority | external deployment-provided secret authority; no secret in Git/DB/report/log |
| Lease | short-lived, tenant-specific, non-transferable; includes tenant role ID, connection ID, expiry, correlation ID |
| Tenant selection | membership/policy/session validation followed by exact organization-to-role mapping |
| Pooling | pool partitioned by authenticated tenant role; no shared cross-tenant session pool |
| Timeout/retry | bounded; every uncertainty is DENY; retry cannot select another tenant or global fallback |
| Revocation | revoke blocks new connection/lease; active lease has bounded expiry and termination procedure |
| Audit | decision/reason/correlation/tenant role ID only; never password or credential material |
| Failure | broker, authority, PostgreSQL, mapping, membership, or policy failure = DENY |

## Proof Scope

This work package does not build a production broker. The audit harness proves the PostgreSQL side with direct tenant login principals and records a broker failure as an inability to acquire a tenant connection, which must fail closed. It cannot prove production credential authority ownership, external session validation, or operational HA; those remain prerequisites.
