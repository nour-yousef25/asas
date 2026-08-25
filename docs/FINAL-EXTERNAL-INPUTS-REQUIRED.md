# المدخلات الخارجية المتبقية — Production

جميع الملفات تخص **Production** وتبقى خارج Git/logs/evidence. تحفظ requests غير السرية تحت `/opt/asasplus/shared/production-requests/` بملكية `root:root` وصلاحية `0600`. لا ترسل الأسرار في chat أو shell history.

| Gate | الاسم والغرض | مكان الحفظ وأقل صلاحية | الاختبار | التدوير/الإبطال |
|---|---|---|---|---|
| Payments / Mada | `ASAS_PAYMENTS_LAUNCH_SCOPE=REQUIRED` و`ASAS_PAYMENT_PRODUCTION_REQUEST_FILE` و`PAYMENT_PROVIDER_CONFIG_FILE` و`PAYMENT_WEBHOOK_LEDGER_APPROVAL_FILE`. يلزم أن يحدد request provider متعاقداً وmerchant/settlement mapping منفصل لمسار School Screen ولكل منظمة. | requests/config `root:root 0600`; API credential وwebhook verifier في systemd credential منفصل لكل merchant scope؛ لا PAN/CVV ولا secret في DB/Git/chat. | sandbox/UAT: provider signature-negative، replay/duplicate، A/B، amount/currency/organization tamper، capture/refund/void/reconciliation؛ لا charge production قبل UAT approval وpublic callback gate. | rotate API/webhook secrets، reconcile refs/settlements، أبطل credential القديم، وعلّق merchant mapping المتأثر. |
| Scheduler | `ASAS_DOMAIN_SCHEDULER_APPROVAL_FILE` وcatalogue versioned و`ASAS_SCHEDULER_HEARTBEAT_PATH` و`ASAS_SCHEDULER_MAX_LAG_SECONDS`. | `/opt/asasplus/shared/production-scheduler/`؛ catalogue/approval `root:root 0600`. | dry-run ثم execution proof مستقل لكل job/owner تحت tenant checkout. | pause job/timer، احتفظ failure audit، ثم استبدل catalogue المعتمد. |
| Go/No-Go | `ASAS_GO_NO_GO_APPROVAL_FILE`: `owner`,`maintenanceWindowUtc`,`approvalReference`. | `production-requests`, `root:root 0600`. | preflight schema/permission فقط. | انتهاء النافذة أو سحب approval يعيد No-Go. |

## أعمال مغلقة وليست مدخلات خارجية

Bootstrap Authentication وLocal VPS Storage وSaaS migrations/RLS/runtime proofs مغلقة الآن. IdP وcertificate activation ليسا شرط SaaS Bootstrap launch.

| بوابة مغلقة | الحالة | القيد التشغيلي |
|---|---|---|
| SMTP submission `schoolscreen.sa` | `CLOSED — SANDBOX VALIDATED` | credential root-only فقط؛ نجح TLS/SASL/sender/sandbox/failure/timeout/retry/redaction/audit. runtime الإنتاجي أعيد fail-closed، ولا توجد product mail flows أو live delivery مفعلة. |
