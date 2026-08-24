# W02 — Queue/Redis/Cache Runtime Completion

## نطاق الإثبات

أثبت harness مستقل على **Redis 7 وPostgreSQL محليين disposable** العقد `Q01–Q10` لمسار publication tenant-bound. يستقبل المنتج `TenantContext` المحلول خادمياً، ويفرض permission صريحاً، ويصنع envelope بلا secrets. يفصل Redis ACL keys بين A/B، ويعيد العامل تحقق permission وlease وplan ownership عبر `TenantAccessBroker → TenantBoundPrismaExecutor` قبل استدعاء handler. لا يستعمل هذا المسار `REDIS_URL` أو `InMemoryQueue` أو Prisma عالمي أو Raw GUC أو `activeOrganizationId` كسلطة data-plane.

حُجرت المسارات العامة السابقة fail-closed: SMS وNotification وemail queues، و`/api/sms`، والعامل legacy للاتصالات. لا تملك نماذج SMS/Notification ownership منظمة قانونياً؛ لذلك لم يُختلق `organizationId` أو صلاحية عامة لإبقائها قيد التنفيذ. المسار الوحيد المعاد فتحه محلياً هو publication الذي يملك graph منظمة صريحاً.

| البوابة | النتيجة المثبتة |
|---|---|
| `Q01` | enqueue A يصدر envelope موثوقاً؛ Redis ACL يثبت principal A وBroker-bound database executor يثبت `session_user` A |
| `Q02–Q03` | queues وcache keys مستقلة A/B؛ forged dispatch/job mismatch وpublication plan الأجنبي يرفضان ولا يصلان إلى handler، مع tenant DLQ |
| `Q04–Q06` | default-deny، stale/revoked context، lease replay، وduplicate dispatch id تخضع لرفض أو idempotency موثقين |
| `Q07–Q08` | retry محدود ثم handler ناجح، tenant DLQ namespace، ومنع Redis ACL قراءة/كتابة key المنظمة الأخرى |
| `Q09` | provider outage، rotation A1→A2، وعملاء A/B المتوازيون يثبتون fail-closed وprincipal/client separation |
| `Q10` | فحص source، أدوار PostgreSQL غير مالكة، Redis ACL، correlation audit، discard، cleanup وartifact hygiene |
| المدقق المستقل | `valid: true`، بلا IDs مفقودة أو مكررة أو فاشلة؛ الدليل والمدقق مؤرشفان بصلاحية `0600` |

## بوابة الانحدار

نجحت `prisma validate` و`prisma generate` و`tsc --noEmit` وJest الكامل (**18 suites / 94 tests PASS**، مع suite واحدة skipped مسبقاً) وفحص communications والبناء الإنتاجي وفحص artifact hygiene. استخدم Prisma سلسلة `DATABASE_URL` محلية تركيبية صالحة لغوياً فقط ولم يتصل هذا المسار بقاعدة إنتاجية. بقيت تحذيرات البناء غير الحاجبة الخاصة بـoptional `@valkey/valkey-glide` وبـ`process.cwd` في Edge Runtime واصطلاح `middleware` deprecated؛ لم تُفسر كدليل Queue أو provider production.

## حدود النتيجة

هذه **COMPLETE LIMITED AUDIT RUNTIME** لحدود Queue/Redis/Cache المحلية، بما فيها حجر الأسطح غير القابلة لإثبات ownership. لا تثبت تشغيل worker production أو provider queue حقيقياً أو provider publishing خارجياً أو DR/HA/scale. لا تعيد تفعيل SMS/Notification إلا بعد عقد ownership/onboarding مستقل ودليل tenant-safe خاص بها. كما لا تغلق Storage/Root Documents أو Financial RLS أو W02 global closure.
