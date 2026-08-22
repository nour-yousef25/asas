# W02 WP0 — Gate Matrix

**الحالة الإجمالية:** `8/8 CLOSED — DESIGN CONTRACTS APPROVED IN WP0`.

| Gate ID | Decision | Rationale | Owner | Dependencies | Security Impact | Operational Impact | Migration Impact | Test Requirement | Acceptance Criteria | Status | Evidence Reference |
|---|---|---|---|---|---|---|---|---|---|---|---|
| G-W02-1 | `Organization` Tenant canonical | يمنع طبقة هوية موازية ويستثمر schema الحالي | Architecture + Product | W01 baseline | server-side tenant boundary | active-org switch/audit | org keys للمستقبل | A/B cross-tenant API/repository/files/jobs | لا client tenant authority ولا unscoped operational query | CLOSED — DESIGN | ADR-001; Readiness §§3–4 |
| G-W02-2 | RLS تدريجي مع app role غير مالك وtransaction-local context | defense-in-depth دون big-bang schema change | Architecture + DBA/Ops | G1, G3 | يمنع direct unscoped DB access | role provisioning/recovery runbook | family-by-family forward rollout | direct-query negative, missing context, owner bypass | RLS لا يفعّل قبل converted family وFORCE بعد proof | CLOSED — DESIGN | ADR-002; Threat Assumptions |
| G-W02-3 | explicit audited mapping؛ dry-run/refuse ambiguity | يمنع attribution خاطئ للبيانات legacy | Data Owner + Architecture | G1 | يمنع cross-tenant misassignment | operator approval/report | nullable expand ثم validate/harden | dry-run, ambiguity/orphan/idempotency | لا null/orphan/ambiguity قبل constraints | CLOSED — DESIGN | ADR-003; Legacy Mapping Spec |
| G-W02-4 | membership RBAC/ABAC، deny-over-allow وSoD | global roles لا تكفي isolation | Security + Product | G1 | least privilege/no escalation | role/support governance | policy tables لاحقة | matrix/stale session/SoD/support tests | كل action حساس له permission/audit/policy outcome | CLOSED — DESIGN | ADR-004; Permission Catalog |
| G-W02-5 | envelope encryption وedition KMS ownership | crypto الحالي محدود للقنوات فقط | Security + Operations | G4 | no plaintext/read-once/rotation | edition support responsibility | additive secret/audit models | encryption/rotate/revoke/redaction | key owner وrotation/revocation policy documented | CLOSED — DESIGN | ADR-005 |
| G-W02-6 | classification/purpose/retention/legal hold | يمنع export/delete غير مشروع | Privacy + Security | G4, G5 | PII masking/export restrictions | DSAR/hold governance | additive privacy/audit models | purpose/mask/hold/DSAR tests | no sensitive export/delete without policy; audit redacted | CLOSED — DESIGN | ADR-006; Threat Assumptions |
| G-W02-7 | signed cert + one-time activation rules | يمنع replay/brute-force والـlockout المفاجئ | Commercial + Security | G1, G5 | hash/TTL/binding/rate limit/audit | issuance/exception ownership | additive identity/cert/activation models | signature/expiry/replay/rate-limit tests | activation consumes valid bound code once; safe failure | CLOSED — DESIGN | ADR-007 |
| G-W02-8 | private S3-compatible storage and quarantine | raw URLs/user-only paths غير كافية | Operations + Security | G1, G4, G5 | private org object access | provider/scanner responsibility | additive StoredObject/reference rollout | cross-org/expiry/revoke/quarantine tests | no public PII object; policy checked signed access only | CLOSED — DESIGN | ADR-008; Threat Assumptions |

## Evidence Interpretation

الدليل في WP0 وثائقي: ADR مقبول، owner محدد، dependencies، impact، test requirement ومعيار قبول. لا توجد نتيجة `PASS` runtime في هذه المصفوفة؛ تنفيذ الاختبارات وmigrations/provider/role verification شرط WP1 وما بعده.
