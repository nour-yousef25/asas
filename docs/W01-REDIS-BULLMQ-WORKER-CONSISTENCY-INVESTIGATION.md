# W01 Redis/BullMQ Worker Consistency Investigation

**النطاق:** `W01-REDIS-BULLMQ-WORKER-CONSISTENCY-FIX`
**حالة التحقيق:** مكتمل قبل الإصلاح
**بيئة الإثبات:** Redis محلي حقيقي؛ `redis-cli ping` أعاد `PONG`.

## خريطة الاعتماد

```text
REDIS_URL
  → src/lib/redis.ts:getRedis()
  → ioredis singleton { maxRetriesPerRequest: 3, lazyConnect: true }
  → src/lib/queue.ts:createQueue() / createPublicationWorker()
  → BullMQ Queue (producer) / BullMQ Worker (blocking consumer)
  → src/workers/communications-worker.ts
  → heartbeat key asas:health:worker:communications
  → src/app/api/health/route.ts
  → HEALTH-001
```

لا يوجد في المصدر الحالي `QueueEvents` أو factory اتصال مستقل له. يوجد إنشاء واحد لـ`new Redis(...)` داخل `src/lib/redis.ts`، ويُمرّر العميل نفسه إلى جميع `Queue` و`Worker` من `src/lib/queue.ts`.

## الواقع المثبت

| المكوّن | الدليل | النتيجة |
|---|---|---|
| Redis | Redis 7 محلي حقيقي و`PONG` | يعمل |
| BullMQ | النسخة المحلولة `6.1.2` | لا يوجد تعارض إصدار مثبت |
| ioredis | النسخة المحلولة `5.11.1` | يعمل كعميل، لكن factory يفرض `maxRetriesPerRequest: 3` |
| Producer | `Queue` يستعمل عميل singleton الحالي | لا يثبت وحده مشكلة |
| Worker | `Worker` يتطلب اتصال blocking | يفشل قبل heartbeat |
| BullMQ guard | المصدر المثبت يتحقق من `options.maxRetriesPerRequest` للاتصالات blocking | يرمي الخطأ نفسه المثبت وقت التشغيل |

## السبب الجذري

السبب هو **C مع A**: factory واحدة تنشئ اتصال ioredis عامّاً بخيار producer-style هو `maxRetriesPerRequest: 3`، ثم يعاد استخدام العميل نفسه في Worker الذي ينشئ مسار اتصال blocking. BullMQ 6.1.2 يرفض هذا التكوين للـWorker صراحةً لأن الاتصال blocking يحتاج `maxRetriesPerRequest: null`.

لا يوجد دليل على تضارب إعداد ثان أو على عيب إصدار مستقل؛ نسخة BullMQ المثبتة تشرح الشرط في guard الداخلي، وإخراج عامل الاتصالات يطابقه حرفياً. لذا فإن وضع `null` على singleton المشترك كله قد يعالج الخطأ لكنه لا يحقق مبدأ فصل producer عن worker، وقد يغير سلوك API/producer بلا حاجة.

## القرار المعماري المحدود

سيُفصل الاتصال إلى factories واضحة:

| الدور | العقد |
|---|---|
| Producer/API | اتصال Redis مشترك مع retries محدودة ومتوافقة مع طلبات HTTP. |
| Worker | اتصال Redis مستقل لـBullMQ مع `maxRetriesPerRequest: null` فقط. |
| QueueEvents | لا يوجد استخدام حالي؛ يُضاف factory مستقل فقط إذا أضيف QueueEvents ضمن نطاق اختبار التكامل. |
| Health | يبقى probe قصير العمر/مشتركاً لكنه لا يعلن صحة worker إلا بوجود heartbeat Redis حقيقي. |

سيثبت الإصلاح Job حقيقياً يكتب Notification في قاعدة التدقيق، مع retry آمن وheartbeat وHealth Center، ولا يغير إصدارات BullMQ أو ioredis ولا يضيف mock أو fallback باعتباره نجاحاً.
