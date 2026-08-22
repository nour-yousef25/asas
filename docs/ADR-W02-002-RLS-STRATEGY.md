# ADR-W02-002 — Phased PostgreSQL RLS Strategy

**Gate:** G-W02-2
**الحالة:** `CLOSED — DESIGN DECISION`
**المالك:** Architecture Owner وDBA/Operations Owner.

## Decision

يعتمد W02 RLS تدريجياً بعد اكتمال tenant conversion لكل table family. يستخدم التطبيق production role غير مالك للجداول، ويضع `app.organization_id` و`app.membership_id` عبر `set_config(..., true)` داخل transaction فقط. تستخدم policies `current_setting('app.organization_id', true)` مع UUID/text validation مناسبة، وتفعل `FORCE ROW LEVEL SECURITY` بعد نجاح negative tests. لا تفعّل RLS على schema كامل أو على tables غير migrated دفعة واحدة.

## Rollout and Recovery

الترتيب: expand tenant keys → backfill verified → repository/API cutover → shadow/direct-query negative tests → enable RLS على family → FORCE RLS. rollback التشغيلي قبل FORCE هو تعطيل policy/family في migration forward محددة بعد إيقاف write path؛ لا تستخدم rollback يعيد كتابة migrations. إذا غاب context داخل transaction تكون القراءة/الكتابة مرفوضة، لا global fallback.

## Security, Operational and Test Requirements

يمنع هذا owner bypass وdirect unscoped query. يتطلب app DB role مخصصاً لا يملك table ولا `BYPASSRLS`، وmigration owner منفصلاً. الاختبارات: org A/B direct query، transaction بلا setting، owner/app role distinction، join children، pagination/export، وfailure recovery. الدليل WP0 هو القرار فقط؛ لا RLS أو database role أنشئ في WP0.
