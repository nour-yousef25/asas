# ASAS Plus — W01 Closure Matrix

**الفرع المقاس:** `w01-foundation`
**Canonical baseline ancestor:** `909b638ee942a2c6dbf1ba331767c193dd63303e`
**قاعدة القرار:** لا يُمنح أي بند حالة PASS نهائية إلا بأمر قابل لإعادة الإنتاج أو اختبار أو دليل تشغيلي محفوظ.

> هذه المصفوفة هي خط البداية لاستئناف W01. لا تعلن اكتمال W01، ولا تضيف أو تنفذ أي عنصر من W02 أو ما بعدها.

| Requirement ID | المتطلب | الحالة الحالية | الدليل الحالي | الدليل/الإجراء الناقص | معيار القبول | الاختبار المطلوب | الحالة النهائية |
|---|---|---|---|---|---|---|---|
| FND-001 | عقود نواة قابلة لإعادة الاستعمال وحدود خدمات | PARTIAL | `src/lib/platform/contracts.ts` واختبارات foundation | تدقيق التغطية وعقد الأخطاء والتكوين الفعلي | عقود مستقرة قابلة للاستخدام | unit + contract review | PENDING |
| FND-002 | تكوين typed وآمن وواعٍ بالبيئة | PARTIAL | `runtime-config.ts`، `.env.example`، `check:env` | clean-environment verification وdocs matrix | validation بلا أسرار أو defaults إنتاجية | config failure tests | PENDING |
| OBS-001 | سجلات مهيكلة ومنقحة وCorrelation ID | PARTIAL | `logger.ts` و`observability/*` واختبارات redaction | request-to-log/runtime evidence | لا secrets وارتباط تشخيصي آمن | API/log correlation test | PENDING |
| DEP-001 | نموذج Core واحد لـCloud/Dedicated/Self-Hosted | PARTIAL | contracts، Dockerfile، compose، control-plane tests | support matrix/runbook وclean topology verification | لا forks وحدود ownership موثقة | deployment contract tests | PENDING |
| DEP-002 | فصل Control Plane/Data Plane وتقليل البيانات | PARTIAL | `control-plane.ts` واختبار deployment | مراجعة مسارات metadata وعدم نقل بيانات تشغيلية | API/data boundary مثبتة | privacy/contract test | PENDING |
| INST-001 | Bootstrap محمي وحالة lock/recovery | PARTIAL | installation state وmiddleware واختبارات installer | authenticated API lifecycle evidence | لا دخول بعد التهيئة إلا recovery مدقق | authz/state test | PENDING |
| INST-002 | Preflight read-only للـruntime والخدمات والموارد | PARTIAL | `preflight.ts` و`run-preflight.ts` | بيئة خدمات حقيقية لإثبات configured/unavailable | report آمن قابل للتنزيل وحالات صحيحة | environment matrix tests | PENDING |
| UPDATE-001 | release manifest موقّع وتوافق إصدارات | PARTIAL | release contracts وCLI tests | CLI sign/verify evidence بمفتاح اختبار ورفض التلاعب | signature/key version/negative path | manifest CLI + tamper test | PENDING |
| UPDATE-002 | خطة تحديث تفرض backup وmigration/health evidence | PARTIAL | release plan واختبارات | تجربة خطة تحديث مقابل backup متحقق وfailure path | لا update دون backup وrunbook واضح | update/backup failure tests | PENDING |
| BACKUP-001 | سياسة backup واقعية وverification وownership وhealth | PARTIAL | `backup.ts` وmanifest verifier وfixtures | إنشاء backup حقيقي وverification ودليل policy/runbook | لا نجاح زائف؛ evidence متحقق | backup creation + verification | PENDING |
| BACKUP-002* | restore/DR drill عند انطباقه على W01 | NOT YET CLASSIFIED | Inventory يصنفه `W01/W19`، بينما خطة W01 الأساسية تسمي BACKUP-001 فقط | حسمه بالمراجع ثم تنفيذ restore drill إذا كان شرط W01 | restore ناجح وRTO/RPO/runbook إن كان داخل W01 | isolated restore exercise | PENDING |
| HEALTH-001 | Health Center آمن وواعٍ بالبيئة | PARTIAL | health service وAPI وسجل Smoke سابق، و`W01-HARNESS-FAILURE-DETECTION-CLEANUP-FIX-REPORT.md` مع Evidence Redis/Queue/Worker حقيقية | إثبات storage/backup والمصفوفة الكاملة للخدمات الخارجية، مع إغلاق الفجوات المتبقية | HEALTHY/DEGRADED/UNAVAILABLE/NOT_CONFIGURED بلا أسرار | runtime health test + external dependency failure matrix | PENDING |
| Security baseline | authn/authz/sessions/CSRF/rate limiting/secrets/errors | PARTIAL | Auth.js، middleware، rate limit، redaction، Smoke auth سابق | protected API/negative authz/secrets scan/audit analysis | server-side controls مثبتة | security integration suite | PENDING |
| Production readiness | clean install، DB from zero، seed، runtime، smoke، build | PARTIAL | audit DB/migrations/seed/build و69 tests | clean install وmatrix الخارجية والاختبارات الناقصة | أوامر كاملة قابلة للإعادة | readiness runbook | PENDING |

`*` لا يمثل هذا السطر إدخال نطاق جديد؛ يسجل الغموض الصريح بين Inventory وW01 Scope/ADR لكي لا يُخفى شرط restore محتمل تحت توصيف "foundation".

## حدود موجات مثبتة

لا تدخل tenant isolation الكامل أو activation/licensing أو vault/IdP أو configuration-as-data أو entitlement أو installer التجاري في هذه المصفوفة، لأنها معرفة صراحةً في W02 وW03 وW19. لكن لا يجوز أن تخفي هذه الحدود فشل أساس W01 إذا كان الأساس نفسه مطلوباً ومعيار قبوله غير متحقق.
