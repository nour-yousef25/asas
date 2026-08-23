# W02 — Users/Memberships Inventory

يوجد فصل أولي بين control-plane وdata-plane: `tenant-context.ts` و`iam.ts` و`policy.ts` تستخدم `organizationMembership` لتثبيت السياق والتحقق، وهو جزء من authority chain. لكن `src/app/api/users/route.ts` يستورد global Prisma ويعرض/ينشئ users بلا TenantContext أو membership scope. لا يجوز دمج هذين السطحين أو تطبيق RLS على User العالمي؛ يلزم contract مستقل يعرّف user identity global مقابل organization membership tenant-scoped، ويحول route إلى Membership repository أو يثبت أنه control-plane محدود الصلاحيات.
