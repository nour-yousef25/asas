# W02 — Nullable-Root Backfill Architecture Decision

## القرار

يُختار **Control-Plane Immutable Audit Ledger** لمسار backfill فقط، مشروطاً بإثبات PostgreSQL audit مستقل قبل اعتماد أي migration أو backfill. لا يعيد هذا القرار استخدام `audit_logs`، ولا يمنح control-plane أي سلطة قراءة أو كتابة على tenant data-plane، ولا يغير مرساة هوية RLS التي تبقى tenant PostgreSQL `LOGIN → session_user → protected role-OID mapping`. [1]

> هذا قرار تصميم مشروط بالدليل، وليس تصريحاً لتفعيل RLS المالي أو تنفيذ backfill أو نشر provider. يفشل الحل إذا لم تثبت حدود ledger محلياً كما هو محدد أدناه.

## المقارنة

| البعد | Ledger control-plane مستقل | Backfill tenant-by-tenant | تعديل عقد `audit_logs` |
|---|---|---|---|
| حد الثقة | يفصل audit authority عن tenant data؛ أصغر صلاحيات ممكنة | يجبر عملية ترحيل على امتلاك actor/membership/lease لكل منظمة | يوسع tenant audit surface أو يمنح استثناءً عالي المخاطر |
| توافق FORCE RLS | كامل؛ لا يكتب في `audit_logs` | ممكن نظرياً لكن يتطلب authority وactor قانونيين لكل legacy organization | ضعيف؛ يخلق ضغطاً لاستثناء RLS أو هوية بديلة |
| عزل A/B | جدول ledger لا يمنح tenant أي DML؛ كل event يحمل org كـmetadata فقط | قابل للتحقق لكن عمليات كثيرة وpartial workflow أكثر تعقيداً | خطر cross-tenant write مرتفع |
| سلامة/Replays | append-only، operation/attempt idempotency، correlation وoutcome منفصل | lease لكل عملية يحمي replay لكنه لا يحل manifest/actor ambiguity | غير آمن بلا تغيير ثقة جوهري |
| recovery/rollback | `STARTED` بلا outcome يكشف partial failure؛ لا false-success؛ retry event مستقل | يحتاج orchestration/resume لكل tenant وإثبات rollback متسلسل | يحتاج تغيير شامل لعقد audit وRLS |
| concurrency/DR/HA | ledger مستقل بسيط وappend-only؛ retention/backup مستقلة | pool/principal/lease density أكبر وتشغيل أصعب عبر Cloud/Dedicated/Self-Hosted | خطر مرتفع وتشغيل غير مدعوم حالياً |
| سلامة migration/evidence | successor فقط، proof قبل migration، validator exact | يعتمد على تمكين roots غير المملوكة قبل الإثبات | لا يوجد مسار آمن مقبول |

رفض بديل tenant-by-tenant في هذه المرحلة ليس لأن tenant-bound operations غير آمنة، بل لأن legacy manifest لا يحمل actor/membership قانونياً لكل منظمة، ولا يجوز استنتاج ذلك من `activeOrganizationId` أو أول عضوية. ويُرفض تعديل `audit_logs` لأنه يضع control-plane داخل tenant data-plane المحمي بـFORCE RLS.

## boundary والتفويض

| المجال | القاعدة |
|---|---|
| هوية tenant | لا تتغير: `session_user` للـtenant LOGIN وحده مرساة RLS. |
| هوية ledger | control-plane audit authority منفصلة، غير tenant principal، ومحدودة بappend-only ledger فقط. |
| صلاحيات control-plane | لا `SELECT/INSERT/UPDATE/DELETE` على tenant roots أو children أو `audit_logs`. |
| صلاحيات tenant | لا `USAGE`/DML على ledger ولا `EXECUTE` على أي writer خاص به. |
| integrity | event immutable؛ مفتاح operation/attempt يمنع duplicate outcome؛ correlation وmanifest digest محفوظان؛ لا توجد حالة نجاح بلا outcome committed. |
| failure | transaction failure يولد `FAILED` أو يترك `STARTED` قابلاً للرصد؛ لا يُعامل الغياب كنجاح. |
| retention/DR | ledger له retention وbackup/restore verification منفصلان، ولا يكون مصدراً لبيانات tenant أو credentials. |

## دليل القبول قبل التنفيذ

يتطلب Phase B PostgreSQL disposable proof معرفات exact تبيّن: tenant A/B لا يكتبان ledger ولا audit row للآخر؛ control authority يسجل A وB metadata فقط ولا يملك mutation tenant data؛ replay/duplicate يرفض؛ correlation يبقى؛ failure وpartial observable؛ cleanup/hygiene/validator pass. لا يمكن بدء nullable-root migration أو dashboard cutover قبل PASS.

[1]: ./ADR-W02-010-CONTROL-PLANE-BACKFILL-AUDIT.md
