# ASAS PLUS — W02 PRE-EXECUTION ARCHITECTURAL READINESS REPORT

**الحالة:** `READY TO START W02 SUBJECT TO PLAN ACCEPTANCE`
**Baseline المُراجع:** `w01-foundation` عند `308ae82`
**طبيعة هذا المستند:** تحليل وخطة فقط. لا يغير هذا التقرير كود الإنتاج أو Prisma schema أو migrations أو packages أو environment، ولا يشغّل W02.

> تنص خريطة الموجات على أن W02 يبدأ بعد W01 ويغطي `DEP-003` و`LIC-001/002` وtenant/IAM/privacy/vault و`IDP-001 base`، وأن شرط خروجه هو tenant-isolation suite وcertificate verification وactivation audit وsecret/policy tests.[1]

## 1. Executive Summary

W01 مكتمل كأساس تقني: release integrity وbackup/health/runtime foundation موثقة ومغلقة، مع بقاء سجل أمن الإنتاج مستقلاً عن قرار الموجة.[2] لذلك لا يوجد مانع معماري يمنع **بدء تخطيط وتنفيذ W02** بعد اعتماد هذه الخطة. لكن المصدر الحالي ليس multi-tenant آمناً: توجد `Organization` و`OrganizationMembership` وعزل جيد في communications، بينما غالبية aggregates وواجهات API الأساسية ما تزال عالمية أو محمية بجلسة فقط.[3] [4]

توصية المراجعة هي اعتماد **Organization بوصفها Tenant canonical**؛ لا تنشأ طبقة `Tenant` مستقلة في W02. يخفف ذلك الازدواجية مع النموذج الموجود ويجعل `organizationId` مفتاح العزل التشغيلي الموحد في قاعدة البيانات والمستودعات وAPI والملفات وRedis والـjobs والتدقيق. يجب أن ينفذ W02 على مراحل توسعية قابلة للتحقق، ولا يجوز جعله مجرد إضافة عمود `organizationId` بلا policy engine واختبارات cross-tenant سلبية.

| القرار | النتيجة |
|---|---|
| قرار الجاهزية | `READY TO START W02 SUBJECT TO PLAN ACCEPTANCE` |
| مانع البدء الحالي | لا يوجد مانع معماري أو اعتمادية موجة غير مكتملة |
| شرط أول commit تنفيذي | اعتماد هذا التقرير وخطة التنفيذ وحل Gates المذكورة في القسم 10 |
| ما لا يبدأ في W02 | Nafath، Offline Activation، transfer/recovery الكامل، entitlement/config engine، W03 وما بعده |

## 2. W02 Scope and Feature Matrix

| ID / المجال | الحالة الحالية المثبتة | Acceptance Criteria في W02 | الاعتماد | المخاطر | الاختبارات المطلوبة |
|---|---|---|---|---|---|
| `DEP-003` Instance Identity | لا يوجد `installationId` أو key/domain transfer contract؛ `InstallationState` singleton لا يحقق هوية instance | installation identity عشوائي ثابت، tamper/transfer audit، بلا hardware fingerprint | W01 release/health | false lockout أو replay | identity tamper، transfer، restore-negative |
| `LIC-001` Signed Certificate | release manifests موقعة، لكن لا certificate محلي للترخيص | public-key verify، key version، edition/modules/limits/expiry | `DEP-003`، secret boundary | key exposure أو certificate replay | signature، expiry، key rotation، negative |
| `LIC-002` Activation Core | لا activation code أو audit/rate limit خاص | one-time قصير العمر، hashed-at-rest، instance-bound، audited/rate-limited | `LIC-001` و`DEP-003` | brute force/reuse | replay، rate-limit، expiry، audit |
| Tenant Isolation | `OrganizationMembership` موجودة؛ أغلب aggregates ليست tenant-scoped | tenant first في DB/API/repository/files/jobs/cache/export | W01، migration plan | IDOR/cross-tenant leakage | two-org isolation suite وRLS/repository negative tests |
| IAM / Policy | global `Role` و`UserPermission`، لا policy engine per membership | RBAC مركزي، ABAC resources عند الحاجة، least privilege وSoD | tenant context | escalation/stale session | permission matrix، role change، vertical/horizontal escalation |
| Privacy | `AuditLog` وfields حساسة موجودة، لا classification/consent/purpose/retention flow | classification، masking، access/export audit، DSAR workflows والـlegal-hold boundary | tenant/IAM/vault | PII leakage أو deletion غير آمن | purpose/retention/export/masking tests |
| Vault / Secrets | تشفير AES-GCM محدود لقنوات الاتصال؛ provider secrets تطبيقية في environment | tenant-scoped secret records، key version، rotation/revoke/access audit، read-once boundary | KMS/master-key operational decision | plaintext/log/key reuse | encryption/rotation/revocation/redaction tests |
| Storage Security | raw object URLs ومسارات user/content لا organization | org-scoped object keys، private access، expiring signed URLs، content scan/classification/audit | tenant/vault | file IDOR أو public PII | cross-org download، expiry، path traversal، malware/scan policy |
| Audit Log | audit helper خاص بالاتصالات؛ لا source-wide event contract | append-only security audit مع tenant/actor/request/correlation/purpose/outcome | policy engine | audit gap أو sensitive payload | event completeness/redaction/tamper tests |
| `IDP-001` Base | OAuth state scoped للاتصالات فقط | provider contract، tenant config/secret boundary، sandbox/prod، mapping/audit/disable/rotate | IAM/vault | callback mix-up أو mapping privacy | provider contract/OAuth/tenant/rotation tests |

## 3. Current Source Audit

### 3.1 Tenant and Authorization Surface

يوجد `Organization` و`OrganizationMembership` بعلاقة فريدة `(organizationId, userId)`، وتستخدم communications `organizationId` في connected channels والمحتوى والنشر والـwebhook والmetrics.[3] ويستمد `getOrganizationContext()` العضوية النشطة من المستخدم، لكنه يختار أول عضوية نشطة ويحتوي fallback توافقياً إلى `DEFAULT_ORGANIZATION_ID` عندما لا توجد عضوية.[4] هذا مناسب لترحيل سابق أحادي المؤسسة، لكنه ليس عقد tenant switching أو تفويض مركزي.

في المقابل، تفحص `auth.ts` هوية المستخدم وكلمة المرور ثم تضع `id` وglobal `role` في JWT؛ و`requireRole()` يقارن global role فقط.[5] كما أن middleware يتحقق من وجود session cookie في أغلب API routes ولا يشتق tenant أو policy.[6] مثالان مباشران للمخاطرة: Beneficiary API يقرأ ويكتب من دون `organizationId` أو membership authorization، وUsers API يعرض وينشئ global users لأي session مصادق عليها.[7] [8] ويوجد route للتقارير لا يستدعي `auth()` ولا يفرض tenant أو audit.[9]

### 3.2 Data Model

`Organization` **تُعتمد Tenant canonical**. تحتفظ `User` بدور principal عالمي محدود للتوافق الانتقالي، لكن المصدر النهائي للتفويض يصبح membership policy داخل المنظمة. تحتوي schema على نماذج منظمة أصلاً مثل `FinancialAccount` وcommunications و`SiteSetting` و`AuditLog`، بينما لا تحمل نماذج أساسية عديدة مثل `Beneficiary` و`Donor` و`Donation` و`Project` و`Task` و`Survey` و`Budget` و`Document` مفتاح منظمة.[3]

يوجد خطر إضافي في constraints العالمية: `Beneficiary.userId` و`Member.userId` و`Volunteer.userId` و`Donor.userId` فريدة عالمياً، و`News.slug` و`ContentPage.slug` و`Invoice.invoiceNo` عالمية. يجب أن تصبح uniqueness tenant-scoped حيث يكون السجل تشغيلياً، بينما تبقى identity principal مثل `User.email` عالمية عمداً.

### 3.3 Storage, Queue, Cache and Worker

Storage الحالي يبني HMAC-SHA1 request يدوياً، يعيد raw URLs، و`getSignedUrl()` يتجاهل `expiresIn`. كما أن المسارات تستخدم user/content identifiers بدلاً من organization prefix.[10] Queue names ثابتة وjob payloads لا تحمل organization/instance/correlation context؛ Notification worker يكتب بواسطة `userId` فقط، مع fallback in-memory عندما لا يوجد Redis.[11] هذه ليست عيوب W01؛ لكنها حدود مباشرة يجب أن يعالجها W02 قبل اعتبار أي job أو file أو cache tenant-safe.

### 3.4 Secret and Provider Baseline

يوجد أصل صالح لإعادة الاستخدام: `ChannelCredential` يحفظ token مشفراً، وcrypto helper يستخدم AES-256-GCM وkey version، كما أن OAuth state يحفظ organizationId وuserId وPKCE وexpiry.[3] [12] لكن `getProviderConfig()` ما زال يقرأ app secrets من environment ولا يوجد secret registry عام أو rotation/revocation/access event contract.[13] لا يعد هذا Vault متعدد tenants.

### 3.5 Migration and Test Baseline

التاريخ يحتوي أربع migrations فقط، وآخرها forward-only W01 alignment الذي يحافظ عمداً على `roleId` و`roles` legacy ويضيف communications/membership schema.[14] الاختبارات الحالية تركز على W01 foundation/schema consistency/release/health، ولا توجد suite مثبتة لعزل منظمتين أو policy matrix أو IDOR أو secret rotation. لا تُعدل migrations التاريخية؛ W02 يضيف migrations forward-only جديدة فقط.

## 4. Tenant Decision and Isolation Architecture

| القرار | العقد المقترح | سبب القرار |
|---|---|---|
| Tenant canonical | `Organization.id` | النموذج موجود ومستخدم في العلاقات المنظمة؛ لا قيمة لإضافة Tenant موازٍ |
| Request context | `TenantContext = { organizationId, membershipId, userId, policySnapshotVersion, correlationId }` | يمنع تمرير tenant من client أو الاعتماد على global JWT role |
| Active organization | اختيار server-side من membership فعالة؛ switch صريح ومدقق | إزالة «أول عضوية» وfallback أحادي المؤسسة من المسار التشغيلي |
| API enforcement | route → authenticate → resolve membership → authorize action/resource → repository scoped query | defense-in-depth لا middleware cookie فقط |
| Repository enforcement | أي repository تشغيلي يقبل `TenantContext` إلزامياً ويضيف `organizationId` في where/create | يمنع نسيان scope في المسارات الجديدة |
| Database enforcement | FK و`NOT NULL` وindexes/unique مركبة؛ ثم PostgreSQL RLS تدريجي بـtransaction-local setting وnon-owner app role | حماية من direct/unscoped query بعد اكتمال كل family |
| File enforcement | private key: `org/{organizationId}/{classification}/{fileId}`؛ object metadata وsigned download قصير العمر بعد policy check | لا raw URL ولا path user-only |
| Job/cache enforcement | أسماء Redis بـinstance namespace؛ payload/context صريحان؛ cache keys تبدأ `asas:{instanceId}:org:{organizationId}` | يمنع queue/cache bleed عبر tenants |

طبقات العزل المطلوبة هي: database schema، repository، API، object storage، search/export، Redis/cache، queue/worker، audit وAI. لا يكفي header أو query parameter أو widget لاختيار المنظمة. كل identifier يأتي من العميل يعامل كـresource identifier فقط، ويعاد التحقق من ملكيته تحت `TenantContext` server-side.

## 5. IAM, Identity and Session Architecture

ينتقل W02 من global role إلى policy model tenant-scoped مع إبقاء `Role` القديم توافقياً فقط حتى اكتمال migration. تتكون النواة المقترحة من `Permission` registry ثابتة semantic names، و`OrganizationRole`، و`OrganizationRolePermission`، و`MembershipRole`، و`MembershipPermissionOverride` (ALLOW/DENY) عند الحاجة المحددة. لا يصبح `SUPER_ADMIN` صلاحية عابرة لجميع العملاء تلقائياً؛ يعرّف platform-support scope منفصلاً، مزوداً بجلسة دعم مبررة، قصيرة العمر، مدققة، وقراءة محجوبة افتراضياً.

| المجال | القاعدة التنفيذية المقترحة |
|---|---|
| Authentication | يبقى principal identity في `User`؛ لا يحمل JWT إلا user/session version ومعلومات عرض غير موثوقة للتفويض |
| Authorization | يعاد حل membership active وpolicy version من الخادم في كل request حساس؛ global `requireRole` لا يستخدم لمسار تشغيلي tenant-scoped |
| Session invalidation | `authVersion` على user و`policyVersion` على membership؛ تغيير password/تعطيل user/role/membership يزيد version ويبطل JWT القديم عند التحقق |
| Tenant switch | endpoint/server action صريح يثبت membership active، ينشئ audit event، ولا يقبل organizationId حرّاً من request business payload |
| ABAC | يبدأ W02 بـresource organization ownership وclassification/purpose، ثم يضاف ownership/department/case attributes بلا bypass لـRBAC |
| SoD | policy rule يمنع actor من اعتماد/نشر/تنفيذ حالة تتطلب reviewer مختلفاً؛ exceptions مدققة |

يبني `IDP-001` provider-neutral interface: provider type، tenant configuration reference، environment (`SANDBOX`/`PRODUCTION`)، callback allow-list، requested scopes، mapping rules، connection status، test connection، enable/disable، rotation وaudit. لا ينفذ Nafath في W02؛ يبقى موصلاً مشروطاً لـW15 بعد الإطار والموافقة والـsandbox/UAT.[1]

## 6. Privacy, Vault, Storage Security and Audit Contracts

### 6.1 Privacy and Classification

يُنشئ W02 catalog تصنيف: `PUBLIC` و`INTERNAL` و`CONFIDENTIAL` و`RESTRICTED`. تصنف beneficiary identity/documents، donor contacts، national identifiers، HR/finance والـcredentials كـ`RESTRICTED` أو `CONFIDENTIAL` وفق policy. كل read/export حساس يتطلب purpose code وpolicy decision ويكتب audit بلا plaintext أو token أو full PII. وتُعرّف retention policy وlegal-hold وDSAR request records، مع قاعدة أن delete/correction/export لا يتجاوز financial/audit retention أو legal hold.

### 6.2 Vault and Rotation

يقترح W02 `SecretRecord` tenant-scoped بتشفير envelope، `keyVersion`، fingerprint، status، not-before/expiry/rotated/revoked timestamps وmetadata غير حساسة، و`SecretAccessAudit` append-only. لا يعود plaintext من API ولا من logs. يظل master key/KMS responsibility في environment/support matrix؛ التطبيق لا يخزن master key في DB. يلزم مسار rotation مزدوج: يكتب نسخة جديدة، يعيد تشفير/يختبر connection masked، يحدّث reference atomically، ثم يبطل النسخة السابقة بحسب grace policy.

### 6.3 Files and Exports

ينشئ W02 `StoredObject` بملكية organization وتصنيف وchecksum/content type/size/scan status/retention fields. تحفظ domain models `storedObjectId` بدلاً من raw URL عندما تبدأ migration في family، ويصدر download controller URL موقّعاً قصير العمر فقط بعد policy check. تشمل الحماية validation server-side للنوع والحجم، content sniffing، quarantine قبل الإتاحة، metadata allow-list، وتدقيق upload/download/share/export. لا تستخدم public bucket لملفات PII.

### 6.4 Audit Event Standard

يتبنى W02 event contract append-only: `organizationId`, `actorUserId`, `actorMembershipId`, `action`, `resourceType`, `resourceId`, `decision`, `reasonCode`, `purposeCode`, `requestId`, `correlationId`, `source`, `ipHash` وredacted metadata. لا يسمح event details بحفظ passwords أو access/refresh tokens أو certificate payloads أو raw national identifiers. AuditLog الحالي يبقى توافقياً ثم يرحل writer موحد تدريجياً.

## 7. Database and Migration Strategy

لا تعدل W02 التاريخ ولا تستخدم `db push`. التسلسل المقترح توسعي ومقسم وقابل للتراجع على مستوى التطبيق:

| Migration / مرحلة مستقبلية | التغيير | Backfill | Hardening | شرط الانتقال |
|---|---|---|---|---|
| M1: security primitives | enums وجداول membership roles/policy/tenant session versions/instance/license/activation/audit-v2 | لا يغير business rows | FKs وindexes فقط | schema validate + policy unit tests |
| M2: tenant keys — wave A | تضيف nullable `organizationId` إلى root aggregates ذات APIs الحالية | CLI audited يطلب `LEGACY_ORGANIZATION_ID` صالحاً؛ لا يفترض multi-org mapping | لا `NOT NULL` قبل report null/foreign-key | dry-run/backfill report وموافقة operator |
| M3: tenant keys — wave B | child aggregates ترث root أو تضيف org key حيث يصل query مباشرة | validate parent ownership | composite unique/indexes | two-org fixture suite |
| M4: code cutover | repositories/routes/jobs/files تتحول إلى TenantContext | dual-read فقط عند الحاجة ومقاس | reject unscoped writes | no unscoped API calls في inventory |
| M5: constraints | org keys `NOT NULL`، composite uniques، foreign keys؛ تعيين/استبدال global uniqueness التشغيلي | null count=0 وorphan count=0 | safe forward migration | migration rehearsal/backup/update path |
| M6: RLS rollout | policies لكل table family مكتمل، `set_config` داخل transaction وapp DB role غير owner | shadow/negative tests أولاً | FORCE RLS بعد نجاح suite | cross-tenant direct-query rejection |
| M7: privacy/vault/storage | SecretRecord/StoredObject/DSAR/retention/audit cutover | migrate references بلا نقل plaintext إلى logs | raw URL paths محظورة | encryption/expiry/export tests |

يجب أن تغطي root aggregates في M2/M3 على الأقل: Member، Volunteer، Beneficiary، Donor، DonationCampaign، Donation، RecurringDonation، Invoice، Project، News، PhotoAlbum، VideoCategory، ContentPage، Announcement، Event، Task، Survey، KPI، Evaluation، StoreProduct، StoreOrder، Budget، Expense، Notification، SMS template/log، MenuItem، ReportShare وDocument. تبقى `User` و`Permission` وpublic `TrialRequest` خارج tenant data plane بحكم عقدهما، مع policy منفصل لمسار trial.

## 8. Redis, Queue, Cache and Worker Plan

W02 لا ينشئ queue لكل tenant؛ يحتفظ بطوابير instance-level لتقليل العبء، لكنه يفرض tenant-safe job envelope:

```ts
type TenantJobEnvelope<T> = {
  instanceId: string;
  organizationId: string;
  requestedByUserId?: string;
  requestedByMembershipId?: string;
  correlationId: string;
  policyVersion: number;
  idempotencyKey: string; // includes organizationId
  payload: T;
};
```

يفحص worker organization ownership قبل أي side effect ويكتب audit outcome. تسمي keys بـ`asas:{instanceId}:org:{organizationId}:{domain}:{key}`، ولا تقبل cache read بلا organizationId. يزيل W02 fallback in-memory من runtime production ويجعله صريحاً في test/development contract فقط. ويلزم test لمنع job أو cache key من tenant A من تنفيذ أو قراءة resource tenant B.

## 9. Threat Model and Required Test Matrix

| التهديد | الخطر الحالي | معالجة W02 | اختبار سلبي إلزامي |
|---|---|---|---|
| IDOR بين منظمات | routes عالمية مثل Beneficiary | TenantContext + repository scope + RLS | user A يطلب/يعدل ID من B ⇒ 404/403 بلا timing/data leak |
| client tenant spoofing | لا عقد switch مركزي | ignore client org in business payload | header/body org مختلف ⇒ context server side فقط |
| role escalation | global role/session فقط | membership policy + SoD + server resolution | MEMBER يعدل role/roleId ⇒ forbidden/audited |
| stale JWT | role يحمل في JWT | auth/policy versions server-checked | disable membership ثم old token ⇒ rejected |
| export leakage | report route بلا auth | export policy + purpose/audit + org filters | tenant A يطلب B report ⇒ denied/no artifact |
| raw file access | raw object URL ومسار user | private objects + signed URL + policy check | expired/share/cross-org URL ⇒ denied |
| secret disclosure | env/ad-hoc cipher | vault read-once/redaction/access audit | plaintext in API/log/audit ⇒ test failure |
| key rotation fault | key version محدود | dual-key rotation/revoke policy | old version during rotation ⇒ defined success/fail safely |
| OAuth callback mix-up | specialized social state فقط | provider connection org/environment binding | callback state for A used in B ⇒ denied/consumed |
| queue replay/cross tenant | job no org context | signed/enveloped job + ownership/idempotency | A job references B plan ⇒ fail/audit |
| cache bleed | no tenant prefix contract | namespaced keys/invalidation | same resource key across A/B ⇒ separate values |
| audit tampering/PII | generic details JSON | append-only redacted event model | attempt update/delete or token detail ⇒ rejected/redacted |
| activation replay | not implemented | hashed one-time code + expiry/rate limit | second use/expired/code brute force ⇒ blocked/audited |
| migration misassignment | legacy global data | explicit audited mapping + dry-run | missing/multiple org mapping ⇒ migration gate blocks |
| RLS owner bypass | future DB policy risk | separate app role/non-owner + FORCE RLS | direct query using app role without set_config ⇒ zero/denied |

## 10. Decision Gates Before First W02 Implementation Commit

| Gate | القرار المطلوب | المالك المقترح | لا يبدأ بدونه |
|---|---|---|---|
| G-W02-1 | اعتماد `Organization` كـTenant canonical | Product + Architecture | M1/M2 |
| G-W02-2 | اختيار RLS rollout: mandatory phased enforcement وapp DB role | Architecture + DBA | M6، لكن يصمم من M1 |
| G-W02-3 | سياسة legacy data mapping إلى `LEGACY_ORGANIZATION_ID` أو mapping table | Product/Data Owner | M2 backfill |
| G-W02-4 | permission catalog وplatform-support boundary وSoD baseline | Security + Product | IAM implementation |
| G-W02-5 | KMS/master-key ownership وrotation/revocation SLA حسب edition | Security/Operations | Vault/secret migration |
| G-W02-6 | classification/purpose/retention/legal-hold baseline | Privacy/Data Owner | privacy and export controls |
| G-W02-7 | activation business rules: issuance owner، TTL، rate limits، grace boundary | Commercial + Security | LIC-002 |
| G-W02-8 | approved supported object-store signing/scan approach | Operations + Security | storage cutover |

## 11. Readiness Decision

**القرار:** `READY TO START W02 SUBJECT TO PLAN ACCEPTANCE`.

هذا ليس حكم أن المصدر الحالي tenant-safe؛ العكس هو الصحيح، وهو سبب W02. الجاهزية تعني أن baseline W01 مستقر، وأن نموذج tenant canonical والمسار forward-only وطبقات العزل والمخاطر ومصفوفة الاختبارات قابلة للتنفيذ من دون تغيير معمارية لاحق. يبدأ التنفيذ فقط بعد اعتماد gates وخطة W02 المرفقة.

## References

[1] [Deployment & Lifecycle Wave Mapping](../../asas-app-workspace/asas-plus-deployment-wave-mapping.md) — نطاق W02 وExit Criteria واعتماديات W15/W19.
[2] [W01 Final Closure Report v2](./W01-FINAL-CLOSURE-REPORT-v2.md) — baseline W01 وقيود الإنتاج المستقلة.
[3] [`prisma/schema.prisma`](../prisma/schema.prisma) — النماذج الحالية، membership، communications والـaggregates غير scoped.
[4] [`src/lib/organization-context.ts`](../src/lib/organization-context.ts) — organization context والفallback الحالي.
[5] [`src/lib/auth.ts`](../src/lib/auth.ts) — JWT/global role/requireRole الحالي.
[6] [`src/middleware.ts`](../src/middleware.ts) — session cookie/rate-limit boundary الحالي.
[7] [`src/app/api/beneficiaries/route.ts`](../src/app/api/beneficiaries/route.ts) — مثال query/write بلا tenant scope.
[8] [`src/app/api/users/route.ts`](../src/app/api/users/route.ts) — مثال global user operations بلا permission policy.
[9] [`src/app/api/reports/[reportName]/route.ts`](../src/app/api/reports/[reportName]/route.ts) — report route بلا auth/tenant/audit.
[10] [`src/lib/storage.ts`](../src/lib/storage.ts) — raw URL وstorage paths الحالية.
[11] [`src/lib/queue.ts`](../src/lib/queue.ts) — queue names وpayloads والـworker الحالي.
[12] [`src/lib/communications/crypto.ts`](../src/lib/communications/crypto.ts) و[`oauth.ts`](../src/lib/communications/oauth.ts) — تشفير channel secret وOAuth state scoped.
[13] [`src/lib/communications/connectors.ts`](../src/lib/communications/connectors.ts) — provider env secrets وtenant-scoped channel persistence.
[14] [`20260822060000_align_canonical_schema_non_destructive`](../prisma/migrations/20260822060000_align_canonical_schema_non_destructive/migration.sql) — قيود migration history forward-only.
