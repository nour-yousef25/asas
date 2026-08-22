# ADR-W02-003 — Legacy Data Mapping and Backfill Refusal

**Gate:** G-W02-3
**الحالة:** `CLOSED — DESIGN DECISION`
**المالك:** Data Owner وArchitecture Owner.

## Decision

يستخدم W02 mapping table مدقق وصريح لكل legacy root aggregate. لا يستخدم `LEGACY_ORGANIZATION_ID` كافتراض صامت؛ يجوز تمريره فقط كمدخل operator موثق عندما يثبت Data Owner أن dataset بالكامل أحادي المنظمة. كل backfill يبدأ بـ`--dry-run` وينتج counts وunmapped/ambiguous/orphan samples redacted، ثم يحتاج explicit mapping approval قبل write.

## Stop Conditions

توقف migration ولا تعين organization عند: أكثر من candidate صحيح، عدم وجود parent/owner mapping، null key بعد مرحلة backfill، orphan foreign key، أو مخالفة uniqueness المستهدف. لا تنشأ منظمة افتراضية ولا تكتب `organizationId` من أول membership للمستخدم.

## Migration and Test Requirements

تنفذ migrations forward-only: nullable key/index → backfill CLI → validation report → not-null/FK/composite uniqueness. يلزم tests لـdry-run، ambiguity refusal، orphan refusal، idempotency، counts قبل/بعد، وaudit event. الدليل WP0 هو [Legacy Mapping Spec](./W02-WP0-LEGACY-MAPPING-SPEC.md)؛ لا backfill أو migration نفذ في WP0.
