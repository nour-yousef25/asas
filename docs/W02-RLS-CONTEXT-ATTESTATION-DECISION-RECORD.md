# W02 RLS Context Attestation Decision Record

## Decision

تم اعتماد **الاتجاه المعماري**: capability موقعة asymmetric خارج PostgreSQL، تتحقق منها دالة SECURITY DEFINER مقيدة، وتسجل binding أحادي داخل transaction registry، وتستدعي RLS verified tenant function فقط. تم رفض per-tenant roles كحل أساسي ورفض تخفيف اختبار context-switch ورفض raw GUC كمرساة ثقة.

## لماذا يمنع Context Switch

لا تستطيع role التطبيق توقيع claim جديد، ولا تملك DML على binding registry. binding المقبول يحتوي PID وXID الحقيقيين ويقبل مرة واحدة. RLS لا تقرأ GUC؛ لذا لا يغير `SET` أو `set_config` organization المحقق. capability B الصحيحة لا يمكن تثبيتها بعد A لنفس PID/XID، ويجب أن تفشل A→B وB→A مباشرة عبر app role.

## الملفات الناتجة

| الملف | الغرض |
|---|---|
| `W02-RLS-CONTEXT-ATTESTATION-ADR.md` | مقارنة البدائل والاتجاه المختار |
| `W02-RLS-CONTEXT-ATTESTATION-CONTRACT.md` | claims، trust، keys، verifier، pooling، failure |
| `W02-RLS-CONTEXT-ATTESTATION-THREAT-MODEL.md` | حدود الحماية والتهديدات |
| `W02-RLS-CONTEXT-ATTESTATION-TEST-MATRIX.md` | acceptance tests الإلزامية |
| هذا الملف | decision gate والقرارات المفتوحة |

## Open Decisions Requiring Approval Before Implementation

1. اختيار public-key verification adapter المحدد في PostgreSQL وإثبات أنه لا يفتح trusted-language أو extension bypass.
2. issuer service boundary وKMS/HSM ownership وSLO/failure/revocation protocol.
3. session registry contract اللازم لاختبارات stale/revoked session، وmembership/policy locking semantics.
4. binding registry retention/cleanup، transaction identity API المدعوم، وحدود race/concurrency.
5. Cloud/Dedicated/Self-Hosted support-responsibility matrix وDR restore instance identity procedure.
6. audit sink/retention وتصنيف metadata، مع منع token/signature logging.

## Gate

**STOP.** لا migration، ولا RLS، ولا role/credential، ولا runtime، ولا Vault/Redis/Storage/Queue/Users/Memberships/Documents حتى تعتمد open decisions أعلاه وتجيز implementation contract منفصلاً. لا يعني هذا القرار تقدم W02 إلى RLS implementation أو إغلاق W02.
