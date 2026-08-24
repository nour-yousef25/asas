# W02 — Deployment Portability Contract

> **حد الإثبات:** هذا العقد يصف ما يلزم لتشغيلٍ قابل للنقل، ولا يحوّل PostgreSQL audit المحلي أو disposable harness إلى provider evidence أو دليل توافر عالٍ أو تعافٍ من كوارث.

## Contract

| طبقة | مدخلات مطلوبة للنشر | ما يتحقق محلياً | ما يبقى للمالك التشغيلي |
|---|---|---|---|
| Runtime | Node.js وpnpm متوافقان مع `package.json` وlockfile، وبيئة build نظيفة | `pnpm install --frozen-lockfile` وPrisma generate وbuild من snapshot مصدر معزول | صورة runtime، reverse proxy، TLS، مراقبة وإدارة secrets |
| Database | PostgreSQL مع TLS، SCRAM، migrator منفصل، principals tenant `LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS` وrole-OID map محمية | migrations الرسمية وA/B RLS على قاعدة disposable | provisioning المدعوم، workload identity، rotation وpool topology |
| Worker/cache/storage | Redis وworker وobject-storage وفق env contract | لا يثبت rehearsal المحلي توافرها أو تشغيلها production-like | الشبكة، ACLs، retries، retention، monitoring وسعة الخدمة |
| Continuity | backup/restore، health routing، failover وcapacity runbook | لا شيء؛ لا يوجد topology متعدد العقد | اختبارات restore/failover والسعة وRPO/RTO المملوكة للنشر |

## Non-negotiable Security Rules

لا يُسمح لطلب التشغيل بتحديد منظمة authoritative، ولا raw GUC أو global application credential أو owner/superuser/BYPASSRLS في data-plane. يظل identity path هو **TenantContext → policy → Broker lease → tenant PostgreSQL LOGIN → `session_user` → protected role-OID map → FORCE RLS**.

## Rehearsal Boundary

`scripts/w02-portability-rehearsal.mjs` يأخذ snapshot للعمل المحلي إلى مجلد مؤقت، يستبعد `.git` و`node_modules` ومخرجات البناء والأسرار، ثم يعيد تثبيت lockfile ويشغل Prisma/build وFinancial RLS harness. نجاحه لا يثبت provider، KMS، workload identity حقيقي، pooling deployment-owned، HA، DR، failover، RPO/RTO أو scale.
