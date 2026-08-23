# W02 — Financial Family Ownership and Runtime Inventory

## قرار النطاق

**الحالة: inventory مكتمل؛ دليل Budget/Expense وDonor/Donation audit-runtime مغلقان؛ RLS المالي غير مصرح به بعد.** يكشف الحصر أن كلمة «financial» تضم عائلتين مختلفتين لا يجوز دمجهما في policy واحدة: **Budget/Expense**، و**Donor/Donation/Campaign/Invoice/Project**. كل root الحالي يحمل `organizationId` قابلاً لـ`NULL`، بينما بعض الأبناء يرثون الملكية عبر relation فقط. لذلك لا تُنشأ RLS migration قبل backfill موثق وrepository/API cutover ودليل runtime مستقل لكل عائلة مختارة.

| العائلة | roots المنظمة | الأبناء الموروثة | حالة الملكية/RLS |
|---|---|---|---|
| Budget/Expense | `budgets`, `budget_items`, `expenses` | `BudgetItem → Budget`، و`Expense → BudgetItem` عند الارتباط | ownership/backfill control-plane موجود، ومسارات API/repository runtime أصبحت tenant-bound مع BE01–BE10 PASS. لا يزال nullable-root hardening وRLS وprovider الإنتاجي وdashboard المختلط خارج الإغلاق. |
| Donor/Donation | `donors`, `donations`, `donation_campaigns`, `projects` | `donor_communications → Donor`، `invoices → Donation` | roots nullable والأبناء لا يحملون tenant key دائماً. repository ومسارا donors/donations أصبحا tenant-bound؛ F01–F10 PostgreSQL runtime PASS لمسارهم المحدد. **NOT READY** لـRLS حتى backfill/paths وبوابات العائلات المتبقية. |
| Dashboard المختلط | donation/project/beneficiary/KPI/member | عابر للعائلات | global direct Prisma؛ لا يمكن إدخاله في أي RLS family حتى تقسيم queries حسب ownership. **BLOCKING PATH**. |

## مسارات runtime المكتشفة

| المسار | الحالة الحالية | الخطر | الإجراء الإلزامي |
|---|---|---|---|
| `src/lib/financial-repository.ts` | **محول** إلى `TenantBoundPrismaExecutor` ولا يستورد `db.ts` | F01–F10 أثبتت المسار tenant LOGIN/lease/session_user ولا تمنحه RLS-ready بمفرده | يبقى تحت بوابة family-wide backfill/paths. |
| `src/app/(dashboard)/donations/page.tsx` | **محول** إلى server TenantContext + `donation.read` + repository | محمي بنيوياً وعبر runtime للمسار repository، لكن provider الإنتاجي لم يهيأ | لا RLS مالي قبل بوابات العائلة الكاملة. |
| `src/app/(dashboard)/donors/page.tsx` | **محول** إلى server TenantContext + `donor.read` + repository | محمي بنيوياً وعبر runtime للمسار repository، لكن provider الإنتاجي لم يهيأ | لا RLS مالي قبل بوابات العائلة الكاملة. |
| `src/app/(dashboard)/page.tsx` | aggregates/findMany global تشمل donations/projects/beneficiaries وغيرها | mixing owners؛ RLS family قد يكسر الصفحة أو يسرب | scope منفصلة لـdashboard aggregation بعد إغلاق families. |
| `src/lib/budget-ownership-backfill.ts` | global Prisma control-plane manifest/backfill | ليس data-plane request path، لكنه لا يصلح كـRLS runtime | يبقى control-plane فقط؛ تستكمله BE01–BE10 لمسار API/repository لا لـRLS. |

## نتيجة BE01–BE10

أثبت harness مستقل على PostgreSQL disposable أن `BudgetExpenseRepository` يربط Budget/BudgetItem/Expense إلى tenant LOGIN/`session_user`/Broker Prisma، ويرفض parent child cross-tenant ويحتفظ بسلسلة owner الصحيحة. مر المدقق exact/fail-closed وhygiene، وانتهى cleanup بصفر residue. لا توجد Financial RLS migration أو policy نتيجة لهذا العمل. راجع [تقرير الإغلاق المحدود](./W02-BUDGET-EXPENSE-RUNTIME-COMPLETION.md).

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

## نتيجة F01–F10

أثبت harness مستقل على PostgreSQL disposable في 2026-08-23 أن مسار Donor/Donation المحدد يستخدم broker-bound Prisma مع provider يتحقق من `session_user` قبل تسليم العميل، وأن فشل provider يرفض بلا fallback عالمي. مر المدقق exact/fail-closed وفحص hygiene، وانتهى cleanup بصفر residue. لا تحتوي evidence المؤرشفة على URL أو كلمة مرور أو principal name. لا تغيّر هذه النتيجة قرار منع RLS المالي. راجع [تقرير الإغلاق المحدود](./W02-FINANCIAL-DONOR-DONATION-RUNTIME-COMPLETION.md).
