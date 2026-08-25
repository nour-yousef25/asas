# FINAL PRODUCTION PREFLIGHT — ASAS Plus

هذا الـpreflight **لا ينشر** ولا يغير DNS أو public vhost أو traffic. الغرض منه عرض بوابات الإطلاق بصيغة قابلة للتدقيق وfail-closed.

## التنفيذ المحلي قبل أي Go/No-Go

شغّل:

```bash
pnpm run preflight:external-gates
```

المخرج JSON فقط، ولا يتضمن قيمة سر أو محتوى ملف request. يخرج الأمر بالرمز `0` فقط إن كانت كل البوابات المطلوبة مغلقة؛ والرمز `2` يعني `FINAL_PRODUCTION_GO_NO_GO_REVIEW` ولا يجوز تفسيره كنجاح جزئي.

| تحقق | نتيجة حالية | معيار المرور النهائي |
|---|---:|---|
| Core production runtime | `PASS` | web/worker/Redis active، listeners loopback فقط، health authorized `200`. |
| DB/RLS/Broker/Queue | `PASS` | لا يعاد الاختبار هنا؛ baseline production evidence مثبت. |
| Backup/restore/retention | `PASS` | manifest `HEALTHY` وrestore rehearsal وtimer retention active. |
| Storage | `BLOCKED` | provider adapter + least-privilege credentials + read-only probe + tenant lifecycle proof. |
| Bootstrap/IdP | `BLOCKED` | provisioner أو adapter production + request approved + negative/revocation evidence. |
| Mail | `BLOCKED` | adapter + sandbox-only probe approved. |
| Payments | `BLOCKED` | launch scope decision وprovider implementation/reconciliation؛ وإلا explicit excluded. |
| License | `BLOCKED` | runtime enforcement + signed certificate/keyring/binding verification. |
| Scheduler | `BLOCKED` | approved catalog + adapter + internal dry-run/health. |
| Owner/window | `BLOCKED` | root-only approval request مع owner/window/reference. |

## متطلبات ملفات الطلبات

ملفات الطلبات ليست credentials. تخزن تحت `/opt/asasplus/shared/production-requests/` بمالك `root:root` وصلاحية `0600`. يرفض preflight أي request file قابل للقراءة من group/other. ملفات secrets الفعلية منفصلة ولا تسجل في terminal أو Git أو report evidence.

| الملف | الحقول غير السرية المطلوبة | فحص preflight |
|---|---|---|
| `ASAS_BOOTSTRAP_ADMIN_REQUEST_FILE` | `organizationName`, `adminName`, `adminEmail`, `approvalReference`, `passwordFile` | صيغة/permissions فقط. |
| `ASAS_LICENSE_ACTIVATION_REQUEST_FILE` | `certificateFile`, `keyringFile`, `approvalReference` | صيغة/permissions فقط. |
| `ASAS_DOMAIN_SCHEDULER_MANIFEST_PATH` | `owner`, `approvalReference`, `jobCatalogVersion` | صيغة/permissions فقط. |
| `ASAS_GO_NO_GO_APPROVAL_FILE` | `owner`, `maintenanceWindowUtc`, `approvalReference` | صيغة/permissions فقط. |

## قواعد التشغيل

لا تُحمّل secrets من سطر الأوامر. لا تستخدم `prisma db seed`. لا تنشئ user أو organization أو tenant principal قبل وجود approval request صالح، وبعد التنفيذ يجب إزالة password/request material وفق runbook. لا يصبح وجود `S3_*` أو `PAYMENT_*` أو `OIDC_*` وحده PASS؛ الـprobe الصحيح في adapter المعتمد شرط مستقل.
