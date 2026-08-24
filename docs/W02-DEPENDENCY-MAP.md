# W02 Dependency Map

| Dependency | Status | Blocks | Resolution authority |
|---|---|---|---|
| canonical Organization tenant | CLOSED | all tenant waves | ADR-W02-001 |
| server-side TenantContext | CLOSED foundation | broker session lookup | WP5-1 contract |
| raw GUC RLS identity | REJECTED | ADR-W02-002 implementation text | successor ADR approval |
| RLS identity contract reconciliation | RESOLVED DESIGN-ONLY | implementation remains blocked by lifecycle/support/family gates | ADR-W02-009 |
| tenant-bound login/broker architecture | COMPLETE AUDIT RUNTIME CORE | all RLS waves still require family cutover and production operations acceptance | L01–L10 proof; external authority boundary |
| Broker B01–B60 audit coverage | COMPLETE AUDIT-ONLY | production Broker lifecycle and RLS Wave 1 remain separately gated | separate Security/Architecture authorization |
| audit credential artifact hygiene | RESOLVED HYGIENE-ONLY | full pre-execution integrity scan | E-HYG-01..04 and strict redacted scan |
| provider role/credential lifecycle | OPEN | Cloud/Dedicated/Self-Hosted rollout | Operations/hosting owner |
| role scale/pooling benchmarks | OPEN | 1,000+ organization rollout | DBA/Operations |
| Beneficiary ownership/cutover | COMPLETE PREREQUISITE | Beneficiary RLS Wave 1 only | O01–O06 proof; Documents delivery excluded |
| tenant-bound runtime connection authority | RESOLVED FOR AUDIT RUNTIME | opens Beneficiary RLS Wave 1 only | A01–A15 PostgreSQL proof; production provider/workload identity remains OPEN |
| Beneficiary RLS Wave 1 | COMPLETE AUDIT RUNTIME | later family waves retain independent gates | R01–R15 PostgreSQL proof; production provider/DR/scale remain OPEN |
| Financial Donor/Donation RLS Wave2 | COMPLETE LOCAL ISOLATED RLS | provider activation remains prohibited | FR01–FR15; FORCE RLS, role-OID/session_user, A/B/children/rotation/cleanup proof |
| Financial Budget/Expense RLS Wave3 | COMPLETE LOCAL ISOLATED RLS | provider activation remains prohibited | BE-R01–BE-R12; FORCE RLS, parent checks, A/B/rotation/parallel/cleanup proof |
| Mixed dashboard ownership aggregation | COMPLETE LIMITED AUDIT RUNTIME | Financial RLS remains prohibited | ADR-W02-011/012 وNR/UR وD01–D10 وMK01–MK10 تثبت ownership/admission/root runtime وMember/KPI cutover محلياً؛ provider operations وبقية family gates مستقلة |
| Control-plane audit ledger boundary | COMPLETE LIMITED AUDIT RUNTIME | does not authorize tenant migration or production | ADR-W02-010 CP01–CP12 exact proof passes; operational retention/DR/HA remains open |
| Nullable-root ownership/backfill | COMPLETE LIMITED AUDIT RUNTIME | Financial RLS remains prohibited | ADR-W02-011/012 وNR01–NR15 وUR01–UR10 تثبت explicit mapping/admission وclean/upgrade rehearsal؛ production operations remain separate |
| Dashboard nullable-root ownership | COMPLETE LIMITED AUDIT RUNTIME | Financial RLS remains prohibited | Member/KPI/KPIRecord classified tenant-owned with explicit manifest/admission; MK01–MK10 closes converted data-plane surfaces locally |
| Dashboard nullable-root clean rehearsal | COMPLETE LIMITED AUDIT RUNTIME | Financial RLS remains prohibited | ADR-W02-012 NR01–NR15 clean migration/admission proof passes; production provider operation remains required |
| Dashboard nullable-root upgrade rehearsal | COMPLETE LIMITED AUDIT RUNTIME | Financial RLS remains prohibited | UR01–UR10 proves pre-successor upgrade, legacy preservation and tenant-bound admission |
| Mixed dashboard root-page runtime | COMPLETE LIMITED AUDIT RUNTIME | Financial RLS remains prohibited | D01–D10 root snapshot and MK01–MK10 Member/KPI data-plane cutover pass; provider and remaining W02 families remain separate |
| Financial migration and portability rehearsal | COMPLETE LOCAL ISOLATED | provider activation remains prohibited | MGR-F01–F10 and PORT-R01–R06 exact validators; Git permission metadata must be materialized locally |
| Provider DR/HA/scale readiness | OPEN — EXTERNAL | global W02 closure | deployment-owned provider, recovery, role-scale and pool capacity evidence required |
| WP6 vault/secret records | COMPLETE INTERNAL CONTRACT | external KMS operation only | opaque references/resolver/revoke/redacted audit/RLS; INT01–INT14 and MGR-I01–I08 |
| WP7 privacy/retention/export/audit-v2 | COMPLETE INTERNAL ARCHITECTURE | owner-approved legal policy values only | classification/purpose/hold/request default-deny contract; export remains fail-closed until approved policy |
| WP8 certificate verification/activation | COMPLETE INTERNAL CONTRACT | external issuer/control-plane only | Ed25519 public-key verification, hash/replay/expiry/revoke state and RLS proof |
| WP9 IdP provider framework | COMPLETE INTERNAL CONTRACT | provider enrollment/sandbox/UAT/credentials only | tenant config/subject/callback/membership/revocation contracts; no provider enabled |
| Reports/export delivery | COMPLETE FAIL-CLOSED INTERNAL BOUNDARY | approved policy/provider delivery only | report read path tenant-bound; download/export/share rejects until WP7 policy/owner inputs |
| legacy manifest/backfill | CLOSED foundation, family-specific | nullable/unmapped roots | Data owner + WP4 contract |
| Users/Memberships tenant authority | COMPLETE LIMITED AUDIT RUNTIME | global identity onboarding remains distinct; W02 closure is still blocked by Queue/Storage/provider | ADR-W02-013; UM01–UM10 exact PostgreSQL proof, validator, quarantine of `/api/users` |
| Queue/Redis/Cache | COMPLETE LIMITED AUDIT RUNTIME | production worker/provider activation and SMS/Notification reactivation remain separately blocked | Q01–Q10 exact Redis/PostgreSQL disposable proof; legacy surfaces fail-closed |
| Storage/Root Documents | COMPLETE LIMITED AUDIT RUNTIME | production bucket/KMS/provider/DR/HA/scale activation remains external | S01–S10 exact PostgreSQL + memory-only provider proof; raw surfaces fail-closed |
