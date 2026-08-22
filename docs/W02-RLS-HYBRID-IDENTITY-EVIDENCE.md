# W02 RLS Hybrid Tenant-Bound Identity Proof — Evidence Index

## Environment

| Field | Value |
|---|---|
| Proof database | disposable alias `asas_hybrid_identity_audit_1787433799749_57169`, dropped after evidence capture |
| PostgreSQL | 16.15 local audit server |
| Runtime principals | distinct non-owner login roles for tenant A, tenant B, and unauthenticated client; all `NOBYPASSRLS` |
| Fixture | two Organizations, two rows, two child rows, protected role-OID map |
| Runtime authority excluded | db owner, security owner, migrator, superuser, and `BYPASSRLS` roles |
| Raw evidence | `docs/W02-RLS-HYBRID-IDENTITY-EVIDENCE.json`, no URL/password/secret |

## Actual PostgreSQL Results

| Tests | Result | Evidence interpretation |
|---|---|---|
| T01–T05 | PASS | unauthenticated access denied; each tenant reads its own row; foreign counts are zero |
| T06–T08B | PASS | A→B and B→A `SET ROLE`/`SET SESSION AUTHORIZATION` were denied by PostgreSQL |
| T09–T10 | PASS | each role set the opposite raw GUC yet foreign count remained zero |
| T11–T12 | PASS | forged organization value did not alter `session_user` → mapped organization |
| T32–T33 | PASS | within the same transaction, `SAVEPOINT` isolated denied role/session attempts; opposite GUC then foreign read remained zero before rollback |
| T13–T17 | PASS | foreign update/delete returned zero; insert rejected by RLS; child and join traversal returned zero |
| T18–T20 | PASS | rollback retained role identity; `DISCARD ALL` retained same login principal; eight concurrent A/B direct connections had no cross-talk |
| T21–T22, T24 | PASS | disabled login, expired credential, and invalid credential denied connection |
| T25–T30 | PASS | wrong role selection, provisioning, peer authority, mapping mutation, membership grant, and privileged role creation were denied |
| T31 | PASS | inactive secure role map caused zero tenant rows |

Every result carries timestamp, principal, PostgreSQL backend PID, and transaction metadata where available in the raw JSON. Tests T32/T33 use same-session `BEGIN`, `SAVEPOINT`, denied role/session changes, `ROLLBACK TO SAVEPOINT`, opposite GUC, foreign-row count, and final `ROLLBACK`; `SAVEPOINT` is necessary because PostgreSQL marks a transaction aborted after a statement error.

## Not Proven

| Requirement | Status | Reason |
|---|---|---|
| Broker unavailable (T23) | NOT RUN | no production or audit broker service was built in this scope |
| broker membership/session/policy staleness | NOT RUN | no external issuer/session/policy authority is in the proof |
| broker lease TTL/replay | NOT RUN | broker contract only |
| production credential authority lifecycle | NOT RUN | audit passwords are ephemeral fixture values only |
| provider support/scale at 10–10,000 organizations | NOT MEASURED | requires approved broker/provider benchmark scope |

The PostgreSQL identity boundary is evidenced; the full Hybrid architecture is not yet evidenced.
