# BLOCKER — W02 WP5-3 Reports / Exports Tenant Cutover

## Root Cause

يتطلب Permission Catalog أن `report.export` يخضع لـ**purpose/approval/classification**، ويطلب التفويض الحالي تطبيق هذه القيود مع audit. لا يوجد في schema أو source عقد تنفيذ لهذه العناصر للتقارير أو للتصديرات: لا report classification، ولا purpose record/validation، ولا export approval أو retention/expiry artifact policy. `evaluatePermission()` الحالي يقرر membership role/override وpolicy snapshot فقط.

## Evidence

| الدليل | الموضع |
|---|---|
| شرط `report.export` | `docs/W02-WP0-PERMISSION-CATALOG.md`: purpose/approval/classification |
| صلاحيات runtime | `src/lib/permission-catalog.ts`, `prisma/seed.ts` |
| policy الحالي | `src/lib/policy.ts`: membership/role/override فقط |
| غياب purpose/classification/export approval | `prisma/schema.prisma` و`src` source audit |
| Reports غير scoped | `src/app/api/reports/[reportName]/route.ts`, `src/modules/reports/generator.ts` |
| ReportShare غير tenant-owned وغير مستخدم | `prisma/schema.prisma` |

## Impact

لا يمكن إعلان Reports/Exports cutover كاملاً أو إنشاء export delivery artifact آمن. تحويل التقرير إلى PDF بعد `report.export` role check فقط سيتجاوز شرط policy الموثق؛ كما أن اختراع purpose/classification/approval contract داخل WP5-3 يوسع إلى privacy/audit-v2 وstorage scope المحجوزة لمراحل لاحقة.

## What Was Not Changed

لم تُعدل routes أو generators أو schema أو migrations أو policy أو storage أو queue/cache. لم تنشأ artifacts أو ملفات export أو قواعد تدقيق جديدة، ولم يُستخدم Production أو `db push`.

## Safe Options

1. **Authorize a minimal export-governance contract**: تحديد report classifications، purpose allow-list، approval rule، redacted audit fields، وdelivery/expiry boundary؛ مع توضيح علاقته بـWP7/WP6 قبل أي schema/service change.
2. **Re-scope to report generation only**: تحويل Financial وDonation report generation إلى TenantContext/policy scoped، مع منع export/download كلياً وتأجيل `report.export` إلى contract governance مستقل.
3. **Defer the whole Reports/Exports cutover** إلى المرحلة التي تنفذ privacy/export governance وStoredObject contract.

## Recommended Option

الخيار 2 هو الأقل توسعاً إذا كان المنتج يقبل generation-only مؤقتاً، لكنه يحتاج اعتماداً صريحاً لأنه لا يحقق بند export الكامل. الخيار 1 هو المسار الكامل لكن يحتاج قراراً معمارياً مستقلاً لتجنب خلط WP5 مع WP6/WP7.
