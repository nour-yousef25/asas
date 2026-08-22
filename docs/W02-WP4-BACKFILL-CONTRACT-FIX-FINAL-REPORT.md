# W02 WP4 — Backfill Contract Fix Final Report

**الحالة:** `W02-WP4-BACKFILL-CONTRACT-FIX COMPLETE`

## Root Cause and Remediation

كان العقد السابق يقبل منظمة واحدة ويعيّنها لجميع الصفوف ذات `organizationId = NULL`. يخالف ذلك صراحةً عقد WP0 الذي يمنع attribution الافتراضي ويشترط التوقف قبل الكتابة عند ambiguity أو orphan أو conflict. استبدل الإصلاح هذا السلوك بـmanifest صريح لكل سجل، مع مرحلتي `analyze` و`apply`، ورفض fail-closed وtransaction واحدة للتطبيق.

| عنصر | النتيجة |
|---|---|
| Default organization أو bulk assignment | أزيل |
| Manifest قابل للمراجعة | `table`, `recordId`, `organizationId`, `source`, `reason?` |
| Counters ديناميكية | `total`, `mapped`, `unmapped`, `orphan`, `ambiguous`, `conflict`, `unexpectedNull`, `invalidReference`, `updated`, `failed` |
| Parent validation | يفحص Donation مقابل Donor/Campaign/Project ويمنع parent بلا owner أو owners متعارضين |
| Atomicity | apply يعيد التحليل داخل transaction ثم يحدث الصفوف المحددة فقط؛ failure injection أثبت rollback |

## Evidence

تم تشغيل Harness حقيقي على قاعدة التدقيق `asas_w02_wp4_backfill_contract` بعد migrations الرسمية فقط. أثبت تعيين A وB صراحةً، ومنع B من أن تتحول إلى A، ورفض unmapped وambiguous وinvalid reference وconflicting manifest وparent orphan وparents المتعارضين. كما أثبت trigger تدقيقي مفروض أن failure في update ثانٍ يعيد owner السجل الأول إلى `NULL` ولا يترك كتابة جزئية.

| الدليل | النتيجة |
|---|---|
| Prisma validate/generate وTypeScript | PASS |
| Backfill Harness | PASS؛ عشرة checks، ومنها rollback الذرّي |
| Jest | 71 PASS، 1 skipped |
| Communications | PASS |
| Production build | PASS مع تحذيرات W01 المعروفة فقط: BullMQ Valkey اختياري وNext middleware/Edge |

## Git and Scope

لم تُعدّل migrations أو schema أو dependencies أو production credentials. نُفّذ العمل في worktree/branch مستقل لحماية تغييرات WP5 غير المثبتة في worktree الأصلي. لا يطلق هذا التقرير Upgrade Rehearsal ولا WP5.

## Remaining Work

يبقى `W02-WP4-UPGRADE-REHEARSAL` محظوراً حتى يعاد تدقيق هذا commit ثم يُنشأ pre-WP4 audit baseline وتنفذ ترقية رسمية متكررة وفق المرفق `pasted_content_19.txt`.
