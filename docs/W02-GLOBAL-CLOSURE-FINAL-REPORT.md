# W02 — Global Closure Final Report

## الملخص التنفيذي

**حالة هذا التقرير التاريخية مُستبدلة بتفويض الإغلاق الداخلي النهائي.** راجع [`W02-INTERNAL-GLOBAL-CLOSURE-FINAL.md`](./W02-INTERNAL-GLOBAL-CLOSURE-FINAL.md): WP6–WP9 وfail-closed export boundary نُفذت داخلياً مع evidence؛ يبقى فقط POST-W02 External Deployment Readiness ولا يمنع `W02 COMPLETE — INTERNAL / CODE & ARCHITECTURE`.

## مصفوفة النطاق النهائي

| النطاق | القرار | حد الدليل |
|---|---|---|
| Broker، Users/Memberships، Queue/Redis، Storage/Root Documents | `COMPLETE AUDIT RUNTIME` ضمن نطاقاته السابقة | لا يفتح quarantines product/control-plane |
| Donor/Donation/Campaign/Project/Invoice/Communication | `PASS LOCAL ISOLATED RLS` | Wave2: FR01–FR15، role-OID/`session_user`، A/B وchildren وcleanup=0 |
| Budget/Expense | `PASS LOCAL ISOLATED RLS` | Wave3: BE-R01–BE-R12، A/B وforeign parent وrotation/parallel وcleanup=0 |
| Financial migration/recovery | `PASS LOCAL ISOLATED` | MGR-F01–MGR-F10: pristine، pre-Wave2 upgrade، A/B، recovery عبر disposal/rebuild الرسمي |
| Portability | `PASS LOCAL ISOLATED` | PORT-R01–PORT-R06: snapshot، frozen install بلا dependency lifecycle، Prisma/typecheck/RLS smoke/build |
| Dashboard المختلط | `QUARANTINED SEPARATE SCOPE` | لا يدخل في claim موجتي Financial RLS |
| WP6–WP9 وreport export | `OPEN INTERNAL / OWNER CONTRACTS` | ADRs design-only؛ لا Vault/Privacy/Activation/IdP/export runtime evidence |
| DT01–DT06 provider/HA/DR/scale | `BLOCKED EXTERNAL` | لا توجد target-like topology أو owner evidence |

## المعمارية الأمنية وFinancial Ownership

المسار authoritative هو **TenantContext → policy → TenantAccessBroker lease أحادي الاستعمال → TenantBoundPrismaExecutor → tenant PostgreSQL LOGIN → `session_user` → protected role-OID map → FORCE RLS**. لا توجد Raw GUC أو `current_setting`/`set_config` كهوية، ولا client organization ID كسلطة، ولا first/default membership fallback، ولا global DB credential أو owner/superuser/`BYPASSRLS` في tenant runtime evidence.

تطبق Wave2 `FORCE RLS` على Donor/Campaign/Project/Donation وعلى الأبناء المرتبطين. وتطبق Wave3 على Budget/BudgetItem/Expense. rows ذات root `NULL` أو role غير mapped أو parent أجنبي تفشل مغلقاً؛ لم ينفذ backfill تخميني أو default-tenant assignment.

## Migration، Regression، Cleanup وPortability

rehearsal المالية نشر migrations رسمية على قاعدة pristine، ثم صنع baseline pre-Wave2 في نسخة مؤقتة، ثم طبق Wave2/Wave3 forward-only، واختبر RLS A/B، ثم أتلف قاعدة audit وأعاد بناءها رسمياً كـ**forward-safe recovery**. هذا ليس rollback لإنتاج ولا وعداً بقدرة restore provider. جميع databases والأدوار disposable حُذفت وresidueCount=0.

Regression النهائي مر باستخدام Prisma URL placeholder محلي بلا credentials ولا اتصال بقاعدة production: Prisma validate/generate، TypeScript، Jest (**19 passed suites، 1 skipped؛ 98 passed tests، 1 skipped**)، communications، production build وaudit hygiene. بقيت تحذيرات البناء غير الحاجبة القائمة سابقاً خارج نطاق W02، ومنها Prisma package-config deprecation وoptional BullMQ Valkey وNext middleware/Edge `process.cwd`.

| Evidence | المسار |
|---|---|
| Financial Wave2 runtime | `docs/evidence/W02-RLS-WAVE2-FINANCIAL-EVIDENCE.json` وvalidator المرافق |
| Financial Wave3 runtime | `docs/evidence/W02-RLS-WAVE3-BUDGET-EXPENSE-EVIDENCE.json` |
| Migration rehearsal | `docs/evidence/W02-FINANCIAL-MIGRATION-REHEARSAL-EVIDENCE.json` |
| Portability rehearsal | `docs/evidence/W02-PORTABILITY-REHEARSAL-EVIDENCE.json` |

كانت كل evidence أعلاه بصلاحية `0600` وقت التحقق المحلي ولا تحتوي credentials أو URLs أو names للأدوار. **Git يحفظ محتوى الملفات لا mode `0600`**؛ لذلك يجب على أي checkout جديد تنفيذ `chmod 600 docs/evidence/W02-*.json` قبل تشغيل validators ذات mode check. لا ينشئ ذلك secret-management claim لأن artifacts نفسها خالية من الأسرار. راجع كذلك [عقد portability](./W02-DEPLOYMENT-PORTABILITY-CONTRACT.md) و[مصفوفة البوابات](./W02-FINAL-CLOSURE-REMAINING-GATES.md).

## المتطلبات الداخلية والخارجية الدنيا

قبل أن يصبح DT01–DT06 العائق الوحيد، يلزم إغلاق scopes W02 الداخلية أو إعادة اعتماد حدودها رسمياً: Vault/secret runtime مع KMS capability، privacy/retention/legal-hold/export policy من Data Owner، activation issuer/control-plane contract، وIdP provider framework/sandbox/UAT contract. لا يحق للتنفيذ اختلاق هذه السياسات أو credentials أو issuer.

يلزم deployment owner توفير **target-like non-production** مملوك له يحوي PostgreSQL tenant-role provisioning وprotected mapping، workload identity/opaque credential resolver، pool settings وhealth/failover، backup/restore exercise، capacity/scale limits وrunbooks. عندها فقط تُنفذ DT01–DT06؛ لا يحق لهذا التقرير أن يحوّل audit host المحلي إلى دليل provider أو HA/DR أو RPO/RTO.

## قرار المتابعة

لا يُعلَن `W02 COMPLETE — READY FOR W03` قبل إغلاق scopes WP6–WP9/report export وفق عقود المالكين، ثم مرور DT01–DT06 على البيئة المذكورة. لا يلزم فتح production أو مشاركة أسرار عبر المحادثة.
