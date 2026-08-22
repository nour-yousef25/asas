# W02 RLS Hybrid Tenant-Bound Identity Proof — Credential Lifecycle

## Lifecycle

| State | Entry | Allowed behavior | Exit and audit |
|---|---|---|---|
| `PROVISION` | organization accepted by owner workflow | create tenant principal and external credential atomically with role map | activation after mapping/grants checks |
| `ACTIVE` | valid credential and membership/policy | issue only role-bound lease | rotation/revocation/decommission request |
| `ROTATING` | new tenant credential prepared | new credentials accepted after broker cutover; old lease bounded | old secret revoked and existing sessions terminated/expire |
| `REVOKED` | incident, deactivation, membership/policy invalidation | no new connection or lease | recovery requires explicit reprovision |
| `DECOMMISSIONED` | legal/data-retention workflow completed | no runtime login | role/map removal only after retention/backup approval |

## Constraints

Credential plaintext remains only in an external secret authority or audit-only process environment with restrictive local permissions. It is not printed, written to Git, persisted in test evidence, passed in command-line arguments, or placed in schema data. Role credentials are always tenant-specific; a central application runtime must not cache credentials for all organizations.

## Rotation, Recovery, and DR

Rotation requires role-to-organization mapping continuity, new secret activation, old credential revocation, bounded session expiry/termination, and audit linkage without secret material. Restore to a new database instance requires recreating approved roles/maps from controlled metadata, invalidating outstanding leases, and rotating credentials before tenant traffic. A backup does not grant a restored instance trust in a prior active lease.

## Audit-only Proof

The harness may create unique local credentials in process memory and rotate/revoke a test role in a disposable PostgreSQL database. It will show only state/result and redacted role aliases. This does not certify a Production credential authority.
