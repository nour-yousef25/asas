# BLOCKER — W02 Broker Proof Mandatory Test Coverage

## Root Cause

أعادت harness الحالة الداخلية `PASS_BROKER_AUDIT_PROOF` لأن `hardFailures` تفحص الاختبارات **المسجلة فقط**. تدقيق evidence النهائية مقابل IDs الإلزامية كشف أن ستة اختبارات لا تُنفذ ولا تُسجل: `B05`, `B06`, `B09`, `B27`, `B45`, `B46`.

| Missing ID | Required proof not executed |
|---|---|
| B05 | A cannot read B under complete success group |
| B06 | B cannot read A under complete success group |
| B09 | forged `organizationId` variant specified by matrix |
| B27 | A lease presented with B context / transfer-specific lease proof |
| B45 | pool partitioning demonstration requirement |
| B46 | concurrent A/B request no cross-talk requirement |

Some nearby tests provide related evidence, but the directive requires **every mandatory test ID**. Related evidence cannot substitute for an omitted ID without an approved contract decision.

## Evidence

`W02-RLS-TENANT-ACCESS-BROKER-EVIDENCE-COVERAGE-GAP.json` records 54 IDs, no recorded FAIL, and the internal PASS status. Its recorded-ID inventory excludes B05/B06/B09/B27/B45/B46. The audit database and temporary roles were deleted after evidence capture.

## Security Impact

The internal PASS is a false-green risk: it can be reported while mandatory security coverage is incomplete. No cross-tenant access was observed in the executed tests, but no valid conclusion can be made about full Broker Proof completion or RLS readiness.

## What Was Not Changed

No expected result, test, RLS policy, production schema, migration, package, credential, environment, role, extension, Queue/Cache, Storage, IAM, Documents, or later W02 scope was changed. The harness remains exactly as exercised so the missing coverage remains reproducible.

## Minimal Safe Fix

Create an independent `W02-BROKER-TEST-COVERAGE-FIX` scope that adds each missing ID as a distinct assertion, adds a coverage gate comparing executed IDs with the mandatory matrix, runs the full Broker Proof on a new audit database, and stops on any missing/failed ID. It must not rename existing tests or change expected results to collapse IDs.

## Recommended Next Step

Authorize the minimal coverage-fix scope only. After it passes, rerun B01–B60 from a clean audit environment before considering Broker lifecycle or RLS Wave 1.
