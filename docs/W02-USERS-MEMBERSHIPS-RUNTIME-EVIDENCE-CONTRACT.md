# W02 — Users/Memberships Runtime Evidence Contract

لا يدمج فرع `w02-users-memberships-execution` ولا يعلن readiness قبل harness PostgreSQL disposable ومدقق exact يثبت: `UM01` Broker/session_user lease، `UM02` A/B list/detail isolation، `UM03` foreign membership IDOR/revoke denial، `UM04` create membership من global identity موجودة فقط وبـorganization من context، `UM05` duplicate/cross-tenant mutation denial، `UM06` permission default-deny وrole binding، `UM07` stale/revoked membership، `UM08` stale session/policy، `UM09` provider outage/rotation/parallel discard، و`UM10` source safety/role safety/audit correlation/cleanup/hygiene.

لا يغطي العقد `User` global identity creation أو يمنحه tenant ownership. ولا يقبل client organizationId أو activeOrganizationId أو first membership أو global Prisma fallback كبديل لأي ID.

يشمل الإغلاق أيضاً مراجعة/تحويل أي data-plane للعضويات في `iam.ts` و`policy.ts`؛ أما `auth.ts` و`tenant-context.ts` و`tenant-access-broker.ts` فهي control/identity boundaries ولا تتحول إلى tenant data ownership. لا يكفي route `api/memberships` لإعلان الإغلاق ما دامت عملية عضوية حساسة تستدعي Prisma عالميّاً خارج هذه الحدود المعلنة.

أكد الجرد أن مراجع Prisma الباقية في `auth.ts` و`tenant-context.ts` تقع ضمن حل هوية المستخدم، فحص session/membership، أو تبديل السياق المدقق؛ ولا تملك data-plane للعضويات. تبقى هذه الحدود تحت اختبارات Broker/session منفصلة، ولا يسمح هذا التصنيف لأي route أو IAM/Policy mutation بالعودة إلى Prisma العالمي.
