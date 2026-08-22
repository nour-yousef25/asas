# ADR-W02-004 — Membership-Scoped IAM, Permission and SoD

**Gate:** G-W02-4
**الحالة:** `CLOSED — DESIGN DECISION`
**المالك:** Security Owner وProduct Owner.

## Decision

يعتمد IAM على semantic Permission Catalog ثابت، Organization Roles محلية، MembershipRole bindings وpolicy evaluator server-side. precedence هي: policy deny صريح → legal-hold/classification restriction → SoD restriction → allow role/override → default deny. لا تستخدم global `Role` أو client claims كقرار تفويض tenant-scoped.

## Platform Support Boundary

لا يمنح `SUPER_ADMIN` وصولاً صامتاً لكل منظمة. support access يمر بطلب وموافقة وربط منظمة وسبب ومدة وpurpose، ويمنع افتراضياً الوصول إلى `RESTRICTED` data/secrets أو export. كل grant/revoke/decision يكتب audit.

## SoD and Tests

يفصل baseline بين request/approve/refund وsecret create/rotate/revoke وsupport request/approve. يلزم عدم قدرة actor واحد على أداء طرفي العملية دون exception مدقق. الاختبارات تشمل vertical/horizontal escalation، deny-over-allow، inactive membership، stale session، support expiry وSoD. الدليل WP0 هو catalog وdecision register؛ لا policy code ينفذ الآن.
