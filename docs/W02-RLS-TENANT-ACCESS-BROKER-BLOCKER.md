# BLOCKER — W02 RLS Tenant Access Broker Audit Proof

> **Historical B16 blocker resolved limited, and coverage rerun completed audit-only.** B16 later passed with the unchanged reason contract, and the subsequent clean B01–B60 coverage rerun passed. This historical document is retained for traceability; it does not authorize production Broker lifecycle or RLS Wave 1.

## Root Cause

فشل الاختبار الإلزامي `B16` قبل استكمال حزمة Broker. الاختبار قدم `userId=A` و`organizationId=A` مع `membershipId=B`، ويتطلب contract أن يعيد Broker `DENY:MEMBERSHIP_ORGANIZATION_MISMATCH`. لكن استعلام authority الحالي يربط `user_id=A` و`membership_id=B` في predicate واحد؛ لذلك لم يجد صفاً وأعاد `DENY:MEMBERSHIP_ABSENT`.

النتيجة **fail-closed** ولم تمنح lease أو role B أو access عابر tenant، لكنها لا تثبت مسار contract المحدد لاكتشاف membership موجودة ومنظمة أخرى. وبحسب التفويض، لا يجوز تعديل expected result أو تغيير الاختبار ليعد denial مختلفاً نجاحاً.

## Evidence

| Item | Value |
|---|---|
| Test | `B16 — cross-organization membership denied` |
| Expected | `DENY:MEMBERSHIP_ORGANIZATION_MISMATCH` |
| Actual | `DENY:MEMBERSHIP_ABSENT` |
| Lease issued | لا |
| Tenant role selected | لا |
| PostgreSQL query as tenant | لا |
| Evidence file | `W02-RLS-TENANT-ACCESS-BROKER-EVIDENCE-FAILED.json` |
| Environment | disposable PostgreSQL 16.15 audit database، تم حذفها بعد الالتقاط |

## Security Impact

لا يوجد cross-tenant access مثبت من B16؛ لكن contract لا يستطيع أن يبرهن التمييز الدقيق بين membership الغائبة وmembership الموجودة ولكن المملوكة لمنظمة أخرى. حتى يثبت المسار المطلوب، لا يمكن اعتبار Broker Proof كاملاً ولا بدء RLS Wave 1.

## What Was Not Changed

لم تعدل expected result أو B16 أو سياسات RLS أو Prisma schema أو migrations أو source application production. لم تستخدم owner أو superuser أو `BYPASSRLS` كدليل tenant runtime. لم تُنشأ production roles أو credentials أو extensions، ولم يبدأ Queue/Redis/Cache أو Storage أو Users/Memberships أو Documents أو W03.

## Safe Options

1. تفويض **B16 Contract Fixture Completion** مستقلاً: إنشاء fixture audit membership موجودة للمستخدم A ومنظمة B، ثم إثبات `MEMBERSHIP_ORGANIZATION_MISMATCH` بالـexpected الحالي وإعادة الحزمة من البداية.
2. اعتماد contract جديد يعلن أن عدم كشف membership لuser A هو السلوك المقصود وأن `MEMBERSHIP_ABSENT` هو reason رسمي؛ هذا يغير expected contract ويحتاج اعتماداً صريحاً، ولا ينفذ تلقائياً.

## Recommended Next Step

الخيار 1 هو الموصى به: يحافظ على expected الحالي ويثبت المسار المفقود بدلاً من إعادة تسمية denial الموجود. بعد اعتماده، تعاد كل Broker security tests على database تدقيقية جديدة؛ لا تستأنف من test B17.
