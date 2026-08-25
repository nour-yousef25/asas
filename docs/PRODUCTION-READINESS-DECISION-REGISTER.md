# سجل قرارات Production Readiness — Product Decisions 54

**المرجع:** `pasted_content_54.txt`. هذا السجل يحكم بوابات الإطلاق اللاحقة، ويُبقي جميع أدلة W02 وstaging وproduction foundation السابقة مغلقة وغير معاد تنفيذها.

| القرار | القرار المنتج المعتمد | الأثر التشغيلي | حالة التنفيذ الآن |
|---|---|---|---|
| PRD-54-01 | `BOOTSTRAP` هو نمط المصادقة عند الإطلاق الأول. Super Admin معتمد يدير Control Plane؛ Admin مستقل لكل Organization. | لا IdP خارجي عند الإطلاق؛ يظل IdP extension لاحقاً خلف contract قائم. | `IMPLEMENTABLE NOW`؛ لا يُنشأ حساب حقيقي بلا identity/approval/secret من المالك. |
| PRD-54-02 | التخزين عند الإطلاق Local VPS tenant-private، لا S3 خارجي. | provider abstraction ثابتة؛ local adapter يملك directories isolated وprivate delivery ويُبدّل لاحقاً إلى S3-compatible بلا تغيير domain logic. | `IMPLEMENTABLE NOW`. |
| PRD-54-03 | SMTP لـ`schoolscreen.sa` مزود mail مؤقت، لا علاقة تشغيلية بـSnappyMail UI. | SMTP adapter/provider-neutral، secret reference، test connection ورسالة اختبار معتمدة فقط. | `EXTERNAL INPUT REQUIRED` لبيانات SMTP/approval الحقيقية؛ لا secret مخترع. |
| PRD-54-04 | Payments مطلوبة عند الإطلاق لمساري Platform Billing وOrganization Donations، مع أولوية Mada. | gateway-agnostic، ledger/reconciliation/idempotency/audit/refund-void، وtenant isolation صريح؛ لا card data داخل ASAS. | `IMPLEMENTABLE NOW` للطبقة الداخلية؛ provider Mada-compatible وcredentials/E2E خارجي لاحقاً. |
| PRD-54-05 | SaaS entitlements: Organization → Subscription/Plan → License/Entitlements → Activation، بالحالات ACTIVE/SUSPENDED/EXPIRED. | Super Admin يدير entitlements؛ payment مستقل؛ certificate/instance activation يبقى extension لـDedicated/Self-Hosted فقط. | `IMPLEMENTABLE NOW`. |
| PRD-54-06 | scheduler يُراجع ويُصنف ثم ينفذ فقط ما يثبت آمناً. | لكل job owner/context/idempotency/retry/timeout/concurrency/failure/audit/heartbeat/lag/launch-safety؛ tenant job تحت authority tenant-bound حصراً. | `IMPLEMENTABLE NOW` للمراجعة وstaging proof. |
| PRD-54-07 | لا DNS أو public vhost أو public traffic أو cutover. | لا تبدأ خطوات cutover قبل Go جديد والعبارة الصريحة للنشر. | `PRODUCTION CUTOVER ONLY`. |

> لا يجيز أي قرار أعلاه استخدام global tenant credential أو Raw GUC أو owner/superuser/BYPASSRLS أو seed/demo data أو placeholder credentials.
