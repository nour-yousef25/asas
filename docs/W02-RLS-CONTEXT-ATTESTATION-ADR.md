# ADR — W02 RLS Database Context Attestation

**الحالة:** مقترح معماري معتمد للتصميم فقط؛ التنفيذ محجوب حتى اعتماد عقده وتقنية verifier.
**النطاق:** W02 RLS فقط. لا migration ولا RLS policy ولا runtime أو role أو credential change في هذا القرار.

## السياق

أثبت اختبار PostgreSQL المباشر السابق أن custom GUC الخام `app.organization_id` قابل للتبديل بواسطة role التطبيق داخل transaction واحدة. لذلك لا يجوز أن يمثل مصدر الثقة في RLS. مطلوب binding صادر من issuer موثوق، transaction-bound، لا تستطيع role التطبيق صنعه أو استبداله، ويفشل مغلقاً في كل حالة غير صالحة.

## مقارنة البدائل

| البديل | منع التزوير | منع A→B داخل transaction | replay | pooling | القرار |
|---|---|---|---|---|---|
| capability موقعة فقط في custom GUC | لا يكفي؛ role تستطيع استبدال GUC | لا | محدود | هش عند إعادة الاتصال | مرفوض |
| SECURITY DEFINER مع raw `current_setting` | يمنع بعض الجداول فقط | لا؛ GUC نفسها mutable | لا | غير كافٍ | مرفوض |
| registration في جدول transaction-bound بلا signature | role يمكنها تسجيل organization مختارة | لا | لا | جيد تقنياً فقط | مرفوض |
| role/connection لكل tenant | قوي | قوي | جيد | حمل provisioning/pooling مرتفع | ممنوع كحل أساسي |
| **capability موقعة + verifier مقيد + binding registry** | نعم إذا تحقق public-key مستقل | نعم عبر binding immutable لـPID+XID | نعم عبر JTI/nonce وXID | نعم داخل interactive transaction | **مقترح** |

## القرار المقترح

يعتمد التصميم الهجين التالي:

```text
Authenticated request + server TenantContext
        ↓
External Attestation Issuer (private signing key خارج PostgreSQL)
        ↓ signed, one-time, PID+XID-bound capability
Application role invokes security.attest_context(capability)
        ↓
SECURITY DEFINER verifier + public-key verifier adapter
        ↓
private transaction binding registry (backend PID, XID, JTI, org, membership, policy/session state)
        ↓
security.current_verified_tenant()  ← RLS policy only
        ↓
tenant-owned rows
```

لا تقرأ RLS `current_setting('app.organization_id')` ولا تثق في `organizationId` يدخل من العميل أو التطبيق. تتعامل RLS فقط مع نتيجة `security.current_verified_tenant()`؛ تعيد هذه الدالة `NULL` عند failure، وتبقى كل policy `USING/WITH CHECK` false عند `NULL`.

## سبب منع context switch

الـcapability تتضمن `database_instance_id` و`backend_pid` و`transaction_xid` و`jti` وorganization/membership/session/policy binding. ينشئ verifier، داخل transaction نفسها، صف binding واحداً فقط لكل `(database_instance_id, backend_pid, transaction_xid)` في schema خاصة لا تملك role التطبيق عليها أي صلاحية DML أو DDL. محاولة attest ثانية، ولو بـcapability سليمة لمنظمة أخرى، تصطدم binding الموجود وتفشل. أما تغيير GUC أو SQL injection في role التطبيق فلا يغير registry ولا نتيجة verifier.

## قيود تقنية حاسمة

يحتاج PostgreSQL إلى **public-key verification adapter موثوق ومراجع أمنياً** لتوقيع asymmetric مثل Ed25519 أو ما يعادله. لا يسمح التصميم بـHMAC يتطلب secret في PostgreSQL، ولا private signing key داخل القاعدة. PostgreSQL core لا يُفترض فيه verifier public-key محدد لهذا العقد؛ اختيار extension/implementation المدعوم تشغيلياً قرار مفتوح إلزامي قبل التنفيذ.

تكون `security.attest_context` و`security.current_verified_tenant` دوال `SECURITY DEFINER` بمالك security-admin منفصل؛ يثبت لها `search_path` إلى schemas موثوقة وينتهي بـ`pg_temp`، ويُسحب `EXECUTE` من `PUBLIC` ويمنح حصراً لدور التطبيق. هذه الحواجز مطلوبة لأن SECURITY DEFINER تعمل بصلاحيات مالكها.[1]

## النتائج

يوفر القرار دفاعاً عميقاً ضد direct DB access بدور التطبيق وraw GUC manipulation وconnection reuse. لا يحمي من PostgreSQL superuser أو DBA قادر على تعديل verifier/policies أو من issuer/private-key compromise؛ هذه الحدود تعالجها إدارة مفاتيح وتشغيل منفصلان وتعلن صراحة في threat model. يؤجل التنفيذ حتى اعتماد adapter وsession-state contract وkey ownership/runbook.

## المراجع

[1]: https://www.postgresql.org/docs/current/sql-createfunction.html "PostgreSQL CREATE FUNCTION — SECURITY DEFINER guidance"
[2]: https://www.postgresql.org/docs/current/ddl-rowsecurity.html "PostgreSQL Row Security Policies"
