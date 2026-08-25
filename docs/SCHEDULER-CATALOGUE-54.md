# Scheduler Catalogue — Reconciliation 54

## جرد الحالة الفعلية

المسارات المجدولة الفعلية في المشروع ليست catalogue عاماً بعد. يوجد فقط worker نشر الاتصالات tenant-bound، وtimer retention التشغيلي الخاص بـASAS. لا توجد jobs مالية أو بريد أو تقارير أو SaaS entitlement مفعّلة في runtime الحالي؛ لذلك لا يجوز وصفها بأنها موجودة أو آمنة للإطلاق.

| Job / surface | الفئة | Owner | Tenant context | idempotency / retry / timeout / concurrency | failure & audit | heartbeat / lag | launch safety |
|---|---|---|---|---|---|---|---|
| `communications.publication` عبر `PublicationPlan.scheduledAt` | `NOTIFICATIONS` + `TENANT` | Communications Operations | `TenantBoundPrismaExecutor` وqueue credential لكل organization | queue job واحد، concurrency=1 حالياً؛ provider يعالج retry/backoff. | DLQ/worker failure وtenant authorization؛ audit في خطة النشر. | supervisor heartbeat في Redis. | `SAFE_CONDITIONALLY`: فقط مع tenant principal/queue credential صحيحين. |
| `asasplus-backup-retention` timer | `RETENTION` + `SYSTEM_MAINTENANCE` | Operations | لا tenant data-plane؛ ASAS-only backups. | timer يومي؛ retention script يحذف verified backups فقط بعد policy. | manifest/retention logs وfailure service status. | systemd timer health؛ لا domain scheduler. | `CLOSED`: مفعّل ومثبت في baseline. |
| Domain scheduler contract | Framework | Platform Operations | job `TENANT` يرفض غياب `organizationId`؛ التنفيذ المستقبلي يجب أن يبدأ authority checkout. | العقد يفرض idempotency، retryLimit، timeout وconcurrency. | `RETRY`/`PAUSE`/`DLQ`/`ALERT` مسجلة في catalogue؛ auditRequired صريح. | heartbeat/lag file محمي. | `IMPLEMENTABLE NOW`: لا catalogue runtime معتمد بعد. |
| Platform billing reconciliation | `FINANCIAL` | Billing Operations | tenant-bound لكل organization/subscription. | غير مفعّل. العقد المالي يملك idempotency/reconciliation. | ledger/audit مطلوبان. | لم يركب heartbeat. | `DISABLED`: يحتاج gateway provider وcatalogue approval. |
| Donation payment expiry/reconciliation | `FINANCIAL` | Organization Finance | tenant-bound لكل donation transaction. | غير مفعّل. | ledger/audit مطلوبان. | لم يركب heartbeat. | `DISABLED`: يحتاج gateway provider وcatalogue approval. |
| SMTP notifications | `NOTIFICATIONS` | Communications Operations | recipient/organization context في message contract. | transport retry bounded؛ لا queue worker عام مفعل. | recipient redacted audit. | غير مفعّل. | `DISABLED`: يحتاج SMTP external input. |
| Entitlement expiry | `PLATFORM` | Platform Operations | tenant-bound لكل subscription. | lifecycle logic موجود، no scheduler job. | audit مطلوب عند تغيير الحالة. | غير مفعّل. | `DISABLED`: يحتاج catalogue/owner policy، لا certificate. |
| Scheduled reports | `REPORTS` | Reporting Operations | tenant-bound. | لا job فعلي. | لا job فعلي. | لا job فعلي. | `NOT_IMPLEMENTED`: لا يدعي هذا التقرير وجوده. |

## العقد الإلزامي للـcatalogue

كل إدخال مستقبلي يفرض: `key` و`owner` و`version` و`category` و`tenantMode` و`intervalSeconds` و`timeoutSeconds` و`retryLimit` و`concurrency` و`failureBehavior` و`auditRequired` و`safeAtLaunch` و`approved` و`paused`. يرفض parser الإدخال غير الموافق أو duplicate key، ويمنع runner execution للـtenant job بلا `organizationId`.

> لا يثبت `organizationId` وحده authority. قبل تنفيذ أي job tenant-level في staging أو production، يجب أن ينشئ executor checkout tenant-bound كما يفعل worker النشر الحالي؛ لا global credential ولا Prisma global context.

## تنفيذ staging المسموح لاحقاً

بعد تركيب release الجديد على staging فقط، يسمح بـdry-run catalogue root-owned ثم health heartbeat/lag. لا يفعّل أي timer أو job مالي أو SMTP أو provider call. التفعيل الحقيقي لكل صف `DISABLED` يحتاج owner approval وcatalogue version معتمداً، ثم دليل A/B وfailure cleanup مستقل.

## دليل staging المنفذ

في **25 أغسطس 2026** شُغّل harness من release staging `1858f8b` مع catalogue root-owned مؤقت يحوي `scheduler.audit.tenant` فقط وبـ`dryRun=true`. أعاد المخرج `SCHEDULER_DRY_RUN_COMPLETE` و`outcome=DRY_RUN`. لم يبدأ worker أو timer، ولم تتغير services staging، ولم تُنفذ عملية domain أو egress أو provider call. أزيل manifest وdirectory المؤقتان بعد النجاح، وتأكد غياب أي `asasplus-domain-scheduler.service` أو timer أو environment enablement.

هذا الدليل يثبت parser/catalogue/tenant-identifier guard فقط؛ **لا يثبت tenant authority checkout أو تنفيذ publication حقيقي**، لأن dry-run لا يملك side effect. يظل ذلك محصوراً في worker النشر القائم وأدلته W02 المغلقة.
