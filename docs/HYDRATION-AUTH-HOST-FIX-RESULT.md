# HYDRATION + AUTH HOST FIX RESULT

**التاريخ:** 26 أغسطس 2026 (UTC)
**النطاق المفوض:** إصلاح تغليف Next.js standalone وعقد المضيف canonical لـAuth.js فقط، أولاً على staging ثم على production loopback-only.
**الالتزام البرمجي:** `ddf824b` — `fix: package Next standalone assets and constrain auth host`.

> لم يتضمن هذا العمل أي تفعيل proxy عام أو تغيير OpenLiteSpeed/CyberPanel/DNS أو traffic عام أو migration/seed/schema/Redis أو دفع/Payments أو Domain Scheduler أو إرسال SMTP حي.

## السبب الجذري والإصلاح

كان إصدار standalone السابق يحتوي على `127` ملفاً تحت `.next/static`، في حين كانت `.next/standalone/.next/static` فارغة. لذلك كانت chunks عميل صفحة login تعود 404 وظهر fallback الخادمي `جاري التحميل...` بدلاً من hydration. أضيفت خطوة packaging إلزامية بعد `next build` تنسخ static assets، وتنسخ `public/` عند وجوده، وترفض الإصدار إذا اختلف Build ID أو كان عدد الأصول صفرًا.

كان Auth.js يفشل بـ`UntrustedHost` لأن runtime لم يكن يتضمن متغير Auth.js المعتمد. أصبح `AUTH_URL=https://asasplus.shop` عقداً غير سرياً، محفوظاً في ملف runtime root-only لكل بيئة. يتحقق الكود من القيمة الدقيقة فقط، ويمرر `trustHost` فقط بعد نجاح هذا التحقق، كما ترفض مسارات `/api/auth*` أي Host أو forwarded host غير `asasplus.shop`.

## نتائج packaging والـruntime

| البيئة | Release immutable | Build ID | Static كامل | Static داخل standalone | Login scripts | Providers عبر canonical host |
|---|---|---:|---:|---:|---:|---|
| Staging | `/opt/asasplus/releases/20260826T001234Z-ddf824b` | `oNeM6tVa3Sc02lsMP9RrN` | 127 | 127 | 10 × 200 JavaScript | 200، وCredentials موجود |
| Production | `/opt/asasplus/releases/20260826T002153Z-ddf824b` | `SQGcvZkSP84SRTugRCS2f` | 127 | 127 | 10 × 200 JavaScript | 200، وCredentials موجود |

مرّت بوابة `release:verify-standalone` في البيئتين. وقد تحققت من صفحة `/login` عبر نفق SSH مؤقت إلى loopback: ظهر نموذج البريد/الجوال وكلمة المرور وزر الدخول، ولم يظهر `جاري التحميل...`.

يُظهر console المتصفح خطأ Auth.js فقط عند طلب session من عنوان النفق `127.0.0.1`. هذا السلوك مقصود؛ فالنفق لا يحمل hostname canonical، بينما يرفض عقد Auth المحكم مسار `/api/auth*` لغير `asasplus.shop`. لم يمنع ذلك hydration، وأثبتت بوابة runtime providers بالـforwarded canonical host منفصلاً.

## حالة Auth والعزل

| فحص | Staging | Production |
|---|---|---|
| رفض `/api/auth/providers` بمضيف غير canonical | PASS — 400 | PASS — 400 |
| كلمة مرور خاطئة | PASS — رفض بلا session | PASS — رفض بلا session |
| `AUTH_URL` الدقيق لمرة واحدة | PASS | PASS |
| أذونات ملف runtime | `0600 root:root` | `0600 root:root` |
| Super Admin قائم | غير مطبق؛ قاعدة staging مستقلة ولا مستخدم مصنوع | PASS read-only: موجود، `SUPER_ADMIN`، بلا active organization، و0 memberships |
| Tenant context بلا جلسة | غير مطلوب لهذا الإصلاح | PASS — 401 |
| Login/session/logout الصحيح | لم يُعد؛ لا بيانات اعتماد staging آمنة دائمة ولا مستخدم جديد | لم يُعد؛ تم حذف artifact كلمة المرور عمداً بعد إغلاق AUTH01–AUTH10 |

اختبار login/session/logout الصحيح كان مثبتاً سابقاً ضمن AUTH05–AUTH08. لم يُعاد فتح bootstrap ولم تُنشأ بيانات اعتماد أو مستخدمون أو عضويات لهذا الإصلاح. عدم إعادة الاختبار الموجب هنا لا يغيّر نتيجة إصلاح التغليف أو عقد المضيف، لكنه مسجل صراحة كي لا يُفهم على أنه دليل جديد.

## حدود التشغيل والـrollback

بقيت production على `127.0.0.1:3106` وحالة health الموقعة PASS. ظل ملف vhost في OpenLiteSpeed على baseline hash `e9aa46820163e309d35d5e65e25f322916bbf91e92fc445307b5abbebeac2ed2` ولا يحتوي `asasplus_next`؛ أي لا يوجد public proxy أو public cutover.

تم حفظ نسخ runtime السابقة في مسارات backup root-only منفصلة لكل بيئة قبل إضافة `AUTH_URL`، وتظل الإصدارات السابقة مراجع rollback ذرية: staging `20260825T221034Z-1858f8b` وproduction `20260825T203521Z-468fd38`.

| نطاق خارج التفويض | الحالة |
|---|---|
| OpenLiteSpeed/CyberPanel/DNS/public traffic | لم يتغير |
| Database migrations/seeding/schema/roles/RLS/Redis | لم يتغير |
| Payments/Mada/webhooks | مؤجل إلى V2 وfail-closed |
| Domain Scheduler | مؤجل إلى V2 وfail-closed |
| SMTP product delivery | لم يتغير؛ يبقى fail-closed |

## ملاحظات غير حاجبة

فشل `pnpm run lint` مسبقاً بسبب أخطاء تاريخية واسعة `no-explicit-any` خارج التغيير. كذلك كشف فحص hygiene ثلاثة artefacts قديمة تحت `/tmp`، اثنان منها مملوكان لمستخدم VPS آخر؛ لم تُحذف لتجنب التأثير على مورد غير تابع لـASAS. يظل `E-HYG-01` عيباً موثقاً غير حاجب، ولم يُستخدم أي bypass.

## القرار والخطوة التالية

**HYDRATION + AUTH HOST FIX: PASS على staging وproduction loopback-only.**

يتوقف هذا التفويض هنا. أي تمكين proxy عام أو التحقق عبر `https://asasplus.shop` أو تحويل traffic يتطلب **تفويض cutover عام منفصل وصريح**؛ لا يُستنتج من هذا التقرير ولا ينفذ تلقائياً.
