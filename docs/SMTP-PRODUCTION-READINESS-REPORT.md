# SMTP Production Readiness — `schoolscreen.sa` Sandbox Qualification

## القرار

**الحالة: `CLOSED — SANDBOX VALIDATED`.** أُثبت مسار SMTP submission المحلي من التطبيق إلى خادم البريد تحت `schoolscreen.sa` باستخدام sender المعتمد `admin@schoolscreen.sa`، ونجح إثبات TLS والمصادقة وقبول رسالة sandbox مقيدة. لا يعني هذا تفعيل البريد الحي أو النشر العام: لا DNS أو public vhost أو public traffic أو تعديل Postfix/Exim/Dovecot، وruntime web الإنتاجي عاد إلى fail-closed بعد الاختبار.

## الأدلة الفعلية

| مجال الإثبات | النتيجة | الدليل المقيد |
|---|---|---|
| SMTP submission المحلي | `PASS` | التطبيق يصل محلياً إلى `127.0.0.1:587` فقط؛ المسار `STARTTLS` واسم TLS هو `schoolscreen.sa`. |
| TLS/هوية الخادم | `PASS` | تحقق hostname لشهادة `schoolscreen.sa` اجتاز عند اتصال التطبيق المحلي. |
| SASL authentication | `PASS` | probe المصادق نجح باستخدام credential root-only؛ اختبار password خاطئ رُفض من دون إرسال رسالة. |
| sender | `PASS` | خادم SMTP قبل رسالة sandbox واحدة من `admin@schoolscreen.sa` إلى recipient المعتمد فقط. |
| sandbox recipient guard | `PASS` | recipient خارج allow-list رُفض قبل الاتصال بالمزود. لم يظهر recipient أو credential في المخرجات. |
| submission/delivery sandbox | `PASS` | Nodemailer قبل provider message identifier ورسالة sandbox واحدة فقط؛ لا يُعلن إثبات قراءة inbox أو flow منتج غير موجود. |
| timeout وretry | `PASS` | transport متعمد التعليق أثبت timeout عند ثانية واحدة وثلاث محاولات كحد أقصى، ثم فشل redacted. |
| audit/redaction | `PASS` | تسلسل النجاح `QUEUED,SENT` وتسلسل الفشل `QUEUED,FAILED` احتويا fingerprints فقط، بلا recipient صريح أو password أو message identifier. |
| تنظيف runtime | `PASS` | harness المؤقت حُذف، وdrop-in المؤقت أزيل، وخدمة `asasplus-web-production.service` نشطة مجدداً بلا `ASAS_MAIL_TRANSPORT_CONFIG_CREDENTIAL` وبلا `ASAS_MAIL_DELIVERY_ENABLED=true`. |

## تصميم السر والتشغيل

يبقى source credential في `/opt/asasplus/shared/production-secrets/asas-smtp-sandbox.json` بملكية `root:root` وصلاحية `0600`. لا توضع كلمة المرور في Git أو environment أو السجلات. تُحمّل فقط في عملية systemd اختبارية أو خدمة معتمدة مستقبلاً عبر `LoadCredential=asas-smtp-sandbox:…` و`ASAS_MAIL_TRANSPORT_CONFIG_CREDENTIAL=asas-smtp-sandbox`.

> إعداد adapter يقبل `SANDBOX` فقط؛ ومن ثم لا توجد حالياً آلية تفعل مخاطبة مستخدمين أو حملة بريدية أو إرسال إنتاجي غير مقيد. كل تفعيل لاحق يحتاج تفويضاً مستقلاً وreview للـrecipient policy.

## ما لا يثبته هذا الاختبار

لا توجد حالياً قوالب أو مسارات منتج موصولة لـpassword reset أو invitations أو notifications. لذلك أُثبت **transport submission** وحده، لا تسليم flow منتج أو قراءة الرسالة من mailbox. لم تُفعّل أي payments أو scheduler، ولم يُعد فتح Authentication المغلقة.

## التشغيل الآمن والتدوير

عند تغيير كلمة مرور `admin@schoolscreen.sa`، يستبدل root فقط ملف credential بطريقة atomic مع بقاء `root:root 0600`، ثم يعاد تنفيذ probe sandbox المقيد تحت systemd credential. عند الإلغاء، يحذف root source credential وأي drop-in/service test، وتبقى خدمة التطبيق fail-closed بلا transport أو إرسال.
