# W02 RLS Tenant Access Broker Audit Proof — Test Matrix

| Group | IDs | Proof objective | Expected state |
|---|---|---|---|
| Success/A-B | B01–B06 | context A/B exact selection and PostgreSQL data path | own allow; foreign zero |
| Spoofing | B07–B12 | org/role/membership/request mutation cannot select peer | DENY/no effect |
| Membership | B13–B16, B48 | missing/disabled/revoked/mismatched membership | DENY new lease |
| Session/policy | B17–B20, B50 | stale/revoked session and policy | DENY new lease |
| Lease | B21–B27, B51 | tenant/connection binding, expiry, revocation, replay, copied lease | DENY peer/reuse |
| Failure | B28–B35 | broker/authority/PostgreSQL/mapping/timeout/exception failure | DENY; no fallback |
| Credentials | B36–B41, B52–B53 | application exposure absent; A/B auth and rotation | deny wrong/old; exact new only |
| Pooling | B42–B47 | partitioned connection identity, reset, stale pool, concurrency | no cross-talk |
| PostgreSQL identity | B54–B60 | `session_user`, peer switch, GUC, forged org | PASS identity; peer deny |

## Execution Status

| IDs | Status | Evidence |
|---|---|---|
| B01–B15 | PASS | `W02-RLS-TENANT-ACCESS-BROKER-EVIDENCE-FAILED.json` |
| B16 | **FAIL** | actual `DENY:MEMBERSHIP_ABSENT`; expected `DENY:MEMBERSHIP_ORGANIZATION_MISMATCH` |
| B17–B60 | NOT RUN | stop condition after B16 |

كل test يسجل purpose وsetup وcommand وinput class وexpected/actual وdatabase identity وtenant/correlation/timestamp/reason بلا password أو token أو connection string سري.

## Completion Rule

كل IDs أعلاه يجب PASS كي يكون proof `PASS`. إذا فشل test أمني أو احتاج bypass فالنتيجة `BLOCKED` ويكتب blocker؛ لا تعاد صياغة expected result أو تعطيل test.
