# SMTP Production Readiness — Internal Closure / External Provider Gate

## القرار

**الحالة: `SMTP BLOCKED — EXTERNAL INPUT REQUIRED`.** أُغلقت الجاهزية الداخلية القابلة للتنفيذ من دون إرسال أي رسالة ومن دون DNS أو public vhost أو public traffic. لا يصح اعتبار SMTP مغلقاً قبل إثبات transport حقيقي وTLS والمصادقة وهوية sender وتسليم sandbox معتمد.

## ما تم التحقق منه

| المجال | الحالة | الدليل أو السلوك |
|---|---|---|
| عقد التطبيق | `CLOSED_INTERNAL_IMPLEMENTATION` | `MailDispatchService` يفرض schema للمنظمة/idempotency/recipients والـsender، ويعطّل delivery افتراضياً. |
| SMTP adapter | `CLOSED_INTERNAL_IMPLEMENTATION` | Nodemailer transport حقيقي يفرض `STARTTLS` أو `TLS` فقط، timeout من 1–60 ثانية، ولا يثبت transport عند غياب config. |
| المصادقة والسر | `CLOSED_INTERNAL_IMPLEMENTATION` | username/password لا يخرجان إلى Git أو logs؛ يدعم runtime systemd credential خاصاً بالخدمة بدلاً من environment secret. |
| sandbox guard | `CLOSED_INTERNAL_IMPLEMENTATION` | adapter يقبل `SANDBOX` فقط، ويرفض أي recipient خارج allow-list قبل الاتصال بالمزود. |
| retry/failure | `CLOSED_INTERNAL_IMPLEMENTATION` | الحد الأقصى ثلاث محاولات، ولا يوجد retry لا نهائي؛ failure يعاد كرمز redacted. |
| audit/redaction | `CLOSED_INTERNAL_IMPLEMENTATION` | audit يحفظ recipient fingerprints فقط ولا يحتفظ بالعنوان الصريح أو credential. |
| Postfix/SnappyMail على VPS | `NOT_PROVEN_AS_APPLICATION_SMTP` | توجد بنية بريد محلية، لكن relayhost غير مضبوط وSASL غير مفعل، ولا يصح افتراض أن SnappyMail هو مزود SMTP للتطبيق. |
| transport حقيقي وتسليم sandbox | `EXTERNAL_INPUT_REQUIRED` | لا يوجد sender أو host/port/TLS أو credential أو recipient تجريبي معتمد. |

## مسار الإعداد المعتمد عند توفر المدخلات

يُنشأ source credential غير متعقب في `/opt/asasplus/shared/production-secrets/asas-smtp-sandbox.json` بملكية `root:root` وصلاحية `0600`. لا يحتوي environment على password؛ بدلاً من ذلك يحمّل systemd هذا المصدر باسم credential `asas-smtp-sandbox` إلى مساحة خاصة بعملية خدمة ASAS. تستعمل الخدمة الاسم فقط عبر `ASAS_MAIL_TRANSPORT_CONFIG_CREDENTIAL=asas-smtp-sandbox`.

> لا يركب transport ولا يفتح اتصال SMTP عندما يغيب اسم credential أو ملفه. كما يبقى `ASAS_MAIL_DELIVERY_ENABLED` متوقفاً حتى توجد موافقة اختبار صريحة.

## عناصر لا توجد لها wiring حالياً

يوفر transport نصاً وHTML، لكن لم يُكتشف renderer/templates أو مسارات product مربوطة فعلياً لـpassword reset أو invitations أو organization/system notifications. لا تمثل هذه فجوة في حماية transport؛ لكنها تعني أن هذه flows لا يمكن ادعاء اختبار تسليمها قبل تنفيذها وربطها بعقد mail نفسه.

## المدخلات الخارجية المطلوبة

| المدخل | الغرض | أقل صلاحية وتخزين | الاختبار بعد الإدخال |
|---|---|---|---|
| sender صريح تحت `schoolscreen.sa` | From address المعتمد؛ وreply-to إن كان مختلفاً | قرار owner، بلا افتراض عنوان | sender validation ورفض sender غير المطابق |
| SMTP host وport وTLS mode | submission route حقيقية؛ `STARTTLS` أو `TLS` فقط | غير سري، لكن يثبت في request root-only | TLS handshake/probe من staging فقط |
| SMTP username/password أو service credential | مصادقة send-only | source `root:root 0600` ثم systemd credential؛ لا mailbox/admin scope | auth success/failure redacted ثم rotation proof |
| sandbox recipient allow-list وapproval | منع أي تسليم لمستخدمين حقيقيين بلا إذن | request root-only، recipient واحد أو أكثر بحد أقصى 25 | رسالة sandbox واحدة بعد approval صريح |

## الاختبارات المؤجلة إلى وجود المدخلات

يلزم تنفيذ probe، TLS، authentication، sender validation، successful/failure delivery، timeout، bounded retry، redaction، audit وtemplate rendering على staging أولاً. لا يُرسل بريد حقيقي ولا يفعل production launch قبل هذه الأدلة.

## الحدود التي لم تتغير

لا DNS، ولا public vhost، ولا public traffic، ولا scheduler حي، ولا payments، ولا تعديل لـAuthentication المغلقة.
