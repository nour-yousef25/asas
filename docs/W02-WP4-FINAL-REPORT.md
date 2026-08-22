# W02 WP4 — Tenant Keys and Legacy Backfill Final Report

**الحالة:** `BLOCKED — independent upgrade rehearsal pending`
**الفرع:** `w02-wp4`
**الحد:** توسعة nullable وbackfill auditable فقط؛ لا `NOT NULL` أو composite uniqueness hardening أو RLS أو API cutover في WP4.

## Summary

أضاف WP4 `organizationId` nullable مع FK وفهرس إلى root aggregates عالية المخاطر: Beneficiary، Donor، Donation، DonationCampaign، Project، News، Event، Task، Survey وDocument. لا تعدل migration بيانات legacy ولا تعين منظمة افتراضياً. أصلح `W02-WP4-BACKFILL-CONTRACT-FIX` عقد backfill ليستخدم manifest صريحاً وتحليلاً fail-closed؛ راجع تقرير الإصلاح المنفصل. يبقى دليل upgrade المستقل مفقوداً.

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

لا يوجد `W02 WP5 READY`. يجب أولاً إنشاء قاعدة تدقيق pre-WP4، تنفيذ ترقية سلسلة migrations الرسمية مرتين، وتوثيق pre/post integrity والعزل وفق `W02-WP4-UPGRADE-REHEARSAL`.
