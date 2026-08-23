# W02 Broker Test Coverage Fix — Test Matrix

| Test class | Required result |
|---|---|
| B01–B60 coverage | each legal ID occurs exactly once and is `PASS` with required evidence fields |
| B05/B06 | valid tenant A/B has own identity and foreign data remains zero |
| B09 | forged request organization is `DENY:ORGANIZATION_SPOOF` |
| B27 | A lease plus B context is `DENY:LEASE_CONTEXT_MISMATCH` |
| B45 | A/B pool partitions and connection IDs differ |
| B46 | concurrent A/B executions have exact own identities/rows and distinct PostgreSQL PIDs |
| Missing ID | `BLOCKED` |
| Duplicate ID | `BLOCKED` |
| Unregistered/invalid ID | `BLOCKED` |
| No result or incomplete evidence | `BLOCKED` |
| Exception/early stop | `BLOCKED` through absent/failed coverage |
| Expected/actual mismatch or hard failure | `BLOCKED` |

No coverage self-test creates a database. The full Broker run is performed later on one new disposable PostgreSQL audit database, using non-owner and `NOBYPASSRLS` tenant roles only.
