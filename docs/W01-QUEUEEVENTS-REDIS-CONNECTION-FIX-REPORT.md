# تقرير W01 — QueueEvents Redis Connection Fix

**الحالة:** `QUEUEEVENTS FIX VERIFIED`
**النطاق:** إثبات اتصال QueueEvents وتكامل Retry ضمن W01 فقط. لا يوسع التقرير نطاق W01 ولا يحكم على اكتماله.

## النتيجة

يستخدم الـHarness اتصال QueueEvents مستقلاً blocking من factory المخصص، بينما يبقى producer على اتصال producer وتعمل الـworkers على اتصالات blocking مستقلة. تحقق التشغيل الحقيقي النهائي على Redis المحلي وPostgreSQL التدقيقي من أن مسار Retry يعمل مع QueueEvents، لا عبر افتراض أو mock.

## الدليل التشغيلي

أنشأ الـHarness طابور Retry فريداً لكل تشغيل، وعاملاً يفشل المحاولة الأولى عمداً ثم ينجح في الثانية. سجّل QueueEvents التسلسل الفعلي التالي للـjob `1`:

```text
waiting → active → waiting (prev=delayed) → active → completed
```

كانت قيمة `attempts = 2` وحالة الـjob النهائية `completed` مع نتيجة `{ "attempts": 2 }`. لا يتطلب هذا التقرير ظهور event باسم `failed` في النسخة الحالية من BullMQ كي يعد المسار صحيحاً؛ الإثبات هو تأخير retry وعودة الـjob إلى waiting ثم إتمامه في المحاولة الثانية.

| عنصر | دليل التشغيل النهائي |
|---|---|
| QueueEvents connection | factory مستقل ومهيأ للاتصال blocking |
| Worker connection | factory blocking مستقل للعامل |
| Producer connection | اتصال producer منفصل |
| Retry | فشل مضبوط ثم نجاح في المحاولة الثانية |
| Events المرصودة | waiting، active، waiting بعد delayed، active، completed |
| الإغلاق | QueueEvents والـworker والطابور ضمن Cleanup محمي |

## التحذير المعروف

ظهر في بناء Next.js تحذير optional dependency باسم `@valkey/valkey-glide` من مسار BullMQ. لم يمنع التحذير استخدام مسار ioredis أو تشغيل Queue/Worker/QueueEvents الحقيقي في الـHarness. لا توجد ترقية package أو إخفاء تحذير في هذا النطاق؛ يبقى التحذير مسجلاً للمراجعة المنفصلة وفق Closure Matrix.

> هذا التقرير يثبت QueueEvents وRetry في بيئة تدقيق حقيقية فقط. لا يثبت Object Storage أو Backup/Restore ولا يحول حالة W01 الكلية إلى مكتملة.
