# W02 RLS Context Attestation — Support Matrix

**الحالة:** لا يوجد support contract معتمد حتى اختيار verifier adapter. لا يجوز اعتبار أي صف أدناه إذناً للتنفيذ.

| النمط | issuer/KMS ownership | verifier requirement | availability evidence | key rotation/revocation | DR/restore | status |
|---|---|---|---|---|---|---|
| Cloud SaaS | platform issuer وKMS/HSM منفصل | provider-supported asymmetric verify extension أو equivalent | PostgreSQL core لا يكفي؛ Cloud SQL مثالاً يسمح بالextensions المدعومة فقط ولا custom extensions | public-key registry + `kid` revoke + issuer HA | instance ID جديد ورفض pre-restore capabilities | **BLOCKED** |
| Dedicated | حسب Support/Responsibility Matrix | pinned adapter package/version وسجل upgrade/CVE | يحتاج provider confirmation لا local inference | customer/platform split محدد | public-key reprovision + tested restore | **CONDITIONAL** |
| Self-Hosted | operator KMS/HSM/issuer | package build/provenance/OS hardening | يمكن تقنياً بعد package review؛ لا يعني support تلقائي | operator runbook والـoverlap/revoke | operator مسؤول عن instance/key restoration | **CONDITIONAL** |
| Audit/local | لا يمثل production contract | لا PoC extension حالياً | فقط `pgcrypto` 1.3 متاح وno asymmetric verifier | غير منطبق | غير منطبق | **NOT SUFFICIENT** |

لا يحمي العقد DBA/superuser أو Self-Hosted administrator يملك PostgreSQL/host control؛ هذه boundary يجب أن تكون ضمن Responsibility Matrix وليس ادعاء تقني من RLS. لا تدخل private signing keys القاعدة في أي نمط.

## Operational Minimum Before Any Implementation

يتطلب كل نمط: issuer SLO وtimeout/retry fail-closed، `kid` registry مملوك، root of trust خارجي، public-key replication strategy، extension upgrade compatibility، backup/restore test، app role separation، SECURITY DEFINER owner، وrunbook compromise/revoke. غياب أي عنصر يبقي النمط BLOCKED.

## Reference

[1]: https://docs.cloud.google.com/sql/docs/postgres/extensions "Managed PostgreSQL extension support restrictions"
