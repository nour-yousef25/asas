# BLOCKER — W02 WP5-3 Scope Lock

## Root Cause

تضع خطة W02 ترتيب التحويل بعد العائلات المنجزة على النحو التالي: **Reports/Exports** ثم Users/Memberships ثم Uploads/Files ثم Communications. route التقرير الحالي `src/app/api/reports/[reportName]/route.ts` يستدعي مولد تقارير غير scoped. مولد `financial` يقرأ `Budget → BudgetItem → Expense` مباشرة بلا `TenantContext` أو policy أو repository.

لا تحتوي نماذج `Budget` و`BudgetItem` و`Expense` على `organizationId`، ولا توجد علاقة ownership يمكن أن تثبت tenant عن طريقها. لذلك لا يمكن إضافة filter آمن أو استنتاج organization من client input، كما لا يمكن تحويل التقرير المالي إلى scoped report وفق عقد WP5-3 دون تغيير data model/migration/backfill.

## Evidence

| الدليل | الموضع |
|---|---|
| ترتيب التحويل الرسمي | `docs/W02-IMPLEMENTATION-PLAN.md`، السطر 54 |
| route غير scoped | `src/app/api/reports/[reportName]/route.ts`، يستدعي التقرير من دون auth/context/policy |
| query غير scoped | `src/modules/reports/generator.ts`، `prisma.budget.findMany()` و`prisma.donation.findMany()` |
| غياب ownership | `prisma/schema.prisma`، `Budget` (1642)، `BudgetItem` (1665)، `Expense` (1679) بلا `organizationId` |

## Impact

لا يجوز تنفيذ أول sub-work package الرسمي Reports/Exports أو ادعاء أن التقرير المالي tenant-scoped. أي filter اصطناعي أو tenant identifier من request سيكون bypass لعقد W02، وأي تحويل للتبرعات فقط يغير نطاق order الرسمي من دون اعتماد.

## What Was Not Changed

لم تُعدَّل migrations أو schema أو route أو generator أو قاعدة بيانات. لم يُستخدم `db push` أو Production DB. بقي branch `w02-wp5-restart` القانوني في baseline النظيف قبل WP5-3 التنفيذية.

## Safe Remediation

يلزم قرار معماري صريح قبل التنفيذ بأحد خيارين فقط:

1. **Ownership migration/backfill موجّه:** migration additive forward-only تضيف `organizationId` nullable إلى Budget وBudgetItem وExpense، مع manifest/backfill audited ورفض ambiguity ثم تحويل Reports/Exports بعد دليل migration/rehearsal. هذا يوسع WP5-3 ويتطلب اعتماداً صريحاً لأن M5 في الخطة يقيد children/file refs ولا ينص على budget roots.
2. **Re-scope رسمي:** اعتماد البدء بـDonations report فقط (لأن Donation يملك `organizationId`) وتأجيل Financial report إلى work package ownership مستقل. لا ينفذ هذا الخيار تلقائياً لأنه يغير ترتيب/نطاق Reports/Exports المثبت.

## Required Approval

تحديد الخيار المعتمد ونطاق migration/backfill إن اختير الخيار الأول، أو اعتماد re-scope الرسمي إن اختير الخيار الثاني. إلى ذلك الحين لا يبدأ WP5-3-1 ولا WP5-4 أو WP6.
