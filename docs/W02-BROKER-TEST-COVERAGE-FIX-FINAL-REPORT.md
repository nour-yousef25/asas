# W02 Broker Test Coverage Fix — Final Report

## Status

**COMPLETE — audit-only Broker coverage fix.** This report closes the false-green coverage defect only. It does **not** close W02 and does not authorize Broker lifecycle, RLS Wave 1, Queue/Cache, Storage, Users/Memberships, Documents, or W03.

| Control | Result |
|---|---|
| Legal baseline | `42a1832` |
| Preservation checkpoint | `987c05c` with hash record `901b993` |
| Clean rerun branch | `w02-broker-test-coverage-rerun-fix` |
| Evidence Recorder self-tests E1–E8 | PASS |
| False-green Coverage Guard | PASS; defective cases are fail-closed |
| Fresh PostgreSQL audit proof | `PASS_BROKER_AUDIT_PROOF` |
| Exact B01–B60 coverage | 60/60, no missing/duplicate/unregistered/invalid/no-result records |
| Cleanup | PASS; no disposable audit database or temporary roles remain |

## Root Cause and Limited Repair

The failed prior rerun expanded the evidence schema and read `out` while serializing evidence after `out` had been declared with block scope inside the `try` block. The resulting `ReferenceError: out is not defined` occurred in the recorder path, before a valid B01–B60 conclusion could be made.

The repair moves command execution, output lifetime, assertion evaluation, metadata derivation, failure serialization, and evidence construction into one dedicated Recorder module. An undefined command output and a `ReferenceError` are now explicit `FAIL` evidence, never a fallback object and never `PASS`. The repair did not change tenant selection, membership validation, lease semantics, PostgreSQL role identity, test IDs, or expected security outcomes.

## Independent Coverage Requirements

| ID | Fresh audit result |
|---|---|
| B05 | PASS: valid A principal returned zero B-owned rows |
| B06 | PASS: valid B principal returned zero A-owned rows |
| B09 | PASS: forged request organization was denied as `ORGANIZATION_SPOOF` |
| B27 | PASS: A lease with B context was denied as `LEASE_CONTEXT_MISMATCH` before B access |
| B45 | PASS: A/B broker pool partitions and connection identities remained distinct |
| B46 | PASS: concurrent A/B PostgreSQL requests returned own rows and distinct identities/PIDs only |

## Evidence and Regression

The complete redacted machine-readable evidence is stored at `docs/W02-BROKER-TEST-COVERAGE-RERUN-EVIDENCE.json`. Its automated validation produced no coverage, hard, security, cleanup, schema, or secret-pattern failure. The retained `notProven` items concern production workload/KMS/HA/deployment boundaries only and do not contain a mandatory Broker proof item.

Prisma validation and generation, TypeScript, Jest, Communications, and production build passed using a temporary local syntactically valid `DATABASE_URL` for command parsing only. The first regression invocation did not start because the inherited `DATABASE_URL` was malformed; no production URL or credential was read, changed, or required. The known Prisma package-configuration deprecation and available-version notices are warnings only.

## Remaining Boundaries

This is evidence for the disposable audit harness, not a production Broker deployment proof. Provider credential lifecycle, role scale/pooling benchmarks, production process isolation, KMS authority ownership, HA/DR, and deployment evidence remain outside this scope. The next scope must be separately authorized; no automated continuation is permitted.
