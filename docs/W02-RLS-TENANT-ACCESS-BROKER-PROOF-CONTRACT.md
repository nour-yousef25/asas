# W02 RLS Tenant Access Broker Audit Proof — Contract

## Boundary and Scope

هذا العقد خاص بـ**Audit-only Broker Proof Harness**. لا يضيف Broker إنتاجية، ولا يغير Prisma أو migrations أو أدواراً إنتاجية. يتلقى الـBroker `TenantContext` server-side فقط ويعالجها وفق authority registry تدقيقية مستقلة، ثم يسمح باتصال PostgreSQL عبر principal tenant محددة. لا يعيد credential أو connection string أو يسمح للتطبيق بتسمية role بحرية.

## Trusted Context and Exact Selection

| الحقل | المصدر الموثوق | شرط Broker |
|---|---|---|
| `userId` | TenantContext server-side | user موجود ونشط |
| `organizationId` | TenantContext server-side | لا يطابق request override؛ membership exact لها |
| `membershipId` | TenantContext server-side | موجود، active، غير revoked، ومملوك للمستخدم/المنظمة |
| `sessionVersion` | authority registry | يطابق النسخة الحالية وغير revoked |
| `policySnapshotVersion` | authority registry | يطابق policy الحالية ومسموح بالعملية |
| `correlationId` | TenantContext server-side | غير فارغ، محفوظ audit مختزلاً |
| requested operation | server-side Broker call | allow-list فقط؛ لا role أو org authority من payload |

تنجح الاختيارات فقط عندما توجد mapping واحدة ونشطة من `Organization.id` إلى `tenant_<org>_rw`. أي غموض أو صف مكرر أو mapping revoked أو طلب role لا يطابق المنظمة ينتج `DENY`. لا يوجد default tenant أو first membership أو fallback أو global credential.

## Lease Contract

| الحقل | القاعدة |
|---|---|
| `leaseId` | random opaque ID؛ لا credential |
| `organizationId`, `tenantRoleId` | exact tenant mapping فقط |
| `connectionId` | broker-generated and bound to lease |
| `correlationId` | يطابق context ولا يقبل override |
| `issuedAt`, `expiresAt` | short-lived audit TTL |
| `usedAt`, `revokedAt` | single-use replay control وrevocation |
| `contextFingerprint` | hash مختزل لحقول context؛ لا secret أو token |

يرفض الـBroker lease إذا انتهت أو revoked أو استعملت سابقاً أو قدمت مع connection/context/organization أخرى. يتحقق PostgreSQL لاحقاً من tenant principal الفعلية وRLS fixture؛ لا تمثل lease بحد ذاتها هوية قاعدة البيانات.

## Credential and Broker Separation

Credential authority التدقيقية منفصلة منطقياً عن واجهة application-to-broker: تحفظ password عشوائية في memory فقط، تعيدها للـBroker عند exact role selection، والـBroker يمررها مباشرة لعملية `psql` ولا يعيدها في output أو audit. لا يملك application interface method لطلب credential أو اختيار role. هذا إثبات harness محدود، وليس برهاناً على production process/KMS isolation.

## Failure Contract

| Failure | Result |
|---|---|
| broker unavailable/unexpected exception | `DENY:BROKER_UNAVAILABLE` أو `DENY:BROKER_EXCEPTION` |
| authority unavailable/timeout | `DENY:AUTHORITY_UNAVAILABLE` أو `DENY:AUTHORITY_TIMEOUT` |
| PostgreSQL unavailable | `DENY:POSTGRES_UNAVAILABLE` |
| stale/revoked user, session, membership, policy, mapping, lease | reason-specific `DENY` |
| mapping absent/ambiguous | `DENY:MAPPING_ABSENT` أو `DENY:MAPPING_AMBIGUOUS` |

لا retry يختار tenant أخرى، ولا failure يحول إلى role عامة.
