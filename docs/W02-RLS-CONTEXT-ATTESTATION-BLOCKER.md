# BLOCKER — W02 RLS Context Attestation Verifier Adapter

## Root Cause

لا يوجد asymmetric public-key verification adapter مثبت ومراجع ومدعوم في PostgreSQL الحالية، ولا يوجد evidence يثبت تشغيل adapter واحد بصورة موحدة عبر Cloud SaaS وDedicated وSelf-Hosted. `pgcrypto` المتاح لا يحقق signature verification؛ المرشحان الخارجيان يحتاجان native extension/support decisions غير معتمدة.

## Security Impact

لا يمكن تحويل capability موقعة إلى database-enforced identity بدون verifier داخل trust boundary. قبول HMAC أو private key داخل PostgreSQL أو raw GUC أو trusted app role سيتعارض مباشرة مع architecture وacceptance tests. أي RLS implementation قبل الحسم سيعطي fail-closed مظهرياً فقط أو يعيد ثغرة context switch.

## Evidence

| المصدر | النتيجة |
|---|---|
| local PostgreSQL extension inventory | `pgcrypto` فقط من الخيارات cryptographic؛ لا pgsodium/ed25519/JWT verifier |
| pgcrypto official docs | hash/HMAC/PGP encryption، بلا signing support |
| pgsodium docs | API verify موجود لكن native installation/libsodium/headers وsupport matrix مطلوبان |
| Cloud SQL extension docs | managed service يسمح بالextensions المدعومة فقط ولا custom extensions |
| previous direct app-role test | raw GUC يسمح A→B switch، لذلك لا fallback ممكن |

## Safe Options and Recommendation

التوصية هي اعتماد **provider-specific, version-pinned pgsodium support contract** فقط إذا قدم مالك الاستضافة دليلاً على توفره في Cloud/Dedicated/Self-Hosted أو عدّل product support matrix بوضوح. البديل هو تصميم architecture خارجية جديدة لا تفترض verifier داخل PostgreSQL. لا يوصى ببناء custom crypto/extension أو بـper-tenant roles كالتفاف.

## What Was Not Changed

لا migration، لا RLS policy، لا schema، لا app role في Production، لا credential/Vault/Redis/Storage/runtime change، ولا PoC extension أو package/server configuration. تظل tests السلبية A→B/B→A إلزامية وغير معدلة.
