# تقرير W01 — Harness Failure Detection / Cleanup Fix

**الحالة:** `W01-HARNESS-FAILURE-DETECTION-CLEANUP-FIX VERIFIED`
**الفرع:** `w01-foundation`
**النطاق:** Runtime Integration Harness فقط؛ لا يعلن هذا التقرير اكتمال W01 ولا يبدأ أي عنصر من W02.

## القرار

تمت معالجة فشل الـHarness السابق في كشف توقف العامل وتنظيف عملياته. كان السبب التشغيلي أن تشغيل العامل عبر `npx tsx` خلق طبقة وسيطة؛ فوصول `SIGTERM` إلى العملية الأب لم يكن دليلاً كافياً على انتهاء عملية `tsx` التابعة. يطلق الـHarness الآن عامل الاتصالات مباشرة عبر واجهة `tsx/cli` الرسمية داخل process group منفصل، ثم يرسل الإشارة إلى المجموعة كاملة، وينتظر خروجها، ويتحقق من غياب المجموعة قبل إعلان نجاح الإغلاق.

لم يتضمن هذا الإصلاح تغييراً في production Worker أو Health أو Redis أو Queue. يقتصر التعديل على `scripts/w01-redis-bullmq-integration.ts`.

## سياسة heartbeat المثبتة

يعتمد العامل مفتاح Redis `asas:health:worker:communications`، بفاصل heartbeat مقداره 30 ثانية وTTL مقداره 90 ثانية. عند الإغلاق الرشيق، يمسح العامل المؤقت ثم يحذف المفتاح قبل إغلاق اتصالاته؛ لذلك يختبر الـHarness الإغلاق الرشيق بانتظار اختفاء المفتاح فوراً، وليس بانتظار انقضاء TTL. يبقى TTL معيار staleness فقط لمسار التوقف القسري غير الرشيق.

| الحالة | سلوك الـHarness المثبت | النتيجة |
|---|---|---|
| العامل يعمل | يتأكد من وجود heartbeat وتحديثه | `worker = HEALTHY` |
| `SIGTERM` للمجموعة | ينتظر code `0`، واختفاء المفتاح، واختفاء process group | إغلاق رشيق مثبت |
| العامل متوقف | يقرأ Health بعد اختفاء heartbeat | `worker = DEGRADED` |
| Redis غير متاح | يحقن اتصالاً إلى `127.0.0.1:6390` مع error listener ملتقط | `redis = DEGRADED` و`redisOverall = DEGRADED` دون unhandled event |

## تصميم الدليل والتنظيف

يكتب الـHarness الدليل في `artifacts/w01/redis-bullmq-integration-evidence.json`، وهو مسار متجاهل من Git لحماية مخرجات التنفيذ المحلية. يضمن تسلسل `try / finally` أن التنظيف لا يمنع كتابة Evidence؛ وتُسجل نتيجة التنظيف في المرحلة `[14] Cleanup`. إذا فشل التنظيف، تتحول الحالة النهائية إلى `BLOCKED` مع بقاء أدلة المراحل السابقة محفوظة.

تُغلق workers وQueueEvents والطابور وPrisma وRedis عبر مسارات محمية، وتُسجل أخطاء التنظيف المجمعة بدلاً من إسقاط الدليل الأصلي. لا يستخدم الاختبار mocks، ويقتصر على Redis المحلي الحقيقي وقاعدة PostgreSQL المعزولة `asas_w01_audit`.

## تشغيل نظيف قابل لإعادة الإنتاج

أُعيد إنشاء `asas_w01_audit` فقط، ثم نُفذت `prisma migrate deploy` و`prisma generate` و`prisma db seed`. نُظفت قاعدة Redis المحلية المعزولة، ثم شُغل الأمر التالي مع `REDIS_URL` و`DATABASE_URL` صالحين داخل العملية فقط:

```bash
npm run test:w01:redis
```

كان معرّف التشغيل النهائي `W01-BULLMQ-2026-08-22T07-14-02-811Z-a0ca1d15`، وانتهى بـ`FINAL STATUS: PASS` ورمز خروج صفري.

| مرحلة الإثبات | النتيجة الفعلية |
|---|---|
| Redis وPostgreSQL الحقيقيان | PASS |
| Notification Queue → Worker → سجل `notifications` | PASS |
| Retry حقيقي | محاولتان ثم `completed` |
| QueueEvents | `waiting → active → waiting (prev=delayed) → active → completed` |
| Heartbeat | مفتاح Redis فعلي وتحديث مسجل |
| Health السليم | Redis وQueue وWorker كلها `HEALTHY` |
| Worker stop | `SIGTERM` للمجموعة، code `0`، حذف heartbeat، وعدم بقاء group |
| Redis failure injection | `ECONNREFUSED` متوقع و`redis = DEGRADED` و`redisOverall = DEGRADED` بلا unhandled error |
| Worker failure detection | `worker = DEGRADED` بعد الإيقاف |
| Cleanup | لا أخطاء، ولا عملية Harness أو عامل اتصالات متبقية |

## تفسير حالة Health الكلية

سجل Health السليم حالة كلية `DEGRADED`، رغم صحة المكونات المقاسة Redis وQueue وWorker. هذه نتيجة صادقة لتبعيات storage/backup غير المهيأة في بيئة التدقيق، وليست فشلاً مخفياً ولا يجوز تحويلها إلى `HEALTHY` بالـHarness. تبقى هذه الفجوة في W01 Closure Matrix وتتطلب بنية تخزين وBackup/Restore حقيقية وأدلة مستقلة.

## تحقق الانحدار

بعد تشغيل الـHarness النهائي اجتازت مجموعة Jest الحالية **69 اختباراً** مع مجموعة واحدة متخطاة، واجتاز `npx tsc --noEmit` واختبار `npm run test:communications` وبناء الإنتاج. بقيت تحذيرات البناء المعروفة: optional `@valkey/valkey-glide` في BullMQ، convention `middleware` المتقادم في Next.js، وتحذير `process.cwd` في Edge Runtime. لم تُخف أو تُعدل ضمن هذا النطاق.

## حدود القرار

> **HARNESS PASS فقط.** هذا التقرير لا يمثل قرار `W01 COMPLETE`. يعود العمل إلى W01 Closure Matrix؛ وتظل أدلة Object Storage وBackup/Restore والأمن والتثبيت والتحديث وجاهزية الإنتاج الكاملة مطلوبة قبل قرار W01 الثنائي النهائي.
