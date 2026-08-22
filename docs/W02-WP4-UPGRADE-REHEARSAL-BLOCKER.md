# BLOCKER — W02-WP4-UPGRADE-REHEARSAL

## Root Cause

نجحت migration الرسمية من قاعدة pre-WP4 عند `e6b5c48` إلى WP4، لكن مرحلة `analyze` لعقد backfill في `d4092fe` رفضت Donations الصحيحة في fixture A/B. يفحص العقد `Donation` مقابل `Donor/Campaign/Project` الحاليين قبل أي كتابة؛ ولأن كل root records legacy لا تملك `organizationId` قبل backfill، صنف Donations على أنها `ORPHAN_RECORD` رغم أن manifest يعيّن donation والأبوين صراحةً إلى المنظمة نفسها.

## Evidence

| الدليل | النتيجة |
|---|---|
| pre-WP4 migration chain | 7 migrations حتى `20260822130000_w02_wp3_instance_identity` |
| fixture | 20 root records، سجلان لكل root family لمنظمتي A/B، بلا tenant columns قبل WP4 |
| official WP4 migration | نجحت على `asas_w02_wp4_rehearsal_1` |
| analyze | `total=20`, `mapped=18`, `orphan=2`, `unexpectedNull=2` |
| blocker records | `rehearsal-donation-a` و`rehearsal-donation-b` |

لم تنفذ apply، ولم تُكتب أي `organizationId` في rehearsal #1 بعد ظهور blocker.

## Impact

لا يصح إعلان WP4 complete أو متابعة rehearsal #2 أو WP5. المشكلة ليست في migration؛ إنها في ترتيب/semantic عقد backfill الحالي، الذي لا يستطيع معالجة parent وchild legacy owners معاً مع بقائه fail-closed.

## Safe Remediation

يلزم نطاق إصلاح محدود جديد لعقد backfill فقط. يجب أن يحلل manifest كـownership graph: يتحقق أولاً من أن mapping الأب والابن الصريحين متسقان، ثم يسمح بتطبيق roots والأبناء في transaction مرتبة (parents قبل donations)، ويستمر في رفض parent غير المعيّن أو المختلف أو غير الموجود. لا يجوز تخفيف check إلى fallback، ولا تطبيق جزء من البيانات يدوياً، ولا تعديل migration التاريخية.

## Exact Scope Required

`W02-WP4-BACKFILL-OWNERSHIP-GRAPH-FIX`: تعديل analyze/apply وHarness فقط لإثبات parent-child explicit mapping في transaction واحدة، مع استمرار رفض orphan/conflict الحقيقيين. بعد اعتماده يعاد rehearsal #1 من قاعدة مستقلة جديدة؛ لا تستأنف القاعدة الحالية.
