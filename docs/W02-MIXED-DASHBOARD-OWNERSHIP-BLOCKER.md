# W02 — Mixed Dashboard Ownership Blocker

## القرار

**الحالة: BLOCKED FOR TENANT-BOUND CUTOVER.** لا يجوز تحويل `src/app/(dashboard)/page.tsx` أو إدخاله في أي Financial RLS Wave الآن. الصفحة تقرأ حالياً من Prisma عالمي وتجمع عائلات متعددة، منها Donation وProject وBeneficiary وMember وKPI. عائلات Donation/Project/Beneficiary تملك أو تعمل نحو ownership محدد في scopes أخرى، لكن سطح dashboard نفسه يضم نموذجي `Member` و`KPI` بلا tenant ownership قانوني قابل للتحقق.

| السطح | الوضع الفعلي | سبب عدم صلاحية inference |
|---|---|---|
| `Member` | لا يحمل `organizationId`؛ يرتبط بـ`User` فقط | يمكن للمستخدم امتلاك عضويات متعددة؛ `activeOrganizationId` اختيار session/UI وليس owner للسجل. |
| `KPI` / `KPIRecord` | لا يحملان `organizationId` ولا relation منظمة | `targetEntity/targetId` ليسا foreign key tenant graph، ولا يغطيان كل KPI بصورة قابلة للتدقيق. |
| الصفحة المختلطة | تستورد `@/lib/db` وتنفذ aggregates/findMany مباشرة | لا يوجد TenantContext أو permission boundary أو repository/executor، ولا يصح استبدالها بفلتر تخميني. |

> `organizationMemberships[0]` و`User.activeOrganizationId` وpayload العميل ليست مصادر ملكية قانونية. استخدامها لإصلاح dashboard سيخالف ADR-W02-009 وقرار عدم التخمين في W02.

## الأثر

لا توجد migration أو RLS أو fallback أو تغيير إنتاجي في هذا النطاق. تبقى الصفحة كما هي عمداً كي لا تُنتج عزلًا ظاهرياً غير صحيح. هذا blocker لا يلغي أدلة runtime المغلقة لعائلتي Donor/Donation وBudget/Expense، لكنه يمنع إدخال dashboard المختلط ضمن RLS أو اعتباره مساراً tenant-bound.

## المسار الموصى به

ينتقل العمل تلقائياً إلى نطاق **nullable-root ownership/backfill**. يلزم هناك ownership contract ومهاجرة forward-only وmanifest/backfill fail-closed لـMember وKPI/KPIRecord، مع معالجة ambiguity/unmapped/conflict. بعد إغلاق ذلك فقط يمكن تصميم DashboardRepository مستقل، وصلاحية dashboard دلالية، ومسار `TenantContext → Broker lease → tenant-bound Prisma`، ثم دليل A/B/concurrency/runtime منفصل.

## Evidence

| الدليل | النتيجة |
|---|---|
| مخطط Prisma | `Member` يفتقد owner منظمة، و`KPI/KPIRecord` يفتقدان owner وعلاقة منظمة. |
| صفحة dashboard | global Prisma aggregate/read مباشر متعدد العائلات. |
| قرار الهوية | لا يسمح بالـdefault tenant أو membership fallback أو client-selected owner. |

[1]: ./ADR-W02-009-TENANT-BOUND-RLS-IDENTITY.md
