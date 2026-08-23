# W02 — Mixed Dashboard Runtime Cutover Completion

## النتيجة

حوّلت الصفحة الرئيسية `src/app/(dashboard)/page.tsx` إلى `DashboardRepository` عبر `TenantBoundPrismaExecutor`، مع `requireTenantContext` وصلاحية `dashboard.read` الدلالية default-deny. لم تعد الصفحة تستورد global Prisma. أثبتت D01–D10 على PostgreSQL disposable أن snapshot يستهلك Broker lease وtenant `session_user`، ويقيد aggregates إلى المنظمة، ويخفي related records المخالفة، ويرفض outage/stale/revoked paths مع cleanup وhygiene. [1] [2]

| سطح الصفحة | حالة العزل المثبتة |
|---|---|
| Donation/Project/Beneficiary aggregates | مقيدة بـ`organizationId` من TenantContext. |
| Member/KPI/KPIRecord | مقيدة بـowner materialized؛ root بلا owner ينتج صفراً/empty وليس بيانات عامة. |
| Donation relations | donor/project/campaign باسم مغاير للمنظمة يحجب من العرض. |
| Authority | Broker lease وprovider-verified `session_user`، مع discard، concurrency، provider fail-closed. |

## الحدود المتبقية

هذا **لا يغلق** Member أو KPI كعائلة runtime كاملة. لا تزال مسارات مثل `/api/members` و`/api/kpi` وصفحات member/KPI التفصيلية تعتمد global Prisma، ولذلك لا تدخل هذه المسارات أو dashboard scope في Financial RLS. كما تظل provider الإنتاجية وledger retention/backup/restore/DR/HA/scale بوابات مفتوحة.

[1]: ./evidence/W02-DASHBOARD-RUNTIME-EVIDENCE.json
[2]: ./evidence/W02-DASHBOARD-RUNTIME-EVIDENCE-VALIDATION.json
