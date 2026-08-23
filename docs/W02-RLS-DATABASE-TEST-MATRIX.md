# W02 RLS — Database Tenant Isolation Test Matrix

| ID | الاختبار | الحالة المطلوبة | الحالة الحالية |
|---|---|---|---|
| RLS-I01 | no authenticated tenant principal/mapping | SELECT/INSERT/UPDATE/DELETE deny | PASS — Beneficiary Wave 1, R01 |
| RLS-I02 | tenant principal A against B row | deny/zero rows حسب operation policy | PASS — Beneficiary Wave 1, R02 |
| RLS-I03 | tenant principal B against A row | deny/zero rows حسب operation policy | PASS — Beneficiary Wave 1, R03 |
| RLS-I04 | same transaction A→B switch | `SET ROLE`/GUC/client payload لا تغير `session_user` أو تقرأ B | PASS — Beneficiary Wave 1, R04–R05; raw GUC remains rejected as identity |
| RLS-I05 | same transaction B→A switch | deny/no foreign row | PASS — Beneficiary Wave 1, R05 |
| RLS-I06 | connection reuse and reset/discard | لا تسرب identity عبر pool partition | PASS — Beneficiary Wave 1, R06 |
| RLS-I07 | parallel A/B execution | own rows/identities only; no shared mutable tenant state | PASS — Beneficiary Wave 1, R07 |
| RLS-I08 | lease/session/membership/policy/role revocation | no new connection; expired/revoked lease denied | PASS — Beneficiary Wave 1, R08 |
| RLS-I09 | broker/authority/PostgreSQL failure | fail closed with redacted reason/audit | PASS — Beneficiary Wave 1, R09 |
| RLS-I10 | role credential rotation/DR recovery | old access denied; map/leases restored safely | PARTIAL — rotation PASS in R10; DR/failover rehearsal remains OPEN |
| RLS-I11 | joins and inherited children | لا تسريب B عبر parent/child join | PASS — Beneficiary Wave 1, R11 |
| RLS-I12 | direct Prisma/runtime path | كل path يمر Broker-bound tenant principal | PASS — Beneficiary path only, R12; inventory for other paths remains OPEN |
| RLS-I13 | permission boundary | كل route/service يملك permission semantic | PASS — Beneficiary dashboard only, R13; other families remain OPEN |
| RLS-I14 | nullable/unmapped roots | لا policy تخمينية ولا null allow | PASS — Beneficiary Wave 1, R14; other families remain OPEN |
| RLS-I15 | migration rehearsal | clean/upgrade/non-owner tenant principal direct-query | PASS — Beneficiary Wave 1, R15 |
