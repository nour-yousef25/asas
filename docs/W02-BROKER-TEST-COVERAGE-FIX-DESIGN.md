# W02 Broker Test Coverage Fix — Design

## Scope

This audit-only fix removes the confirmed false-green path in the Tenant Access Broker harness. It adds a static legal list `B01` through `B60`, requires each ID to be registered once with complete evidence, and blocks the final status for missing, duplicate, unregistered, invalid, unresolved, failed, or incomplete-evidence tests.

## Independent Missing Assertions

| ID | Independent proof |
|---|---|
| B05 | valid A lease queries B-owned record; foreign result is zero under A identity |
| B06 | valid B lease queries A-owned record; foreign result is zero under B identity |
| B09 | request-supplied opposite `organizationId` cannot alter trusted A tenant selection |
| B27 | A lease presented with B context is denied before B role/connection/database access |
| B45 | A and B leases resolve to distinct broker pool partitions and connection IDs |
| B46 | parallel A/B broker executions use separate PostgreSQL identities/PIDs and return own rows only |

The assertions preserve existing expected security outcomes and do not merge or rename IDs.

## Coverage Gate

`validateBrokerCoverage()` computes `missingIds`, `duplicateIds`, `unregisteredIds`, `invalidIds`, `testsWithoutResult`, `evidenceMissingFields`, `hardFailures`, and `coverageFailures`. Only empty failure sets result in `PASS_BROKER_AUDIT_PROOF`; otherwise the harness emits `BLOCKED_BROKER_AUDIT_PROOF` and exits non-zero.

## False-Green Guard

The separate no-database self-test exercises complete coverage plus missing test, duplicate ID, unregistered ID, no result, pre-registration exception/early stop, expected/actual mismatch, hard failure, and missing evidence. Every defective case must return `BLOCKED`.
