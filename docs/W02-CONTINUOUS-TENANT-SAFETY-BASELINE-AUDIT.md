# W02 Continuous Tenant-Safety — Baseline Audit

**Branch:** `w02-continuous-tenant-safety` from `1e55dd6`.

## Legal Baseline

تم إنشاء worktree نظيف من آخر baseline مرفوع، مع بقاء `w02-wp5` القديم وتغييراته غير المثبتة دون تعديل. المرجع المعماري يؤكد أن `Organization` هو tenant canonical، وأن RLS تدريجي ومقيد بالعائلات التي اكتمل لها ownership وrepository/API cutover.

## RLS Readiness Findings

| الدليل | النتيجة |
|---|---|
| ADR-W02-002 | يتطلب app DB role غير مالك، `set_config(..., true)` transaction-local، fail-closed عند غياب context، ثم FORCE بعد negative proof |
| بحث migrations/source | لا توجد policies أو RLS أو DB roles أو context setter مطبقة حالياً |
| WP5-0 Inventory | ما زالت 27 route ذات Prisma مباشر، مع عائلات API غير محولة |
| WP5-2/WP5-3 | Beneficiary وDonor/Donation/Campaign/Project وBudget/BudgetItem/Expense لديها ownership/repository conversion مثبتة |

## Scope Lock for Phase A

تبدأ Phase A بعائلات مكتملة ownership/cutover فقط: Beneficiary، Financial/Donations، وBudget/Expenses بعد إعادة تدقيق source/schema. لا يجوز تفعيل RLS على كامل schema أو على Users/Memberships/Documents/Storage/Queue tables قبل اكتمال مراحلها وتحقيق عقودها الخاصة.

لا يمثل ذلك إغلاق RLS الشامل: **schema-wide RLS يبقى غير قابل للإعلان** ما دامت العائلات غير المحولة تحتوي routes أو Prisma مباشر غير scoped. إذا أثبت audit للعائلات المستهدفة غياب app-role transaction contract أو ownership/relations اللازمة، تصدر مرحلة A blocker ولا تُنشأ policy تخمينية.

## Immediate Next Action

إكمال inventory ownership وsource audit للعائلات المستهدفة، وتحديد migration/app-role design وruntime A/B direct-query proof قبل أي `CREATE POLICY` أو `FORCE ROW LEVEL SECURITY`.
