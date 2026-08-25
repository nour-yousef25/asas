# FINAL EXTERNAL INPUTS REQUIRED — Reconciliation 54

جميع الملفات تخص **Production** وتبقى خارج Git/logs/evidence. تحفظ الطلبات غير السرية تحت `/opt/asasplus/shared/production-requests/` بملكية `root:root` وصلاحية `0600`. لا ترسل الأسرار في chat أو shell history.

| Gate | الاسم والغرض | مكان الحفظ وأقل صلاحية | الاختبار | التدوير/الإبطال |
|---|---|---|---|---|
| Bootstrap | `ASAS_BOOTSTRAP_CONTROL_REQUEST_FILE`: `requestId`,`kind`,`administrator`,`approvedBy`,`approvalReference`,`passwordFile`,`requestedAt`,`expiresAt`. password حقيقي في `passwordFile` فقط. | request/password `root:root 0600`; لا password في request أو Git. | provision/login بشري معتمد ثم evidence redacted؛ لا ينفذه preflight. | احذف password file بعد النجاح، revoke request عند الإلغاء، وrotate `AUTH_SECRET` مع invalidation للجلسات. |
| SMTP مؤقت | `ASAS_MAIL_PRODUCTION_REQUEST_FILE` + `ASAS_MAIL_TRANSPORT_CONFIG_PATH` + switch `ASAS_MAIL_DELIVERY_ENABLED=true`. المطلوب host/port/TLS/from/sender domain/secret reference لـschoolscreen.sa. | config/secret reference `root:root 0600`; send-only scope، لا mailbox/admin scope. | provider identity/probe ثم رسالة sandbox واحدة بعد approval منفصل. | rotate credential، re-probe، revoke القديم. |
| Payments | `ASAS_PAYMENTS_LAUNCH_SCOPE=REQUIRED`, `ASAS_PAYMENT_PRODUCTION_REQUEST_FILE`, `PAYMENT_PROVIDER_CONFIG_FILE`, `PAYMENT_WEBHOOK_LEDGER_APPROVAL_FILE`. المطلوب gateway Mada-compatible وmerchant credentials/webhook secret/callback allow-list. | requests/config `root:root 0600`; token merchant الأقل صلاحية، webhook secret منفصل، لا PAN/CVV. | sandbox: signature-negative، idempotency، tenant A/B، capture/refund/void/reconciliation؛ لا charge production قبل approval. | rotate API/webhook secrets وفق provider ثم reconcile وأبطل السابق. |
| Scheduler | `ASAS_DOMAIN_SCHEDULER_APPROVAL_FILE`, catalogue root-owned versioned، `ASAS_SCHEDULER_HEARTBEAT_PATH`, `ASAS_SCHEDULER_MAX_LAG_SECONDS`. | `/opt/asasplus/shared/production-scheduler/`; catalogue/approval `root:root 0600`; لا credential global. | dry-run ثم execution proof منفصل لكل job/owner تحت tenant checkout. | pause job/timer، احتفظ failure audit، ثم استبدل catalogue المعتمد. |
| Go/No-Go | `ASAS_GO_NO_GO_APPROVAL_FILE`: `owner`,`maintenanceWindowUtc`,`approvalReference`. | `production-requests`, `root:root 0600`. | preflight schema/permission فقط. | انتهاء النافذة أو سحب approval يعيد No-Go. |

## ليست مدخلات خارجية

Local VPS Storage root/delivery secret وSaaS migration/RLS/runtime proof هي أعمال داخلية لازمة قبل Go. IdP وcertificate activation ليسا شرط SaaS Bootstrap launch.
