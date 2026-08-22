# W02 RLS Hybrid Tenant-Bound Identity Proof — Security Mapping Contract

## Mapping

```text
authenticated tenant PostgreSQL login
  → session_user::regrole::oid
  → security.role_organization(role_oid)
  → Organization.id UUID
  → RLS policy comparison to row.organization_id
```

The mapping table is owned by `security_owner` in a dedicated `security` schema. Tenant roles receive no `USAGE`, no table privilege, no DML privilege, and no `CREATE` on that schema. The public schema must not be writable by tenant roles. A security-definer reader is hardened with a fixed `pg_catalog, security` search path, qualified objects, no dynamic SQL, a stable scalar return type, and `EXECUTE` only for the tenant data group. It returns NULL on missing/revoked map; policy treats NULL as deny.

## Security-Definer Conditions

`SECURITY DEFINER` is not sufficient alone. The function owner is a non-login security owner, function search path is fixed, `PUBLIC` execute is revoked, tenant roles cannot create objects in searched schemas, and the function does not accept tenant text or request inputs. It reads `session_user` itself and cannot be called to map a supplied identity.

## Failure Contract

No role map, duplicate role map, disabled/revoked mapping, function error, missing schema privilege, stale lease, or policy uncertainty returns `NULL`/error and therefore denies. There is no `NULL = unrestricted`, legacy organization, first membership, or request organization fallback.
