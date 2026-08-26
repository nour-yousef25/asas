# HTTP→HTTPS + FINAL CUTOVER RESULT

## القرار النهائي

**PRODUCTION CUTOVER — SUCCESS**

تم تشغيل School Screen V1 فعلياً على `https://asasplus.shop` بعد إصلاح محدود داخل vhost `asasplus.shop` فقط واستعادة proxy OLS المعتمد. لم يُغيّر DNS أو global OLS أو أي vhost آخر أو release التطبيق أو قاعدة البيانات أو أي نطاق V2.

## السبب الجذري

كان vhost `asasplus.shop` مرتبطاً بكل من HTTP listener وHTTPS listener، وكانت كتلة `rewrite` مفعلة بلا أي قاعدة force-HTTPS. لذلك كان HTTP يصل إلى document root أو إلى proxy عند تفعيله ويعيد `200` بدلاً من redirect. يدعم OpenLiteSpeed قواعد rewrite على مستوى virtual host؛ استُخدم هذا المستوى فقط مع وجهة ثابتة لا تعتمد على `Host` مُرسل من المستخدم.[1]

## الملفات والتغييرات

| الملف | التغيير |
|---|---|
| `/usr/local/lsws/conf/vhosts/asasplus.shop/vhost.conf` | أضيف redirect vhost-only وproxy ASAS المعتمد فقط |
| global OLS configuration | لم يتغير |
| vhosts الأخرى | لم تتغير |
| DNS/SSL/Node/Next.js/Database/Redis | لم تتغير |

الفرق الفعلي داخل vhost هو:

```text
rewrite {
  enable                  1
  autoLoadHtaccess        1
  RewriteCond %{SERVER_PORT} 80
  RewriteRule ^/(.*)$ https://asasplus.shop/$1 [R=301,L]
}

extprocessor asasplus_next {
  type                    proxy
  address                 127.0.0.1:3106
  maxConns                10
  initTimeout             60
  retryTimeout            0
  respBuffer              0
}

context / {
  type                    proxy
  handler                 asasplus_next
  addDefaultCharset       off
}
```

قاعدة redirect ثابتة إلى `https://asasplus.shop` فقط، ولذلك لا توجد open redirect ولا وجهة خارجية أو user-controlled. يحافظ rewrite على path وquery string، مثل `/login?callbackUrl=%2F`.

## النسخ الاحتياطية وvalidation

| البند | القيمة |
|---|---|
| Backup redirect | `/opt/asasplus/shared/cutover-backups/http-https-redirect-20260826T004436Z` |
| Backup proxy بعد redirect | `/opt/asasplus/shared/cutover-after-redirect-20260826T004507Z` |
| vhost قبل redirect | `e9aa46820163e309d35d5e65e25f322916bbf91e92fc445307b5abbebeac2ed2` |
| vhost بعد redirect وproxy | `f0800160420a84d17ed62b2894e1ad92b2e837bce79f34d196eb104438e28fd5` |
| OLS reload | graceful `SIGUSR1` فقط |
| أخطاء ASAS في configtest قبل/بعد | `0 / 0` |
| global OLS وvhosts الأخرى | unchanged وفق hash/manifest |

أظهرت `lswsctrl configtest` أخطاء قديمة تخص vhosts PHP أخرى ومسارات PHP غير موجودة، لكنها لم تذكر `asasplus.shop` قبل أو بعد التغيير. لم تُصلح ولم تُمس لأنها خارج التفويض.

## التحقق العام

| الفحص | النتيجة |
|---|---|
| `http://asasplus.shop/` | 301 إلى HTTPS |
| `http://asasplus.shop/login` | 301 إلى `https://asasplus.shop/login` |
| query preservation | PASS، بما في ذلك `callbackUrl=%2F` و`x=1` |
| TLS | PASS، والتحقق من الشهادة ناجح |
| `https://asasplus.shop/login` | 200 |
| Browser hydration | PASS؛ نموذج الدخول ظاهر ولا يوجد `جاري التحميل...` |
| Browser console | بلا أخطاء |
| Next login JavaScript chunks | 10/10 = HTTP 200 JavaScript |
| `/api/auth/providers` | 200 وCredentials provider حاضر |
| production Node | active، non-root، و`127.0.0.1:3106` فقط |
| OLS وworker وhealth | active/PASS |

لم يُعد login/session/logout الموجب عبر Super Admin لأن artifact credentials الآمن كان قد أزيل عمداً عند إغلاق AUTH. الحالة هي **AUTH_POSITIVE_LOGIN_NOT_REPRODUCED**؛ ولا تعني فشلاً في Auth أو اختراع نتيجة جديدة. بقي دليل AUTH05–AUTH08 التاريخي منفصلاً.

## V2 Safety

ظلت Payments، Mada، payment webhooks، donation checkout، settlement/reconciliation/refund/void، Domain Scheduler، scheduled reports، entitlement scheduler، وlive SMTP product delivery في وضع fail-closed. لم توجد marker تمكين V2 في عملية web production، ووصل payment webhook غير المصرح به إلى `401` قبل أي handler أو side effect.

## Monitoring

خلال نافذة المراقبة القصيرة بعد cutover:

| المؤشر | النتيجة |
|---|---|
| HTTP redirect | PASS |
| HTTPS login | PASS |
| OLS/Node/worker | active |
| health | PASS |
| Node listener | loopback-only |
| critical OLS logs | 0 |
| critical Node logs | 0 |
| global OLS/vhosts أخرى | unchanged |
| DNS | **NO CHANGE**؛ ما زال يشير إلى `179.61.219.190` |
| rollback | لم يُنفذ بعد النجاح النهائي؛ backup جاهز |

## References

[1]: https://docs.openlitespeed.org/config/rewriterules/ "OpenLiteSpeed Documentation — Rewrite Rules"
