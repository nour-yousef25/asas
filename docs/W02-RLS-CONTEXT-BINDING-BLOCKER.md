# BLOCKER — W02 RLS Context Binding

## Root Cause

سياسة RLS التجريبية تعتمد مباشرة على `current_setting('app.organization_id', true)`. رغم أن `withTenantTransaction()` يضبط القيمة من `TenantContext` server-side، فإن role التطبيق غير المالكة تستطيع استدعاء `set_config` بنفسها مرة ثانية داخل transaction واحدة وتغيير القيمة إلى tenant آخر. لا تمنع PostgreSQL custom GUCs هذا التبديل per-role.

## Runtime Evidence

تم تشغيل harness على PostgreSQL audit database منفصلة مع role تطبيق `NOSUPERUSER NOINHERIT NOBYPASSRLS` وgrants محصورة على `beneficiaries` و`beneficiary_documents`. مرّت اختبارات no-context، A/B read، cross-tenant write/delete، forged insert، child ownership، rollback وعدم تسرب context بين transactions. لكن اختبار:

```text
CONTEXT_SWITCH_INSIDE_TRANSACTION_DENIED = FAIL (rows=1)
```

أثبت أن role التطبيق تستطيع ضبط context A ثم B داخل نفس transaction وقراءة row B. هذا يخالف شرط التفويض الصريح: محاولة تبديل tenant داخل transaction يجب أن تكون `DENY`.

## Impact

لا يمكن اعتبار `app.organization_id` custom setting وحدها DB-enforced tenant identity. ترك migration RLS المرتبطة بها سيعطي انطباع fail-closed غير صحيح عند وصول مباشر بدور التطبيق، ولذلك لا يجوز نشرها أو تثبيتها في commit إغلاق.

## What Remains Unchanged

لم يُستخدم Production DB أو credential أو Redis أو Storage. لم يتم push لأي migration RLS، ولم يبدأ Queue/Cache أو Storage أو Users/Memberships أو Documents. role وfixtures استُخدما على audit database فقط.

## Required Architectural Decision

يتطلب الإغلاق واحداً من عقود binding التالية قبل استئناف RLS:

1. **Database context attestation**: policy تقرأ tenant identity من security-definer verifier يقبل capability موقعة ومحدودة transaction؛ لا تقرأ raw custom GUC. يجب تحديد issuer/key rotation/failure behavior/audit.
2. **Per-tenant database roles/connections**: role أو credential مستقلة لكل منظمة تضبط tenant identity خارج سيطرة role التطبيق العامة؛ يتطلب provisioning/rotation/pooling contract.
3. **تعديل acceptance contract رسمياً** ليعتبر app runtime موثوقاً بعد TenantContext ويزيل direct app-role context-switch negative test. لا أوصي بهذا الخيار لأنه يضعف هدف RLS المعتمد.

## Recommended Option

الخيار 1 هو الأنسب للنواة الواحدة لكنه عقد معماري جديد يتقاطع مع Vault/secret ownership وconnection management، ولا يجوز اختراعه داخل Wave 1 دون قرار مكتوب.
