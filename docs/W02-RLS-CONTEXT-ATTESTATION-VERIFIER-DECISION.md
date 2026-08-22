# W02 RLS Context Attestation — Verifier Decision

**الحالة:** `BLOCKED — no selected verifier adapter`.

## Evidence Gathered

تم فحص PostgreSQL المحلية الفعلية بالـcatalog `pg_available_extensions`: المتاح cryptographically هو `pgcrypto` 1.3 فقط، وغير مثبت؛ لا يظهر `pgsodium` أو `ed25519` أو JWT/EdDSA verifier. فحص الدوال المتاحة لم يعثر على `sign` أو `verify` asymmetric. لا يستنتج هذا غياب كل extension ممكنة عالمياً، لكنه يثبت أن البيئة الحالية لا تملك adapter مثبتاً أو supported بالفعل.

## Candidate Assessment

| المرشح | asymmetric verify | الدليل | Cloud SaaS | Dedicated | Self-Hosted | القرار |
|---|---|---|---|---|---|---|
| PostgreSQL core + `pgcrypto` | لا | توثيق pgcrypto يذكر `digest` و`hmac` وPGP encryption، وينص صراحة على عدم دعم PGP signing | متاح غالباً | متاح | متاح | مرفوض؛ HMAC/private secret وraw encryption محظوران |
| `pg_ed25519` | نعم، `ed25519_verify` | repository مستقل يدوي البناء و`sudo make install`؛ لا inventory محلي ولا managed-cloud support evidence | غير قابل للاعتماد | يحتاج vendor/security review | يحتاج build/patch lifecycle | مرفوض حالياً؛ لا production supportability موحدة |
| `pgsodium` 3.x | نعم، `crypto_sign_verify_detached` | يوثق API Ed25519/libsodium؛ يتطلب libsodium headers/build وPostgreSQL 14+؛ غير متاح محلياً | لا ضمان؛ Cloud SQL يقصر الإنشاء على extensions المدعومة ولا يسمح بإنشاء custom extensions | مرشح مشروط | مرشح مشروط | غير مختار؛ يحتاج availability/support decision وsupply-chain review |
| custom C/PL verifier | قد يكون | لا evidence/adapter reviewed | غير قابل للتشغيل عموماً | مخاطرة عالية | مخاطرة عالية | مرفوض؛ لا cryptography جديدة |

## Why No PoC Was Run

يتطلب `pg_ed25519` و`pgsodium` تنزيل وبناء native extension من مصدر خارجي أو تثبيت packages/server headers وإمكان privileged `CREATE EXTENSION`. لا توجد موافقة منفصلة لتشغيل كود extension غير موثوق أو تغيير server packages/configuration، ولا يمكن اعتبار build محلي isolated دليلاً على Cloud/Dedicated/Self-Hosted support. الامتناع عن PoC يحافظ على شرط عدم اختيار تقنية افتراضية أو غير مثبتة.

## Decision

لم تُختر تقنية verifier. `pgcrypto` لا يحقق signature verification المطلوب، و`pg_ed25519` لا يحقق production supportability، و`pgsodium` مرشح تقني فقط لا availability guarantee عبر Cloud. ينطبق Stop Condition 1: **لا يوجد verifier adapter آمن ومدعوم ومثبت لهذه architecture في البيئة الحالية**.

## Exact Decision Required

يلزم اعتماد واحد من التالي قبل RLS implementation:

1. اعتماد provider/edition matrix يضمن `pgsodium` بإصدار محدد وامتداد verified لكل Cloud/Dedicated/Self-Hosted مدعوم، مع owner لإدارة upgrades وCVE/supply-chain وDR؛ أو
2. تعديل architecture المعتمدة ليصبح verifier خارج PostgreSQL مع database-enforced attestation channel جديد يخضع لتصميم مستقل؛ لا يكفي trusted app role أو raw GUC؛ أو
3. إزالة Cloud من نطاق support لهذا العقد صراحة، وهو قرار منتج/استضافة جديد لا يمكن افتراضه.

## References

[1]: https://www.postgresql.org/docs/current/pgcrypto.html "pgcrypto functions and PGP limitations"
[2]: https://github.com/michelp/pgsodium "pgsodium installation, version and signature API"
[3]: https://docs.cloud.google.com/sql/docs/postgres/extensions "Cloud SQL extension support and custom-extension limitation"
[4]: https://github.com/cardano-community/pg_ed25519 "pg_ed25519 build and verification interface"
