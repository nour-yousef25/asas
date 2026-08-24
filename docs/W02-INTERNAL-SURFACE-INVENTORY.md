# W02 — Internal Surface Inventory and Classification

> **Baseline:** `bb76675`، وexecution branch `w02-internal-global-closure`. يستعمل هذا السجل قاعدة التفويض الداخلي النهائي: **A** قابل للتنفيذ داخلياً، **B** عقد/تصميم داخلي، **C** deployment/provider/owner external، و**D** مانع داخلي غير قابل للحل. لا توجد بنود D في هذا الجرد.

## أسطح W02 المثبتة والمعاد استخدامها

| Scope | Classification | الحالة | الدليل/الإجراء |
|---|---|---|---|
| TenantContext/Policy/Broker/session_user RLS chain | A | مكتمل محلياً | Broker وRLS evidence الحالية تبقى صالحة ما لم يتغير عقدها |
| Users/Memberships | A | مكتمل محلياً | UM01–UM10 و`MembershipRepository`، مع حجر `/api/users` |
| Queue/Redis/Cache | A | مكتمل محلياً | Q01–Q10 وtrusted envelope/ACL/worker boundary |
| Storage/Root Documents | A | مكتمل محلياً | S01–S10 وprivate artifact/opaque delivery |
| Beneficiary/Financial/Dashboard roots | A | مكتمل محلياً في العائلات المحولة | Wave1/Wave2/Wave3 وNR/UR/D/MK evidence؛ لا إعادة تنفيذ بلا تغيير عقد |
| Reports read/generation | A | مكتمل داخلياً | route tenant-bound؛ export/download/share يرفض fail-closed `501` حتى WP7 policy contract |

## أسطح W02 المطلوب تنفيذها في هذه الموجة

| Scope | Classification | حد التنفيذ الداخلي |
|---|---|---|
| WP6 Vault/Secrets | B ثم A | secret reference/resolver contract، revocation/rotation state، redacted audit، memory-only test adapter، fail-closed عند الغياب؛ لا KMS/HSM حقيقي |
| WP7 Privacy/Retention/Legal Hold/Export | B ثم A | classification/purpose/hold/request models، policy interfaces، redaction/deletion guards وexport authorization default-deny؛ لا مدد قانونية أو DSAR policy مخترعة |
| WP8 LIC-001/LIC-002 | B ثم A | certificate verification/keyring contract وactivation state/one-time hash/replay/rate-limit/revocation/audit؛ لا issuer أو PKI أو licensing control plane حقيقي |
| WP9 IDP-001 | B ثم A | provider-neutral tenant config/subject mapping/callback state/revocation/session hooks مع mock proof؛ لا provider enrollment أو sandbox credential حقيقي |

## أسطح direct-Prisma المكتشفة وخارج W02

المسارات التالية لم تُدرج كـW02 PASS ولم تُحذف؛ تصنف إلى موجاتها المعتمدة التالية، ويلزم لها cutover مستقل قبل نطاق domain الخاص بها: `announcements/news/gallery` إلى W11 CMS، `communications/channels` و`webhooks` إلى W12/W15، `evaluations/volunteers` إلى W09، و`tasks/surveys` إلى W03/Core Workflow. `health` وinstaller من W01. لا يسمح هذا التصنيف بإعادة استعمال Prisma غير المقيد داخل APIs W02 الجديدة.

## POST-W02 External Deployment Readiness

| Item | سبب عدم إمكان الإثبات المحلي |
|---|---|
| KMS/HSM/managed Vault وعمليات rotation/DR | capability وkey custody مملوكان للـprovider/owner؛ المحلي يستخدم adapter بلا credentials |
| privacy/legal policy values | مدد الاحتفاظ وDSAR/legal-hold تحتاج Data/Privacy Owner ولا تستنتج من الكود |
| certificate issuer / PKI / licensing control plane | جهة إصدار ومفتاح خاص وprovisioning خارج repository؛ المحلي يتحقق بمفاتيح عامة/fixtures فقط |
| IdP enrollment/sandbox/UAT/production | provider contract وtenant credentials وموافقة owner خارجية |
| DT01–DT06 | topology/identity/pool/failover/backup/restore/scale deployment-owned |

## Acceptance Rule

لا تدخل أي API أو worker أو repository جديد في W02 إلا عبر server-side `TenantContext` وسياسة deny-wins وrepository scoped أو boundary fail-closed. لا Raw GUC، ولا organization من client كسلطة، ولا first-membership fallback، ولا global credential أو owner/superuser/BYPASSRLS proof.
