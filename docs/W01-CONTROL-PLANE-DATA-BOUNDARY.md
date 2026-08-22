# ASAS Plus — W01 Control Plane / Data Plane Boundary

**النطاق:** `DEP-002` foundation. لا توجد قناة Control Plane مفعلة أو نقل بيانات فعلي في W01؛ العقد الحالي محلي strict validation فقط.

## Data Inventory

| فئة البيانات | Data Plane | Control Plane في W01 | القرار |
|---|---|---|---|
| `installationId` UUID | يحتفظ به الـinstance | مسموح فقط عبر `controlPlaneInstanceMetadataSchema` عند اعتماد transport لاحق | ALLOW metadata |
| edition، release version/channel | محلياً ضمن runtime/release config | مسموح كـrelease/support metadata | ALLOW metadata |
| support contract reference، approved domain، observedAt | محلياً | مسموح اختيارياً وبالحد الأدنى | ALLOW metadata |
| بيانات المستفيدين والحالات والوثائق | Data Plane فقط | ممنوع | DENY |
| التبرعات والمانحين والقيود/المصروفات والمعاملات المالية | Data Plane فقط | ممنوع | DENY |
| database/Redis/storage URLs وكلمات المرور والمفاتيح والتواقيع الخاصة | instance secret boundary | ممنوع | DENY |
| Auth sessions، access tokens، cookies، IP الخام، PII | Data Plane/security boundary | ممنوع | DENY |
| application logs وjob payloads | logs محلية منقحة | لا نقل raw logs؛ لا يسمح إلا بمؤشر دعم منقح في عقد لاحق | DENY by default |

## API Boundary Contract

العقد التقني الوحيد المسموح به هو `validateControlPlaneMetadata` في `src/lib/platform/control-plane.ts`. schema strict وتقبل فقط الحقول الستة المحددة أعلاه؛ ترفض الحقول الإضافية، بما فيها `beneficiaryName` و`databaseUrl`، كما تثبت اختبارات `deployment-foundation.test.ts`.

لا يوجد endpoint أو queue أو webhook أو persistence يرسل هذا العقد خارج instance. لذلك لا يسمح هذا المستند بإنشاء transport جديد أو بتصدير metadata أثناء W01؛ وهو يعرّف **ما قد يسمح به** إذا اعتمدت طبقة النقل في موجة لاحقة، لا ما ينقل الآن.

## Retention Contract

| نوع التخزين | W01 behavior | Retention |
|---|---|---|
| Control Plane remote persistence | غير منفذ | لا بيانات تُرسل أو تُخزن؛ retention = صفر |
| Instance runtime metadata | محلي وفق سجلات التطبيق وrelease config | خارج Control Plane؛ يخضع لسياسات instance |
| Future approved Control Plane metadata | لا يبدأ دون data processing/retention contract صريح | يجب تحديد purpose، owner، retention، deletion، audit قبل التفعيل |

## Privacy and Threat Boundary Note

تهديدات هذه الحدود تشمل: سحب بيانات تشغيلية مفرطة إلى Control Plane، تسريب credentials ضمن metadata أو logs، خلط identifiers مع beneficiary/financial data، واستغلال transport لاحق لتجاوز data-plane ownership. تخفف W01 هذه التهديدات عبر schema strict، fail-closed للحقول الإضافية، عدم وجود transport، logging redaction، وعدم تخزين Control Plane remote. لا يدعي هذا note تحقيق tenant isolation الكامل أو vault أو retention engine؛ تلك مؤجلة صراحةً إلى W02/W03.
