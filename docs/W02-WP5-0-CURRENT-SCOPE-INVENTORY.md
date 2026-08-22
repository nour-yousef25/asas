# W02 WP5-0 — Current Scope Inventory

**Baseline:** `w02-wp5-restart` at `e3968d3`.

## Measured Surface

أظهر الجرد read-only وجود 44 route API، و197 موضع استدعاء Prisma ضمن `src`، و27 route فيها Prisma مباشر، مقابل routeين فقط يستدعيان TenantContext (`tenant/context` و`tenant/switch`). يوجد repository contract واحد فقط (`tenant-repository.ts`) ولا توجد Server Actions مكتشفة بالاصطلاحات الحالية. كما رصد الجرد 192 ملفاً ذا صلة محتملة بالطوابير أو Redis/cache أو reports/exports/files/communications؛ لا يعني ذلك أنها جميعاً tenant-unsafe، بل تحتاج تصنيفاً وتحويلاً في مراحل WP5 اللاحقة.

## High-Risk API Inventory

| Component family | Read/Write | Tenant source now | Status | Risk | Required WP5 action |
|---|---|---|---|---|---|
| Beneficiaries/Documents | CRUD/files | session only أو route-local | unsafe | PII/IDOR/file leakage | repository + API cutover أولاً |
| Donors/Donations/Campaigns/Invoices | CRUD/financial | session only | unsafe | cross-tenant financial data | graph-aware repositories وownership checks |
| Projects/News/Events/Tasks/Surveys | CRUD/search/pagination | session only | unsafe | ID manipulation/search leakage | scoped list/get/mutation contracts |
| Users/Memberships | CRUD/renewal | global role/session | unsafe | membership escalation | context/policy-enforced service boundary |
| Reports/Exports | read/generate | route parameters | unsafe | bulk disclosure | tenant-scoped report/export service |
| Upload/Documents/files | upload/read | user/session | unsafe | cross-org object reference | defer object enforcement contract to WP6; inventory in WP5 |
| Communications | plans/channels/worker | global provider paths | unknown/unsafe | queue/provider tenant bleed | tenant envelope and worker audit |
| Payment webhook | webhook input | external payload | boundary risk | spoofed or cross-org attribution | explicit trusted mapping and fail-closed validation |

## Direct Prisma Findings

العناصر التالية أمثلة مثبتة على مسارات حساسة ذات Prisma مباشر ولا يظهر فيها TenantContext أو Policy في الجرد الآلي: `beneficiaries`, `donations`, `donors/[id]`, `donors`, `news`, `projects`, `tasks`, `surveys`, `users`, `members`, `communications/*`, `reports/[reportName]`, و`upload`. لا يجوز اعتبار هذا الجرد إثبات تسرب runtime؛ إنه source inventory يحدد عناصر cutover الإلزامية قبل WP5 closure.

## Non-HTTP Surface

تشمل السطوح ذات المخاطر: `src/lib/queue.ts`, `src/lib/redis.ts`, `src/workers/communications-worker.ts`, `src/lib/communications/*`, `src/modules/reports/generator.ts`, `api/reports`, و`api/upload`. يتطلب WP5-5 لاحقاً فحص payload tenant envelope وRedis key namespace والـretry/replay/idempotency؛ لا ينفذ WP5-0 أي تغيير فيها.

## Current Blockers

لا يظهر blocker baseline أو migration في WP5-0. لكن **WP5-1+ لا يمكن بدءها تلقائياً**: توجد 27 route ذات Prisma مباشر وhigh-risk domains غير scoped، كما أن RLS يحتاج app role غير مالك وshadow tests بعد اكتمال repositories/APIs للأسرة المختارة.
