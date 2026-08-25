# FINAL PRODUCTION GO/NO-GO REVIEW — ASAS Plus

**قرار المراجعة:** `NO-GO`.

| المجال | القرار | السبب |
|---|---:|---|
| Platform core | `GO-ELIGIBLE` | production foundation/RLS/Broker/Redis/worker/backup/restore/rollback/TLS/candidate vhost مثبتة ضمن baseline. |
| External gates | `NO-GO` | storage، bootstrap/IdP، mail، payments إن كانت ضمن scope، license، scheduler، وowner/window لم تغلق. |
| DNS/public traffic | `HOLD` | لا تغيير أو تفعيل مسموح قبل إغلاق البوابات وعبارة النشر الصريحة. |

## شروط تحويل القرار إلى Go

يصبح القرار `GO` فقط عندما يعيد `pnpm run preflight:external-gates` حالة `READY_FOR_PRODUCTION_SWITCH`، وتكون adapters الناقصة مختبرة ببيئة provider الصحيحة، ويكون ملف approval الخاص بالمالك ونافذة الصيانة صالحاً، ثم ترد العبارة الصريحة: `انشر على asasplus.shop الآن`.

لا تكفي credentials، ولا certificate، ولا URL منفردة لتغيير القرار. يجب أن يثبت لكل integration: least privilege، health/probe غير مدمر، fail-closed، owner، rotation/revocation، وإدراج صحيح في backup/rollback implications.

## No-Go triggers

أي من الحالات التالية يبقي القرار `NO-GO`: health required component غير سليم، provider implementation placeholder أو mock، missing request approval، غياب owner/window، أي محاولة لتسجيل secret في evidence، أو أي تعديل DNS/public vhost قبل phrase النشر.

## عند اكتمال البوابات

لا يبدأ cutover تلقائياً. يتوقف العمل على هذا المستند إلى أن يقرر المالك scope للخدمات الاختيارية ويوفر الملفات/الأسرار المحددة في [FINAL-EXTERNAL-GATES-CLOSURE.md](./FINAL-EXTERNAL-GATES-CLOSURE.md)، ثم تصدر مراجعة Go/No-Go جديدة قبل تنفيذ [PRODUCTION-CUTOVER-RUNBOOK.md](./PRODUCTION-CUTOVER-RUNBOOK.md).
