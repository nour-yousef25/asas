# FINAL PRODUCTION PREFLIGHT — ASAS Plus

هذا الـpreflight **لا ينشر** ولا يغير DNS أو public vhost أو traffic. تسري عليه قرارات [Reconciliation 54](./PRODUCTION-READINESS-DECISION-REGISTER.md): Bootstrap بدلاً من IdP في الإطلاق الأول، Local VPS storage بدلاً من S3، payments مطلوبة، وSaaS entitlements بدلاً من certificate gate. ستتغير checks البرمجية في scope التنفيذ التالي؛ حتى ذلك الوقت يظل أي مخرج سابق fail-closed ولا يجيز cutover. شغّل فقط:

```bash
pnpm run preflight:external-gates
```

المخرج JSON redacted. القيمة `READY_FOR_PRODUCTION_SWITCH` وحدها تخرج بالرمز `0`. أما `FINAL_PRODUCTION_GO_NO_GO_REVIEW` فيخرج بالرمز `2`، وهو **No-Go** لا نجاح جزئي.

## مدلول الحالات

| الحالة | المعنى |
|---|---|
| `CLOSED_INTERNAL_IMPLEMENTATION` | العقد/harness موجود ومختبر محلياً؛ لا يعني مزوداً حقيقياً أو credential صحيحاً. |
| `EXTERNAL_INPUT_REQUIRED` | التنفيذ الداخلي أغلق، لكن يلزم ملف/قرار/credential reference حقيقي ومحدد. |
| `EXPLICITLY_EXCLUDED` | استبعاد launch scope موثق وموافق عليه؛ المسار يبقى fail-closed. |
| `NOT_APPLICABLE` | البند ليس dependency للمسار الذي اختاره المالك. |
| `BLOCKED_IMPLEMENTATION` | عيب برمجي داخلي حقيقي؛ لا يظهر في الوضع الحالي لهذه البوابات. |

## مسار التشغيل الآمن

| الترتيب | الإجراء | أثره |
|---|---|---|
| 1 | وضع request/config files root-owned خارج Git في المسارات الواردة في قائمة المدخلات. | لا provider call. |
| 2 | تشغيل preflight. | يقرأ schema/permissions فقط، ولا يطبع محتوى سرياً. |
| 3 | تنفيذ proof مزود غير مدمر وموافق عليه لكل gate مطلوب. | لا DNS ولا public traffic. |
| 4 | تحديث evidence completion ثم تشغيل preflight مرة أخرى. | لا يجعل ذلك cutover تلقائياً. |
| 5 | إصدار Go/No-Go جديد. | cutover يحتاج نافذة صيانة وعبارة النشر الصريحة فقط بعد Go. |

### Auth هو مسار واحد لا مساران متوازيان

يجب أن يحدد المالك `ASAS_AUTH_LAUNCH_MODE` بالقيمة `BOOTSTRAP` أو `IDP`. في وضع bootstrap لا يصبح request وحده نجاحاً: يلزم completion evidence من إجراء بشري معتمد، ولا ينشئ preflight حساباً. في وضع IdP تصبح bootstrap غير منطبقة، بينما يلزم issuer/client/secret-file/redirect وproof metadata/JWKS أو SAML خارج preflight.

### Scheduler dry-run

لاختبار catalogue المحلي من دون job أو egress، يستخدم المسار التالي بعد وضع catalogue root-owned:

```bash
pnpm run scheduler:dry-run
```

ينتج `SCHEDULER_DRY_RUN_COMPLETE` أو يخرج `2` بصورة fail-closed. لا يكتب heartbeat ولا يفعّل systemd timer.
