# Domain Scheduler Production Readiness

## القرار

**الحالة: `SCHEDULER — EXTERNAL INPUT REQUIRED`.** أُغلق framework الداخلي وdry-run المقيد على staging، لكنه ليس production scheduler مفعلاً. لا يوجد catalogue production معتمد أو owner approval أو heartbeat path/lag threshold معتمدان، ولا service/timer باسم Domain Scheduler. لذلك لا يجوز إعلان scheduler حي أو تشغيل أي job في production.

## الحالة الداخلية

| مجال التحكم | النتيجة | الدليل |
|---|---|---|
| catalogue validation | `CLOSED_INTERNAL` | schema versioned يفرض key/purpose/owner/version/category/tenant mode/interval/timezone/IANA/input/output/side-effect/dependencies/timeout/retry/concurrency/failure/audit/approval/enablement. يرفض duplicate أو غير الموافق. |
| timezone وschedule | `CLOSED_INTERNAL` | timezone IANA يتحقق منه، وslot لا يقبل إلا timestamp صحيحاً موافقاً لـinterval؛ schedules الحالية interval-based وUTC slot semantics مع timezone موثق في catalogue. |
| tenant scoping | `CLOSED_INTERNAL` | job `TENANT` يرفض organization غائباً أو غير صالح. لا يمثل identifier authority؛ execution حقيقي يحتاج tenant-bound checkout مستقل. |
| idempotency وconcurrency | `CLOSED_INTERNAL` | key مشتق من job/organization/slot؛ duplicate يرفض، وstore يحد active runs لكل job/tenant. |
| retry/timeout/failure | `CLOSED_INTERNAL` | retry حدّه 0–5، timeout فعلي بـ`Promise.race`، و`PAUSE` يوقف job بعد الاستنفاد؛ لا infinite retry. `DLQ`/`ALERT` contract فقط حتى تتوفر sink/owner policy. |
| observability/audit | `CLOSED_INTERNAL` | auditRequired وapproved إلزاميان؛ store يسجل outcome، وheartbeat versioned يرفض permissions غير الآمنة أو lag/absence. |
| worker/queue | `CLOSED_INTERNAL` | tenant-publication supervisor هو worker منفصل، per-tenant queue credential وtenant-bound executor؛ لا global queue fallback. worker القديم quarantined. |
| production enablement | `BLOCKED_BY_DESIGN` | لا `asasplus-domain-scheduler.service` أو timer أو environment enablement، ولا catalogue runtime دائم. هذا منع مقصود وليس عيباً مخفياً. |

## Catalogue والتصنيف

| Job identifier | purpose / scope | schedule/timezone | side effect | الحالة | سبب القرار |
|---|---|---|---|---|---|
| `scheduler.audit.tenant` | harness catalogue/tenant-slot audit؛ tenant identifier فقط، لا authority checkout | كل 300 ثانية، `Asia/Riyadh` | none | **A — INTERNAL / SAFE TO CLOSE** | manifest مؤقت root-only، disabled/paused، dry-run فقط ثم cleanup. ليس job إنتاجياً. |
| `communications.publication` | نشر خطة اتصال tenant-bound عبر worker القائم | حسب `PublicationPlan.scheduledAt`؛ لا Domain Scheduler schedule مستقل | tenant communication | **A — INTERNAL / SAFE TO CLOSE** | worker/queue وheartbeat لهما دليل W02 مستقل؛ لا يُعاد تشغيله عبر executor عام. |
| `asasplus-backup-retention` | احتفاظ backups الخاصة بـASAS فقط | systemd daily timer؛ timezone يحدده host/systemd | حذف backup verified وفق policy | **D — NOT APPLICABLE** | timer تشغيلي مستقل ومغلق في baseline؛ ليس Domain Scheduler job. |
| `platform.billing.reconciliation` | مطابقة اشتراك platform settlement | غير معتمد | financial/provider | **B — EXTERNAL INPUT REQUIRED** | Payments/Mada provider وmerchant/settlement/UAT وowner catalogue. |
| `donation.payment.reconciliation` | مطابقة تبرعات الجمعيات | غير معتمد | financial/provider | **B — EXTERNAL INPUT REQUIRED** | provider/mapping/reconciliation contract وapproval. |
| `smtp.notifications` | إرسال notifications منتجية | غير معتمد | email | **B — EXTERNAL INPUT REQUIRED** | transport qualification مغلقة، لكن product mail flows وlive delivery/owner catalogue غير معتمدة. |
| `entitlement.expiry` | تعليق/انتهاء entitlement بحدود tenant | غير معتمد | internal tenant state | **B — EXTERNAL INPUT REQUIRED** | policy مالك المنتج، catalogue version، audit/rollback expectation، heartbeat/lag configuration. |
| `reports.scheduled` | تقارير موقّتة | غير مطبق | غير معروف | **C — BLOCKED / UNSAFE** | لا job implementation أو input/output/owner/authority؛ لا يضاف أو يشغل. |

## دليل staging dry-run

| الاختبار | النتيجة |
|---|---|
| release staging | `1858f8b` نشر بصورة ذرية وhealth المصادق نجح. |
| manifest | temporary `root:root 0600` في directory `0700`؛ job واحد `scheduler.audit.tenant`، `NONE`، disabled/paused، بلا dependencies أو credential. |
| parser/timezone/schedule/tenant scope | `PASS`؛ catalogue version `1.0.0` وIANA `Asia/Riyadh` وslot aligned وtenant identifier صالح. |
| side effect | `PASS — NONE`؛ scheduler بلا executor و`dryRun=true`. لم يبدأ worker أو timer أو email/payment/provider call أو egress. |
| idempotency/concurrency/retry/timeout | `PASS — CONTRACT TEST`؛ اختبارات scheduler على staging release أثبتت duplicate/concurrency/PAUSE/retry/timeout bounded. لا تدعي هذه نتيجة تنفيذ job منتج. |
| heartbeat/lag | `PASS — CONTRACT TEST`؛ اختبارات heartbeat/lag على staging release نجحت. لم يثبت heartbeat إنتاجي لأنه لا scheduler مفعلاً. |
| cleanup | `PASS`؛ manifest وdirectory حُذفا، ولا service/timer أو environment enablement للـDomain Scheduler بقيت. |

## التحقق والجودة

| التحقق | النتيجة |
|---|---|
| TypeScript / Jest / build | `PASS`؛ TypeScript وJest الكامل وNext.js build نجحت بعد hardening. |
| W02 broker coverage guard | `PASS_BROKER_COVERAGE_GUARD`. |
| W02 audit artifact static scan | `PASS_AUDIT_ARTIFACT_HYGIENE_SCAN` بلا findings. |
| diff / secret markers | `PASS`؛ `git diff --check` وscan الإضافات لم يجدا password أو connection string أو private key أو payment secret. |
| W02 audit artifact hygiene self-test | `BLOCKED — UNRELATED HARNESS FAILURE`؛ الحالة `E-HYG-01:UNEXPECTED_STATUS_OR_CLEANUP` صدرت من harness قاعدة بيانات محلي تاريخي بعد اكتمال Jest/build وbroker guard. لم يُعد تشغيله ولم يُستخدم owner/superuser لتجاوزه؛ لا يتعلق بخدمة Domain Scheduler أو staging، لكنه يبقى blocker جودة منفصلاً يحتاج إصلاح harness في نطاقه. |

## المدخلات الخارجية الدقيقة قبل الإنتاج

| المطلوب | الغرض | التخزين/التحكم | الاختبار قبل التمكين |
|---|---|---|---|
| `ASAS_DOMAIN_SCHEDULER_APPROVAL_FILE` | owner، maintenance window، catalogue version وapproval reference. | `/opt/asasplus/shared/production-scheduler/`، `root:root 0600`. | schema وexpiry/owner verification فقط. |
| catalogue production root-only | قائمة approved jobs فقط مع كل حقول schema، بما فيها side effects/dependencies وenabled state. | نفس directory، `root:root 0600`، لا secrets داخله. | parse/deny unknown/tenant A/B/dry-run لكل job. |
| `ASAS_SCHEDULER_HEARTBEAT_PATH` و`ASAS_SCHEDULER_MAX_LAG_SECONDS` | health وlag detection محددان بحسب intervals المعتمدة. | path root-owned غير group/world-writable؛ threshold لا يختار عشوائياً. | fresh/stale/missing/unsafe-permission probes. |
| sinks/credentials للـDLQ أو ALERT | مطلوبة فقط إن وافق catalogue job يستعملها. | systemd credential منفصل بأقل صلاحية. | failure negative/retry ceiling/redaction/cleanup. |
| متطلبات provider/job الخارجية | لكل financial/mail/provider job حسب بوابته المستقلة. | لا تكتب الآن. | UAT منفصل بعد إغلاق provider gate. |

## rollback/disable

لا يوجد live scheduler يمكن إيقافه الآن. عند تمكين لاحق، rollback هو: disable service/timer، إزالة/استبدال catalogue approval، حذف أو عزل systemd credential، التحقق من غياب heartbeat، واحتفاظ audit/failure records. لا يعدّل rollback migrations أو tenant data ولا يعيد تشغيل job failed تلقائياً.
