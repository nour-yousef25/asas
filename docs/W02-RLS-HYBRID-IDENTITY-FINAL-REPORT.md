# W02 RLS Hybrid Tenant-Bound Identity Proof — Final Report

## Scope Completed

This work package created a **disposable PostgreSQL audit proof only**. It designed the role, broker, credential, and secure role-OID mapping contracts; created temporary tenant A/B login principals and a limited RLS fixture; executed direct PostgreSQL negative tests; preserved redacted evidence; and dropped the audit database and roles afterwards.

No ASAS schema, production role, credential, package, extension, deployment, Queue/Redis/Cache, Storage, Users/Memberships, Documents, RLS Wave 1, or W03 work was started.

## Branch and Evidence

| Item | Value |
|---|---|
| Branch | `w02-rls-hybrid-identity-proof` |
| Baseline | `ffad6c187f495ee69453592ccd62f5acbbdba6e0` |
| Audit PostgreSQL | 16.15, temporary database dropped after capture |
| Principal evidence | tenant A/B `LOGIN NOINHERIT NOBYPASSRLS NOCREATEROLE`, non-owner runtime |
| Final database identity result | `PASS_DATABASE_IDENTITY_PROOF_PARTIAL` |
| Raw evidence | `docs/W02-RLS-HYBRID-IDENTITY-EVIDENCE.json` |

## Security Result

The narrow database identity claim is proven in the audit fixture: authenticated role A could not become B, and B could not become A, through direct SQL, `SET ROLE`, `SET SESSION AUTHORIZATION`, raw GUC manipulation, forged organization input, direct foreign-row access, DML, child joins, transaction rollback, connection reset, or concurrent direct connections. RLS used protected `session_user` role-OID mapping and not `current_setting`.

The crucial same-transaction tests T32 and T33 passed. Each transaction attempted peer role/session switching under savepoints, observed PostgreSQL denial, set the opposite raw GUC, and queried the foreign organization; the result was zero rows before rollback. No owner, superuser, or bypass role was used as tenant runtime evidence.

## Decision

> **DATABASE IDENTITY PROOF: PASS (AUDIT FIXTURE).**
> **FULL HYBRID ARCHITECTURE / RLS WAVE 1: BLOCKED.**

The proof validates the proposed database anchor—tenant-bound PostgreSQL login principal plus protected mapping—but cannot validate the overall Hybrid design until an actual Tenant Access Broker and external credential authority are separately implemented and tested. It therefore does not make W02 or RLS complete and does not authorize a RLS Wave 1 migration.

## Remaining Blockers and Safest Remediation

| Blocker | Security impact | Limited next scope |
|---|---|---|
| no Tenant Access Broker runtime | no evidence that a compromised central runtime cannot obtain an arbitrary tenant connection | broker-only audit proof with lease/membership/session/policy checks |
| no broker failure/replay/TTL proof | T23 and lease failures cannot be marked PASS | failure-injection harness with actual broker boundary |
| no provider lifecycle acceptance | credentials/roles may be operationally unsafe at scale | Cloud/Dedicated/Self-Hosted responsibility and benchmark package |
| no stale session/membership/policy proof | authorization state cannot be enforced by this fixture alone | integrate a controlled session/policy authority in audit proof |
| no family migration rehearsal | no production table policy proof | separate RLS Wave 1 request after all gates |

## What Was Not Implemented

This package deliberately did not build a commercial broker, use production credentials, create a persistent role service, enable RLS on ASAS tables, modify Prisma, alter migrations, add extensions, or move on to Queue/Redis/Cache, Storage, IAM, Documents, or a later wave.

## Final Status

> **W02 remains open. RLS Wave 1 is not ready.**

The exact next request should be limited to a **Tenant Access Broker audit proof** that consumes server-side TenantContext, issues tenant-specific connection leases, validates stale/revoked membership/session/policy, and exercises all failure/replay/pooling tests without introducing a global tenant credential runtime.
