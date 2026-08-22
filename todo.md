# متابعة تنفيذ W01 — ASAS Plus

- [ ] استخراج جميع الميزات المصنفة `Wave = W01` من Master Feature Inventory v1.1 وربطها بالـADRs وWave Mapping.
- [ ] تدقيق بنية Canonical Baseline الحالية وتحديد نقاط التوسع الفعلية دون إنشاء معمارية موازية.
- [ ] تنفيذ `FND-001` وفق تعريفه المعتمد، مع اختبارات وعقد استخدام قابل لإعادة الاستعمال.
- [ ] تنفيذ `FND-002` وفق تعريفه المعتمد، مع توثيق وعقد تكوين آمن.
- [ ] تنفيذ `OBS-001` للمراقبة والسجلات الآمنة والارتباط التشخيصي حسب التعريف المعتمد.
- [ ] تنفيذ `DEP-001` و`DEP-002` لدعم Cloud وDedicated وSelf-Hosted من نواة واحدة.
- [ ] تنفيذ `INST-001` و`INST-002` كأساس مثبت حقيقي دون قفز إلى المثبت التجاري الكامل.
- [ ] تنفيذ `UPDATE-001` و`UPDATE-002` كأساس تحديث آمن وقابل للتدقيق.
- [ ] تنفيذ `BACKUP-001` كأساس نسخ احتياطي واستعادة قابل للاختبار.
- [ ] تنفيذ `HEALTH-001` بفئات HEALTHY وDEGRADED وUNAVAILABLE وNOT_CONFIGURED.
- [ ] إضافة اختبارات W01 وتشغيل فحص الأنواع والبناء وحزمة الاختبارات.
- [ ] إصدار تقرير إكمال W01، وإنشاء commit ورفع الفرع للمراجعة دون تنفيذ أي عناصر من W02 وما بعدها.

## W01-SCHEMA-MIGRATION-CONSISTENCY-FIX

- [x] إعداد Dependency Map كامل لمسار `Schema → Migration → Database → Prisma Client → Seed → Application` للكيانات `User` و`Role`.
- [x] فحص تاريخ Git ومقارنة `User.role` و`User.roleId` وتحديد التصميم النهائي المدعوم بالأدلة.
- [x] توثيق Root Cause قبل تغيير أي migration أو schema أو عقد تطبيق.
- [x] اختيار Forward Migration محدود وغير مدمر بعد إثبات عدم تطابق schema الحالية مع التاريخ القانوني للمigrations.
- [x] إصلاح أقل طبقة لازمة عبر migration تقدمية دون إعادة كتابة migrations تاريخية أو تغيير عقد التطبيق القانوني.
- [x] إعادة إنشاء قاعدة التدقيق `asas_w01_audit` فقط وتطبيق جميع migrations من الصفر.
- [x] التحقق من Prisma Client وDatabase Schema والبذر الرسمي وSmoke Test على قاعدة التدقيق.
- [x] تدقيق جميع مراجع `role` و`roleId` وتشغيل الاختبارات وTypeScript وبناء الإنتاج.
- [x] إصدار تقرير `W01 Schema/Migration Consistency Fix Report` وإنشاء commit منفصل واضح للمراجعة.

## W01 RESUMPTION & CLOSURE

- [ ] قراءة مراجع W01 الرسمية وإنشاء W01 Closure Matrix بمتطلبات القبول والأدلة والفجوات.
- [ ] تدقيق Canonical Git baseline والفرع الحالي وقياس أدلة البناء والاختبارات وقاعدة التدقيق.
- [ ] التحقق الفعلي من المصادقة والتفويض والجلسات والمسارات المحمية وضوابط API وRate Limiting.
- [ ] التحقق الفعلي من عزل الجمعيات عبر سيناريو جمعيتين ومنع القراءة والكتابة عبر ID manipulation حيث يدخل ذلك ضمن W01.
- [ ] التحقق الفعلي من Redis والطوابير والعمال وحالات الفشل وHealth Center دون نجاحات محاكاة.
- [ ] التحقق الفعلي من Object Storage والتحكم بالوصول أو إثبات مانع البنية الخارجية وفق متطلبات W01.
- [ ] إثبات دورة Backup وRestore كاملة على قاعدة تدقيق مستقلة والتحقق من البيانات بعد الاستعادة.
- [ ] فحص npm audit والتحذيرات وأثرها وفق نطاق W01 دون تحديثات قسرية عمياء.
- [ ] تشغيل Production Readiness Matrix الكاملة: clean install وGenerate وValidate وmigrations وseed والاختبارات وbuild وruntime.
- [ ] إعداد W01 Final Completion Report مع Closure Matrix وقرار ثنائي `W01 COMPLETE` أو `W01 BLOCKED`.
- [ ] إعداد W02 Readiness Note فقط بعد إغلاق W01، دون تنفيذ أي عنصر W02.

## W01-REDIS-BULLMQ-WORKER-CONSISTENCY-FIX

- [ ] إنشاء Dependency Map لمسار Redis Configuration → ioredis → BullMQ Queue → Worker → Job → Database → Heartbeat → Health Center.
- [ ] تدقيق إصدارات BullMQ وioredis والـlockfile وجميع factories وimports وخيارات الاتصال وسكربتات العامل.
- [ ] توثيق Root Cause الدقيق وخيار الفصل الصحيح بين Producer وWorker وQueueEvents قبل أي تعديل.
- [ ] تطبيق إصلاح اتصال Redis في الموضع المعماري الصحيح دون تعطيل Queue أو Worker أو تغيير إصدارات الحزم بلا دليل.
- [ ] إضافة اختبار تكامل حقيقي عبر Redis وقاعدة التدقيق لإثبات Job → Worker → Database → completed.
- [ ] إثبات Retry فعلي آمن وحالة failed/success وعدم ترك بيانات اختبار غير مرغوبة.
- [ ] إثبات heartbeat حقيقي وRedis/Queue/Worker Health في الحالات السليمة والفاشلة.
- [ ] تحليل تحذير `@valkey/valkey-glide` وتسجيل أثره على مسار ioredis المستخدم.
- [ ] تشغيل اختبارات Redis/Worker وJest الكامل وTypeScript وProduction Build.
- [ ] إنشاء تقرير W01 Redis/BullMQ Worker Fix Report وتثبيت commit واضح للمراجعة.

## W01-REDIS-BULLMQ-INTEGRATION-HARNESS

- [ ] تأكيد إصدارات BullMQ وioredis وtsx وtsconfig ومخطط Prisma وعقود Redis/Queue/Worker/Health قبل كتابة الـHarness.
- [ ] إنشاء `scripts/w01-redis-bullmq-integration.ts` مستقل عبر `tsx` دون تعديل إعداد Jest أو استخدام mock.
- [ ] إضافة أمر `npm run test:w01:redis` لتشغيل الـHarness فقط مع Preconditions صريحة وإشارات خروج صحيحة.
- [ ] إثبات Redis وDatabase وQueue وWorker وJob وDatabase effect وcompletion على قاعدة التدقيق الحقيقية.
- [ ] إثبات Retry حقيقي آمن وHeartbeat مخزن في Redis وإغلاق رشيق لكل الاتصالات.
- [ ] تنفيذ Failure Injection آمن لـRedis وWorker وتوثيق عدم ظهور حالة Health زائفة.
- [ ] حفظ سجل Evidence قابل لإعادة الإنتاج وإصدار تقرير HARNESS PASS أو HARNESS BLOCKED فقط.
- [ ] تشغيل Jest الحالي دون تعديل وTypeScript وProduction Build وتثبيت commit واضح على `w01-foundation`.

## W01-QUEUEEVENTS-REDIS-CONNECTION-FIX

- [ ] تثبيت Redis Role Matrix للـProducer والـWorker والـQueueEvents وفق BullMQ 6.1.2 وioredis 5.11.1.
- [ ] التحقق من جميع BullMQ usages وconnections وعدم وجود QueueScheduler أو event listener أو factory إضافي غير محسوب.
- [ ] تعديل factory `createQueueEventsRedisConnection()` فقط ليستخدم الاتصال blocking الصحيح دون تغيير Producer.
- [ ] إعادة إثبات Producer وWorker وNotification database effect قبل الانتقال إلى Retry.
- [ ] إثبات QueueEvents وwaiting/active/failed/completed وRetry وattempt count على Redis وقاعدة التدقيق الحقيقية.
- [ ] اختبار Health وحالات Redis/Worker/QueueEvents الفاشلة والإغلاق الرشيق وعدم تسرب العمليات.
- [ ] تشغيل Jest غير المعدل وTypeScript وProduction Build وحفظ Evidence وتقرير `QUEUEEVENTS FIX VERIFIED` أو `QUEUEEVENTS FIX BLOCKED`.

## W01-HARNESS-FAILURE-DETECTION-CLEANUP-FIX

- [x] استخراج تردد heartbeat وTTL وسياسة Health الحالية وتوثيق مراحل Current → Stale → Worker failure.
- [x] إنشاء process group حقيقي للعامل داخل الـHarness وإيقافه بـSIGTERM ثم التحقق من انتهاء المجموعة قبل أي fallback موثق.
- [x] ضمان حفظ Evidence قبل cleanup وإتمامه حتى إذا وقع Exception أو timeout، مع تسجيل حالة cleanup.
- [x] التعامل مع Redis failure injection كفشل متوقع دون unhandled error event أو إخفاء نتيجة الاختبار.
- [x] إعادة إنشاء قاعدة التدقيق وتشغيل الـHarness من بيئة Redis وPrisma نظيفة.
- [x] إثبات توقف heartbeat وHealth worker غير السليم وRedis failure والإغلاق الرشيق وعدم تسرب عمليات.
- [x] إنشاء تقرير Harness Failure Detection/Cleanup Fix؛ يبقى إنشاء commit ورفع الفرع ضمن مرحلة التثبيت التالية.

## W01 FINAL CLOSURE REVIEW

- [x] تثبيت baseline `w01-foundation` عند `4db083b` وتأكيد نطاق W01 فقط؛ الشجرة تحتوي توثيق المراجعة الجاري فقط.
- [x] استخراج معايير قبول W01 الرسمية من Master Blueprint وFeature Inventory وADRs وWave Mapping دون إدخال نطاق موجات لاحقة.
- [x] استكمال Closure Matrix بالحقول: ID، requirement، acceptance criteria، evidence، test، status، risk، remaining gap، decision.
- [x] تدقيق Evidence الفعلي للـruntime وRedis وQueue وWorker وHealth، وتوثيق `EXPECTED AUDIT-ENVIRONMENT DEGRADATION`.
- [x] تدقيق Foundations الخاصة بالنشر والأمان والتحديث والنسخ الاحتياطي والتحذيرات وفق W01 فقط، دون إصلاح إنتاجي.
- [x] تصنيف الفجوات والبنود المؤجلة والتحذيرات وقرار `W01 PARTIAL — SPECIFIC ITEMS REMAIN`.
- [x] إعداد `W01-FINAL-CLOSURE-REPORT` وتحديث الوثائق؛ يبقى commit مراجعة واضح على `w01-foundation` بعد مراجعة النص النهائي.

## W01 FINAL REMAINING ITEMS EXECUTION

- [x] تثبيت بيئة التدقيق المعزولة وخطة Evidence للبنود DEP-001 وDEP-002 وINST-002 وBACKUP-001 وUPDATE-002 دون استخدام Production أو mocks.
- [x] إنشاء Deployment Support Matrix وTopology وRunbook تتضمن App وWorker وPostgreSQL وRedis وStorage وBackup وScheduler وTLS وEgress عبر Cloud/Dedicated/Self-Hosted.
- [x] إنشاء DEP-002 Data Inventory وAPI Boundary Contract وRetention Contract وPrivacy/Threat Boundary Note، من دون نقل بيانات فعلية إلى Control Plane.
- [x] تشغيل Preflight read-only على topology تدقيق حقيقي وتسجيل حالات Node/PostgreSQL/Redis/Storage/Scheduler/Egress/TLS/Resources مع Evidence.
- [x] إنشاء Backup artifact حقيقي لقاعدة `asas_w01_audit` في audit storage والتحقق من checksum وprovider وencryption/ownership/retention وربط evidence بـHealth.
- [x] تنفيذ rehearsal تحديث حقيقي داخل audit environment يربط artifact موقّعاً وverified backup وmigration آمنة وHealth وفشل/recovery evidence.
- [x] إعادة TypeScript وJest وCommunications وProduction Build وRuntime Harness وHealth checks بعد التنفيذ ومنع أي regression.
- [x] تحديث Closure Matrix وتقرير `W01-FINAL-CLOSURE-REPORT-v2`؛ يبقى commit ورفع النتيجة كخطوة التثبيت الأخيرة دون بدء W02.

## W02 PRE-EXECUTION ARCHITECTURAL READINESS REVIEW — ANALYSIS ONLY

- [x] تثبيت baseline `w01-foundation` عند `308ae82` وتأكيد حظر تعديل production code وdatabase/migrations/packages/environment وبدء W02.
- [x] استخراج جميع Features W02 من Master Feature Inventory مع الحالة والاعتماديات والمخاطر ومعايير القبول والاختبارات واعتماديات الموجات.
- [x] تدقيق المصدر والـPrisma schema والمigrations والاختبارات الحالية لكل Tenant/IAM/Identity/Privacy/Vault/Storage/Audit/Configuration/Installation relevant surface.
- [x] تصميم قرار Organization/Tenant وعقود Membership/Role/Permission/Context وtenant isolation دفاعي متعدد الطبقات.
- [x] تصميم IAM وIdP framework وPrivacy/Vault/Storage Security/Audit contracts، مع توافق Cloud/Dedicated/Self-Hosted وعدم تنفيذ Nafath أو Licensing.
- [x] مراجعة قاعدة البيانات وRedis/Queue/Cache وتهديدات الأمن وخطة الاختبارات وعقود migration المستقبلية من دون تعديل schema أو migration.
- [x] كتابة `W02-PRE-EXECUTION-ARCHITECTURAL-READINESS-REPORT` و`W02-IMPLEMENTATION-PLAN` وقرار `READY TO START W02 SUBJECT TO PLAN ACCEPTANCE` فقط؛ لا يبدأ W02 قبل اعتماد المالك.

## W02-WP0 ARCHITECTURE GATES — DOCUMENTATION ONLY

- [x] إنشاء فرع `w02-wp0` من baseline `w01-foundation` وتأكيد أن النطاق وثائقي فقط بلا runtime/schema/migration/database/package/environment changes.
- [x] إغلاق وتوثيق ADRs للبوابات G-W02-1 إلى G-W02-8، مع Decision وOwner وDependencies وSecurity/Operational/Migration Impact وTest Requirement وEvidence.
- [x] إنشاء W02-WP0 Permission Catalog رسمي يحدد purpose/resource/action/risk/SoD/default role/audit لكل permission مطلوب.
- [x] إنشاء W02-WP0 Legacy Mapping Spec لكل root aggregate، مع mapping source وambiguity/orphan stop conditions وbackfill success criteria وcomposite uniqueness.
- [x] إنشاء W02-WP0 Threat Assumptions وDecision Register وGate Matrix، وتسجيل عدم وجود conflict مانع بصيغة موثقة.
- [x] إنشاء W02-WP0 Final Report؛ التحقق النهائي من عدم تغير أي production artifact وcommit/رفع الفرع في المرحلة التالية.
- [x] إنشاء commit واحد `docs(w02): establish wp0 architecture gates and decision contracts` ورفع `w02-wp0` دون دمج أو بدء WP1.

## W02 FULL EXECUTION — WP1 TO WP10

- [x] قراءة أمر التنفيذ كاملاً وتثبيت فرع التنفيذ وbaseline وقواعد migrations وblocker protocol قبل WP1.
- [x] تنفيذ وإغلاق WP1: Tenant Context وauthorization kernel وmembership/session/policy versioning وcross-tenant evidence.
- [x] تنفيذ وإغلاق WP2: IAM data model وpolicy evaluator وSoD وplatform support boundary.
- [x] تنفيذ وإغلاق WP3: instance identity وidentity audit وtamper/duplicate/restore evidence.
- [ ] تنفيذ وإغلاق WP4: migrations توسعية وlegacy backfill auditable على قواعد تدقيق clean/upgrade فقط. **BLOCKED: upgrade rehearsal missing.**

## W02-WP5-0 — CLEAN BASELINE + CURRENT SCOPE INVENTORY ONLY

- [x] إنشاء `w02-wp5-restart` من `e3968d3` في worktree نظيف، والتحقق أن `w02-wp5` القديم لم يتغير.
- [x] جرد repositories/routes/actions/Prisma/jobs/queues/cache/reports/exports/files/schedules والعمليات غير scoped.
- [x] تسجيل baseline Prisma/TypeScript/Jest/communications/build من دون تعديل environment أو packages أو migrations.
- [x] إعداد Inventory Report وScope Matrix وتسجيل blockers؛ التوقف دون WP5-1.

## W02-WP5-1 — TENANT CONTEXT ENFORCEMENT ONLY

- [x] تدقيق عقد TenantContext الحالي والمسارات والـfallbacks والمستدعين دون تعديل.
- [x] توثيق canonical contract وresolution flow وsecurity boundary وpolicy snapshot/correlation behavior.
- [x] توحيد boundary server-side وإزالة fallback آمن فقط إن وجد ضمن النطاق، بلا تحويل repositories/routes.
- [x] إثبات unauthenticated/no-membership/disabled/revoked/stale/spoofing/switching/A-B/ audit negatives على قاعدة تدقيق.
- [x] تشغيل Prisma/TypeScript/Jest/communications/build وتقرير WP5-1؛ التوقف دون WP5-2.

## W02-WP5-2 — REPOSITORY/API CUTOVER ONLY

- [x] تدقيق baseline/source واختيار Beneficiary/Documents وDonor/Donation/Campaign كنطاق أولي أو توثيق blocker.
- [x] إعداد تصميم repository/API cutover ومصفوفة اختبار العزل والعلاقات/search/pagination.
- [x] تحويل repositories والمسارات المختارة إلى TenantContext → policy → repository دون Prisma مباشر حساس.
- [x] تشغيل دليل A/B وIDOR/read/write/delete/relation/search/pagination/audit حقيقي على قاعدة تدقيق.
- [x] تشغيل regression والتقرير النهائي؛ لا RLS ولا WP5-3 قبل القرار.

## W02-WP4-BACKFILL-CONTRACT-FIX — ONLY SCOPE

- [x] تدقيق `runLegacyTenantBackfill` ومستدعيه والعلاقات/fixtures والمصدر الفعلي، مع تسجيل Git state.
- [x] توثيق اختيار manifest صريح قابل للمراجعة بدلاً من أي default organization أو bulk assignment.
- [x] تنفيذ مرحلتي analyze/apply fail-closed مع counters وأخطاء تشخيصية وtransaction واحدة للـapply.
- [x] بناء fixture حقيقية لمنظمتي A/B واختبار mapped/unmapped/orphan/ambiguous/conflict/invalid-reference/no-write/atomicity.
- [x] إثبات اختبار سلبي يمنع تعيين سجل B إلى A، ثم Prisma/TypeScript/backfill/W02 regression وإصدار التقرير النهائي.
- [x] التوقف عند `W02-WP4-BACKFILL-CONTRACT-FIX COMPLETE`؛ لا Upgrade Rehearsal ولا WP5 تلقائياً.

## W02-WP4-UPGRADE-REHEARSAL — ONLY SCOPE

- [ ] تدقيق commit `d4092fe` وسلسلة migrations والوثائق وتقارير WP4 وحالة Git قبل أي قاعدة تدقيق.
- [ ] إنشاء قاعدتي تدقيق مستقلتين pre-WP4 عبر migrations الرسمية حتى WP3، مع fixture A/B وevidence قبل الترقية.
- [ ] ترقية كل قاعدة عبر migration WP4 الرسمية فقط، والتحقق من schema/migration history/counts/constraints. **BLOCKED: Donation ownership graph cannot be analyzed before mapped parents are applied.**
- [ ] تشغيل analyze ثم apply لعقد backfill المصلح، وتدقيق ownership/data integrity/A-B isolation والـrollback.
- [ ] مقارنة rehearsal #1 و#2، وتشغيل regression وحزمة evidence وإصدار قرار WP4 فقط؛ لا WP5.

## W02-WP4-UPGRADE-REHEARSAL — RESTART AT a53c171

- [ ] تدقيق commit `a53c171` وسلسلة migrations والعقود والتقارير وحالة Git قبل إنشاء قواعد التدقيق الجديدة.
- [x] تنفيذ Rehearsal #1 من migrations الرسمية حتى WP3 ثم fixture A/B ثم WP4 upgrade وownership-graph analyze/apply/audit.
- [x] إثبات العزل A/B والـforeign keys والـrow/null counts وfailure rollback على قاعدة التدقيق الأولى.
- [x] تنفيذ Rehearsal #2 مستقلاً بالكامل ومقارنة evidence بالتجربة الأولى.
- [x] تشغيل Prisma/TypeScript/Jest/communications/build وإصدار Evidence Pack وقرار WP4 دون WP5.

## W02-WP4-BACKFILL-OWNERSHIP-GRAPH-FIX — ONLY SCOPE

- [x] تدقيق مصدر backfill وعقد Donation/Donor/Campaign/Project والـfixtures والتغييرات غير المثبتة.
- [x] توثيق ownership graph المبني على manifest الصريح، مع تعريف orphan/conflict وحدود عدم الاستنتاج.
- [x] تنفيذ analyze graph-aware وترتيب apply parents قبل Donation داخل transaction واحدة.
- [x] إثبات A/B positive وmissing-parent/conflict/unmapped/reversed-manifest/rollback negative tests.
- [x] تشغيل Prisma/TypeScript/Harness/regression وتوثيق الإصلاح، ثم التوقف دون Upgrade Rehearsal أو WP5.
- [ ] تنفيذ وإغلاق WP5: repository/API cutover وRLS مرحلي وnegative direct-query evidence.
- [ ] تنفيذ وإغلاق WP6: vault/secret records وprivate object storage وsigned URLs وvalidation/quarantine.
- [ ] تنفيذ وإغلاق WP7: privacy classification/purpose/retention/legal hold/DSAR/export وAudit V2.
- [ ] تنفيذ وإغلاق WP8: signed license certificate verification وactivation core وreplay/rate-limit evidence.
- [ ] تنفيذ وإغلاق WP9: provider-neutral IdP framework وsandbox/production/state/mapping/rotation contracts.
- [ ] تنفيذ وإغلاق WP10: hardening وfull migration/runtime rehearsal وW02 closure matrix/release gates.
- [ ] التوقف عند أي conflict أو security/data/migration blocker وتسجيل CONFLICT ID والدليل والأثر والقرار المطلوب؛ لا يبدأ W03.
