# W02 — Financial Family Ownership and Runtime Inventory

## قرار النطاق

**الحالة: inventory مكتمل؛ RLS المالي غير مصرح به بعد.** يكشف الحصر أن كلمة «financial» تضم عائلتين مختلفتين لا يجوز دمجهما في policy واحدة: **Budget/Expense**، و**Donor/Donation/Campaign/Invoice/Project**. كل root الحالي يحمل `organizationId` قابلاً لـ`NULL`، بينما بعض الأبناء يرثون الملكية عبر relation فقط. لذلك لا تُنشأ RLS migration قبل backfill موثق وrepository/API cutover لكل عائلة مختارة.

| العائلة | roots المنظمة | الأبناء الموروثة | حالة الملكية/RLS |
|---|---|---|---|
| Budget/Expense | `budgets`, `budget_items`, `expenses` | `BudgetItem → Budget`، و`Expense → BudgetItem` عند الارتباط | tenant keys موجودة nullable؛ backfill control-plane موجود، لكن لا يوجد repository/runtime/dashboard tenant-bound. **NOT READY**. |
| Donor/Donation | `donors`, `donations`, `donation_campaigns`, `projects` | `donor_communications → Donor`، `invoices → Donation` | roots nullable والأبناء لا يحملون tenant key دائماً. repository ومسارا donors/donations أصبحا tenant-bound؛ PostgreSQL evidence وباقي paths ما زالت **NOT READY** لـRLS. |
| Dashboard المختلط | donation/project/beneficiary/KPI/member | عابر للعائلات | global direct Prisma؛ لا يمكن إدخاله في أي RLS family حتى تقسيم queries حسب ownership. **BLOCKING PATH**. |

## مسارات runtime المكتشفة

| المسار | الحالة الحالية | الخطر | الإجراء الإلزامي |
|---|---|---|---|
| `src/lib/financial-repository.ts` | **محول** إلى `TenantBoundPrismaExecutor` ولا يستورد `db.ts` | يتطلب PostgreSQL runtime proof قبل اعتباره RLS-ready | F01–F09 على tenant login/lease/session_user. |
| `src/app/(dashboard)/donations/page.tsx` | **محول** إلى server TenantContext + `donation.read` + repository | لا تغطيه evidence PostgreSQL بعد | يشمله F01–F10. |
| `src/app/(dashboard)/donors/page.tsx` | **محول** إلى server TenantContext + `donor.read` + repository | لا تغطيه evidence PostgreSQL بعد | يشمله F01–F10. |
| `src/app/(dashboard)/page.tsx` | aggregates/findMany global تشمل donations/projects/beneficiaries وغيرها | mixing owners؛ RLS family قد يكسر الصفحة أو يسرب | scope منفصلة لـdashboard aggregation بعد إغلاق families. |
| `src/lib/budget-ownership-backfill.ts` | global Prisma control-plane manifest/backfill | ليس data-plane request path، لكنه لا يصلح كـRLS runtime | يبقى control-plane فقط؛ يحتاج proof clean/backfill مستقل قبل Budget RLS. |

## شروط القرار التالي

لا تبدأ RLS لأي عائلة مالية قبل أن يثبت نطاق cutover التالي، كحد أدنى، أن كل UI/API/repository المحدد يستخدم server `TenantContext` وصلاحية semantic و`TenantBoundPrismaExecutor`، وأن foreign read/write/create relation تُرفض وتدقق، وأن nullable/unmapped roots لا تصلح لpolicy تخمينية. لا يستبدل scope هذا Queue/Storage/Document/IAM أو DR/HA/provider production gates.

## صلاحية الأدلة السابقة

ملف `scripts/w02-wp5-2-financial-isolation.ts` وثّق سابقاً predicates للعزل، لكنه يستورد `db.ts` ويستخدم `resolveTenantContextForUser` ثم `FinancialRepository` قبل مسار Broker-bound Prisma. لذلك هو **SUPERSEDED FOR RUNTIME AUTHORITY** ولا يمكن ترقية نتيجته إلى evidence لهذا النطاق. الدليل التالي يجب أن يكون PostgreSQL disposable مستقلاً، يستخدم tenant LOGIN principals وBroker leases وprovider يتحقق من `session_user`، مع mandatory-ID validation وcleanup/hygiene fail-closed.

| ID | الإثبات الإلزامي للحarness البديلة |
|---|---|
| F01 | Donor/Donation repository path يتسلم `session_user` للـtenant A من Broker-bound Prisma. |
| F02 | A list/read لا يرى Donor أو Donation للمستأجر B. |
| F03 | A لا يكتب DonorCommunication للـDonor B وتُنشأ denial audit ضمن A. |
| F04 | createDonation يرفض donor/campaign/project للعلاقة B. |
| F05 | Donation وInvoice الجديدان يحتفظان بـorganization A والعلاقة الصحيحة. |
| F06 | lease replay/revocation وstale session يمنعون data-plane execution. |
| F07 | rotation إلى principal A جديد تنتج `session_user` جديداً ولا تعيد استخدام القديم. |
| F08 | provider failure يرفض بلا global Prisma fallback. |
| F09 | rows/queries المتوازية A/B والـdiscard لا تتشارك client أو هوية. |
| F10 | mandatory coverage/cleanup/role/database/artifact hygiene exact PASS. |
