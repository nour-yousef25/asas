# دليل التحويل إلى إنتاج ASAS Plus

**نطاق الدليل:** يستخدم هذا الدليل فقط بعد إغلاق بوابات الجاهزية وتلقي العبارة الصريحة: `انشر على asasplus.shop الآن`. لا ينفذ هذا المستند أي أمر بذاته، ولا يجيز DNS changes أو تعديل موقع آخر أو قاعدة أخرى.

> إذا غاب أي precondition مطلوب، تكون النتيجة **No-Go**. لا تلتف على التخزين أو الهوية أو الترخيص أو البريد بقيم مؤقتة أو credentials تجريبية.

## مرحلة Go/No-Go

| الشرط | مطلوب |
|---|---:|
| phrase التفويض الصريحة | نعم |
| release production المحدد وchecksum | نعم |
| web/worker/Redis production active وloopback health authorized `200` | نعم |
| production backup جديد وmanifest `HEALTHY` وrestore rehearsal صالح | نعم |
| external gates في تقرير readiness مغلقة أو مستثناة خطياً | نعم |
| owner نافذة الصيانة وقناة المراقبة | نعم |
| snapshot ASAS-only لـpublic vhost وunits وsymlink current | نعم |

## التنفيذ الذري

أولاً، أنشئ backup ASAS-only للـvhost الحالي، وحدات production، symlink `production-current`، وmanifest backup. لا تلمس `httpd_config.conf` أو أي vhost خارج `asasplus.shop`. ثانياً، تحقق من candidate proxy offline وقيمته checksum، ثم أضف `extprocessor asasplus_production_3106` وroot proxy context إلى vhost `asasplus.shop` فقط مع إبقاء ACME challenge و`vhssl` كما هما.

بعد validate configuration وإجراء graceful reload لـOpenLiteSpeed، اختبر محلياً بـHost/SNI للنطاق نفسه: الصفحة الأساسية، redirect HTTP→HTTPS إن كان موجوداً، health token، وسلامة عدم عرض `.env` أو `.git` أو source أو backup paths. لا تكشف health token في shell history أو logs. راقب access/error logs الخاصة بـASAS فقط لمدة نافذة قصيرة متفق عليها، ثم نفذ smoke للمستخدم المعتمد وstorage/mail/integrations فقط عند وجود credentials وعقد تشغيل صحيح.

| Smoke بعد التحويل | معيار المرور |
|---|---|
| HTTPS public route | status متوقع وcertificate صحيح للنطاق |
| Unauthorized health | `401` |
| Authorized health | `200` وcomponents المطلوبة `HEALTHY` |
| Auth/IdP | login من account production معتمد فقط |
| Tenant A/B | tenant principal production قائم ومصرح؛ لا debug fixture |
| Storage | upload/read/delete عبر provider حقيقي فقط |
| Mail/integration | sandbox/provider approved فقط، لا payment أو bulk send |

## القرار بعد التحويل

إذا فشل أي smoke required أو ارتفعت أخطاء ASAS في نافذة المراقبة أو أصبحت health required component `UNAVAILABLE`، انتقل فوراً إلى [PRODUCTION-ROLLBACK-RUNBOOK.md](./PRODUCTION-ROLLBACK-RUNBOOK.md). لا تحاول إصلاحاً تجريبياً على traffic العام.
