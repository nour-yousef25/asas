# W02 Broker Lifecycle and Operational Readiness — Design

## Security Boundary

`TenantAccessBroker` is an application security boundary that accepts only a server-resolved context containing user, organization, membership, session version, policy snapshot version, and correlation ID. It reads one active `TenantDatabasePrincipal` for the exact organization, issues a single-use, correlation-bound lease, and calls a deployment-provided credential authority only after every check succeeds. The returned descriptor contains no credential reference, password, connection URL, or arbitrary role selector.

The external authority interface is intentionally narrow: it receives the selected credential reference and principal name from the Broker, invokes a tenant-specific operation, and cannot be asked by the caller to select a different principal. Any authority, mapping, PostgreSQL, membership, policy, session, lease, or operation uncertainty becomes a deny record with a redacted reason code.

## Lifecycle Metadata

The forward-only migration `20260823070000_w02_broker_lifecycle_expand` adds credential-free metadata only. `TenantDatabasePrincipal` keeps a tenant role name, opaque external credential reference, generation, status, and revocation time. PostgreSQL enforces at most one **ACTIVE** principal per organization through a partial unique index, preserving a history of revoked generations for rotation. `TenantAccessLease` records a short-lived one-time connection binding and a fingerprint of the validated context; `TenantBrokerAuditEvent` records only decision metadata.

## Enforced Invariants

| Invariant | Enforcement |
|---|---|
| No global database credential | no credential column or configuration is exposed from the Broker descriptor |
| Exact tenant mapping | one active principal per organization; absent or revoked mapping denies |
| Context binding | lease fingerprint binds user, organization, membership, session version and policy snapshot |
| Replay resistance | successful execution atomically changes lease to `CONSUMED` |
| Revocation | principal revocation revokes every active lease and blocks future issuance |
| Pool partition | every descriptor receives a unique connection ID and principal-specific authority operation |
| Audit hygiene | only identifiers, correlation, decision and reason code are stored; evidence is 0600 |

## Operational Boundary

The runtime rehearsal proves this lifecycle in a disposable PostgreSQL database with non-owner application and tenant login roles. It does **not** claim a production secret provider, workload identity issuer, HA topology, scale benchmark, or deployment-specific operator acceptance. Those are release/hosting responsibilities that remain explicit before production rollout.
