# BLOCKER — W02 Full Continuous Execution: RLS Identity Contract Conflict

## Root Cause

يوجد تعارض أمني صريح بين مصدرين ملزمين في W02. تنص `W02-IMPLEMENTATION-PLAN.md`، في قاعدة تنفيذ قاعدة البيانات واستراتيجية M6، على استخدام إعداد transaction-local كمرساة هوية RLS (`set_config` وdirect-query proof). في المقابل، يسجل `W02-DECISION-REGISTER.md` القرار المقبول `W02-D-02`: **رفض Raw GUC identity** وعدم تنفيذ أي هوية تعتمد `current_setting`.

لا يمكن تنفيذ RLS Wave 1 أو أي wave لاحقة مع ادعاء الامتثال للمصدرين معاً. اختيار أحدهما من دون قرار معماري صريح يغير Security Contract، وهو محظور في التفويض.

## Security Impact

استخدام GUC خام كمرساة هوية يسمح، بحسب evidence البديلة السابقة، بإمكان تبديل سياق tenant داخل جلسة PostgreSQL. تجاهل خطة التنفيذ من دون تعديل رسمي يخلق مساراً غير قابل للمراجعة ولا يثبت أن شروط W02 mandatory قد استوفيت. لذلك يبقى الحظر على RLS وQueue/Storage/tenant-sensitive surfaces التي تعتمد RLS فعالاً.

## Evidence

| المصدر | النص المتعارض | الأثر |
|---|---|---|
| `W02-IMPLEMENTATION-PLAN.md` | M6: `set_config` transaction-local setting وdirect-query negative tests | يصف GUC كهوية runtime لـRLS |
| `W02-DECISION-REGISTER.md` | `W02-D-02`: Raw GUC identity is rejected; no `current_setting` identity implementation | يمنع نهج M6 المذكور |
| `W02-RLS-ALTERNATIVE-ARCHITECTURE-DECISION.md` | Hybrid tenant-bound PostgreSQL identity direction | يثبت وجود مسار بديل يحتاج إدماجاً رسمياً في الخطة |
| `W02-BROKER-TEST-COVERAGE-RERUN-EVIDENCE.json` | Broker B01–B60 audit-only PASS | لا يرفع تعارض architecture ولا يجيز RLS |

## Affected Scope

يتوقف W02 بعد read-only pre-execution audit. لا يبدأ Broker lifecycle أو RLS Wave 1 أو migrations جديدة أو Queue/Redis/Cache أو Storage أو Users/Memberships أو Documents أو Reports/Privacy/Vault أو Activation أو IDP أو W03.

## What Was NOT Changed

لم يتغير source application أو Prisma schema أو migration history أو package version أو production environment أو قاعدة بيانات إنتاج أو credential أو expected result أو Broker contract. لم تشغّل أي RLS/Queue/Storage proof جديدة ولم تحذف أي evidence تاريخية.

## Minimal Safe Fix

يتطلب النطاق التالي المعتمد فقط **W02-RLS-IDENTITY-CONTRACT-RECONCILIATION**. يجب أن يصدر قرار معماري صريح يعدل Implementation Plan وM6 وtest matrices لتحديد مرساة الهوية المسموحة، ويطابقها مع `W02-D-02` وعقد Hybrid tenant-bound login/Broker. لا يجوز تنفيذ implementation أو migration ضمن نطاق reconciliation قبل اعتماد القرار.

## Required Tests After Reconciliation

بعد اعتماد contract موحد فقط: identity A/B، direct SQL negative proof، context-switch denial، connection reuse، concurrency، owner/bypass prohibition، RLS Wave 1 migration rehearsal، وclean audit database proof. لا تستخدم evidence الحالية كبديل لهذه الاختبارات.

## Next Authorized Scope

`W02-RLS-IDENTITY-CONTRACT-RECONCILIATION` فقط، ثم إعادة pre-execution audit من branch نظيفة. لا يوجد انتقال تلقائي إلى أي work package تنفيذي.
