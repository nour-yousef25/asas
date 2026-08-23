# W02 — Financial Family Ownership and Runtime Inventory

## قرار النطاق

**الحالة: inventory مكتمل؛ RLS المالي غير مصرح به بعد.** يكشف الحصر أن كلمة «financial» تضم عائلتين مختلفتين لا يجوز دمجهما في policy واحدة: **Budget/Expense**، و**Donor/Donation/Campaign/Invoice/Project**. كل root الحالي يحمل `organizationId` قابلاً لـ`NULL`، بينما بعض الأبناء يرثون الملكية عبر relation فقط. لذلك لا تُنشأ RLS migration قبل backfill موثق وrepository/API cutover لكل عائلة مختارة.

| العائلة | roots المنظمة | الأبناء الموروثة | حالة الملكية/RLS |
|---|---|---|---|
| Budget/Expense | `budgets`, `budget_items`, `expenses` | `BudgetItem → Budget`، و`Expense → BudgetItem` عند الارتباط | tenant keys موجودة nullable؛ backfill control-plane موجود، لكن لا يوجد repository/runtime/dashboard tenant-bound. **NOT READY**. |
| Donor/Donation | `donors`, `donations`, `donation_campaigns`, `projects` | `donor_communications → Donor`، `invoices → Donation` | roots nullable والأبناء لا يحملون tenant key دائماً. `FinancialRepository` موجود لكنه global وغير مستخدم من pages. **NOT READY**. |
| Dashboard المختلط | donation/project/beneficiary/KPI/member | عابر للعائلات | global direct Prisma؛ لا يمكن إدخاله في أي RLS family حتى تقسيم queries حسب ownership. **BLOCKING PATH**. |

## مسارات runtime المكتشفة

| المسار | الحالة الحالية | الخطر | الإجراء الإلزامي |
|---|---|---|---|
| `src/lib/financial-repository.ts` | يستورد `db.ts` ويستدعي Prisma globally في donors/campaigns/donations/projects/audit | يتجاوز Broker-bound tenant Prisma؛ لا يمكن أن يثبت `session_user` | تحويله إلى executor tenant-bound، أو تقسيمه إلى repositories أصغر قبل RLS. |
| `src/app/(dashboard)/donations/page.tsx` | `prisma.donation.findMany` بلا context أو permission | كشف cross-tenant للdonation/invoice/relations | `requireTenantContext` + permission + repository tenant-bound. |
| `src/app/(dashboard)/donors/page.tsx` | `prisma.donor.findMany` بلا context أو permission | كشف donor والنشاط | نفس cutover. |
| `src/app/(dashboard)/page.tsx` | aggregates/findMany global تشمل donations/projects/beneficiaries وغيرها | mixing owners؛ RLS family قد يكسر الصفحة أو يسرب | scope منفصلة لـdashboard aggregation بعد إغلاق families. |
| `src/lib/budget-ownership-backfill.ts` | global Prisma control-plane manifest/backfill | ليس data-plane request path، لكنه لا يصلح كـRLS runtime | يبقى control-plane فقط؛ يحتاج proof clean/backfill مستقل قبل Budget RLS. |

## شروط القرار التالي

لا تبدأ RLS لأي عائلة مالية قبل أن يثبت نطاق cutover التالي، كحد أدنى، أن كل UI/API/repository المحدد يستخدم server `TenantContext` وصلاحية semantic و`TenantBoundPrismaExecutor`، وأن foreign read/write/create relation تُرفض وتدقق، وأن nullable/unmapped roots لا تصلح لpolicy تخمينية. لا يستبدل scope هذا Queue/Storage/Document/IAM أو DR/HA/provider production gates.
