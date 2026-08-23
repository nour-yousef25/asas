# W02 — Users/Memberships Inventory

يوجد فصل أولي بين control-plane وdata-plane: `tenant-context.ts` و`iam.ts` و`policy.ts` تستخدم `organizationMembership` لتثبيت السياق والتحقق، وهو جزء من authority chain. لكن `src/app/api/users/route.ts` يستورد global Prisma ويعرض/ينشئ users بلا TenantContext أو membership scope. لا يجوز دمج هذين السطحين أو تطبيق RLS على User العالمي؛ يلزم contract مستقل يعرّف user identity global مقابل organization membership tenant-scoped، ويحول route إلى Membership repository أو يثبت أنه control-plane محدود الصلاحيات.

القراءة المباشرة تؤكد أن GET يسرد كل users حسب role اختياري، وPOST ينشئ identity عامة بلا organization membership أو permission دلالية. لذلك هو **global identity surface غير مصنف**، وليس tenant-safe API ولا control-plane مقيّداً بما يكفي للإغلاق. لا يُحوّل بفلاتر client أو `activeOrganizationId`؛ يتطلب ownership/administration contract منفصل.
