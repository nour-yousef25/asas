# W02 RLS — Database Tenant Isolation Test Matrix

| ID | الاختبار | الحالة المطلوبة | الحالة الحالية |
|---|---|---|---|
| RLS-I01 | no authenticated tenant principal/mapping | SELECT/INSERT/UPDATE/DELETE deny | NOT CONFIGURED |
| RLS-I02 | tenant principal A against B row | deny/zero rows حسب operation policy | NOT CONFIGURED |
| RLS-I03 | tenant principal B against A row | deny/zero rows حسب operation policy | NOT CONFIGURED |
| RLS-I04 | same transaction A→B switch | `SET ROLE`/GUC/client payload لا تغير `session_user` أو تقرأ B | NOT CONFIGURED; raw-GUC historical proof failed and is rejected |
| RLS-I05 | same transaction B→A switch | deny/no foreign row | NOT CONFIGURED |
| RLS-I06 | connection reuse and reset/discard | لا تسرب identity عبر pool partition | NOT CONFIGURED |
| RLS-I07 | parallel A/B execution | own rows/identities only; no shared mutable tenant state | NOT CONFIGURED |
| RLS-I08 | lease/session/membership/policy/role revocation | no new connection; expired/revoked lease denied | NOT CONFIGURED |
| RLS-I09 | broker/authority/PostgreSQL failure | fail closed with redacted reason/audit | NOT CONFIGURED |
| RLS-I10 | role credential rotation/DR recovery | old access denied; map/leases restored safely | NOT CONFIGURED |
| RLS-I11 | joins and inherited children | لا تسريب B عبر parent/child join | NOT CONFIGURED |
| RLS-I12 | direct Prisma/runtime path | كل path يمر Broker-bound tenant principal | FAIL: direct Prisma inventory مفتوح |
| RLS-I13 | permission boundary | كل route/service يملك permission semantic | FAIL: Budget/Expense permissions غير معرفة |
| RLS-I14 | nullable/unmapped roots | لا policy تخمينية ولا null allow | FAIL للعائلات غير backfilled |
| RLS-I15 | migration rehearsal | clean/upgrade/non-owner tenant principal direct-query | BLOCKED حتى اكتمال prerequisites |
