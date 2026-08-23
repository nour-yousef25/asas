# W02 — Queue Tenant Envelope Contract

## الحالة

**DESIGN READY — RUNTIME NOT STARTED.** العقد لا يعتبر InMemory fallback أو Redis URL دليلاً، ولا يغير workers الحالية قبل migration/cutover قابل للاختبار.

## envelope الموثوق

أي job tenant-bound يجب أن ينشأ من سياق موثق داخل الخادم، لا من body أو `tenantId` يرسله العميل. يتضمن envelope: `organizationId`، `membershipId`، `userId`، `sessionVersion`، `policySnapshotVersion`، `correlationId`، ومرجع job أحادي الاستخدام/قابل للتحقق. لا يحمل credential أو password أو connection string.

| المرحلة | شرط الأمان |
|---|---|
| Publisher | يستقبل `TenantContext` الموثق ويطبق permission قبل بناء envelope |
| Queue key | namespace ثابتة ولا تخلط keys أو retry/DLQ بين tenants |
| Worker | يعيد التحقق من session/membership/policy/revocation قبل كل data-plane operation |
| Data-plane | ينفذ فقط عبر Broker و`TenantBoundPrismaExecutor`؛ لا global Prisma |
| Retry/replay | لا يعيد استخدام authority من payload؛ يصدر lease جديداً بعد تحقق حي |
| Cache/locks/pubsub | key namespace يتضمن identity موثوقة، ويمنع collision بين A/B |

## دليل مطلوب لاحقاً

يجب أن يثبت Redis disposable أو target-safe: forged payload denial، replay/retry/delay/DLQ، revoked/stale session/policy، restart، concurrent A/B، key collision، وcleanup. إذا لم يتوفر Redis فلا يصنف ذلك PASS؛ يبقى **BLOCKED — LOCAL CODE/DESIGN** حتى يكتمل adapter والـfixture.
