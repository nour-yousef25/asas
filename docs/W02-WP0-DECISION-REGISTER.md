# W02 WP0 — Decision Register

| Decision ID | Decision | Status | Evidence | Impact | Required Approval / Follow-up |
|---|---|---|---|---|---|
| D-W02-01 | Organization هي Tenant canonical ولا `Tenant` table موازية | ACCEPTED | ADR-001 | كل data-plane design يستخدم organizationId | Product/Architecture يثبتان في WP1 kickoff |
| D-W02-02 | tenant context server-side ولا يقبل payload business `organizationId` للتفويض | ACCEPTED | ADR-001, Threat Assumptions | routes/repositories/jobs/files/cache تتغير WP1+ | policy kernel design review |
| D-W02-03 | PostgreSQL RLS phased وليس all-schema | ACCEPTED | ADR-002 | app DB role وtransaction context لاحقان | DBA يوافق app role/FORCE rollout قبل M6 |
| D-W02-04 | لا default legacy organization؛ mapping explicit ومدقق | ACCEPTED | ADR-003, Mapping Spec | backfill قد يتوقف عند data ambiguity | Data Owner يقر mapping قبل أي write |
| D-W02-05 | membership-scoped policy؛ deny-over-allow وSoD baseline | ACCEPTED | ADR-004, Catalog | global role يصبح compatibility only | Security/Product يقران permission catalog |
| D-W02-06 | platform support وصول مؤقت ومبرر ومراجع وليس super-admin bypass | ACCEPTED | ADR-004 | support workflows/audit لاحقة | Operations/Security يقران emergency exception |
| D-W02-07 | envelope encryption؛ KMS ownership حسب edition | ACCEPTED | ADR-005 | vault design/provider integration لاحقة | Security/Ops يقران KMS/rotation SLA |
| D-W02-08 | classification/purpose/retention/legal hold contract | ACCEPTED | ADR-006 | privacy policy models لاحقة | Privacy/Data Owner يعتمد المدد القانونية المحلية |
| D-W02-09 | activation TTL=15 min، one-use/hash/bind/rate limit/audit؛ safe failure | ACCEPTED | ADR-007 | activation models/services لاحقة | Commercial/Security يقران issuance/grace policy |
| D-W02-10 | private object key `org/{organizationId}/{classification}/{fileId}`، URL=5 min، quarantine | ACCEPTED | ADR-008 | StoredObject/migration/scanner لاحقة | Ops/Security يقران provider/scanner capability |
| D-W02-11 | Nafath لا ينفذ في W02؛ IdP framework base فقط | ACCEPTED | W02 plan/Wave Mapping | يمنع connector scope creep | W15 requires separate authorization |
| D-W02-12 | لا conflict مانع بين W01 baseline وW02 readiness/source/schema | VERIFIED FOR WP0 | Readiness report/current source audit | WP0 can close documentation gates | re-evaluate before WP1 migration design |
| D-W02-13 | raw GUC لا يصلح tenant identity؛ يقترح Hybrid Tenant-Bound Login Principal مع broker منفصل | PROPOSED — BLOCKED | direct A→B failure; Alternative Architecture Decision | يخلف فقط هوية RLS في ADR-002 بعد اعتماد صريح | Architecture/Security/Product يعتمدون broker, role lifecycle, provider matrix |
| D-W02-14 | Broker audit proof توقف عند B16 reason contract mismatch؛ لا تغيير expected result تلقائياً | BLOCKED | `W02-RLS-TENANT-ACCESS-BROKER-BLOCKER.md` | يمنع اكتمال broker وRLS Wave 1 | اعتماد B16 fixture أو contract revision مستقل |

## Conflict Register

لا يوجد `CONFLICT` مانع يمنع إغلاق WP0. توجد فجوات تنفيذية معروفة وليست تعارضاً: global legacy aggregates، global role middleware، raw storage URLs، queue payloads غير scoped، وغياب RLS/vault/privacy/activation runtime. هذه هي دوافع WP1–WP10، وليست أسباباً لتغيير WP0 إلى PASS runtime أو لتعديل الكود الآن.

### CONFLICT-W02-RLS-01

`ADR-W02-002` يذكر `set_config/current_setting` كهوية RLS، بينما دليل PostgreSQL المباشر أثبت context switch بدور التطبيق داخل transaction. لا يلغى ADR تلقائياً؛ لكن section الهوية فيه **محجوب** إلى أن يعتمد successor ADR بديل tenant-bound login/broker أو قرار آخر يحقق الاختبارات السلبية. لا يبدأ تنفيذ RLS على النص الحالي.

إذا ظهر تعارض لاحق بين source/schema والمواصفات، ينشأ سجل بالشكل: `CONFLICT ID`، Evidence، Impact، Recommended Decision، Required Approval، ويتوقف الـwork package المتأثر إلى حين موافقة المالك.
