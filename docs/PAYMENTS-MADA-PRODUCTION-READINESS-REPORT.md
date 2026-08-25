# Payments / Mada Production Readiness

## القرار

**الحالة: `PAYMENTS — EXTERNAL INPUT REQUIRED`.** أُغلقت عقود الفصل الحسابي والـledger وRLS وfail-closed على staging loopback، لكن لا يوجد Mada provider adapter أو merchant onboarding أو webhook contract حقيقي أو UAT. لذلك لا توجد عملية دفع أو callback أو charge حقيقي، ولا يصح اعتبار نجاح الاختبارات بديلاً عن إثبات المزود.

## نتيجة التدقيق الداخلي

| المجال | النتيجة | الدليل والحد التشغيلي |
|---|---|---|
| Provider architecture | `PARTIAL — PROVIDER_NEUTRAL` | `PaymentProvider` يعرّف create/verifyWebhook/reconcile بلا مزود منصب. لا يوجد adapter فعلي لـMada أو أي gateway في runtime. |
| عملة ومبلغ intent | `CLOSED_INTERNAL` | SAR فقط، ومبلغ موجب بمضاعفات `0.01`، وcallback HTTPS فقط. |
| مسار A: Organization → School Screen | `CLOSED_INTERNAL` | `PLATFORM_BILLING` لا يستخدم `paymentConfiguration` الخاصة بالجمعية؛ يحتفظ فقط ببصمة غير قابلة للعكس لـmerchant platform في `PaymentAttempt`، ويرتبط بـ`PlatformInvoice` وsubscription واحد. |
| مسار B: Donor → Organization | `CLOSED_INTERNAL` | `ORGANIZATION_DONATION` يتطلب `PaymentConfiguration` مفعلة للمنظمة نفسها، وينشئ donation وinvoice بحالة pending؛ ولا يكملها إلا حدث `CAPTURED` موثوق. |
| فصل merchant/settlement | `CLOSED_INTERNAL` | RLS يثبت ownership للـconfiguration والدonation/subscription وplatform invoice ضمن `organizationId` للجلسة، ويمنع ربط transaction بمرجع جمعية أخرى. |
| webhook/replay/idempotency | `CLOSED_INTERNAL_CONTRACT` | event يرفض عند اختلاف amount/currency/provider أو merchant platform؛ unique keys هي `(organizationId,idempotencyKey)` و`(organizationId,providerKey,providerEventId)`، ولا يُخزن raw payload بل digest. Endpoint العام يبقى `503` حتى verifier وledger wiring حقيقيين. |
| reconciliation/refund/void | `PARTIAL — CONTRACT_ONLY` | تسجل reconciliation لكل حدث مطبق، ويمنع adjustment غير صالح أو تجاوز مبلغ المعاملة. refund كامل موثق يعلّق اشتراك المنصة وentitlements ويحوّل فاتورتها إلى `REFUNDED`؛ تنفيذ refund/void عند المزود غير موجود. |
| entitlement activation | `CLOSED_INTERNAL` | `CAPTURED` لمسار `PLATFORM_BILLING` وحده ينشّط subscription/entitlements ويجعل PlatformInvoice `PAID`. لا يمكن لتبرع أن يعدل entitlement. |
| Super Admin / Organization Admin control | `PARTIAL — NO_RUNTIME_UI` | لا توجد حتى الآن API أو UI لإدارة provider policy أو onboarding. لا تعيد العقود secrets أو PAN/CVV؛ `credentialRef` مرجع opaque فقط. يلزم بناء control-plane policy بعد اختيار المزود والعقد التشغيلي. |
| staging runtime | `PASS — FAIL-CLOSED` | release `3b0fc30` ومigration invoice على staging loopback اجتازا health ومراجعة migration؛ لا environment marker لـPayment/Mada/Webhook ولا provider call أو charge. |

## مسارا المنتج

| المسار | الحقيقة الحالية | الأثر المستقبلي بعد adapter حقيقي |
|---|---|---|
| **A — اشتراك الجمعية في School Screen** | ينشأ ledger/platform invoice داخلياً فقط عند ربط checkout مستقبلي؛ لا merchant credential جمعية في هذا المسار. | checkout → Mada/3DS → verified webhook/reconciliation → `CAPTURED` → PlatformInvoice `PAID` → subscription وentitlements `ACTIVE`. |
| **B — تبرع المتبرع للجمعية** | endpoint التبرعات العام fail-closed ولا ينشئ donation مكتمل أو فاتورة مدفوعة. | checkout المنسوب للـmerchant mapping الصحيح للجمعية → webhook موثوق → donation/invoice/campaign/project/donor updates عند `CAPTURED` فقط. |

> لا يجوز أن يفعّل حدث تبرع subscription أو entitlement، ولا يجوز أن يستخدم `PLATFORM_BILLING` إعداد merchant خاصاً بجمعية.

## متطلبات Mada الخارجية الدقيقة

يلزم أولاً اختيار **مزود واحد متعاقد معه** يدعم Mada للتجارة الإلكترونية، ثم تأكيد contract الخاص به. مدى هي شبكة مدفوعات وطنية للتجارة الإلكترونية وتذكر الحماية ثلاثية الأبعاد كطبقة تحقق إضافية، لكن لا توفر هذه الصفحة adapter أو credentials للتطبيق.[1] مثالان من وثائق مزودين محتملين يبينان أن التفاصيل تختلف: provider قد يطلب merchant ID من acquirer سعودي وحساب اختبار ومفاتيح مقيدة وwebhook server، وقد يفرض قواعد capture و3DS مختلفة.[2] [3] لذا لا يُختار أي منهما ضمناً هنا.

| المطلوب | الغرض وأقل صلاحية | التخزين والاختبار |
|---|---|---|
| قرار provider + عقده | تأكيد Mada ecommerce و3DS وcreate/redirect/capture/refund/void/reconcile وsignature rules. | ملف request root-only غير سري؛ review للعقد قبل كتابة adapter. |
| **School Screen merchant mapping** | merchant ID/settlement account لمسار subscription فقط، مع provider key وenvironment. | reference غير سري في config root-only؛ credential منفصل لا يظهر للـSuper Admin أو tenants. |
| **Organization merchant/settlement model** | لكل جمعية: merchant/sub-merchant/account mapping أو اتفاق مكتوب يبين كيف تنسب وتسوي التبرعات؛ لا reuse cross-organization. | mapping per organization، وcredential/reference لكل منظمة إن طلبه المزود؛ لا تخزن password أو card data في DB. |
| sandbox/UAT | حساب test منفصل وmerchant test IDs ووسيلة اختبار معتمدة من provider. | root-only/systemd credential؛ نختبر negative signature/replay/A-B/capture/refund/void/reconciliation قبل production. |
| credentials وwebhook verifier | server-side API key وwebhook secret/public-key contract بأقل scopes. | source `root:root 0600` ثم systemd credential؛ لا chat/Git/env process العام. |
| callback/webhook URLs | success/failure URLs وHTTPS webhook endpoint ثابت وallow-list من المزود. | يتطلب public HTTPS في بوابة cutover منفصلة؛ لا localhost، ولا DNS/vhost في هذه الجولة. |
| settlement/reconciliation | access إلى تقارير settlement/cutoff/currency/fees وسياسة معالجة الفروقات. | runbook وموافقة مالية؛ مقارنة provider refs بالـledger، بلا تعديل attribution تاريخي. |

توضح وثائق webhook لمزود محتمل أن endpoint يجب أن يكون متاحاً عبر HTTPS وأن callback قد يعاد إذا فشل، ولذلك loopback الحالي لا يمكن اعتباره اختبار webhook حقيقي.[4]

## اختبارات لم تُدّع

لم تُجر اختبارات provider signature أو browser checkout أو 3DS أو callback خارجي أو capture/refund/void/reconciliation من مزود، ولم تُنشأ أي transaction أو merchant أو credential تجريبي. هذه بوابة خارجية حقيقية وليست فشلاً يمكن تغطيته بـmock.

## المراجع

[1]: https://www.mada.com.sa/en
[2]: https://www.checkout.com/docs/payments/add-payment-methods/mada/web
[3]: https://www.checkout.com/docs/payments/add-payment-methods/mada/unified-payments-api
[4]: https://developers.tap.company/docs/webhook
