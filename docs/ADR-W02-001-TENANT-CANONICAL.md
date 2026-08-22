# ADR-W02-001 — Organization as Tenant Canonical

**Gate:** G-W02-1
**الحالة:** `CLOSED — DESIGN DECISION`
**المالك:** Architecture Owner وProduct Owner.

## Decision

`Organization.id` هو معرّف الـTenant القانوني والوحيد في data plane. لا تنشأ طبقة `Tenant` موازية، ولا يصبح `User.role` العالمي مصدر تفويض tenant. يكون كل command تشغيلي مقيداً بـ`TenantContext` server-side يحوي `organizationId` و`membershipId` و`userId` و`policySnapshotVersion` و`correlationId`.

## Rationale and Impact

يوجد بالفعل `Organization` و`OrganizationMembership` وعلاقات communications منظمة، لذلك تضيف طبقة Tenant ثانية ازدواجية وهوية قابلة للانحراف. لا يقبل أي business payload `organizationId` كمرجع تفويض؛ tenant switching مسار صريح يتحقق من membership نشطة ويكتب audit. يتوافق هذا مع Cloud وDedicated وSelf-Hosted لأن contract موحد وتختلف ownership/provisioning فقط.

## Dependencies, Security and Migration

يعتمد التنفيذ على ADR-W02-002/003/004. الأثر الأمني هو منع client spoofing وIDOR؛ والأثر التشغيلي هو إضافة active organization selection من الخادم. تضيف migrations المستقبلية `organizationId` forward-only إلى data-plane aggregates ولا تلمس `User` global identity أو التاريخ الحالي في WP0.

## Acceptance and Evidence

يتحقق في WP1 من أن كل repository وAPI/file/job/cache/export يستخدم `TenantContext`، وأن resource من org B غير مرئي أو قابل للتعديل من org A. الدليل الحالي هو schema وقرار W02 readiness؛ لا يوجد runtime implementation في WP0.
