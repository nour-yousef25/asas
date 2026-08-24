# W02 — Queue/Redis/Cache Runtime Audit

## الحالة عند الجرد

**BLOCKED — LOCAL CODE/DESIGN قبل cutover.** أثبت الجرد وجود Redis 7 محلي يمكن استعماله لاحقاً في fixture disposable فقط. لا يمثل ذلك provider إنتاجياً ولا يعالج أي حدود tenant قائمة.

| السطح الفعلي | الوضع القائم | الخطر | التصرف الإلزامي قبل الإثبات |
|---|---|---|---|
| `smsQueue` و`notificationQueue` | أسماء عامة وpayload بلا `TenantContext` وfallback `InMemoryQueue` | نجاح ظاهري بلا Redis، ولا ownership منظمة في `SMSTemplate` أو `Notification` | quarantine fail-closed؛ لا ينفذ worker أو enqueue حتى عقد ownership/onboarding مستقل |
| `publicationQueue` | اسم عام وpayload يحوي `publicationPlanId` فقط | payload مزور/replay لا يحمل membership/session/policy/correlation؛ العامل يستدعي Prisma عالمياً | envelope موثوق من `TenantContext`، namespace tenant، revalidation Broker، ومعالج data-plane مقيّد |
| `createPublicationWorker` | عامل BullMQ يتحقق من `REDIS_URL` فقط ثم يستدعي `publishPlanById` | لا يعيد التحقق من membership/revocation/policy ولا يستخدم tenant executor | يرفض كل job غير envelope موثق؛ يصدر lease جديداً لكل تشغيل؛ لا fallback عالمي |
| `publishPlanById` | `prisma` عالمي، وقراءة/كتابة plan/channel/attempt بلا `organizationId` scope | يمكن لعامل صف عالمي الوصول إلى plan من tenant آخر | تحويل المعالج إلى `PrismaClient` صادر من executor مع إثبات ownership graph قبل أي provider call |
| health/heartbeat/cache | heartbeat عام `asas:health:worker:communications` وqueue health يساوي Redis health | collision وfalse-green: Redis متاح لا يعني worker tenant-safe | namespace ثابت يشمل workload وtenant، وhealth لا يعلن tenant closure |

## حقائق معمارية حاكمة

`PublicationPlan` و`CommunicationContentItem` و`ConnectedChannel` تحمل `organizationId` قانونياً، لذا يمكن تحويل publication job إلى مسار tenant-bound دون اعتماد على client organization id. أما `Notification` و`SMSTemplate` و`SMSLog` فلا تحمل ownership منظمة، لذلك لا يجوز تحويلها شكلياً إلى queue tenant-bound أو إعادة استخدام `activeOrganizationId`/أول membership لتخمين السلطة.

لا تحتوي `W02_PERMISSION_CATALOG` الحالية على permission للـcommunications publication أو queue dispatch. لا يجوز اختراع صلاحية افتراضية أو استعمال global role. أي producer جديد يجب أن يطلب permission صريحاً مزروعاً ومربوطاً بدور organization-scoped، أو يبقى fail-closed.

## بوابة التنفيذ التالية

لا يقبل التنفيذ إلا: producer يستقبل `TenantContext` المحلول خادمياً، permission صريحاً، envelope بلا secrets، queue/key namespace يستمد من `organizationId` الموثوق، worker يعيد التحقق عبر Broker، وfixture Redis disposable يثبت A/B وforged payload/replay/retry/stale/revoked/rotation/outage/concurrency/cleanup. لا تستدعي هذه البوابة provider خارجي ولا تدعي تشغيل عامل دائم أو target deployment.
