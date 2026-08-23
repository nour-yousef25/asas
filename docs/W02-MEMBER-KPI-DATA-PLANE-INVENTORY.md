# W02 — Member/KPI Remaining Data-Plane Inventory

## الحالة

بعد إغلاق dashboard root-page المحدود، بقيت مسارات Member/KPI التالية تستخدم Prisma عالمياً أو تفتقد `TenantContext`/permission/repository. لا تدخل هذه المسارات في نطاق dashboard runtime المغلق، وتمنع أي RLS للعائلة حتى تحويلها وإثباتها.

| surface | العمليات الحالية | الحالة المطلوبة |
|---|---|---|
| `src/app/(dashboard)/members/page.tsx` | list members global | TenantBound repository + `member.read` scoped by `organizationId` |
| `src/app/(dashboard)/members/[id]/page.tsx` | detail global | tenant-bound scoped read + foreign-ID negative |
| `src/app/api/members/route.ts` | list/count/create global | context + semantic permissions + repository |
| `src/app/api/members/[id]/renew/route.ts` | member/payment renewal global | explicit member owner verification + payment data-plane boundary |
| `src/app/(dashboard)/performance/kpi/[id]/report/page.tsx` | KPI detail/report global | tenant-bound scoped parent/record read |
| `src/app/api/kpi/route.ts` | list/create/record/create/update global | context + KPI permissions + parent/child ownership verification |

## القيود

لا تكفي إضافة `organizationId` في schema وحدها. ينبغي أن تقطع كل عملية إلى `TenantContext → permission → TenantBoundPrismaExecutor → organizationId predicate`، مع منع foreign IDs وKPIRecord owner mismatch، ومن دون استعمال `activeOrganizationId` أو global Prisma fallback أو raw GUC. مسار renewal يستلزم حصر `MembershipPayment` كchild ownership يرث من Member قبل كتابة أي cutover.
