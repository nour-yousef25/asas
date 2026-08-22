# متابعة تنفيذ W01 — ASAS Plus

- [ ] استخراج جميع الميزات المصنفة `Wave = W01` من Master Feature Inventory v1.1 وربطها بالـADRs وWave Mapping.
- [ ] تدقيق بنية Canonical Baseline الحالية وتحديد نقاط التوسع الفعلية دون إنشاء معمارية موازية.
- [ ] تنفيذ `FND-001` وفق تعريفه المعتمد، مع اختبارات وعقد استخدام قابل لإعادة الاستعمال.
- [ ] تنفيذ `FND-002` وفق تعريفه المعتمد، مع توثيق وعقد تكوين آمن.
- [ ] تنفيذ `OBS-001` للمراقبة والسجلات الآمنة والارتباط التشخيصي حسب التعريف المعتمد.
- [ ] تنفيذ `DEP-001` و`DEP-002` لدعم Cloud وDedicated وSelf-Hosted من نواة واحدة.
- [ ] تنفيذ `INST-001` و`INST-002` كأساس مثبت حقيقي دون قفز إلى المثبت التجاري الكامل.
- [ ] تنفيذ `UPDATE-001` و`UPDATE-002` كأساس تحديث آمن وقابل للتدقيق.
- [ ] تنفيذ `BACKUP-001` كأساس نسخ احتياطي واستعادة قابل للاختبار.
- [ ] تنفيذ `HEALTH-001` بفئات HEALTHY وDEGRADED وUNAVAILABLE وNOT_CONFIGURED.
- [ ] إضافة اختبارات W01 وتشغيل فحص الأنواع والبناء وحزمة الاختبارات.
- [ ] إصدار تقرير إكمال W01، وإنشاء commit ورفع الفرع للمراجعة دون تنفيذ أي عناصر من W02 وما بعدها.

## W01-SCHEMA-MIGRATION-CONSISTENCY-FIX

- [x] إعداد Dependency Map كامل لمسار `Schema → Migration → Database → Prisma Client → Seed → Application` للكيانات `User` و`Role`.
- [x] فحص تاريخ Git ومقارنة `User.role` و`User.roleId` وتحديد التصميم النهائي المدعوم بالأدلة.
- [x] توثيق Root Cause قبل تغيير أي migration أو schema أو عقد تطبيق.
- [x] اختيار Forward Migration محدود وغير مدمر بعد إثبات عدم تطابق schema الحالية مع التاريخ القانوني للمigrations.
- [x] إصلاح أقل طبقة لازمة عبر migration تقدمية دون إعادة كتابة migrations تاريخية أو تغيير عقد التطبيق القانوني.
- [x] إعادة إنشاء قاعدة التدقيق `asas_w01_audit` فقط وتطبيق جميع migrations من الصفر.
- [x] التحقق من Prisma Client وDatabase Schema والبذر الرسمي وSmoke Test على قاعدة التدقيق.
- [x] تدقيق جميع مراجع `role` و`roleId` وتشغيل الاختبارات وTypeScript وبناء الإنتاج.
- [x] إصدار تقرير `W01 Schema/Migration Consistency Fix Report` وإنشاء commit منفصل واضح للمراجعة.

## W01 RESUMPTION & CLOSURE

- [ ] قراءة مراجع W01 الرسمية وإنشاء W01 Closure Matrix بمتطلبات القبول والأدلة والفجوات.
- [ ] تدقيق Canonical Git baseline والفرع الحالي وقياس أدلة البناء والاختبارات وقاعدة التدقيق.
- [ ] التحقق الفعلي من المصادقة والتفويض والجلسات والمسارات المحمية وضوابط API وRate Limiting.
- [ ] التحقق الفعلي من عزل الجمعيات عبر سيناريو جمعيتين ومنع القراءة والكتابة عبر ID manipulation حيث يدخل ذلك ضمن W01.
- [ ] التحقق الفعلي من Redis والطوابير والعمال وحالات الفشل وHealth Center دون نجاحات محاكاة.
- [ ] التحقق الفعلي من Object Storage والتحكم بالوصول أو إثبات مانع البنية الخارجية وفق متطلبات W01.
- [ ] إثبات دورة Backup وRestore كاملة على قاعدة تدقيق مستقلة والتحقق من البيانات بعد الاستعادة.
- [ ] فحص npm audit والتحذيرات وأثرها وفق نطاق W01 دون تحديثات قسرية عمياء.
- [ ] تشغيل Production Readiness Matrix الكاملة: clean install وGenerate وValidate وmigrations وseed والاختبارات وbuild وruntime.
- [ ] إعداد W01 Final Completion Report مع Closure Matrix وقرار ثنائي `W01 COMPLETE` أو `W01 BLOCKED`.
- [ ] إعداد W02 Readiness Note فقط بعد إغلاق W01، دون تنفيذ أي عنصر W02.

## W01-REDIS-BULLMQ-WORKER-CONSISTENCY-FIX

- [ ] إنشاء Dependency Map لمسار Redis Configuration → ioredis → BullMQ Queue → Worker → Job → Database → Heartbeat → Health Center.
- [ ] تدقيق إصدارات BullMQ وioredis والـlockfile وجميع factories وimports وخيارات الاتصال وسكربتات العامل.
- [ ] توثيق Root Cause الدقيق وخيار الفصل الصحيح بين Producer وWorker وQueueEvents قبل أي تعديل.
- [ ] تطبيق إصلاح اتصال Redis في الموضع المعماري الصحيح دون تعطيل Queue أو Worker أو تغيير إصدارات الحزم بلا دليل.
- [ ] إضافة اختبار تكامل حقيقي عبر Redis وقاعدة التدقيق لإثبات Job → Worker → Database → completed.
- [ ] إثبات Retry فعلي آمن وحالة failed/success وعدم ترك بيانات اختبار غير مرغوبة.
- [ ] إثبات heartbeat حقيقي وRedis/Queue/Worker Health في الحالات السليمة والفاشلة.
- [ ] تحليل تحذير `@valkey/valkey-glide` وتسجيل أثره على مسار ioredis المستخدم.
- [ ] تشغيل اختبارات Redis/Worker وJest الكامل وTypeScript وProduction Build.
- [ ] إنشاء تقرير W01 Redis/BullMQ Worker Fix Report وتثبيت commit واضح للمراجعة.

## W01-REDIS-BULLMQ-INTEGRATION-HARNESS

- [ ] تأكيد إصدارات BullMQ وioredis وtsx وtsconfig ومخطط Prisma وعقود Redis/Queue/Worker/Health قبل كتابة الـHarness.
- [ ] إنشاء `scripts/w01-redis-bullmq-integration.ts` مستقل عبر `tsx` دون تعديل إعداد Jest أو استخدام mock.
- [ ] إضافة أمر `npm run test:w01:redis` لتشغيل الـHarness فقط مع Preconditions صريحة وإشارات خروج صحيحة.
- [ ] إثبات Redis وDatabase وQueue وWorker وJob وDatabase effect وcompletion على قاعدة التدقيق الحقيقية.
- [ ] إثبات Retry حقيقي آمن وHeartbeat مخزن في Redis وإغلاق رشيق لكل الاتصالات.
- [ ] تنفيذ Failure Injection آمن لـRedis وWorker وتوثيق عدم ظهور حالة Health زائفة.
- [ ] حفظ سجل Evidence قابل لإعادة الإنتاج وإصدار تقرير HARNESS PASS أو HARNESS BLOCKED فقط.
- [ ] تشغيل Jest الحالي دون تعديل وTypeScript وProduction Build وتثبيت commit واضح على `w01-foundation`.

## W01-QUEUEEVENTS-REDIS-CONNECTION-FIX

- [ ] تثبيت Redis Role Matrix للـProducer والـWorker والـQueueEvents وفق BullMQ 6.1.2 وioredis 5.11.1.
- [ ] التحقق من جميع BullMQ usages وconnections وعدم وجود QueueScheduler أو event listener أو factory إضافي غير محسوب.
- [ ] تعديل factory `createQueueEventsRedisConnection()` فقط ليستخدم الاتصال blocking الصحيح دون تغيير Producer.
- [ ] إعادة إثبات Producer وWorker وNotification database effect قبل الانتقال إلى Retry.
- [ ] إثبات QueueEvents وwaiting/active/failed/completed وRetry وattempt count على Redis وقاعدة التدقيق الحقيقية.
- [ ] اختبار Health وحالات Redis/Worker/QueueEvents الفاشلة والإغلاق الرشيق وعدم تسرب العمليات.
- [ ] تشغيل Jest غير المعدل وTypeScript وProduction Build وحفظ Evidence وتقرير `QUEUEEVENTS FIX VERIFIED` أو `QUEUEEVENTS FIX BLOCKED`.

## W01-HARNESS-FAILURE-DETECTION-CLEANUP-FIX

- [x] استخراج تردد heartbeat وTTL وسياسة Health الحالية وتوثيق مراحل Current → Stale → Worker failure.
- [x] إنشاء process group حقيقي للعامل داخل الـHarness وإيقافه بـSIGTERM ثم التحقق من انتهاء المجموعة قبل أي fallback موثق.
- [x] ضمان حفظ Evidence قبل cleanup وإتمامه حتى إذا وقع Exception أو timeout، مع تسجيل حالة cleanup.
- [x] التعامل مع Redis failure injection كفشل متوقع دون unhandled error event أو إخفاء نتيجة الاختبار.
- [x] إعادة إنشاء قاعدة التدقيق وتشغيل الـHarness من بيئة Redis وPrisma نظيفة.
- [x] إثبات توقف heartbeat وHealth worker غير السليم وRedis failure والإغلاق الرشيق وعدم تسرب عمليات.
- [x] إنشاء تقرير Harness Failure Detection/Cleanup Fix؛ يبقى إنشاء commit ورفع الفرع ضمن مرحلة التثبيت التالية.

## W01 FINAL CLOSURE REVIEW

- [x] تثبيت baseline `w01-foundation` عند `4db083b` وتأكيد نطاق W01 فقط؛ الشجرة تحتوي توثيق المراجعة الجاري فقط.
- [x] استخراج معايير قبول W01 الرسمية من Master Blueprint وFeature Inventory وADRs وWave Mapping دون إدخال نطاق موجات لاحقة.
- [x] استكمال Closure Matrix بالحقول: ID، requirement، acceptance criteria، evidence، test، status، risk، remaining gap، decision.
- [x] تدقيق Evidence الفعلي للـruntime وRedis وQueue وWorker وHealth، وتوثيق `EXPECTED AUDIT-ENVIRONMENT DEGRADATION`.
- [x] تدقيق Foundations الخاصة بالنشر والأمان والتحديث والنسخ الاحتياطي والتحذيرات وفق W01 فقط، دون إصلاح إنتاجي.
- [x] تصنيف الفجوات والبنود المؤجلة والتحذيرات وقرار `W01 PARTIAL — SPECIFIC ITEMS REMAIN`.
- [x] إعداد `W01-FINAL-CLOSURE-REPORT` وتحديث الوثائق؛ يبقى commit مراجعة واضح على `w01-foundation` بعد مراجعة النص النهائي.
