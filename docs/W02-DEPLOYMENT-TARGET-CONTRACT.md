# W02 — Deployment Target Contract

## الحالة والنطاق

هذا عقد **EXTERNAL DEPLOYMENT PREREQUISITE** لـCloud وDedicated وSelf-Hosted. لا يهيئ provider ولا ينشئ URL أو credentials ولا يعد دليلاً لإنتاج أو Financial RLS. الغرض منه جعل rehearsal غير الإنتاجي قابلاً للتنفيذ عند توفير صاحب النشر للمدخلات التالية.

| الجهة المالكة | الالتزام المطلوب | دليل القبول غير الإنتاجي |
|---|---|---|
| Deployment owner | تعريف topology وبيئة target-like وفصلها عن production | architecture reference وبيان boundaries |
| DBA | tenant LOGIN principals: `LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE`، protected role-OID mapping، FORCE RLS، grants دقيقة | inventory مدقق للـroles وmapping وgrants؛ لا كلمات مرور |
| Security | workload identity وopaque credential resolution، rotation/revocation، audit retention | policy/control evidence مع redaction كامل |
| Provider operator | pool limits، health checks، failover، backups/restore وقيود capacity | runbook ونتائج rehearsal غير إنتاجية |
| Application | `TenantConnectionProvider` fail-closed، Broker lease one-time، discard على كل checkout، بلا fallback عالمي | harness application/runtime مطابق للعقد |

## مصفوفة rehearsal المطلوبة

| ID | سيناريو | النجاح المقبول |
|---|---|---|
| DT01 | tenant A/B principals عبر pool reuse | لا يمر اتصال أو query بهوية tenant خاطئة؛ كل checkout يتحقق من `session_user` ويُdiscard |
| DT02 | principal rotation/revocation | lease قديم يرفض قبل data-plane؛ principal جديد فقط يعمل |
| DT03 | provider/pool outage وhealth recovery | fail-closed؛ لا universal credential ولا global Prisma fallback؛ recovery موثق بعد صحة identity |
| DT04 | failover | لا cross-tenant disclosure؛ health routing وreconnect ضمن سياسة owner |
| DT05 | backup/restore | restore rehearsal يثبت حماية mapping وRLS والـaudit وفق RPO/RTO المعتمدين |
| DT06 | capacity/scale | exhaustion وlimits لا تتجاوز tenant boundary ولا تخفض checks الأمنية |

## موانع صريحة

لا يُقبل كبديل: audit database محلي، URL في التطبيق، role owner، superuser، `BYPASSRLS`، `current_setting`/`set_config` كهوية، أو بيانات/credentials إنتاجية. إلى أن يسلم deployment owner contract inputs وبيئة target-like، يبقى Financial RLS وW02 global closure محجوبين خارجياً.
