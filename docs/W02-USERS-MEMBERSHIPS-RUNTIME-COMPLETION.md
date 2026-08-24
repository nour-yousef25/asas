# W02 — Users/Memberships Runtime Completion

## نطاق الإثبات

أثبت harness مستقل على PostgreSQL محلي **disposable** العقد `UM01–UM10` لمسار `OrganizationMembership` وعمليات IAM/Policy المرتبطة به. مرّ كل تنفيذ عبر `TenantAccessBroker → TenantBoundPrismaExecutor → MembershipRepository/IAM/Policy`، واستعمل موفر الاتصال principal خاصاً بالمستأجر يتحقق داخلياً من `session_user`. لم يُستخدم Raw GUC أو `current_setting` أو `set_config` أو `organizationMemberships[0]` أو `activeOrganizationId` كسلطة data-plane، كما لم تستخدم الأدوار غير المالكة أي `SUPERUSER` أو `BYPASSRLS` أو credential عام.

تم عزل `GET/POST /api/users` صراحةً بحالة `410 GLOBAL_IDENTITY_SURFACE_QUARANTINED`. هذا قرار fail-closed: لا يحول `User` العالمي إلى مورد tenant-owned ولا يختلق entitlement control-plane. استبدلت شاشات المهام والتقييمات قارئ identities العالمي بمسار memberships المقيّد، وأوقفت شاشة تسجيل العضو إنشاء identity عالمي جديد إلى أن يعتمد عقد onboarding/control-plane مستقل.

| البوابة | النتيجة المثبتة |
|---|---|
| `UM01` | lease أحادية الاستخدام تستهلك، وموفر الاتصال يثبت principal A عبر `session_user` |
| `UM02–UM03` | قوائم/بحث/pagination/detail A/B، إخفاء membership الأجنبي، منع revoke/role/override الأجنبي، وعدم تسريب audit rows بين A/B |
| `UM04–UM05` | إنشاء membership من `User` عالمي موجود ونشط فقط، وstamp لـ`organizationId` من `TenantContext`، ومنع duplicate/cross-tenant mutation مع تحقق عدم الكتابة |
| `UM06–UM07` | default-deny وrole binding وALLOW/DENY override وself-escalation/SoD؛ revoke يزيد `policyVersion` ويمنع البيانات اللاحقة |
| `UM08–UM09` | replay/revocation/stale session/stale policy، outage، rotation A1→A2، A/B parallel clients وdiscard |
| `UM10` | فحص المصدر والأدوار غير المالكة وcorrelation audit وسلامة cleanup/hygiene |
| المدقق المستقل | `valid: true`، بلا IDs مفقودة أو مكررة أو فاشلة؛ الدليل والمدقق مؤرشفان بصلاحية `0600` |

## بوابة الانحدار

نجحت `prisma validate` و`prisma generate` و`tsc --noEmit` وJest الكامل (**17 suites / 91 tests PASS**، مع suite واحدة skipped مسبقاً) وفحص communications وproduction build وفحص artifact hygiene. استخدم Prisma سلسلة `DATABASE_URL` محلية تركيبية صالحة لغوياً فقط ولم يتصل هذا المسار بقاعدة إنتاجية. بقيت تحذيرات build السابقة غير الحاجبة المتعلقة بـ`process.cwd` في Edge Runtime وبالـoptional `@valkey/valkey-glide` خارج نطاق هذا الإغلاق.

## حدود النتيجة

هذه **COMPLETE LIMITED AUDIT RUNTIME** لمسار memberships tenant-bound وIAM/Policy فقط. لا تثبت إدارة `User` العالمي أو onboarding/control-plane entitlement، ولا تثبت provider إنتاجياً أو DR/HA/scale أو RLS لكل عائلات W02. ولا تغلق Queue/Redis/Cache أو Storage/Root Documents أو Financial RLS أو W02 global closure.
