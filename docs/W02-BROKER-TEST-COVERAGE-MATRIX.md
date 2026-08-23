# W02 Broker Test Coverage Matrix

## Mandatory Set

The legal mandatory set is the exact ordered sequence `B01` through `B60`. The rerun evidence validator requires equality of that set and the recorded set, plus one record per ID, `PASS` result, complete evidence fields, `assertionPassed: true`, no hard/security/coverage/cleanup failures, and no mandatory item in `notProven`.

| Coverage measure | Result |
|---|---|
| Mandatory IDs | 60 |
| Executed IDs | 60 |
| Missing IDs | 0 |
| Duplicate IDs | 0 |
| Unregistered / invalid IDs | 0 / 0 |
| Tests without PASS | 0 |
| Missing evidence fields or references | 0 |
| Expected/actual assertion mismatches | 0 |
| Hard/security/coverage/cleanup failures | 0 / 0 / 0 / 0 |

## Independent Previously Omitted IDs

| ID | Independent assertion | Result |
|---|---|---|
| B05 | A lease querying B-owned row set returns zero under A PostgreSQL identity | PASS |
| B06 | B lease querying A-owned row set returns zero under B PostgreSQL identity | PASS |
| B09 | trusted A context plus forged B request organization is denied | PASS |
| B27 | A lease plus B context is denied before B tenant access | PASS |
| B45 | A/B broker pool entries are distinct role and connection partitions | PASS |
| B46 | concurrent A/B executions retain own rows, identities, and distinct backend PIDs | PASS |

## Guard and Recorder Controls

The false-green guard rejects missing, duplicate, unregistered, invalid, no-result, early-stop, hard-failure, expected/actual mismatch, missing-evidence, and cleanup-failure conditions. Recorder self-tests E1–E8 prove complete success evidence, command failure evidence, pre-command exception evidence, undefined-output failure, visible `ReferenceError`, missing field block, duplicate block, and unregistered block.
