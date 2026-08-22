# W02 WP5-3 — Report Generation Inventory

| Report | Route | Current generator | Prisma models/relations | Root ownership | Current safety | Required conversion |
|---|---|---|---|---|---|---|
| `financial` | `GET /api/reports/financial` | `generateFinancialReport()` | Budget → BudgetItem → Expense | Organization → Budget → BudgetItem → Expense | غير آمن: route بلا context/policy وquery غير scoped | TenantContext → `report.generate` → FinancialReportService → scoped Budget query |
| `donations` | `GET /api/reports/donations` | `generateDonationsReport()` | Donation → Donor/Campaign/Project | Organization → Donation/Donor/Campaign/Project | غير آمن: route بلا context/policy وquery غير scoped | TenantContext → `report.generate` → DonationsReportService → scoped Donation query |

## Scope Status

لا توجد report generation routes أخرى أو report repositories أو raw SQL أو background report jobs أو cache results أو temporary report files مستخدمة فعلياً في المصدر. `ReportShare` موجود في schema لكنه غير مستخدم ولا يحمل `organizationId`، ولذلك لا يدخل هذا التحويل ولا يستعمل كبديل delivery.

## Explicit Exclusions

`CSV` و`XLSX` و`PDF` و`JSON` download وStoredObject وshare URL وtemporary artifact وqueue/cache/storage export كلها **خارج النطاق وممنوعة**. سيعيد route generation payload بيانات JSON report محددة لا ملفاً ولا URL. `report.export` لن يستدعى؛ يحتفظ التقرير النهائي بالحالة `REPORT EXPORT = DEFERRED`.

## Ownership Gate

Financial ownership مثبتة في Budget Ownership Foundation. Donations ownership مثبتة في WP5-2. لم يُكتشف Beneficiary report فعلي؛ لذلك لا يوجد تحويل Beneficiary report في هذه الحزمة.
