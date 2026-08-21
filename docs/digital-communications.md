# مركز الاتصال والنشر الرقمي — دليل التشغيل والاعتماد

> **الغرض:** يشرح هذا الدليل تشغيل مركز الاتصال في ASAS، وربط الحسابات الرسمية، وإعداد الخلفية وجدولة النشر. لا تُدرج مفاتيح التطبيقات أو رموز الوصول أو نسخ ملف `.env` في المستودع أو في تذاكر الدعم.

## نظرة تشغيلية

يعمل المركز داخل **سياق الجمعية النشط**. تُقيّد قنوات الاتصال والمحتوى والحملات وخطط النشر ولقطات التحليلات بالجمعية نفسها على مستوى الاستعلامات وقاعدة البيانات. تُخزن رموز OAuth باستخدام AES-256-GCM مع مفتاح خادمي `INTEGRATIONS_ENCRYPTION_KEY`، ولا يعيد أي مسار API الرمز إلى المتصفح.

| الطبقة | المسؤولية | ضابط الأمان |
|---|---|---|
| الواجهة | القنوات، المحرر، المراجعة، التقويم، وهوية الاتصال | لا توجد أسرار أو رموز في الواجهة |
| API الخادمي | OAuth، المحتوى، الاعتماد، الجدولة، التحليلات | جلسة مستخدم + سياق جمعية + فحص الدور |
| مخزن البيانات | حسابات القنوات، نسخ المحتوى، المحاولات، مؤشرات الأداء | علاقات مفهرسة بحسب `organizationId` |
| عامل النشر | تنفيذ BullMQ للخطط المؤجلة وإعادة المحاولة | Redis إلزامي للإنتاج، مفاتيح idempotency لكل محاولة |
| Webhooks | تحديث حالات القنوات والنشر | تحقق توقيع، منع تكرار، واستقبال HTTPS فقط |

## المتطلبات التشغيلية

انسخ `.env.example` إلى ملف بيئة خاص بكل بيئة تشغيل، ثم ضع القيم الحقيقية في مخزن أسرار الاستضافة. يجب أن يكون `NEXT_PUBLIC_APP_URL` نطاق HTTPS ثابتًا؛ فهو مصدر روابط إعادة OAuth وWebhook. ولأن النشر المؤجل يعتمد عاملًا منفصلًا، فإن بيئات Autoscale التي توقف العمليات عند الخمول لا تكفي لعامل BullMQ طويل العمر؛ استخدم بيئة تشغيل مستمرة مع Redis مُدار.

| الأمر | الاستخدام |
|---|---|
| `npm run build` | فحص البناء والأنواع قبل النشر |
| `npm run prisma:local -- db push` | مزامنة قاعدة التطوير المحلية فقط |
| `npm run worker:communications` | تشغيل عامل النشر بعد ضبط `REDIS_URL` |
| `npm run db:migration:from-current -- <name>` | توليد SQL تفاضلي عند حجب صلاحية قاعدة الظل في بيئة التطوير |
| `npx prisma migrate deploy` | تطبيق الهجرات في الإنتاج بعد ضبط خط أساس لسجل الهجرات |

> **ملاحظة الهجرة:** قاعدة التطوير المحلية الحالية كانت غير مسجلة في جدول تاريخ Prisma، ولذلك تمت مزامنتها محليًا باستخدام `db push` مع الاحتفاظ بملفات SQL في `prisma/migrations/`. في الإنتاج، اضبط خط الأساس لسجل الهجرات أولًا ثم استخدم `prisma migrate deploy` فقط؛ لا تستخدم `db push` على قاعدة إنتاج.

## مسارات API وتشخيص النتيجة

| المسار | الغرض | الحالات المتوقعة |
|---|---|---|
| `GET /api/integrations/{platform}/start` | بدء OAuth | 302 إلى المزود؛ عند غياب الإعداد يعود إلى القنوات برسالة واضحة |
| `GET /api/integrations/{platform}/callback` | تبادل الرمز واكتشاف القنوات | 302 إلى القنوات بعد حفظ الرموز مشفرة |
| `GET /api/communications/channels` | عرض القنوات بلا أسرار | 200؛ 401/403 عند غياب الجلسة أو الدور |
| `POST /api/communications/content` | إنشاء أصل ونسخ قنوات | 201؛ 400 عند مخالفة فحص المحتوى أو قناة غير جاهزة |
| `POST /api/communications/variants/{id}/review` | إرسال أو اعتماد أو طلب تعديل | 200؛ 403 إن لم يكن المستخدم معتمدًا |
| `POST /api/communications/plans` | جدولة أو تجهيز النشر | 201؛ 409 إن طُلبت جدولة دون Redis |
| `POST /api/communications/plans/{id}/publish` | نشر فوري لخطة معتمدة | 200؛ تسجل محاولة وفئة خطأ عند فشل المزود |
| `POST /api/communications/metrics` | مزامنة مؤشرات القنوات | 200 مع عدد النجاحات والإخفاقات |
| `GET/POST /api/webhooks/{platform}` | تحقق واستقبال Webhook | 200 بعد تحقق التوقيع؛ 401 لتوقيع غير صالح |

## سياسة المحتوى والمراجعة

ينشأ المحتوى كـ **مسودة** ثم يرسل إلى المراجعة. لا تصبح النسخة قابلة للجدولة حتى تعتمدها صلاحية مدير أو مشرف أعلى. يفحص النظام المحتوى الخالي من النص والوسيط، والإشارات المرجحة للبيانات الشخصية، وحد طول X، وإلزام الوسيط في TikTok وYouTube. لا يقتصر هذا الفحص على سياسة القانون أو الجمعية؛ فهو خط حماية أولي ويجب أن تظل المراجعة البشرية مسؤولة عن الموافقة النهائية.

| الحالة | المعنى | الإجراء التالي |
|---|---|---|
| `DRAFT` | مسودة قابلة للتعديل | إرسال للمراجعة |
| `IN_REVIEW` | تنتظر قرارًا | اعتماد أو طلب تعديل |
| `APPROVED` | مؤهلة للخطة | نشر فوري أو جدولة |
| `SCHEDULED` | أضيفت للطابور | يتولى العامل التنفيذ في الموعد |
| `PUBLISHING` | الطلب لدى المزود أو ينتظر حالة وسيط | متابعة Webhook أو إعادة المحاولة |
| `PUBLISHED` / `FAILED` | حالة نهائية | استعراض رابط المنشور أو سبب الفشل |

## إعداد المنصات واعتماد التطبيقات

### Meta: Facebook Pages وInstagram Professional

أنشئ تطبيقًا في Meta for Developers، واضبط نطاق إعادة OAuth إلى:

```text
https://YOUR_DOMAIN/api/integrations/facebook/callback
https://YOUR_DOMAIN/api/integrations/instagram/callback
```

واضبط عنوان Webhook إلى `https://YOUR_DOMAIN/api/webhooks/facebook` أو `/instagram`، مع وضع نفس قيمة `META_WEBHOOK_VERIFY_TOKEN` في لوحة Meta. يحتاج النشر إلى صلاحيات Pages وInstagram المطلوبة وبوابة مراجعة Meta عند استخدامها خارج أدوار التطبيق. تستخدم Instagram حسابًا احترافيًا مرتبطًا بصفحة، والوسائط يجب أن تبقى عامة وقت محاولة النشر؛ يدعم الموصل الصور، Reels، وCarousel حتى 10 عناصر. تفرض Meta حد 100 منشور API لكل حساب Instagram في فترة 24 ساعة متحركة، لذلك يجب مراقبة الحد قبل جدولة دفعات كبيرة. [1]

### LinkedIn Pages

سجّل التطبيق واطلب الوصول إلى برنامج Community Management وStandard Access للقدرات المؤسسية. أضف رابط العودة `https://YOUR_DOMAIN/api/integrations/linkedin/callback`، واطلب النطاقات الموثقة في الكود فقط بعد اعتماد المنتج. موصل ASAS ينشئ المنشور المؤسسي النصي ويعتمد رأي المزود لوسائط LinkedIn والصلاحيات؛ لا تعتبر القناة جاهزة إنتاجيًا حتى يظهر حساب المؤسسة الصحيح وحالة الوصول الفعلية. [2]

### TikTok

سجّل رابط العودة `https://YOUR_DOMAIN/api/integrations/tiktok/callback` وWebhook `https://YOUR_DOMAIN/api/webhooks/tiktok` في بوابة المطور. تحتاج Direct Post إلى `video.publish` وإلى تدقيق عميل المحتوى لرفع قيود الرؤية العامة. يجب التحقق من ملكية نطاق الوسيط عند استخدام `PULL_FROM_URL`. يدعم الموصل الصور حتى 35 رابطًا والفيديو عبر مسارات النشر الرسمية، ويقرأ إعداد الخصوصية من `creator_info` بدل فرض إعداد غير مسموح. يتحقق Webhook من `TikTok-Signature` وفق HMAC-SHA256 وتاريخ الحدث لمنع إعادة الإرسال. [3] [4]

### YouTube

أنشئ عميل OAuth لدى Google، واضبط `https://YOUR_DOMAIN/api/integrations/youtube/callback`، ثم مرر مراجعة YouTube Data API قبل الإطلاق العام؛ تقيّد مشاريع الرفع غير المدققة الفيديوهات الجديدة إلى الخاص. يرفع الموصل الفيديوهات من رابط HTTPS عام بواسطة جلسة `videos.insert` قابلة للاستئناف، ويحتاج عاملًا مستمرًا لاتمام المحاولة وإعادة المحاولة عند انقطاع الشبكة. [5]

### X

أنشئ تطبيق OAuth 2.0، واضبط `https://YOUR_DOMAIN/api/integrations/x/callback` وWebhook `https://YOUR_DOMAIN/api/webhooks/x` عند تفعيل المنتج المناسب. يرسل الموصل النصوص عبر X API ويعرض أخطاء الحد أو الصلاحية للمدير؛ لا تفعّل نشر الوسائط قبل التأكد من توفر منتج Media وإتاحة الاستخدام والإنفاق في حساب X، لأن القدرات والتسعير تتغير حسب طبقة الحساب. [6]

## قائمة اعتماد قبل الإنتاج

| البند | حالة الاعتماد المطلوبة |
|---|---|
| قاعدة البيانات | تطبيق الهجرات على نسخة مرحلية ثم نسخة احتياطية موثقة قبل الإنتاج |
| الأسرار | تخزين جميع مفاتيح المزودين ومفتاح التشفير في Secret Manager، لا في Git |
| النطاق | HTTPS ثابت، روابط OAuth وWebhooks مسجلة لدى كل مزود |
| Redis والعامل | Redis مُدار، عملية `worker:communications` مستقلة، ومراقبة للمهام الفاشلة |
| Meta | مراجعة الصلاحيات، Page Publishing Authorization عند لزومها، واختبار حساب احترافي |
| LinkedIn | قبول Community Management وStandard Access والتحقق من صفحة المؤسسة |
| TikTok | تدقيق Content Posting، تحقق ملكية النطاق، وتجربة Webhook موقعة |
| YouTube | OAuth verified، تدقيق YouTube Data API، وتجربة رفع مرحلية |
| X | خطة استخدام مفعلة، حدود إنفاق، واختبار النص وWebhook إن فُعّل |
| الأمن | تدوير المفاتيح، اختبار فصل الحساب، اختبار رموز منتهية، ومراجعة سجل التدقيق |

## المراجع

[1] [Meta — Instagram Content Publishing](https://developers.facebook.com/documentation/instagram-platform/content-publishing)

[2] [LinkedIn — Community Management](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/community-management-overview)

[3] [TikTok — Photo Content Posting API](https://developers.tiktok.com/doc/content-posting-api-reference-photo-post)

[4] [TikTok — Webhook Signature Verification](https://developers.tiktok.com/doc/webhooks-verification)

[5] [Google — YouTube Resumable Upload Protocol](https://developers.google.com/youtube/v3/guides/using_resumable_upload_protocol)

[6] [X — Create a Post](https://docs.x.com/x-api/posts/create-post)
