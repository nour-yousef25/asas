# ADR-W02-011 — Dashboard Nullable-Root Ownership

## Status

**ACCEPTED FOR AUDIT REHEARSAL ONLY.** لا يسمح هذا القرار بتشغيل migration أو backfill أو dashboard cutover في الإنتاج.

## Decision

تصنف الكيانات التالية على أنها **tenant-owned** ضمن W02، وليست global أو shared أو control-plane:

| الكيان | التصنيف | مرساة ownership | قاعدة child |
|---|---|---|---|
| `Member` | tenant-owned root | `organizationId` الناتج من manifest صريح | لا يرث organization من `User` أو `OrganizationMembership`. |
| `KPI` | tenant-owned root | `organizationId` الناتج من manifest صريح | لا يستنتج من `targetEntity` أو `targetId`. |
| `KPIRecord` | derived tenant-owned child | يرث owner من parent `KPI`، مع materialized `organizationId` بعد التحقق | لا يقبل owner مخالفاً لـKPI. |

تستند هذه الملكية إلى أن dashboard يعرض أداء منظمة محددة وأن W02 يعرّف Organization كـcanonical tenant. وهي **قرار منتج/أمن صريح** يزيل ambiguity؛ لا تستنتج من السجل التاريخي أو من active organization.

## مصادر غير مقبولة

`User.activeOrganizationId` وfirst membership ووجود عضوية وحيدة وKPI target fields وclient request ليست مصادر ownership. كل root قديم يتطلب mapping manifest واحداً قابلاً للمراجعة يحدد `recordId` و`organizationId` و`source` وسبب القرار. لا يُطبق unmapped أو ambiguous أو conflicting أو invalid-reference row.

## تسلسل التنفيذ

1. successor migration توسعية تضيف nullable `organizationId` وFK/index إلى `Member/KPI/KPIRecord`، مع ledger control-plane immutable منفصل.
2. analyze manifest fail-closed والتحقق من parent graph وnull/conflict.
3. ledger `STARTED` قبل apply و`SUCCEEDED` أو `FAILED/ROLLBACK` كoutcome immutable؛ لا false-success.
4. PostgreSQL clean/upgrade rehearsal وA/B negatives وidempotency/recovery/rollback/cleanup.
5. بعد evidence فقط، DashboardRepository وtenant-bound runtime cutover؛ لا RLS قبل إغلاق dashboard وDR/HA/scale.

## Consequences

قد تظل rows بلا owner بعد توسعة schema عندما لا يوجد manifest قانوني؛ هذا **حظر مقصود** وليس سبباً لتعيين owner افتراضي. لا يكون Member/KPI جزءاً من أي RLS wave حتى تظهر evidence backfill وruntime مستقلة.
