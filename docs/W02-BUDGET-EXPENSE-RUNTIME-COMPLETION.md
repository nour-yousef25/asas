# W02 — إغلاق دليل التشغيل لعائلة Budget/Expense

## النتيجة وحدودها

أُغلق نطاق **Budget/BudgetItem/Expense** كدليل تشغيل تدقيقي محلي فقط. استبدل المسار المعرض سابقاً، الذي كان ينشئ `PrismaClient` محلياً ويقبل معرفات parents من العميل بلا ownership verification، بـ`BudgetExpenseRepository` الذي ينفذ عبر `TenantBoundPrismaExecutor` ويقيد كل root وchild إلى `TenantContext.organizationId`. تظل هوية PostgreSQL runtime هي tenant `LOGIN` ثم `session_user` المتحقق منه داخل provider التدقيقي ثم Broker lease. [1] [2]

> لا تضيف هذه النتيجة RLS مالية أو تكمل W02 أو تهيئ provider إنتاجياً. لا يزال dashboard المختلط، وDR/HA/scale، ومتطلبات nullable-root hardening، وFinancial RLS بوابات مستقلة.

| مجموعة الإثبات | النتيجة | الحد المثبت |
|---|---|---|
| BE01 | PASS | repository يستهلك Broker lease ويصل عبر tenant `session_user` فقط. |
| BE02–BE05 | PASS | A/B root وchild isolation، منع BudgetItem وExpense عبر parent أجنبي، وحفظ سلسلة ownership الصحيحة. |
| BE06–BE09 | PASS | replay/revocation/stale-session denial، rotation، outage fail-closed، وعزل parallel clients مع discard. |
| BE10 | PASS | أدوار الدليل non-superuser و`NOBYPASSRLS`، ولا يوجد local/global Prisma أو raw GUC أو `DATABASE_URL` fallback في السطح المحول. |
| المدقق والتنظيف | PASS | BE01–BE10 exact، cleanup residue صفر، hygiene ناجح، وevidence منقحة. |

## التغيير التشغيلي

أضيفت صلاحيات دلالية explicit هي `budget.read/create/update/delete` و`expense.read/create/update/delete`. يظل هذا **default-deny**: تمت إضافتها إلى كتالوج البذر فقط، ولم تُمنح تلقائياً إلى دور قائم. لذلك قد ترفض المسارات في أي نشر ما لم تقم طبقة IAM/التزويد المعتمدة بمنحها صراحةً، وهو سلوك أمني مقصود وليس fallback وظيفياً.

## المخرجات المرجعية

| الأثر | الحالة |
|---|---|
| Repository | `src/lib/budget-expense-repository.ts` |
| Harness | `scripts/w02-budget-expense-runtime-proof.ts` |
| مدقق exact/fail-closed | `scripts/w02-budget-expense-evidence-validate.mjs` |
| evidence | [ملف evidence][1] |
| validation | [ملف validation][2] |

[1]: ./evidence/W02-BUDGET-EXPENSE-RUNTIME-EVIDENCE.json
[2]: ./evidence/W02-BUDGET-EXPENSE-EVIDENCE-VALIDATION.json
