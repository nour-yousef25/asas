# المدخلات الخارجية المتبقية — Production

جميع الملفات تخص **Production** وتبقى خارج Git/logs/evidence. تحفظ requests غير السرية تحت `/opt/asasplus/shared/production-requests/` بملكية `root:root` وصلاحية `0600`. لا ترسل الأسرار في chat أو shell history.

| Gate | الاسم والغرض | مكان الحفظ وأقل صلاحية | الاختبار | التدوير/الإبطال |
|---|---|---|---|---|
| SMTP مؤقت | `ASAS_MAIL_PRODUCTION_REQUEST_FILE` + `ASAS_MAIL_TRANSPORT_CONFIG_PATH` + `ASAS_MAIL_DELIVERY_ENABLED=true`. | config/secret reference `root:root 0600`; send-only scope، لا mailbox/admin scope. | provider identity/probe ثم sandbox message واحدة بعد approval منفصل. | rotate credential ثم re-probe وأبطل السابق. |
| Payments | `ASAS_PAYMENTS_LAUNCH_SCOPE=REQUIRED` و`ASAS_PAYMENT_PRODUCTION_REQUEST_FILE` و`PAYMENT_PROVIDER_CONFIG_FILE` و`PAYMENT_WEBHOOK_LEDGER_APPROVAL_FILE`. | requests/config `root:root 0600`; merchant token الأقل صلاحية وwebhook secret منفصل؛ لا PAN/CVV. | sandbox signature-negative/idempotency/A-B/capture/refund/void/reconciliation؛ لا charge production قبل UAT approval. | rotate API/webhook secrets ثم reconcile وأبطل السابق. |
| Scheduler | `ASAS_DOMAIN_SCHEDULER_APPROVAL_FILE` وcatalogue versioned و`ASAS_SCHEDULER_HEARTBEAT_PATH` و`ASAS_SCHEDULER_MAX_LAG_SECONDS`. | `/opt/asasplus/shared/production-scheduler/`؛ catalogue/approval `root:root 0600`. | dry-run ثم execution proof مستقل لكل job/owner تحت tenant checkout. | pause job/timer، احتفظ failure audit، ثم استبدل catalogue المعتمد. |
| Go/No-Go | `ASAS_GO_NO_GO_APPROVAL_FILE`: `owner`,`maintenanceWindowUtc`,`approvalReference`. | `production-requests`, `root:root 0600`. | preflight schema/permission فقط. | انتهاء النافذة أو سحب approval يعيد No-Go. |

## أعمال مغلقة وليست مدخلات خارجية

Bootstrap Authentication وLocal VPS Storage وSaaS migrations/RLS/runtime proofs مغلقة الآن. IdP وcertificate activation ليسا شرط SaaS Bootstrap launch.
