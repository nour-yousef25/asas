# W02 — Isolated PostgreSQL Audit Environment

> هذه بيئة تدقيق مؤقتة ومعزولة محلياً. **ليست Production وليست target-like provider ولا تثبت HA/DR/SLA أو RPO/RTO.**

## البيئة المتحققة

| بند | القيمة المتحققة | حد الأمان |
|---|---|---|
| PostgreSQL | `16.15` على Ubuntu | متوافق مع Prisma/schema الحالية؛ لا تستخدم بيانات أو migrations إنتاجية |
| الاستماع | `127.0.0.1:5432` و`[::1]:5432` فقط | لا يوجد bind عام أو URL منشور |
| المصادقة | `scram-sha-256`، وTLS مفعّل في server | credentials عشوائية memory-only لكل harness، ولا تحفظ في Git أو evidence |
| Docker | غير متاح في sandbox الحالي | لا يُدعى container أو image أو network isolation غير موجودة |
| قاعدة التدقيق | database فريدة عشوائياً لكل rehearsal | ينشئها migrator audit فقط ثم يحذفها بـ`DROP DATABASE ... WITH (FORCE)` |
| الأدوار | control وtenant principals عشوائية | `LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE`؛ runtime principals غير مالكة |

## نموذج الملكية والتشغيل

ينشئ harness كل audit database بمالك migration مؤقت منفصل عن control role وtenant principals. يجري التطبيق عبر migrations الرسمية forward-only، ويجري الوصول tenant-bound فقط عبر broker وlease وprovider يتحقق من `session_user`. لا يمر `organizationId` من العميل كهوية، ولا تستخدم `current_setting` أو `set_config` أو `SET ROLE` أو global credential.

| خطوة | الإجراء المسموح | الدليل المطلوب |
|---|---|---|
| Bootstrap | إنشاء database/roles عشوائية محلياً وتشغيل `prisma migrate deploy` | PostgreSQL disposable وPrisma validate/generate |
| Rehearsal | fixtures A/B وroles tenant غير مالكة؛ migrations forward-only | IDs exact، expected/actual/result، A/B/direct-query/context-switch عند انطباقه |
| Failure | outage/rotation/revocation محاكاة داخل harness فقط | fail-closed، بلا fallback أو credential دائم |
| Cleanup | disconnect ثم `DROP DATABASE ... WITH (FORCE)` و`DROP ROLE` | `residueCount = 0` وevidence `0600` وhygiene PASS |

## قيود صريحة

لا تثبت البيئة provider workload identity أو KMS أو pool topology أو failover أو backup/restore semantics أو limits/scale أو worker deployment. تظل هذه البنود `EXTERNAL DEPLOYMENT PREREQUISITE` في DT01–DT06. يجوز للحarness المحلي إثبات migrations وRLS وA/B/context-switch/rollback الواقعية فقط عندما تتحقق family-wide code/ownership prerequisites.
