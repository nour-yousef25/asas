# W02 WP5-1 — Canonical TenantContext Contract

## Contract

```ts
type TenantContext = Readonly<{
  organizationId: string;
  membershipId: string;
  userId: string;
  policySnapshotVersion: number;
  correlationId: string;
}>;
```

`requireTenantContext()` هو مسار runtime الموثوق: يستخرج الجلسة server-side، ويتحقق من `authVersion` ثم User النشط ثم `activeOrganizationId` ثم عضوية نشطة غير revoked ثم `policyVersion`، وينتج context immutable. لا تقبل عملية الحل `organizationId` من body أو query أو header. التبديل فقط عبر `switchActiveOrganization()` بعد authentication وmembership check، ويكتب audit event.

## Resolution Flow

> Authentication → authenticated user → authVersion → active organization → active/non-revoked membership → immutable TenantContext → policy/repository downstream.

أي فشل يولد `TenantAuthorizationError` fail-closed. تحمل security boundary correlation ID عشوائياً ويُمرر إلى audit switching دون token أو secret أو PII غير لازم.

## Policy Snapshot

`policySnapshotVersion` مصدره `OrganizationMembership.policyVersion`. مقارنة session بـ`User.authVersion` تمنع session stale، و`bumpMembershipPolicyVersion()` هي آلية bump المعتمدة للسياسة. context لاحقاً يمرر snapshot إلى policy evaluator؛ لا ينفذ WP5-1 policy engine جديداً.

## Fallback Found and Removal

كان `resolveTenantContextForUser()` يختار `organizationMemberships[0]` عندما لا يحمل User قيمة `activeOrganizationId`. هذا fallback يعيد إدخال اختيار tenant ضمني ويتعارض مع WP0/WP5. سيُزال داخل WP5-1 ليصبح غياب active organization حالة `NO_ACTIVE_MEMBERSHIP` fail-closed؛ لا migration مطلوبة لأن `activeOrganizationId` موجود منذ WP1.

## Scope Boundary

لا يحوّل هذا العمل repositories أو API domains أو RLS أو queue/cache/storage. يستخدم `tenant/context` و`tenant/switch` فقط لإثبات boundary المركزية.
