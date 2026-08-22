# BLOCKER — W02 Phase A RLS / Database Tenant Isolation

## Root Cause

التفويض يطلب Phase A على جداول العلاقة بالمنظمة، بينما العقود الرسمية تمنع RLS قبل اكتمال repository/API conversion **لكل table family** ووجود application DB role غير مالك وtransaction-local context. المصدر الحالي لا يحقق هذه الشروط: لا RLS أو role أو `set_config` حالياً، وتبقى عائلات runtime غير محولة مع Prisma مباشر، وroots nullable أو بلا ownership مثبتة. Budget/Expense API المعروض لا يملك permission runtime semantic في catalog.

## Evidence

| الدليل | النتيجة |
|---|---|
| `ADR-W02-002-RLS-STRATEGY.md` | يمنع RLS قبل converted family، ويتطلب app role/context/fail-closed/negative proof |
| `W02-IMPLEMENTATION-PLAN.md` | يضع RLS بعد repository/API cutover ويمنع big-bang schema policy |
| `W02-WP5-0-CURRENT-SCOPE-INVENTORY.md` | 27 route Prisma مباشر وعائلات API غير محولة |
| `src/modules/finance/budget.ts`, `expenses.ts`, `src/app/api/finance/*` | clients محلية وCRUD غير authenticated/unscoped |
| `schema.prisma` | Document وأغلب roots الأخرى nullable أو غير مكتملة ownership للعائلات اللاحقة |
| `W02-WP0-PERMISSION-CATALOG.md` | لا `budget.*` أو `expense.*` permission runtime لاستخدام API المالي القائم |
| source scan | لا `CREATE POLICY` أو RLS role أو `set_config/current_setting` في baseline |

## Impact

تفعيل RLS الآن على كل الجداول tenant-owned سيكسر runtime غير المحول أو يفرض اختياراً غير آمن بين owner bypass وglobal/default context. إضافة policies لـBudget/Expense من دون permission contract أو تطبيق `organizationId IS NULL` allow ستتجاوز default-deny وlegacy mapping refusal. لا يمكن إنتاج PostgreSQL A/B evidence صادق لهذه المرحلة قبل حل prerequisites.

## What Remains Unchanged

لم تُنشأ migrations أو database roles أو RLS policies. لم يتغير Prisma runtime أو environment أو credentials أو Production DB أو Redis أو storage. لم يبدأ Queue/Cache أو Storage أو Users/Memberships أو Documents، امتثالاً لترتيب التفويض الذي يمنع الانتقال قبل إغلاق RLS.

## Safe Options

1. اعتماد **RLS Wave 1 scoped**: أولاً تحويل كامل surface لعائلة واحدة ذات permissions مثبتة (مثل Beneficiary أو Donation) إلى tenant transaction context، ثم تنفيذ app role/RLS/force/rehearsal لها فقط، وتكرار waves إلى أن يصبح RLS package كاملاً.
2. اعتماد **permission expansion مصغر ومراجع** لـBudget/Expense ثم تحويل APIs/modules/dashboard الخاصة بها، وبعدها إدخال RLS Budget wave.
3. توسيع نطاق التنفيذ صراحةً إلى repository/API cutover لكل عائلات Organization قبل RLS الشامل، مع phases مستقلة؛ لا يعد ذلك RLS-first بالمعنى الحرفي لكنه يطابق ADR الرسمي.

## Recommended Option

الخيار 1 هو الأدنى خطراً والأكثر اتساقاً مع ADR: ابدأ Donation أو Beneficiary wave ذات policy مثبتة، وأنشئ app role وtransaction guard وRLS evidence حقيقية ثم استمر wave-by-wave. لكن هذا **يغير تعريف إغلاق Phase A** من RLS schema-wide إلى RLS phased rollout؛ يلزم اعتماد معماري صريح لأن التفويض الحالي يطلب RLS كاملاً أولاً ولا يسمح بالانتقال إلى Phase B قبل إغلاقه.
