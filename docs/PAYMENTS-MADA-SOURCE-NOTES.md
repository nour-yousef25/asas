# ملاحظات مصادر — Payments / Mada

## الحقائق الخارجية ذات الصلة بالبوابة

تصف صفحة مدى الرسمية الشبكة كمنظومة مدفوعات وطنية للتجارة الإلكترونية، وتذكر استخدام بروتوكول الحماية ثلاثي الأبعاد كطبقة إضافية للتحقق من هوية حامل البطاقة. لا تحدد الصفحة adapter تطبيق أو merchant credential خاصاً بـASAS، ولذلك لا يمكن استنتاج مزود أو حساب تاجر منها.

توثق بوابة Checkout.com، كمثال لمزود محتمل لا كمزود مختار، أن قبول Mada يتطلب حساب اختبار، مفاتيح محددة الصلاحية، webhook server، ومعرّف تاجر من acquiring سعودي لبعض مساراتها. وتوضح كذلك فصل sandbox عن production وتلقي webhook لتحديد الحالة النهائية، وأن fulfillment يجب أن ينتظر callback الموثوق. كما توثق مسار API أن Mada ينبغي أن يستخدم 3DS وأن يؤخذ قرار الالتقاط وفق متطلبات المزود/الشبكة.

توثق بوابة Tap، كمثال ثانٍ لا كمزود مختار، أن endpoint الـwebhook يجب أن يكون HTTPS علنياً ومتاحاً من الإنترنت، وأنها تعيد محاولة POST الفاشل، وأن التحقق يعتمد على hash محسوب من payload وsecret. لا تصلح loopback أو localhost لاستقبال callbacks حقيقية.

## الاستنتاج التشغيلي لـASAS

لا يمكن اختراع adapter موحد حقيقي لـMada من دون اختيار مزود متعاقد معه وتأكيد contract الخاص به. لكن أي اختيار لاحق يجب أن يقدم على الأقل: merchant onboarding ومعرّف/حساب merchant مناسب لكل مسار تسوية، sandbox/UAT credential منفصل، server-side API credential أو secret reference بأقل صلاحية، webhook verification secret أو public-key contract، callback URLs HTTPS، سياسة refunds/voids/captures، وطريقة reconciliation/settlement reports.

تظل هذه الملاحظات **مصادر بحث فقط** ولا تمثل تهيئة provider أو تفويضاً لتشغيل payment أو نشر public callback.

## المراجع

[1]: https://www.mada.com.sa/en
[2]: https://www.checkout.com/docs/payments/add-payment-methods/mada/web
[3]: https://www.checkout.com/docs/payments/add-payment-methods/mada/unified-payments-api
[4]: https://developers.tap.company/docs/webhook
