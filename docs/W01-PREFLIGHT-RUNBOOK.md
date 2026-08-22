# W01 Preflight Runbook

يقصر هذا الدليل التنفيذ على read-only probes. لا يكتب بيانات التطبيق ولا ينشئ backup ولا يطبق migration.

| المدخل | الغرض | الحالة الصحيحة عند غيابه |
|---|---|---|
| `DATABASE_URL` | probe PostgreSQL `SELECT 1` | `NOT_CONFIGURED` أو `UNAVAILABLE` |
| `REDIS_URL` | Redis PING | `NOT_CONFIGURED` أو `DEGRADED` |
| S3 variables + `ASAS_PREFLIGHT_STORAGE_PROBE_URL` | provider health GET read-only | `NOT_CONFIGURED` أو `DEGRADED` |
| `ASAS_PUBLIC_URL` | HTTPS endpoint GET read-only | `NOT_CONFIGURED` أو `DEGRADED` |
| `ASAS_PREFLIGHT_EGRESS_URL` | outbound egress GET read-only | `NOT_CONFIGURED` أو `DEGRADED` |

شغّل `npm run preflight` في البيئة الهدف واحفظ JSON output كـEvidence. لا يعالج preflight عيباً ولا يمرر النتيجة باللون الأخضر عند فشل dependency. Scheduler اختياري في W01؛ يعلن `NOT_CONFIGURED` حتى يعتمد scheduler adapter صريح.

في audit execution، كانت DB وRedis وStorage وTLS وEgress والموارد `HEALTHY` و`ready=true`. لم يكن scheduler مهيأ، وسجل ذلك كحالة صحيحة لا كنجاح مصطنع.
