# W02 WP4 — Tenant Keys and Legacy Backfill Final Report

**الحالة:** `W02 WP4 COMPLETE`
**الفرع:** `w02-wp4`
**الحد:** توسعة nullable وbackfill auditable فقط؛ لا `NOT NULL` أو composite uniqueness hardening أو RLS أو API cutover في WP4.

## Summary

أضاف WP4 `organizationId` nullable مع FK وفهرس إلى root aggregates عالية المخاطر: Beneficiary، Donor، Donation، DonationCampaign، Project، News، Event، Task، Survey وDocument. لا تعدل migration بيانات legacy ولا تعين منظمة افتراضياً. أداة backfill تتطلب organization موجودة صراحة، وتنفذ dry-run، وترفض orphaned references، وتسجل audit عند apply، وتبقى idempotent عند الإعادة.

## Evidence

تطبيق migrations وgenerate/validate/seed على `asas_w02_wp4_clean` نجح. شغّل Harness حقيقي عند `2026-08-22T09:58:53.401Z`: كشف dry-run أربعة Beneficiaries بلا tenant، طبق mapping صريحاً على أربعة صفوف، تحقق من زوال null للسجل المختبر، أثبت reapply بلا updates، ورفض mapping لمنظمة غير موجودة. لا استخدمت Production DB أو `db push` أو migration rewrite.

## Deferred Hardening

تبقى `NOT NULL` وcomposite uniques وrepository/API cutover وRLS وcross-tenant domain tests لـWP5 بعد inventory كامل وbackfill report ومراجعة Data Owner. لا يعد WP4 أن كل legacy data صارت tenant-safe؛ يثبت فقط آلية توسع ومسار mapping قابل للتدقيق.

## Evidence Index

| الدليل | الموقع |
|---|---|
| Migration | `/tmp/w02-wp4-clean-migrate.log` |
| Backfill Harness | `/tmp/w02-wp4-backfill-evidence.json` |
| Seed | `/tmp/w02-wp4-clean-seed.log` |

## Next WP Readiness

`W02 WP5 READY` لتنفيذ repositories/routes scoped وRLS phased بعد إعادة فحص كل root aggregate وتحويل API inventory. لا يبدأ RLS تلقائياً من هذا التقرير.
