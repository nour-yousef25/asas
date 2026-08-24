# دليل rollback والتعافي بعد تحويل ASAS Plus إلى الإنتاج

هذا الدليل خاص بـASAS فقط. لا يستخدم `git reset --hard` أو force push أو حذف evidence أو rollback migrations تاريخية، ولا يغير DNS أو مواقع VPS الأخرى.

## قاعدة القرار

ابدأ rollback عندما يفشل health required check أو public smoke required أو يثبت routing خاطئ أو مشكلة أمنية. سجل timestamp والـrelease الحالي وسبب القرار، ثم امنع التغييرات الإضافية غير الضرورية.

## rollback التطبيق وvhost

استعد نسخة vhost `asasplus.shop` الملتقطة في بوابة cutover فقط، ثم validate/reload OpenLiteSpeed بصورة graceful. لا تغير ACME أو TLS keys. بعد ذلك أعد `production-current` إلى release السابق المعروف، وأعد تشغيل `asasplus-web-production.service` و`asasplus-worker-production.service` وsmoke local على `127.0.0.1:3106` باستخدام health token غير مسجل.

تحقق أن vhost العام عاد للمسار السابق وأن listener production ما زال loopback-only. لا توقف Redis أو PostgreSQL ما لم يكن سبب الحادث يتطلب ذلك، ولا تلمس Redis أو DB غير ASAS.

## rollback البيانات

Prisma migrations **forward-only**. لا تعكس migrations ولا تحذف schema production. إذا تطلب حادث بيانات استعادة، أنشئ قاعدة ASAS جديدة مخصصة للاستعادة، فك archive المشفر المتحقق، نفذ restore، وقارن tables/migration counts، ثم قرر تبديل connection path كإجراء منفصل ومعتمد. احتفظ بقاعدة الحادث الأصلية للـforensics حتى يوافق owner، ولا تستبدلها أو تحذفها عشوائياً.

## ما بعد rollback

أعد health وsmoke من المسار السابق، احفظ evidence ASAS-only، وقيّد السبب في incident record. لا تعاود cutover حتى يمر rehearsal جديد وتُغلق root cause. تبقى external services غير المتاحة `BLOCKED — EXTERNAL INPUT REQUIRED` ولا تُحوَّل إلى نجاح بعد rollback.
