# الإغلاق النهائي للبوابات الخارجية — ASAS Plus

**Baseline القانوني:** `6743382`. **إغلاق التنفيذ الداخلي:** `95d7a66`، مع مواءمة preflight/installer/harness في هذه الجولة. لم يتغير DNS أو OpenLiteSpeed public vhost أو أي traffic، ويظل production loopback-only كما هو موثق في تقرير الجاهزية.

> أُغلقت **فجوات التنفيذ الداخلي** فقط. لا تتحول هذه النتيجة إلى نجاح مزود خارجي، ولا ينشئ أي harness مستخدم إنتاج أو يرسل بريداً أو يجري payment أو يشغّل job حياً.

## التنفيذ الداخلي المثبت

| البوابة | الحالة الداخلية | الدليل العملي |
|---|---|---|
| Storage | `CLOSED_INTERNAL_IMPLEMENTATION` | `TenantS3ArtifactProvider` يفرض object key tenant/artifact، توقيع SigV4، references opaque، HTTPS، وعمر delivery أقصاه 300 ثانية. |
| Bootstrap/Auth | `CLOSED_INTERNAL_IMPLEMENTATION` | provisioner يقتصر على `DRY_RUN` أو `AUDIT_FIXTURE`، يمنع demo وproduction mode، ويطبق idempotency/revocation وaudit fingerprint. |
| OIDC/SAML | `CLOSED_INTERNAL_IMPLEMENTATION` | contract يفرض issuer/HTTPS/redirect allow-list/state/nonce/audience/expiry ونتيجة verifier ذات `signatureVerified: true`. |
| Mail | `CLOSED_INTERNAL_IMPLEMENTATION` | transport محايد، sender/sandbox guards، explicit delivery switch، timeout/retry bounded، وaudit لا يحفظ عناوين المستلمين. |
| Payments | `CLOSED_INTERNAL_IMPLEMENTATION` | placeholder محجور؛ gateway/webhook contracts تحتاج verifier وledger tenant-bound idempotent، وroute تفشل بـ`503` إن لم يركبا. |
| License | `CLOSED_INTERNAL_IMPLEMENTATION` | loader يتحقق من Ed25519 certificate/keyring/revocation/instance/edition/expiry، ولا يقبل private signing key على VPS. |
| Domain scheduler | `CLOSED_INTERNAL_IMPLEMENTATION` | catalogue approved/versioned، dry-run محلي، pause/idempotency/timeout boundary وheartbeat/lag probe. |
| Preflight | `CLOSED_INTERNAL_IMPLEMENTATION` | `pnpm run preflight:external-gates` لا يتصل بمزود ولا يطبع secrets؛ يخرج `2` و`FINAL_PRODUCTION_GO_NO_GO_REVIEW` عند نقص أي بوابة launch-required. |

## التصنيف الحالي للبوابات

| Gate | Status | Internal / External | المدخل المتبقي الدقيق |
|---|---|---|---|
| Storage | `EXTERNAL_INPUT_REQUIRED` | internal closed / external pending | directories per-tenant + `ASAS_STORAGE_AUDIT_PROBE_REQUEST_FILE`. |
| Authentication | `EXTERNAL_INPUT_REQUIRED` | internal closed / owner decision pending | `ASAS_AUTH_LAUNCH_MODE=BOOTSTRAP` أو `IDP`، ثم مدخلات المسار المختار. |
| Mail | `EXTERNAL_INPUT_REQUIRED` | internal closed / external pending | approval/config/switch للـtransport، من دون إرسال الآن. |
| Payments | `EXTERNAL_INPUT_REQUIRED` | internal closed / launch-scope pending | approval صريح للاستبعاد، أو provider/ledger approvals إذا كان الدفع مطلوباً. |
| License | `EXTERNAL_INPUT_REQUIRED` | internal closed / external pending | certificate/keyring/revocation/instance files المعتمدة. |
| Scheduler | `EXTERNAL_INPUT_REQUIRED` | internal closed / owner operational inputs pending | approval + catalogue + heartbeat/lag files. |
| Owner/window | `EXTERNAL_INPUT_REQUIRED` | external decision | `ASAS_GO_NO_GO_APPROVAL_FILE`. |

## حدود لا تنطبق في هذه الجولة

| البند | الحالة | السبب |
|---|---|---|
| DNS أو public vhost أو traffic | `NOT_APPLICABLE` | محظور حتى Go جديد ثم العبارة الصريحة للنشر. |
| `prisma db seed` أو demo users | `NOT_APPLICABLE` | محظور على production. |
| real email/payment/job | `NOT_APPLICABLE` | لا يدخل ضمن proof المحلي؛ يتطلب approval/provider منفصلين. |

تفاصيل كل مدخل خارجي، ومساره وصلاحيته واختباره وتدويره، موجودة حصراً في [FINAL-EXTERNAL-INPUTS-REQUIRED.md](./FINAL-EXTERNAL-INPUTS-REQUIRED.md).
