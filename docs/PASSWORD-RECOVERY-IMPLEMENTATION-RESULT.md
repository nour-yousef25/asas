# PASSWORD RECOVERY IMPLEMENTATION RESULT

## القرار

**PASSWORD RECOVERY — BLOCKED**

تم تنفيذ ونشر Password Recovery على **staging فقط**. اجتازت بوابات المصدر والبناء والمigration وواجهات الاستخدام والضوابط السلبية، لكن لا يجوز تسميتها `STAGING READY` بعد لأن الدليل end-to-end الإلزامي لم يكتمل: لا يوجد في staging حساب Super Admin، ولا أي مستخدم فعال يطابق sandbox recipient allow-list. لم يتم إنشاء مستخدم أو تغيير كلمة مرور أو إرسال بريد إلى مستلم غير معتمد لتجاوز هذه البوابة.

> لم يجر أي تعديل على production database أو production release أو OLS أو CyberPanel أو DNS أو public traffic خلال هذا العمل.

## 1. المعمارية المختارة

اخترنا **secure reset link** بدلاً من OTP، لأنه يتسق مع SMTP transaction الحالي ويقلل سطح إدخال رمز يدوي. يولد التطبيق token عشوائياً بطول 32 byte، بصيغة Base64URL بطول 43 حرفاً. لا يُخزن token الخام؛ يخزن hash SHA-256 مع context ثابت. يوضع token في URL fragment (`#token=...`) لا query string، ولذلك لا يرسل المتصفح token إلى الخادم مع طلب صفحة reset أو في referrer العادي.

| البند | العقد المنفذ |
|---|---|
| Token | 32-byte cryptographic random، Base64URL |
| Storage | hash فقط في `control.password_recovery_tokens` |
| Expiration | 15 دقيقة، مع حد أقصى تحققه الدالة 30 دقيقة |
| Single use | `consumed_at` بعد reset ناجح؛ وtokens الفعالة السابقة لنفس المستخدم تُrevoked عند طلب جديد |
| Replay / wrong / expired | نفس دالة consume ترفضها بلا تغيير password |
| Password hashing | bcrypt cost 12 |
| Password policy | 12 حرفاً على الأقل، وحرف صغير وكبير ورقم؛ policy نفسها المستخدمة في `registerSchema` |
| Session invalidation | `authVersion` يزيد atomically؛ session callback يعيد session بلا user عندما لا يطابق JWT النسخة الحالية |

## 2. الخصوصية وrate limits والتدقيق

يعيد endpoint الطلب دائماً رسالة موحدة: **«إذا كان الحساب موجوداً، فستصلك تعليمات الاستعادة.»**، سواء كان البريد معروفاً أو غير صالح أو غير موجود. ينفذ العمل اللاحق بعد response، فلا يغير وجود حساب حالة HTTP أو body العامة.

| الضبط | القيمة |
|---|---|
| request rate limit | 3 طلبات لكل IP خلال 15 دقيقة |
| reset rate limit | 5 محاولات لكل IP خلال 15 دقيقة |
| audit | `PASSWORD_RECOVERY_REQUESTED` أو `PASSWORD_RECOVERY_RESET` أو `PASSWORD_RECOVERY_DELIVERY_FAILED` فقط |
| audit data | outcome وuser fingerprint فقط؛ لا email أو token أو URL أو password أو session token |
| SQL privileges | `REVOKE ALL` على token table والدوال من `PUBLIC`؛ `GRANT EXECUTE` فقط إلى control-plane role الموروث |

الجدول داخل schema `control` لأنه state مصادقة على مستوى platform، لا يملك `organizationId` ولا يمنح tenant scope. لا توجد صلاحيات جدول عامة للـruntime؛ الدوال محدودة الإدخال وتستخدم `SECURITY DEFINER` مع `search_path` ثابت.

## 3. SMTP والتسليم

تم ربط feature بـSMTP sandbox فقط عبر systemd credential في staging:

| البند | الحالة |
|---|---|
| sender | `admin@schoolscreen.sa` فقط |
| secret storage | systemd credential من ملف root-only؛ لا Git ولا env عام |
| general mail delivery | بقي fail-closed |
| recovery mail delivery | يتطلب `ASAS_PASSWORD_RECOVERY_DELIVERY_ENABLED=true` في drop-in staging فقط |
| recipients | sandbox allow-list فقط، وtransport يرفض أي عنوان خارجها قبل provider delivery |
| template | School Screen وتعليمات reset ومدة الصلاحية وتحذير عدم المشاركة والرابط الرسمي فقط |

لم يرسل اختبار staging بريداً، لأن allow-list لا يطابق أي حساب staging قائم. هذا هو blocker، وليس SMTP credential أو transport: أثبتت الخدمة تحميل systemd credential بنجاح.

## 4. migration وrelease

| البند | النتيجة |
|---|---|
| Migration | `20260826010000_password_recovery_control_plane` مطبقة على staging فقط |
| Staging release | `/opt/asasplus/releases/20260826T012205Z-c518acd` |
| Build ID | `qoRB0pUvaEXnJP726rCo4` |
| Static / standalone | `131 / 131` |
| Staging health | PASS |
| SMTP credential | loaded في systemd credential directory |
| rollback | symlink السابق `20260826T001234Z-ddf824b` وbackup control schema/drop-in محفوظان root-only |
| Production | لم يُمس |

## 5. الاختبارات المنفذة

| الاختبار | النتيجة |
|---|---|
| Prisma validate | PASS |
| TypeScript | PASS |
| Jest | PASS — 154 tests، 1 skipped |
| Build / standalone packaging | PASS |
| Artifact hygiene scan | PASS |
| Forgot Password UI | PASS عبر staging loopback |
| Reset Password UI بلا token | PASS — form disabled ورسالة رفض ظاهرة |
| Anti-enumeration | PASS — status/body موحدان للبريد غير الموجود وغير الصالح |
| Request rate limit | PASS — الطلب الرابع = 429 |
| Wrong token | PASS — 400 بلا تغيير password |
| Tenant context بلا session | PASS — 401 |
| Expiry/replay/cross-user | PASS في unit tests؛ replay وexpiry مغطّيان بدلالة consume الوحيدة |
| SMTP sandbox mail / valid reset / old-new login / session/logout | **BLOCKED** — لا recipient مطابقة في staging |
| Super Admin staging invariants | **BLOCKED** — عدد Super Admin في staging = 0 |

## 6. الملفات الرئيسية

| الفئة | الملفات |
|---|---|
| Core | `src/lib/password-recovery.ts`, `src/lib/auth.ts`, `src/lib/rate-limit.ts` |
| API/UI | `src/app/api/password-recovery/*`, `src/app/forgot-password/page.tsx`, `src/app/reset-password/page.tsx`, `src/app/login/page.tsx` |
| SMTP | `src/lib/smtp-transport.ts`, `src/lib/mail-transport.ts` |
| Data | `prisma/migrations/20260826010000_password_recovery_control_plane/migration.sql` |
| Tests | `src/lib/password-recovery.test.ts`, `src/__tests__/validations.test.ts` |
| Hygiene | `scripts/w02-audit-artifact-hygiene-scan.mjs` |

## 7. Git وrollback

التنفيذ موجود في commit **`c518acd`** (`feat: add secure password recovery flow`) على الفرع `w02-global-closure-execution`.

Rollback staging متاح عبر symlink إلى release السابق وإزالة drop-in recovery؛ migration additive فقط، ولا ينبغي حذف token table أو الدوال إلا من خلال change مخصص ومراجَع. لا يوجد production rollback لأن production لم يتغير.

## 8. المدخل المطلوب لإغلاق blocker

المطلوب الأدنى هو **واحد فقط** من التالي، ولا يطلب كلمة مرور في المحادثة:

| الخيار | المطلوب | النطاق | الاختبار |
|---|---|---|---|
| A — الموصى به | إضافة بريد مستخدم staging موجود إلى sandbox recipient allow-list root-only | Staging فقط | طلب recovery، استلام sandbox mail، valid reset، replay، old/new login، authVersion، logout |
| B | توفير principal staging فعال موجود مسبقاً يطابق allow-list الحالية | Staging فقط | الاختبار نفسه، من دون إنشاء مستخدم |

لا يسمح هذا التفويض باستخدام Super Admin production أو إرسال بريد إلى مستخدم production أو إنشاء حساب staging جديد فقط لأجل الاختبار. بعد PASS الكامل على staging يلزم تفويض production مستقل؛ التنفيذ الحالي يتوقف هنا.
