# W02 RLS Context Attestation — Implementation Readiness Report

## Status

> **BLOCKED — DO NOT IMPLEMENT**

## What Was Examined

تمت مراجعة branch القانوني وملفات Context Attestation وRLS ownership/blockers والمصدر الفعلي، ثم inventory للـPostgreSQL المحلية وextensions المتاحة، ومراجع PostgreSQL/pgcrypto/pgsodium/managed cloud extension support. يؤكد المصدر الحالي عدم وجود RLS policies أو verifier adapter، ويؤكد اختبار سابق أن raw GUC قابل للتبديل بواسطة app role.

## What Changed

تمت إضافة/تحديث وثائق قرار verifier وsupport matrix وblocker وreadiness فقط. لا تغيير source/runtime/schema/migrations/environment أو قاعدة بيانات.

## Closed Decisions

| القرار | الحالة |
|---|---|
| raw GUC ليس مصدر ثقة | CLOSED — rejected |
| per-tenant roles كحل أساسي | CLOSED — rejected |
| capability asymmetric خارج PostgreSQL | CLOSED — required direction |
| private key/HMAC secret داخل PostgreSQL | CLOSED — prohibited |
| A→B وB→A direct app-role tests | CLOSED — mandatory |
| verifier adapter technology | **OPEN/BLOCKED** |

## Prerequisites Not Met

لا يوجد adapter مختار ومدعوم، ولا issuer/KMS owner/SLO معتمد، ولا session/policy registry lock semantics مثبتة، ولا binding registry implementation، ولا SECURITY DEFINER deploy contract، ولا performance baseline. لذلك لا يمكن صياغة migration prerequisites أو rollback executable sequence بصدق.

## Planned Sequence After an Approved Adapter

1. security/supply-chain review وversion-pinned installability لكل hosting mode.
2. audit-only PoC مع PostgreSQL حقيقية وapp role حقيقية، ثم direct SQL tests 1–24.
3. اعتماد issuer/KMS/session/policy/binding schema contracts.
4. forward-only migrations وSECURITY DEFINER hardening في audit database.
5. A/B harness وfailure/rollback/pooling/performance evidence.
6. family-by-family RLS rollout؛ لا schema-wide switch.

## Performance and Operational Budget

لا توجد قياسات لأن verifier لم يختر ولم ينفذ PoC. budget لا يحدد رقمياً قبل قياس adapter؛ يجب أن يقيس implementation لاحقاً issuer latency، verifier latency، transaction overhead، concurrent A/B، connection reuse، key lookup وtimeout. أي timeout أو uncertainty يجب أن ينتج DENY؛ لا يسمح performance pressure بتخفيف العقد.

## Final Recommendation

اعتمد verifier technology/support contract أو architecture بديلة؛ بعدها فقط يمكن إعادة فتح readiness. حتى ذلك الحين لا تبدأ RLS أو Queue/Redis/Cache أو Storage أو Users/Memberships أو Documents.
