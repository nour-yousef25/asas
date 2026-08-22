# W02 WP5-0 — Clean Baseline and Current Scope Inventory

**الحالة:** `WP5-0 COMPLETE — READY FOR WP5-1`

## Canonical Baseline

تم إنشاء branch/worktree نظيفين باسم `w02-wp5-restart` من commit `e3968d3` في `w02-wp4-backfill-contract-fix`. التحقق أعاد SHA نفسه و`BASELINE_MATCH=YES`. بقي branch/worktree القديم `w02-wp5` دون تغيير عند `72a170d`، مع التغييرات غير المثبتة التالية محفوظة كما هي: تعديل `beneficiaries/route.ts` و`W02-WP4-FINAL-REPORT.md` و`todo.md` وملف `beneficiary-repository.ts` الجديد. لم تُدمج أو تُحذف أو تُستبدل.

## Inventory Result

سجل الجرد 44 API routes، و197 موضع Prisma ضمن `src`، و27 route ذات Prisma مباشر، وrouteين فقط ذوي استعمال TenantContext. رصد 192 ملفاً ذا صلة محتملة بـqueue/cache/files/reports/communications، وrepository contract واحداً دون domain cutover مكتمل. التفاصيل والتصنيف في `W02-WP5-0-CURRENT-SCOPE-INVENTORY.md` و`W02-WP5-0-SCOPE-MATRIX.md`.

| أعلى المخاطر | سبب الأولوية |
|---|---|
| Beneficiary وDocuments | PII، IDOR، وfile reference boundaries |
| Donor وDonation وCampaigns | بيانات مالية وعلاقات parent/child |
| Reports وExports | disclosure جماعي خارج tenant |
| Users وMemberships | privilege/membership escalation |
| Communications وQueue/Redis | tenant envelope وcache/replay risks |

## Regression Baseline

نجح `prisma validate` و`prisma generate` وTypeScript وJest (71 PASS، 1 skipped) وcommunications وproduction build. لا توجد dependencies أو environment أو migrations جديدة. بقيت تحذيرات البناء المعروفة الخاصة بـBullMQ Valkey الاختياري وNext middleware/Edge مسجلة دون إخفاء أو remediation خارج النطاق.

## Blockers and Next Gate

لا يوجد blocker يمنع WP5-1. لكن WP5-1 لا يبدأ تلقائياً: الجرد يثبت وجود direct Prisma عالي المخاطر وroutes غير scoped يجب تحويلها وفق ترتيب WP5 المعتمد. لا يبدأ WP6 ولا يعلن WP5 أو W02 مكتملين من هذا التقرير.
