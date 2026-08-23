# W02 Broker Test Coverage Rerun Fix — Design

## Root Cause

The previous rerun added expanded evidence fields outside the `try` block while the command result `out` was declared inside that block. Command execution could finish successfully, but evidence serialization then raised `ReferenceError: out is not defined`. The failure was in recorder serialization, not in PostgreSQL tenant isolation, Broker mapping, membership validation, lease validation, or RLS behavior.

## Correct Data Lifecycle

| Stage | Responsibility | Fail-closed behavior |
|---|---|---|
| Command | execute one test command with a generated correlation ID | thrown command error is retained as evidence input |
| Output | require a defined output | undefined output becomes `EVIDENCE_OUTPUT_UNDEFINED` and `FAIL` |
| Assertion | evaluate output or expected denial | evaluator exception is `FAIL`; a valid expected denial can still be `PASS` |
| Metadata | derive redacted database identity, tenant, org, membership, lease, and role fields | metadata exception is `FAIL` |
| Serialization | build exactly one complete evidence record | recorder faults, including `ReferenceError`, are never converted to PASS |
| Coverage | compare records to B01–B60 exactly | missing/duplicate/unregistered/invalid/no-result/evidence/assertion/cleanup failure blocks PASS |
| Cleanup | persist redacted evidence first, then delete database, roles, temporary credential SQL, and processes | cleanup failure blocks PASS |

## Evidence Recorder Tests

| ID | Condition | Required outcome |
|---|---|---|
| E1 | command success | complete PASS evidence |
| E2 | command failure | complete FAIL evidence |
| E3 | exception before command completes | complete FAIL evidence |
| E4 | command yields undefined output | controlled FAIL, never fallback PASS |
| E5 | internal undefined variable / `ReferenceError` | visible FAIL evidence |
| E6 | required evidence field absent | Coverage Gate blocks |
| E7 | duplicate mandatory ID | Coverage Gate blocks |
| E8 | unregistered ID | Coverage Gate blocks |

The design is intentionally audit-harness-only. It does not introduce a production Broker, alter a tenant authority source, change a lease contract, modify RLS, or alter B01–B60 expected results.
