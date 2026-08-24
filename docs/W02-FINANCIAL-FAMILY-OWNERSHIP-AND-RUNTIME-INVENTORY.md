# W02 — Financial Family Ownership and Runtime Inventory

## قرار النطاق

**الحالة: inventory مكتمل؛ RLS المالي المحلي المنعزل مغلق على موجتين، لكنه ليس دليلاً على provider أو Production.** يكشف الحصر أن كلمة «financial» تضم عائلتين مختلفتين لا يجوز دمجهما في policy واحدة: **Budget/Expense**، و**Donor/Donation/Campaign/Invoice/Project**. كل root الحالي يحمل `organizationId` قابلاً لـ`NULL`، بينما بعض الأبناء يرثون الملكية عبر relation فقط. لذلك تطبق policies الجديدة fail-closed ولا تنسب صفوف `NULL` أو children غامضة إلى tenant افتراضي.

| العائلة | roots المنظمة | الأبناء الموروثة | حالة الملكية/RLS |
|---|---|---|---|
| Budget/Expense | `budgets`, `budget_items`, `expenses` | `BudgetItem → Budget`، و`Expense → BudgetItem` عند الارتباط | Wave3 يفرض `FORCE RLS` وrole-OID/`session_user` مع parent checks؛ BE-R01–BE-R12 PASS وcleanup=0 على PostgreSQL disposable. |
| Donor/Donation | `donors`, `donations`, `donation_campaigns`, `projects` | `donor_communications → Donor`، `recurring_donations → Donor`، `invoices → Donation` | Wave2 يفرض `FORCE RLS` وfail-closed roots/children؛ FR01–FR15 PASS وcleanup=0 على PostgreSQL disposable. |
| Dashboard المختلط | donation/project/beneficiary/KPI/member | عابر للعائلات | global direct Prisma؛ لا يمكن إدخاله في أي RLS family حتى تقسيم queries حسب ownership. **BLOCKING PATH**. |

## مسارات runtime المكتشفة

| المسار | الحالة الحالية | الخطر | الإجراء الإلزامي |
|---|---|---|---|
| `src/lib/financial-repository.ts` | **محول** إلى `TenantBoundPrismaExecutor` ولا يستورد `db.ts` | F01–F10 أثبتت المسار tenant LOGIN/lease/session_user ولا تمنحه RLS-ready بمفرده | يبقى تحت بوابة family-wide backfill/paths. |
| `src/app/(dashboard)/donations/page.tsx` | **محول** إلى server TenantContext + `donation.read` + repository | محمي بنيوياً وعبر runtime للمسار repository، لكن provider الإنتاجي لم يهيأ | لا RLS مالي قبل بوابات العائلة الكاملة. |
| `src/app/(dashboard)/donors/page.tsx` | **محول** إلى server TenantContext + `donor.read` + repository | محمي بنيوياً وعبر runtime للمسار repository، لكن provider الإنتاجي لم يهيأ | لا RLS مالي قبل بوابات العائلة الكاملة. |
| `src/app/(dashboard)/page.tsx` | aggregates/findMany global تشمل donations/projects/beneficiaries وغيرها | mixing owners؛ لا يدخل في claim الإغلاق المحلي للموجتين | scope منفصلة لـdashboard aggregation؛ لا يعاد تفسيره كـFinancial RLS path. |
| `src/lib/budget-ownership-backfill.ts` | global Prisma control-plane manifest/backfill | ليس data-plane request path، لكنه لا يصلح كـRLS runtime | يبقى control-plane فقط؛ تستكمله BE01–BE10 لمسار API/repository لا لـRLS. |

## نتيجة BE01–BE10

أثبت harness مستقل على PostgreSQL disposable أن `BudgetExpenseRepository` يربط Budget/BudgetItem/Expense إلى tenant LOGIN/`session_user`/Broker Prisma، ويرفض parent child cross-tenant ويحتفظ بسلسلة owner الصحيحة. مر المدقق exact/fail-closed وhygiene، وانتهى cleanup بصفر residue. لا توجد Financial RLS migration أو policy نتيجة لهذا العمل. راجع [تقرير الإغلاق المحدود](./W02-BUDGET-EXPENSE-RUNTIME-COMPLETION.md).

## نتيجة موجات Financial RLS المحلية

تغطي `20260824090000_w02_rls_wave2_donor_donation` الجذور Donor/Campaign/Project/Donation والأبناء DonorCommunication/RecurringDonation/Invoice، وتغطي `20260824093000_w02_rls_wave3_budget_expense` Budget/BudgetItem/Expense. اختبرت evidence المؤرشفة A/B direct SQL، `session_user`، children foreign-parent، nullable/unmapped fail-closed، Broker lease replay/revocation/stale context، rotation/provider outage، parallel/discard، hygiene وcleanup. يثبت `W02-FINANCIAL-MIGRATION-REHEARSAL-EVIDENCE.json` pristine deploy وupgrade من pre-Wave2 وforward-safe recovery بإتلاف audit DB وإعادة البناء الرسمي؛ **لا يدّعي rollback إنتاج**.

لا يستبدل هذا scope Queue/Storage/Document/IAM أو provider/HA/DR/scale gates. ويظل dashboard المختلط scope منفصلاً لا تدخل نتائجه في موجتي RLS الماليتين.

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
