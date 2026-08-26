# PASSWORD RECOVERY — STAGING E2E RESULT

## القرار

**PASSWORD RECOVERY — BLOCKED**

Password Recovery يعمل على staging، واجتازت جميع بوابات التطبيق والأمن والـSMTP التي يمكن إثباتها من البيئة. لكن لا يجوز إعلان `STAGING READY` لأن بوابة واحدة إلزامية لم تُغلق: **استخراج reset link من صندوق بريد sandbox والتحقق منه كرسالة مستلمة**. المستلم المفوض ليس صندوقاً محلياً قابلاً للفحص على VPS، ولم تتوفر credentials أو قناة mailbox مفوضة. لم تُطبع أو تُطلب أي كلمة مرور أو بريد أو token أو URL أو cookie.

> لم يحدث أي deployment أو migration أو إعداد أو traffic تغيير في production. لا يزال العمل محصوراً في staging.

## 1. المستلم وSMTP sandbox

| البند | النتيجة |
|---|---|
| مستخدم staging | fingerprint `82300b73de016cf2` فقط |
| allow-list | إضافة عنوان المستخدم داخلياً، وارتفع العدد من `1` إلى `2` فقط |
| حفظ الإعداد | root-only، `0600 root:root`، مع backup قبل التعديل |
| خدمة staging وhealth بعد reload | PASS |
| SMTP sandbox request | PASS — response موحد وaudit event `PASSWORD_RECOVERY_REQUESTED` redacted موجود |
| استلام/قراءة mailbox | **BLOCKED** — المستلم خارج local spool ولا توجد قناة mailbox مفوضة |

لم يرسل التطبيق إلى أي مستلم غير allow-list، ولم تتغير allow-list في production.

## 2. نتائج التطبيق والأمن

| الفحص | النتيجة |
|---|---|
| Forgot Password request | PASS — HTTP 200 ورسالة موحدة |
| Anti-enumeration | PASS — البريد غير الموجود والبريد غير الصالح يعيدان body متطابقاً |
| Request rate limit | PASS — أول 3 طلبات، والرابع 429 لكل IP اختبار |
| Secure reset token | PASS — hash فقط في `control.password_recovery_tokens`، expiry وsingle-use |
| Expired token | PASS — 400 |
| Wrong token | PASS — 400 |
| Replay بعد reset صحيح | PASS — 400 |
| Valid reset endpoint | PASS — 200 باستخدام token اختبار داخلي غير مطبوع |
| Login بكلمة المرور القديمة | PASS — مرفوض |
| Login بكلمة المرور الجديدة | PASS |
| `authVersion` | PASS — يزيد لكل reset، والجلسة الأقدم تبطل |
| Logout | PASS — الجلسة بعد الخروج بلا user وtenant context = 401 |
| Cross-user | PASS — لا تغيير لـ`authVersion` للمستخدم الآخر |
| Role / organization / memberships | PASS — بلا تغيير |
| Tenant authority | PASS — لم تُنشأ منظمة أو عضوية أو tenant scope |

## 3. إصلاحات staging المكتشفة أثناء الإثبات

تم اكتشاف ثلاث عوائق حقيقية في مسار جديد ولم يتم تجاوزها:

| الالتزام | التصحيح |
|---|---|
| `e8171d5` | تأهيل عمود token داخل `issue_password_recovery` لإزالة PL/pgSQL ambiguity. |
| `b08ddb8` | جدولة request غير حاجبة عبر `setImmediate` بدلاً من `after()` الذي لم ينفذ العمل في release staging. |
| `0f68a53` | نقل recovery audit redacted إلى schema `control` لأن `public.audit_logs` يفرض tenant RLS ولا يصح تجاوزه. |

الدالة الجديدة لا تستخدم `BYPASSRLS` أو Raw GUC أو global tenant credential ولا تخفف policy الخاصة بـ`public.audit_logs`.

## 4. حالة staging والـrollback

| البند | الحالة |
|---|---|
| release الحالي | `/opt/asasplus/releases/20260826T020424Z-0f68a53` |
| migrations | applied على staging فقط |
| backup control schema | محفوظ root-only قبل كل migration |
| release rollback | `staging-previous` متاح |
| OLS / DNS / public traffic | لم تتغير |
| production | لم يُمس |
| Payments/Scheduler/live SMTP product delivery | بقيت fail-closed |

## 5. المدخل الأدنى لإغلاق blocker

يلزم أحد الأمرين التاليين فقط، وكلاهما منفصل عن production:

| الخيار | المطلوب | الاختبار المتبقي |
|---|---|---|
| A — الموصى به | ربط mailbox sandbox للمستلم المفوض في بيئة اختبار آمنة أو توفير وصول browser/session مفوض إلى mailbox | استخراج reset URL بصورة redacted ثم فتحه وإكمال reset من الرسالة المستلمة |
| B | توفير صندوق بريد محلي/اختباري جديد مخصص للـsandbox ومطابق allow-list، مع صلاحية وصول تشغيلية مقيدة | الاختبار نفسه |

حتى إغلاق هذا الدليل، لا يوجد تفويض أو سبب لنشر Password Recovery إلى production.
