# Production Readiness Reconciliation 54

## النتيجة التنفيذية

قرارات المنتج الجديدة متوافقة مع عزل W02 ولا تتطلب إعادة أي موجة مغلقة. لكنها تغيّر بوابات الإطلاق كما يلي: **Local VPS Storage** يحل محل S3، و**Bootstrap** يحل محل IdP، و**SaaS Entitlements** يحل محل certificate activation، بينما تصبح **payments** نطاق إطلاق مطلوباً بدلاً من استبعاد اختياري. تظل SMTP وgateway Mada-compatible مدخلين حقيقيين لا يمكن اختراعهما.

| المجال | الموجود فعلياً | الفجوة المحددة | تصنيف العمل |
|---|---|---|---|
| Local storage | `TenantArtifactProvider` tenant-bound، raw storage محجور، وadapter S3 اختياري. | لا provider filesystem محلي يفرض root path/tenant ownership/private token delivery. | `IMPLEMENTABLE NOW` |
| Bootstrap Auth | credentials auth يستخدم bcrypt و`Role.SUPER_ADMIN` موجود؛ harness الحالي audit-only ويرفض production. | لا control-plane provision flow مدقق ينشئ Super Admin وOrganization Admin وفق approval حقيقي. | `IMPLEMENTABLE NOW` |
| IdP | contract OIDC/SAML provider-neutral موجود. | لا شيء مطلوب للإطلاق الأول؛ يبقى extension. | `PRODUCTION CUTOVER ONLY` |
| SMTP | mail transport abstraction/redaction/retry موجودة. | لا SMTP adapter حقيقي أو secret/config من المالك أو approved test. | `EXTERNAL INPUT REQUIRED` |
| Payments | gateway contract/webhook fail-closed موجود؛ Donation وInvoice موجودان. | لا Platform Plan/Subscription/Entitlement، ولا transaction/attempt/event/refund ledger؛ `FinancialRepository.createDonation` يكتب `COMPLETED` و`PAID` مباشرة قبل provider confirmation. | `IMPLEMENTABLE NOW` |
| Provider payments | لا provider مثبت ولا card storage. | تحديد gateway Mada-compatible، merchant credentials، webhook secret وsandbox/UAT. | `EXTERNAL INPUT REQUIRED` |
| SaaS entitlement | `ActivationRecord`/license signature contract موجودان لكنهما خاصان بcertificate activation. | لا SaaS plans/subscriptions/entitlements/status lifecycle مفصول عن payment. | `IMPLEMENTABLE NOW` |
| Scheduler | worker فعلي واحد للنشر الاتصالي tenant-bound؛ domain scheduler contract/dry-run موجود. | لا catalogue حقيقي مصنف أو persistent run store/tenant executor عام للوظائف الأخرى. | `IMPLEMENTABLE NOW` |

## حدود التصميم الإلزامية

### التخزين المحلي

المسار الصحيح هو `TenantArtifactProvider` جديد، لا إعادة إحياء `storage.ts` المحجور. يجب أن يكون `rootPath` root-owned، وأن يتحول object key المقبول فقط إلى مسار تحت `private/<organizationId>/artifact/<artifactId>/vN`. لا يعاد local filesystem path إلى العميل؛ delivery يكون token قصير العمر يمر على API يملك authorization tenant-bound، أو file descriptor streaming من endpoint محمي. لا يقرأ التطبيق credentials S3 في هذا النمط.

### Bootstrap

ينفذ provisioner control-plane منفصل بعد request root-owned وموافقة صريحة. لا يستخدم `prisma db seed`، ولا ينشئ منظمة تجريبية، ولا يطبع password. الإنشاء الحقيقي يحتاج identity وsecret في ملف root-only خارج Git، ثم يحذف material أو يبطلها بعد verify. Super Admin platform-level لا يستعمل كبديل عن membership/tenant authority داخل منظمة؛ كل Organization Admin يبقى membership مستقلاً.

### المدفوعات والترخيص

تحتاج منصة SaaS إلى models جديدة مستقلة: `PlatformPlan`، `OrganizationSubscription`، `OrganizationEntitlement`، و`PaymentTransaction`/`PaymentAttempt`/`PaymentWebhookEvent`/`PaymentReconciliation`/`PaymentAdjustment`. لا تحفظ PAN/CVV أو raw card data، ولا تؤثر webhook على totals أو entitlement إلا بعد signature verification وربط tenant/configuration وidempotent ledger. يظل Platform Billing في control plane، وتظل Organization Donations مقيدة دوماً بـorganizationId وtenant-bound executor.

### Scheduler

catalogue الحالي مجرد contract؛ العمل المجدول الحقيقي القائم هو publication tenant worker. يجب أن تسجل المصفوفة كل job مع فئته، owner، authority، timeout، retries، concurrency، audit وlaunch safety. لا يجوز تسليم `organizationId` متحكم به من scheduler كبديل عن checkout authority؛ كل job tenant-level يبدأ بربط tenant-bound مستقل.

## أقل مدخل خارجي متبقٍ بعد التنفيذ الداخلي

| البوابة | المدخل الأدنى |
|---|---|
| SMTP | host، port، TLS mode، sender، secret reference، وapproval لاختبار اتصال ورسالة sandbox. |
| Mada-compatible gateway | provider مختار، merchant/sandbox ثم production credentials، webhook secret، callback allow-list، وUAT approval. |
| Bootstrap الحقيقي | identity/email Super Admin معتمد وrequest/approval، مع initial secret root-only لا يمر في Git أو logs. |
| Go/No-Go | owner/window approval فقط بعد اكتمال proofs. |

لا يشكل غياب S3 أو IdP أو signed SaaS certificate blocker لإطلاق النمط المعتمد في هذه الجولة.
