# W02 — Tenant Storage and Private Artifact Contract

## الحالة

**DESIGN READY — RUNTIME BLOCKED.** القراءة الحالية لـ`storage.ts` تثبت أن caller يختار path، وأن `getSignedUrl` و`getPublicUrl` يعيدان URL مباشر، وأن development fallbacks تتضمن اعتماداً عاماً. لا تعد هذه الطبقة private storage أو tenant isolation.

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

يلزم adapter قابل للـfake provider الاختباري الآمن أو disposable provider لا يحمل بيانات/credentials إنتاجية، ثم proof exact: forged org/path، guessed document ID، direct object access، expiry، revoke/stale session/policy، delete/replace/share، concurrency وprovider failure. حتى ذلك الحين تبقى upload/root documents/storage **BLOCKED — LOCAL SECURITY/DESIGN** ولا تعد `STORAGE_PATHS` الحالية namespace tenant-safe.
