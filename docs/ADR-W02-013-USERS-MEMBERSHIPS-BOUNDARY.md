# ADR-W02-013 — Users and Memberships Authority Boundary

## الحالة

**مقبول للتصنيف والتنفيذ المرحلي؛ غير مغلق runtime.**

## القرار

`User` هو **GLOBAL IDENTITY**: لا يحمل ownership لمنظمة ولا يدخل تلقائياً في RLS tenant tables. `OrganizationMembership` هو **TENANT-BOUND AUTHORITY**: يمثل العلاقة القانونية الوحيدة بين identity ومنظمة، وهو المدخل المطلوب لأي list أو detail أو create أو update أو delete حساس للمنظمة.

| السطح | التصنيف | الحكم الحالي |
|---|---|---|
| `GET /api/users` | global identity listing surface | غير آمن حالياً؛ يسرد identities عالمياً بلا control-plane entitlement أو tenant scope |
| `POST /api/users` | global identity creation surface | غير آمن حالياً؛ ينشئ identity بلا contract onboarding أو control-plane entitlement |
| OrganizationMembership operations | tenant-bound authority | تتطلب `TenantContext → permission/policy → tenant-bound repository → broker executor → Prisma` |
| session organization switch | tenant-context selection | لا ينشئ membership ولا يختار أول membership ولا يمنح صلاحية تلقائياً |

## القيود الملزمة

لا يتحول `User` إلى tenant-owned عبر `activeOrganizationId` أو body `organizationId` أو أول membership أو role عام. لا يجوز اعتبار endpoint الحالي control-plane لأن auth-only لا يمثل entitlement إدارياً مستقلاً. ولا يجوز إضافة global Prisma fallback لمسارات memberships.

## أثر التنفيذ

يتطلب الإغلاق implementation منفصل لـMembershipRepository وسياسات permissions محددة ومسارات API مفصولة: listing membership-scoped للمستأجر، وglobal identity onboarding/control-plane لا يفعّل إلا بعقد product/identity صريح. إلى حين توفر ذلك العقد، تم **عزل** `GET/POST /api/users` صراحةً بحالة `410 GLOBAL_IDENTITY_SURFACE_QUARANTINED`، وأزيلت استدعاءاته من شاشات dashboard. لا يمثل العزل عقد onboarding أو دليلاً على global identity management، ولا يغيّر تصنيف هذا النطاق إلى COMPLETE قبل دليل UM runtime والتوثيق الصريح للـcontrol-plane الناقص.
