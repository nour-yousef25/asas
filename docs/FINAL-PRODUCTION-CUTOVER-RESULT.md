# FINAL PRODUCTION CUTOVER RESULT

## 1. Decision

**ROLLBACK EXECUTED**

تم تنفيذ public cutover المفوض بصورة محدودة على `asasplus.shop`، لكن تم التراجع فوراً وبنجاح لأن شرط HTTP الإلزامي لم يتحقق: أعاد `http://asasplus.shop/login` استجابة **200** بدلاً من تحويل HTTP إلى HTTPS. لا يجوز اعتبار هذا السلوك نجاحاً وفق تفويض الإطلاق، ولذلك لا توجد حالياً خدمة ASAS عامة مفعلة.

## 2. Release

| البند | القيمة |
|---|---|
| Git commit | `ddf824b` |
| Release path | `/opt/asasplus/releases/20260826T002153Z-ddf824b` |
| Build ID | `SQGcvZkSP84SRTugRCS2f` |
| أصول Next static / standalone | `127 / 127` |
| Login scripts في بوابة runtime الداخلية | `10 / 10`، JavaScript 200 |

لم يتغير release أو خدمة Node أو أي قاعدة بيانات أو schema أو migration خلال المحاولة أو rollback.

## 3. Pre-Cutover Read-Only

| الفحص | النتيجة |
|---|---|
| release، Git، Build ID | PASS |
| خدمة Node non-root و`127.0.0.1:3106` فقط | PASS |
| health و`/login` loopback | PASS |
| Auth providers عبر canonical host وCredentials | PASS |
| Super Admin control-plane فقط | PASS: `SUPER_ADMIN`، لا active organization، و0 memberships |
| Bootstrap role وruntime write privileges | PASS: الدور غائب وcontrol runtime بلا `INSERT`/`UPDATE` على `public.users` |
| Local VPS Storage وhealth | PASS |
| backup/release rollback artifacts | PASS |
| TLS/SAN وDNS إلى `179.61.219.190` | PASS |
| OLS baseline وCyberPanel document root | PASS: `/home/asasplus.shop/public_html` |
| V2 enablement markers في web runtime | PASS: لا Payment/Mada/Scheduler/live mail marker مُمكّن |

فحص `lswsctrl configtest` أظهر أخطاء قائمة مسبقاً في مواقع أخرى مرتبطة بمسارات PHP قديمة، لذلك لم يُستخدم كدليل green. بقي OLS نشطاً، ولم تتغير تلك المواقع أو global OLS configuration ضمن هذا التنفيذ.

## 4. Public Route ومحاولة Proxy

تمت استعادة **نفس** proxy المعتمد سابقاً، لا proxy جديد:

```text
extprocessor asasplus_next -> 127.0.0.1:3106
maxConns 10
context /
```

تم حفظ backup root-only جديد قبل التعديل في:

```text
/opt/asasplus/shared/cutover-backups/final-public-cutover-20260826T003528Z
```

نجحت HTTPS local public-route probe إلى `/login`، ونجح المتصفح العام في فتح `https://asasplus.shop/login`: ظهر نموذج الدخول، لم يظهر `جاري التحميل...`، ولم يظهر أي خطأ في console. ومع ذلك، أظهر فحص HTTP العام `200` بدلاً من `301/302/307/308` إلى HTTPS؛ وهذا trigger rollback صريح.

## 5. Rollback

استُعيد أحدث backup للـvhost نفسه فقط، ثم نُفذت إشارة OLS graceful reload (`SIGUSR1`).

| البند | النتيجة بعد rollback |
|---|---|
| vhost SHA-256 | `e9aa46820163e309d35d5e65e25f322916bbf91e92fc445307b5abbebeac2ed2` |
| OLS | active |
| Node production | active، loopback-only على `127.0.0.1:3106` |
| Worker production | active |
| health | PASS |
| global OLS config | لم يتغير |
| vhosts الأخرى | لم تتغير وفق manifest المقارن |
| `/login` العام بعد rollback | 404 كما هو متوقع عند غياب proxy |

## 6. Authentication وTenant/Storage

لم يُنفذ positive login عبر الحساب الموجود لأن قناة credentials الآمنة لم تكن متاحة بعد تنظيف AUTH closure. تسجل الحالة بدقة كـ**AUTH_POSITIVE_LOGIN_NOT_REPRODUCED**، بينما تظل AUTH05–AUTH08 السابقة دليلاً تاريخياً منفصلاً. لم يُنشأ مستخدم أو عضوية أو reset أو bootstrap جديد.

أثبت pre-cutover read-only حساب Super Admin ودور control-plane فقط وعدم وجود عضويات أو منظمة نشطة. لم يُعد تشغيل tenant A/B harness لأنه ينشئ fixtures؛ استُخدمت الأدلة السابقة وhealth/read-only invariants فقط، ولم يحدث أي تغيير tenant أو storage.

## 7. V2 Safety

لم تتغير أو تتفعل Payments، Mada، payment webhooks، donation checkout، settlement، reconciliation، refund/void، Domain Scheduler، scheduled reports، entitlement scheduler، أو live SMTP product delivery. بقيت V2 وSMTP product delivery في وضع fail-closed.

## 8. Monitoring

بعد rollback، كانت counts خلال نافذة المراقبة القصيرة:

| المؤشر | النتيجة |
|---|---|
| OLS critical (`fatal/segfault/panic`) | 0 |
| Node critical (`fatal/uncaught/EADDRINUSE`) | 0 |
| الموارد | load متوسط ومنتظم، وذاكرة متاحة تقارب 4.6 GB |
| OLS/Node/worker/health | active/PASS |

## 9. DNS وOther Sites

تمت ملاحظة DNS إلى VPS الحالي `179.61.219.190`. **لم يتغير DNS.** لم يتم تعديل أي vhost آخر أو global OLS configuration أو site ownership أو document root أو PHP/mail configuration.

## 10. المطلوب قبل محاولة جديدة

تحتاج محاولة cutover جديدة تفويضاً صريحاً ومحدوداً لمعالجة **HTTP-to-HTTPS redirect** على vhost `asasplus.shop` فقط، مع backup جديد وrollback، لأن إعادة proxy المعتمد وحدها لا تفرض redirect على HTTP listener الحالي. لا ينبغي تعديل DNS أو أي موقع آخر أو V2 كجزء من هذا الإصلاح.
