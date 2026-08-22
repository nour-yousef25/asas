# W02 WP5-3 — Reports / Exports Source Inventory

| الملف | السطح | مصادر البيانات | Ownership المتاح | الحالة | الخطر | التحويل المقترح |
|---|---|---|---|---|---|---|
| `src/app/api/reports/[reportName]/route.ts` | `financial`, `donations` generate route | route parameter فقط | لا TenantContext أو policy | غير آمن | unauthenticated/unscoped report invoke | TenantContext → policy → report service |
| `src/modules/reports/generator.ts` | Financial PDF generator | Budget → BudgetItem → Expense | WP5-3 Budget graph | غير scoped | A/B aggregation leakage | scoped financial repository/service |
| `src/modules/reports/generator.ts` | Donations PDF generator | Donation → Donor, Campaign, Project | WP5-2 graph | غير scoped | donor/financial leakage | scoped donations repository/service |
| `prisma/schema.prisma:ReportShare` | potential shared report record | JSON data/recipients | لا organizationId ولا source usage | غير مفعّل | لا يتحول أو يستخدم | خارج التنفيذ؛ يحتاج ownership foundation منفصلة إن فُعّل |
| Export artifacts/storage | لا route أو service أو object model مستخدم للتقارير | لا يوجد | لا يوجد | غير configured | لا يجوز إنشاء public/stored export bypass | delivery in-memory فقط إن سمح contract، وإلا WP6 |
| Jobs/cache/temp exports | لا report job أو cache result أو temp file route مكتشف | لا يوجد | لا يوجد | غير configured | لا queue/cache proof ممكن | لا يُنشأ queue/cache/storage system في هذا النطاق |

## Permissions and Contract Gap

الصلاحيتان `report.generate` و`report.export` موجودتان في permission catalog ومربوطتان في seed بأدوار محددة. لكن catalog نفسه يشترط purpose/approval/classification لـ`report.export`، ولا توجد نماذج أو service أو policy evaluator لتصنيف report data أو purpose للـexport أو approval/retention/expiry artifact. `Policy` الحالي يقيم membership/roles/overrides فقط.

## Scope Conclusion

يمكن تحويل **generation** scoped بعد tenant/policy. لكن تحويل **export** بالمعنى المصرح في التفويض لا يمكن إثباته آمنًا: contract الحاسم purpose/approval/classification غائب، و`ReportShare` غير tenant-owned. لا يُعد UI أو report parameter بديلاً عن هذا العقد.
