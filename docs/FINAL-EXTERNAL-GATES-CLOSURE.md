# الإغلاق النهائي للبوابات الخارجية — ASAS Plus

**Baseline القانوني:** commit `6743382`، مع production release loopback-only `20260824T215700Z-ef28e17`.

**القرار الحالي:** `FINAL PRODUCTION GO/NO-GO REVIEW`، وقرار التحويل العام هو **No-Go**. لم يتغير DNS أو public vhost أو public traffic أثناء هذه الجولة.

> هذا المستند لا يحوّل provider ناقصاً إلى نجاح. البوابة لا تصبح جاهزة إلا بعد وجود implementation معتمد، إدخال production حقيقي، probe غير مدمر، وevidence لا يتضمن قيم سرية.

## A) CLOSED — يمكن إثباته الآن

| البند | النتيجة المثبتة | حدود الإثبات |
|---|---|---|
| External-gates preflight | `CLOSED` | يوجد `pnpm run preflight:external-gates` ويعيد JSON بلا قيم أسرار؛ fail-closed مع exit `2` ما دام أي gate غير مغلق. |
| Secret exposure discipline | `CLOSED` | الـpreflight يفحص الوجود/صيغة الملفات فقط، ولا يطبع URL أو key أو token أو محتوى ملف request. |
| Storage boundary | `CLOSED` | `TenantArtifactProvider` tenant-scoped ويفشل بـ`TENANT_ARTIFACT_PROVIDER_UNCONFIGURED` عند غياب provider؛ surface raw legacy محجور. |
| Auth local credentials boundary | `CLOSED` | Credentials authentication ترفض identifier/password غير الصحيح؛ لا fallback أو user افتراضي. |
| IdP/activation security contracts | `CLOSED` | contracts تتحقق من expiry/signature/status/state وتفشل بـ`ACTIVATION_DENIED` أو `IDP_DISABLED`/`IDP_CALLBACK_DENIED`. |
| Backup/rollback implication | `CLOSED` | backup production مشفر، manifest متحقق، restore rehearsal وretention timer مثبتة؛ أي secrets جديدة لا تدخل release أو Git وتظل root-only خارج archive source. |
| DNS/public routing isolation | `CLOSED` | production services loopback فقط وcandidate OLS خارج config الحي؛ لا public proxy إلى `3106`. |

## B) BLOCKED — يحتاج مدخلاً أو قراراً خارجياً محدداً

| البوابة | الحالة | ما يلزم من المالك تحديداً | مكان التخزين وأقل صلاحية | اختبار الإغلاق وrotation/revocation |
|---|---|---|---|---|
| Storage | `BLOCKED — EXTERNAL INPUT REQUIRED` **و** implementation مطلوب | `S3_ENDPOINT` HTTPS، `S3_BUCKET` مخصص لـproduction، `S3_ACCESS_KEY` و`S3_SECRET_KEY` لحساب خدمة، و`ASAS_PREFLIGHT_STORAGE_PROBE_URL` read-only. | `/opt/asasplus/shared/production-runtime-secrets.conf` root:root `0600`; policy لحساب الخدمة: bucket المحدد فقط، prefix tenant-private فقط، وبدون bucket list/delete عام. | adapter tenant-safe ينفذ head/read-only probe، ثم upload/read/delete lifecycle على object اختبار مخصص؛ تدوير key بزوج مفاتيح وتأكيد probe ثم إبطال القديم. |
| Bootstrap administrator | `BLOCKED — EXTERNAL INPUT REQUIRED` **و** provisioning implementation مطلوب | ملف root-only `ASAS_BOOTSTRAP_ADMIN_REQUEST_FILE` يحوي `organizationName`, `adminName`, `adminEmail`, `approvalReference`, `passwordFile`. يجب أن يكون `passwordFile` مسار ملف root-only منفصل يحتوي password حقيقية يقدمها المالك. | request وpassword تحت `/opt/asasplus/shared/production-requests/` root:root `0600`; لا يمر password في CLI أو Git أو logs. أقل صلاحية: إنشاء منظمة واحدة، user واحد، membership واحدة وrole معتمدة، ثم tenant principal منفصل وفق W02. | تنفيذ provisioner audited مع no-demo guard، login يدوي بالـadmin المعتمد، ثم تغيير password وإبطال ملف الطلب/password. |
| Auth/IdP | `BLOCKED — EXTERNAL INPUT REQUIRED` **و** OIDC/SAML adapter مطلوب | قرار provider، `OIDC_ISSUER`, `OIDC_CLIENT_ID`, ملف `OIDC_CLIENT_SECRET_FILE`, `OIDC_REDIRECT_URI`، و`OIDC_CLAIMS_MAPPING_APPROVAL` يحدد subject/email/role mapping. | secret file root:root `0600`؛ client confidential يسمح redirect URI الإنتاجي فقط وscope identity الأدنى. | metadata/JWKS read-only validation، login test بحساب production معتمد، callback/state/revocation negative tests؛ تدوير client secret ثم إبطال السابق. |
| Mail | `BLOCKED — EXTERNAL INPUT REQUIRED` **و** transport adapter مطلوب | `MAIL_PROVIDER`, `MAIL_FROM_ADDRESS`, `MAIL_FROM_NAME`, `MAIL_CREDENTIAL_FILE`, `MAIL_SANDBOX_RECIPIENT`, `MAIL_OWNER_APPROVAL`. | credentials root:root `0600`; sender/domain يقتصر على ASAS؛ لا API key بأكثر من send scope. | provider health/identity check وtest واحد إلى sandbox recipient بعد approval؛ تدوير key ثم revoke previous key. |
| Integrations/Payments | `BLOCKED — EXTERNAL INPUT REQUIRED` **و** provider implementation مطلوب | `PAYMENTS_LAUNCH_SCOPE_DECISION` (excluded/included)، وعند included: `PAYMENT_PROVIDER_CONTRACT`, `PAYMENT_API_KEY_FILE`, `PAYMENT_SECRET_FILE`, `PAYMENT_WEBHOOK_RECONCILIATION_APPROVAL`. | ملفات root:root `0600`; production key بأقل scope، webhook secret منفصل، callback allow-list. | لا تبدأ payment حقيقية: provider sandbox + signature negative test + tenant-bound reconciliation persistence قبل launch؛ تدوير/revoke وفق provider. |
| License/Activation | `BLOCKED — EXTERNAL INPUT REQUIRED` **و** runtime enforcement مطلوب | `ASAS_LICENSE_ACTIVATION_REQUEST_FILE` root-only يحوي `certificateFile`, `keyringFile`, `approvalReference`؛ certificate signed Ed25519 production ومطابق instance/edition/expiry. | certificate/keyring root:root `0600`، keyring public-only؛ لا private signing key على VPS. | verify signature/expiry/binding locally، activation/revoke/expiry negative tests، واستبدال keyring مع overlap قصير ثم حذف key revoked. |
| Domain scheduler | `BLOCKED — EXTERNAL INPUT REQUIRED` **و** scheduler adapter مطلوب | `ASAS_DOMAIN_SCHEDULER_MANIFEST_PATH` root-only يحوي `owner`, `approvalReference`, `jobCatalogVersion` إضافة إلى job definitions المعتمدة وfailure/retention policy. | manifest root:root `0600`; service account لا يمتلك provider credentials عامة ولا DB bypass. | dry-run catalogue validation، test job داخلي بلا egress، heartbeat/lag health، ثم enable تدريجي؛ pause timer/service لإبطال التشغيل. |
| Go/No-Go owner/window | `BLOCKED — EXTERNAL INPUT REQUIRED` | `ASAS_GO_NO_GO_APPROVAL_FILE` root-only يحوي `owner`, `maintenanceWindowUtc`, `approvalReference`، وقرار صريح بشأن external blockers التي تقع خارج launch scope. | `/opt/asasplus/shared/production-requests/` root:root `0600`. | preflight يعرض approval schema فقط؛ لا يجيز النشر. انتهاء النافذة أو سحب approval يعادل No-Go. |

## C) NOT APPLICABLE

| البند | السبب |
|---|---|
| DNS change | خارج نطاق هذه الجولة؛ لا يلزم لإغلاق contracts/preflight. |
| Public vhost activation | محجوب حتى Go وبعد phrase النشر الصريحة. |
| Mail send أو payment transaction حقيقي | غير مطلوب ولا مسموح أثناء readiness closure. |
| Prisma seed/demo users | غير قابل للتطبيق في production؛ محظور لأن seed ينشئ بيانات تجريبية. |

## D) أخطار أو blockers مكتشفة

| التصنيف | الوصف | الأثر |
|---|---|---|
| `BLOCKER_IMPLEMENTATION` | لا يوجد S3-compatible `TenantArtifactProvider` مركب في runtime. | storage required health لا يمكن أن يصبح `HEALTHY` رغم وجود credentials. |
| `BLOCKER_IMPLEMENTATION` | لا يوجد IdP OIDC/SAML adapter runtime أو bootstrap-admin provisioner audited. | لا يوجد onboarding production آمن أو IdP login قابل للإثبات. |
| `BLOCKER_IMPLEMENTATION` | mail transport adapter غير موجود. | لا يمكن إرسال أو probe mail بصورة صحيحة. |
| `BLOCKER_IMPLEMENTATION` | payment provider يستخدم `api.example-payment.com` وwebhook لا يحفظ reconciliation tenant-bound. | payments لا تدخل launch scope حتى تنفيذ integration حقيقية. |
| `BLOCKER_IMPLEMENTATION` | certificate verifier موجود، لكن لا يوجد loader/enforcement في runtime. | license لا يمكن أن تكون gate تشغيلية فعلية. |
| `BLOCKER_IMPLEMENTATION` | scheduler check ثابت `NOT_CONFIGURED` ولا يوجد adapter/job catalogue. | لا يمكن اعتماد domain automation. |

## الأمر التالي المسموح

يجب عدم بدء cutover. يظل التوقف عند **FINAL PRODUCTION GO/NO-GO REVIEW** إلى أن يقرر المالك launch scope ويوفر الطلبات والـsecrets المذكورة، ثم تنفذ adapters الناقصة وتختبر وفق preflight دون إخراج القيم الحساسة.
