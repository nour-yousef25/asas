# ADR-W02-005 — KMS and Secret Ownership

**Gate:** G-W02-5
**الحالة:** `CLOSED — DESIGN DECISION`
**المالك:** Security/Operations Owner.

## Decision

تستخدم الأسرار tenant-scoped envelope encryption: ciphertext فقط في التطبيق/DB، data-encryption key ملفوف تحت KMS/master key خارج DB، `keyVersion` وstatus/fingerprint/timestamps metadata غير حساسة، وread-once service boundary. لا تسجل plaintext أو access/refresh token أو certificate payload في logs/audit/API.

## Edition Responsibility

| Edition | KMS/master-key owner | Rotation operator | Environment responsibility |
|---|---|---|---|
| Cloud/SaaS | ASAS Operations | ASAS وفق rotation runbook | ASAS |
| Dedicated | Customer key custody؛ ASAS تشغيل مفوض محدود | Customer أو shared وفق العقد | Shared |
| Self-Hosted | Customer | Customer | Customer |

## Rotation and Revocation

ينشئ rotation نسخة جديدة، يختبر connection masked، يبدل reference atomically، يحتفظ بالقديم في grace state، ثم يلغيه. revoke يعطل الاستخدام فوراً ويكتب audit. تنفيذ vault migration يتطلب KMS capability verification في environment الهدف؛ الدليل WP0 قرار ownership فقط ولا يثبت provider runtime.
