# W02 RLS — Database Tenant Isolation Test Matrix

| الاختبار | الحالة المطلوبة | الحالة الحالية |
|---|---|---|
| app role without tenant context | SELECT/INSERT/UPDATE/DELETE deny | NOT CONFIGURED |
| app role A against B row | deny/zero rows حسب operation policy | NOT CONFIGURED |
| app role B against A row | deny/zero rows حسب operation policy | NOT CONFIGURED |
| transaction-local context isolation | لا تسرب context عبر transaction/pool | PASS: context لا يتسرب بعد transaction |
| context switch inside one transaction | role التطبيق لا تغير tenant A إلى B | FAIL: app role set_config إلى B ثم قرأت B row |
| joins and inherited children | لا تسريب B عبر parent/child join | NOT CONFIGURED |
| direct Prisma/runtime path | كل path يمر tenant transaction | FAIL: direct Prisma inventory مفتوح |
| permission boundary | كل route/service يملك permission semantic | FAIL: Budget/Expense permissions غير معرفة |
| nullable/unmapped roots | لا policy تخمينية ولا null allow | FAIL للعائلات غير backfilled |
| migration rehearsal | clean/upgrade/app-role direct-query | BLOCKED حتى اكتمال prerequisites |
