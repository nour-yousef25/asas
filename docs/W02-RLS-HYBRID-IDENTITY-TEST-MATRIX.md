# W02 RLS Hybrid Tenant-Bound Identity Proof — Test Matrix

| ID | Required test | Expected | Evidence status |
|---:|---|---|---|
| 01–05 | no login; A/B own and foreign reads | deny / own allow / foreign deny | PASS |
| 06–10 | A/B `SET ROLE`, `SET SESSION AUTHORIZATION`, raw GUC | role/authorization deny; GUC no effect | PASS |
| 11–17 | forged organization, updates/deletes/inserts, child, join | identity unchanged and foreign actions deny | PASS (T12 added) |
| 18–20 | rollback, connection reuse/reset, concurrent A/B | no retained or cross-tenant context | PASS |
| 21–22, 24 | disabled login, expired credential, invalid credential | deny | PASS |
| 23 | actual broker unavailable | deny | NOT RUN — no broker implementation |
| 25–30 | wrong role, provisioning, membership/mapping/role administration attempts | deny | PASS (T26 added) |
| 31 | revoked protected role map | deny | PASS |
| 32–33 | A→B and B→A in one transaction with savepoints, role/session/GUC attempts | denied attempts and foreign count zero | PASS |

Each final result must include audit database alias, PostgreSQL version, proof principal, expected/actual, backend PID, transaction ID where available, timestamp, and redacted evidence-file path. No item becomes PASS based only on unit tests or helper inspection.
