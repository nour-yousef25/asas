# W02 RLS Broker B16 Contract Fix — Test Matrix

| ID | Setup | Input | Expected | Failure condition |
|---|---|---|---|---|
| B16 | user A has active membership A→organization A and a separate active membership B→organization B | context user A, organization A, membership B | `DENY:MEMBERSHIP_ORGANIZATION_MISMATCH`; no lease/role/database access | any other reason, lease, tenant role, or database access |

The proof uses a fresh disposable PostgreSQL audit database and non-owner `NOBYPASSRLS` tenant roles. It has no production effect and does not execute any Broker test after B16.
