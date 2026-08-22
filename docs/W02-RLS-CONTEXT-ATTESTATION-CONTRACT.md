# W02 RLS Context Attestation Contract

**الحالة:** Design Contract Pending Approval. هذا العقد لا يضيف schema أو migrations أو credentials.

## 1. أطراف الثقة

| الطرف | يثق به في | لا يثق به في | الملكية |
|---|---|---|---|
| Client | session transport فقط | tenant authority أو capability claims | المستخدم |
| Application runtime | تمرير token داخل interactive transaction | إنشاء capability أو تعديل binding | منصة التطبيق |
| Attestation Issuer | اشتقاق claims من session/policy موثوقين وتوقيعها | الوصول إلى tenant data | security service |
| PostgreSQL verifier | فحص signature/claims وربطها بالـtransaction | private signing key | DBA/security owner |
| App DB role | تنفيذ SQL بعد attestation | DDL/DML في security schema أو تغيير binding | runtime operator |
| Security administrator | verifier/policies/key registry | private signing key | فصل مهام مطلوب |

## 2. Capability Claims

| الحقل | داخل capability | التحقق | الغرض |
|---|---|---|---|
| `v`, `iss`, `aud`, `kid`, `alg` | نعم | issuer/audience/key allow-list/algorithm pinned | منع confusion وunknown key |
| `jti` و`nonce` | نعم | unique transaction use | replay protection |
| `organization_id` | نعم | مقارنة مع binding فقط | tenant identity |
| `user_id`, `membership_id` | نعم | membership active/non-revoked | user attribution ومنع wrong membership |
| `session_id`, `session_version` | نعم | session registry active/current | stale/revoked session denial |
| `policy_version` | نعم | membership policy version current | stale policy denial |
| `database_instance_id` | نعم | local immutable instance identifier | منع cross-environment replay |
| `backend_pid`, `transaction_xid` | نعم | `pg_backend_pid()` و`pg_current_xact_id()` | transaction/connection binding |
| `iat`, `nbf`, `exp` | نعم | short skew window ومدة قصيرة جداً | expiry |
| raw permissions أو PII أو tenant payload | لا | غير منطبق | لا تتحول capability إلى authorization cache أو data carrier |
| private key أو HMAC secret | لا | محظور | لا secrets داخل PostgreSQL |

لا يختار application runtime organization claim. يحصل issuer على identity من session موثوقة ويحسب organization/membership/policy state بنفسه. لا يقبل issuer `organizationId` مرسلاً من العميل كسلطة.

## 3. Protocol داخل Interactive Transaction

1. يبدأ Prisma interactive transaction، فيثبت connection واحدة.
2. يقرأ runtime `pg_backend_pid()` و`pg_current_xact_id()` من تلك transaction؛ لا يستخدم قيمة من connection أخرى.
3. يطلب runtime capability من issuer بعد authenticated server-side session resolution. يوقع issuer claims المقيدة بالـPID+XID.
4. تستدعي role التطبيق حصراً `security.attest_context(serialized_capability)`.
5. يتحقق SECURITY DEFINER verifier من format، algorithm، issuer، `kid`، public signature، time window، audience، PID، XID، organization/membership/session/policy state، وJTI/binding uniqueness.
6. عند النجاح ينشئ binding ثابتاً واحداً داخل security schema ويحفظ audit metadata مختزلة. كل access لاحق يمر بـ`security.current_verified_tenant()`.
7. عند commit/rollback ينتهي transaction. صف binding لا يصلح لأي XID جديد؛ scheduled privileged cleanup يحذف expired historical records فقط.

## 4. Verifier and RLS Boundary

`security.attest_context` هي نقطة الإدخال الوحيدة. لا تمنح role التطبيق أي `SELECT/INSERT/UPDATE/DELETE` على binding table أو key registry أو session/policy registry، ولا `EXECUTE` على دوال admin. تغلق الدالة فشلاً عبر exception مصنف بلا claims. أما `security.current_verified_tenant()` فتُرجع NULL بلا معلومات تفصيلية كي تستخدم داخل RLS. policies تستدعيها فقط ولا تستدعي raw GUC.[1]

يتطلب verifier adapter asymmetric public-key-only. يحتفظ PostgreSQL بـverification public keys وحالاتها (`active`, `retiring`, `revoked`) وmetadata `kid` فقط. private signing keys تقيم في issuer-backed KMS/HSM أو نموذج self-hosted معتمد؛ لا تدخل PostgreSQL أبداً.

## 5. Replay, Switch, and Failure Rules

| الحالة | السلوك |
|---|---|
| no capability أو malformed/unknown algorithm | deny |
| bad signature أو unknown/revoked `kid` | deny |
| expired/not-yet-valid | deny |
| JTI مستخدم داخل binding أو token سبق استعماله لنفس XID | deny |
| PID أو XID أو audience لا يطابق | deny |
| membership/session/policy stale أو revoked | deny |
| binding ثانٍ لنفس PID+XID حتى لو منظمة أخرى | deny |
| verifier/adaptor/key registry unavailable | deny |
| raw `set_config` بعد attestation | لا أثر؛ RLS لا تقرأه |

## 6. Key Management Contract

Issuer يملك private signing key ومعرف `kid`. يدار key lifecycle كالتالي: إصدار active key، نشر public verification key قبل الاستخدام، overlap قصير ومحدد للـretiring key، حظر فوري لـrevoked `kid`، short token TTL، وإلغاء session/membership مستقلين. عند compromise: توقف issuer عن key، revoke `kid` في verifier registry، تبطل capabilities الحية، rotate key، وتحلل audit metadata. لا تستخدم rotation cached state لا يمكن إبطاله؛ أي cache يحتاج event invalidation وfail-closed عند uncertainty.

| نمط الاستضافة | issuer/key ownership | database verifier |
|---|---|---|
| Cloud SaaS | platform security service + KMS/HSM | platform-managed public key registry |
| Dedicated | customer-approved KMS boundary أو managed platform key وفق matrix | instance-bound public keys وDB instance audience |
| Self-Hosted | operator HSM/KMS أو secret authority | operator-run verifier؛ DBA/superuser خارج threat boundary |

## 7. Pooling and Operations

لا تستخدم هذا العقد session GUC كهوية. Prisma يجب أن يستخدم interactive transaction فقط من بداية PID/XID إلى نهاية operation؛ لا يجوز capability issuance أو verification قبل `BEGIN` أو على connection أخرى. `backend_pid + transaction_xid` يجعل token إعادة استخدام connection لاحقاً غير صالحاً. rollback يزيل binding المرئي لتلك transaction؛ XID جديد يتطلب capability جديدة. concurrent A/B تعمل على XID/PID مختلفين وبـJTI منفصلة.

الأثر التشغيلي هو round trip إلى issuer في بداية كل security transaction، ثم verifier lookup ثابت الحجم. الأداء يقاس قبل التنفيذ؛ لا يسمح caching capability عبر transaction. Disaster recovery يتطلب instance ID جديداً وpublic key registry/key re-provisioning ورفض capabilities من instance قبل recovery.

## 8. Assumptions and Open Dependencies

يستلزم التنفيذ: verifier adapter reviewed، security schema owner، session registry/version/revocation contract، membership policy version lookup، issuer availability/SLO، key lifecycle runbook، وretention/audit contract. هذه عناصر **مفتوحة** وليست منفذة الآن.

## المراجع

[1]: https://www.postgresql.org/docs/current/ddl-rowsecurity.html "RLS policies, default deny, FORCE RLS and policy execution"
[2]: https://www.postgresql.org/docs/current/sql-createfunction.html "SECURITY DEFINER search path and EXECUTE privilege hardening"
