# W02 RLS Hybrid Tenant-Bound Identity Proof — Role Contract

## Objective

تكون هوية tenant التي تراها PostgreSQL هي login principal في `session_user`. لا تشتق من request payload أو `current_setting` أو `current_user` القابل للتغيير بـ`SET ROLE`.

## Roles

| Principal | Required attributes | Permitted scope | Explicit prohibitions |
|---|---|---|---|
| `db_owner` | `NOLOGIN` في الإنتاج المقترح | owns tenant data tables | runtime login, proof evidence, `BYPASSRLS` runtime |
| `security_owner` | `NOLOGIN`; owns `security` schema and mapping function | mapping administration only | tenant data DML, application login |
| `migrator` | controlled `LOGIN` outside runtime | approved DDL only | runtime pooling, tenant role membership |
| `tenant_<org>_rw` | `LOGIN NOINHERIT NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION` | own-tenant DML through RLS | DDL, security schema DML, `SET ROLE` to tenant peer |
| `tenant_<org>_ro` | same baseline, `SELECT` only | own-tenant read | writes, peer switching |
| `tenant_data_access` | `NOLOGIN` group; data grants only | inherited object privileges | membership `SET TRUE` for tenant roles |
| audit fixture owner | disposable audit login | create test records only | proof result principal |

`tenant_A_rw` and `tenant_B_rw` never belong to one another. If a shared object-grant group is used, its grants to tenant roles must set `INHERIT TRUE, SET FALSE`; therefore tenants can use data privileges without using `SET ROLE` to alter their identity. PostgreSQL requires a membership chain with SET permission for `SET ROLE`.[1]

## Identity Invariants

1. RLS proof reads `session_user` role OID through a mapping, never `current_setting`.
2. `session_user=tenant_A_rw` maps only to Organization A; `session_user=tenant_B_rw` maps only to B.
3. A non-superuser cannot set session authorization to B.[2]
4. `SET ROLE`, raw GUCs, a forged `organizationId`, or a local transaction rollback cannot change `session_user`.
5. tenant roles cannot `CREATE ROLE`, alter memberships, own data/security objects, or receive `BYPASSRLS`.

## RLS Proof Surface

The audit proof may create only a disposable `proof` schema with `organizations`, `records`, and `record_children`, a protected `security.role_to_organization` map/function, and RLS policies limited to those tables. It is not an ASAS schema migration and does not enable RLS for any production table family.

## References

[1]: https://www.postgresql.org/docs/current/role-membership.html "Role membership and SET option"
[2]: https://www.postgresql.org/docs/current/sql-set-session-authorization.html "Session authorization permission boundary"
