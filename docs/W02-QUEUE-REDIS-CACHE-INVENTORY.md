# W02 — Queue/Redis/Cache Inventory

يوجد surface فعلي لـBullMQ/Redis: `src/lib/queue.ts` و`src/lib/redis.ts` و`src/workers/communications-worker.ts`، إضافة إلى health/preflight وpackage dependencies. يستخدم worker heartbeat key ثابتاً، ويعتمد التشغيل على `REDIS_URL`. لا يثبت هذا الجرد وجود tenant isolation؛ بل يفتح scope مستقل يتطلب فحص queue names، job payloads، cache keys، retry/DLQ، worker validation، heartbeat، واسترداد الهوية بعد restart.

لا يجوز تشغيل worker أو Redis محلياً كبديل لموفر production أو اختراع `REDIS_URL`. الخطوة التالية هي تحليل data flow لعائلة communications وكتابة contract evidence قابلة للتنفيذ فقط إن أمكن fixture Redis disposable آمن.
