# W02 WP0 — Threat Assumptions

**الحالة:** `CLOSED — DESIGN BASELINE`
**ملاحظة:** هذه افتراضات تصميم واختبارات مطلوبة، وليست claims عن حماية runtime الحالية.

| Threat | Assumption | Required Control | Required Negative Evidence | Residual Risk |
|---|---|---|---|---|
| Cross-tenant IDOR | client يعرف resource ID من org أخرى | TenantContext + repository + RLS phased | A cannot read/write/export B ID | legacy data mapping error |
| Tenant spoofing | client يرسل organizationId مزوراً | server-resolved active membership | mismatched header/body ignored/denied | switch endpoint misuse |
| Privilege escalation | global role/JWT قديم | policy version + membership-scoped RBAC | role/membership revoke invalidates session | support emergency path |
| SoD bypass | actor ينشئ ويعتمد/refund | separation rules and approval audit | same actor blocked without exception | approved emergency exception |
| Secret disclosure | logs/API/audit/storage URLs قد تحمل token | envelope encryption/redaction/read-once | secret plaintext scan and access tests | KMS operator compromise |
| Cross-org file access | raw/public URL reusable | private key/policy-signed URL/expiry/revoke | A URL denied for B and after expiry | provider signing outage |
| Malicious upload | type spoofing/malware | sniffing/quarantine/scanner/checksum | unsafe file not available | scanner coverage gaps |
| Queue/cache bleed | payload/key لا يحمل tenant | org envelope/key namespace/ownership verify | A job/key cannot act/read B | worker code regression |
| Export leakage | report path بلا policy | purpose/classification/audit/expiry | cross-org export denied | approved export mishandling |
| Activation replay | one-time code reused/brute forced | hash/TTL/binding/rate limit/audit | second/expired/wrong instance blocked | control-plane compromise |
| OAuth callback mix-up | state reused بين organizations | org/environment-bound state/consume once | A callback cannot configure B | provider redirect weakness |
| RLS bypass | table owner or no transaction context | non-owner app role/FORCE RLS/context required | direct query fails without context | migration owner misuse |
| Privacy lifecycle error | retention conflicts with legal hold | purpose/hold checks and explicit state | delete/export blocked under hold | unresolved legal policy |
| Backfill misassignment | legacy global relation ambiguous | dry-run/manual map/stop conditions | ambiguity/orphan stops migration | incomplete source metadata |

## Trust Boundaries

العميل غير موثوق للتفويض أو tenant selection. API is policy enforcement boundary؛ repository وdatabase طبقتان مستقلتان؛ worker ليس trusted لتجاوز policy؛ object storage لا يمنح public authority؛ provider callback وcontrol-plane inputs تتطلب signature/state verification. KMS/provider operators نطاقات ثقة خارج التطبيق وتخضع لمسؤولية edition.
