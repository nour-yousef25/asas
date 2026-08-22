# W02 RLS Context Attestation Threat Model

## Security Objective

يثبت النظام أن role التطبيق، حتى عند direct PostgreSQL access، لا تستطيع تحويل transaction مثبتة لـA إلى B ثم قراءة أو تعديل B. الحماية لا تعتمد على helper صحيح فقط؛ تقوم database verifier وRLS بفرضها.

| التهديد | المسار | الضابط المقترح | النتيجة المتوقعة | الحد المتبقي |
|---|---|---|---|---|
| مستخدم authenticated خبيث | يرسل `organizationId=B` | issuer يشتق tenant من session؛ verifier يطابق claim | deny | issuer/session compromise |
| route مخترق | يغير body/header/GUC | RLS لا تقرأ input/GUC؛ capability مقيدة | deny | route قد يطلب token لجلسة مخترقة فقط |
| app role direct SQL | `SET app.organization_id=B` | raw GUC غير مستخدمة | deny/no effect | app role لا تملك verifier tables |
| A→B/B→A في transaction | attest ثانية أو SQL switch | PID+XID immutable binding + single binding/JTI | deny | verifier bug |
| capability forgery | token مصطنع | asymmetric signature, pinned alg/kid | deny | private key compromise |
| capability replay | token قديم/من transaction أخرى | JTI + exp + PID/XID + instance audience | deny | token داخل transaction نفسها قبل first use يعالج uniqueness |
| stale policy/membership/session | authorization تغير بعد issuance | verifier reads active/current versions | deny | transaction race policy requires documented locking/isolation |
| pooling/reused connection | context سابق يرث | XID-bound registry لا session state | deny | runtime must use one interactive transaction |
| SQL injection | استدعاء verifier/raw SQL | no DML security schema; verifier validates claims | deny | injection can act only ضمن capability صحيحة للـtransaction |
| key compromise | issuer signs false B token | kid revoke, short TTL, incident response | contain/revoke | window حتى revoke |
| malicious operator/DBA | ALTER policy/function أو superuser | ليس محمياً بهذا العقد | خارج boundary | organisational controls/audit/HSM |
| self-hosted administrator | يمتلك database/host | لا يمكن RLS حمايته من superuser | خارج boundary معلن | customer operational responsibility |

## Trust Boundaries

لا يعتبر application runtime issuer. لا يعتبر app DB role security administrator. لا يحتفظ PostgreSQL private key. لا تحمي RLS backup operator أو superuser؛ RLS يمكن تجاوزها بـBYPASSRLS/superuser والمالك عادةً يتجاوزها ما لم تفرض FORCE RLS.[1] لذلك يتطلب التشغيل فصل owner/app/security roles والتدقيق الإداري.

## Failure and Audit

كل verifier failure يمنع row access. لا تكتب RLS per-row audit، لأن ذلك قد يغير semantics أو الأداء؛ تسجل `attest_context` محاولة واحدة مختزلة تشمل `attestation_id_hash`, issuer, kid, organization hash/ID وفق data classification, membership ID, PID/XID hash, decision, reason code, correlation ID ووقت الانتهاء. لا تسجل capability أو signature أو PII أو private keys.

## المراجع

[1]: https://www.postgresql.org/docs/current/ddl-rowsecurity.html "RLS bypass and FORCE RLS behavior"
[2]: https://www.postgresql.org/docs/current/perm-functions.html "PostgreSQL function security and trusted owners"
