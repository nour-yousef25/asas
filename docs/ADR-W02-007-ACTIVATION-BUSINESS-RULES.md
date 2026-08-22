# ADR-W02-007 — Activation Business Rules

**Gate:** G-W02-7
**الحالة:** `CLOSED — DESIGN DECISION`
**المالك:** Commercial/Licensing Owner وSecurity Owner.

## Decision

Activation core يتبع المسار: Signed Certificate → Instance Identity → Activation Request → One-Time Code → Hash at Rest → TTL → Instance Binding → Rate Limit → Audit → Activated. إصدار code مسؤولية licensing control-plane/operator المعتمد، والتحقق محلي في instance باستخدام certificate public key وinstance identity ثابتة؛ لا hardware fingerprint.

## Rules

| Rule | Decision |
|---|---|
| Code storage | salted one-way hash فقط؛ لا plaintext في DB/log/audit |
| TTL | 15 دقيقة من issuance ما لم يلغى قبلها |
| Use count | استخدام واحد؛ success أو terminal failure يستهلك code |
| Binding | certificate/license/edition + instance identity + requested organization context |
| Rate limit | 5 محاولات لكل instance/activation request خلال 15 دقيقة ثم cooldown مدقق |
| Replay | transaction/idempotency record؛ second use يرفض ويكتب audit |
| Failure | لا حذف بيانات ولا disable مفاجئ؛ يعرض status آمن ويدخل grace/read-only وفق certificate policy لاحقاً |
| Audit | issue/request/attempt/success/failure/revoke مع correlation وreason دون code |

تنفذ WP1 tests للexpiry/replay/rate limit/tampering/binding. لا runtime activation أو certificate persistence ينفذ في WP0.
