# W02 — Tenant Storage and Private Artifact Contract

## الحالة

**COMPLETE LIMITED AUDIT RUNTIME.** حُجر `storage.ts` الخام و`/api/upload`، وأصبح `PrivateArtifactRepository` هو boundary المحلي: key خادمي، metadata مملوك للمنظمة، RLS `session_user`، وdelivery opaque قصير العمر من provider محقون. لا يعد ذلك provider production أو credential lifecycle proof.

## العقد الإلزامي

| العملية | العقد الآمن |
|---|---|
| object key | الخادم وحده يبنيه من `TenantContext` موثوق وartifact ID مملوك؛ لا يمر path من العميل |
| metadata | Document/attachment metadata تسجل organization owner وentity owner وkey immutable وcontent attributes |
| upload | permission ثم ownership validation ثم private provider adapter؛ لا public URL |
| download | يعاد التحقق من membership/session/policy/revocation وownership قبل إصدار signed delivery قصير العمر |
| replace/delete/share | نفس owner check؛ key أو version جديد للـreplace؛ revoke يلغي delivery capability |
| provider | credential resolution deployment-owned؛ التطبيق لا يقرأ global bucket credential أو fallback سري |

## الأدلة المطلوبة

نفذ adapter memory-only آمن داخل harness S01–S10، ويمر exact proof لـforged org/path وguessed artifact وexpiry وrevoke/stale policy وdelete/replace وconcurrency وprovider failure. لا تزال bucket/KMS/provider target-like وDR/HA/scale خارجية؛ ولا تعد delivery opaque المحلية signed URL provider production.
