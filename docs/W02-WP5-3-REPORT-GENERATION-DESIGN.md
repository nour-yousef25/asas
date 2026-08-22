# W02 WP5-3 — Report Generation Tenant Cutover Design

## Boundary

كل generation يمر حصراً عبر `requireTenantContext → requirePermission(context, "report.generate") → ReportGenerationService → scoped Prisma`. لا يقبل service أو route `organizationId` من client. report name ليس source بيانات؛ هو enum ثابت (`financial` أو `donations`) يختار service مسموحاً فقط. أي name غير معروف يعيد `400` ولا يشغل query.

## Ownership Maps

| التقرير | Scoped root | Child/relation guards |
|---|---|---|
| Financial | `Budget.organizationId = context.organizationId` | BudgetItem وExpense يحتفظان بنفس owner؛ include يفرض `organizationId = context.organizationId` في كل مستوى |
| Donations | `Donation.organizationId = context.organizationId` | Donor/Campaign/Project include مقيد بالمنظمة نفسها؛ foreign filter ID خارج المنظمة ينتج not-found/empty scoped result |

لا تستخدم services `ReportShare` أو stored artifact أو raw SQL أو cache/job/file delivery.

## Parameters

تقبل services قائمة allow-list فقط: date range، category، budget ID، search، page، pageSize، sort. يتعامل `budgetId` وforeign IDs كـresource identifiers ويُتحقق منها تحت `TenantContext`. لا تقبل `organizationId` authority من query/body/header؛ وجوده لا يوسع query. invalid date range أو malformed pagination يعيد `400` قبل query.

## Policy and Privacy Boundary

يتحقق `report.generate` عبر policy evaluator الحالي، بما يشمل membership وrole وoverride وpolicy snapshot. لا يستدعى `report.export`.

لا يوجد runtime purpose/classification contract للتقرير generation حالياً؛ لا يُخترع واحد في هذه الحزمة. يسجل audit `purposeCode: null` و`purposeStatus: "NOT_CONFIGURED"` في metadata المختزلة كـgap صريح. لا ينتج عن generation ملف أو download أو share أو artifact، لذلك لا تنفذ approval/expiry/export governance المحجوزة لمسارات لاحقة.

## Result and Audit

تعيد route JSON generation result فقط: normalized totals/counts/pagination وrows scoped. لا تعيد PDF أو URL أو buffer. يكتب service audit مختزلاً للقرار allow/deny يتضمن organization/user/membership/correlation/report type/decision/reason/source ومعلمات redacted بلا donor full details أو report contents أو token أو national ID.
