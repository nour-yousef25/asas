# W02 Blocker Register

| ID | Area | Severity | Status | Root cause | Blocks | Next safe scope |
|---|---|---|---|---|---|---|
| W02-RLS-CONTEXT-BINDING | RLS identity | Critical | Superseded by Hybrid proof direction | raw GUC allowed role context switching | raw-GUC RLS design | tenant-bound identity retained |
| W02-RLS-VERIFIER | Context attestation | High | Superseded by Hybrid proof direction | no supported asymmetric verifier adapter | verifier design implementation | hybrid identity retained |
| W02-BROKER-B16 | Broker membership authority | High | RESOLVED LIMITED | B16 fixture lacked an existing user A / organization B membership | Broker rerun required before later W02 phases | rerun B01–B60 from clean audit database |
| W02-BROKER-COVERAGE | Broker security proof | Critical | RESOLVED AUDIT-ONLY | internal PASS did not verify mandatory-ID completeness; rerun now validates exact B01–B60 coverage and cleanup | production Broker/RLS still require their own approved scopes | stop; separate authorization required |

No active blocker may be bypassed by default tenant selection, `organizationMemberships[0]`, a global credential, a role fallback, a changed expected result, or an incomplete proof result.
