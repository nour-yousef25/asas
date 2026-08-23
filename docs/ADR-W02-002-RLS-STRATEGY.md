# ADR-W02-002 — Phased PostgreSQL RLS Strategy

**Gate:** G-W02-2
**الحالة:** `SUPERSEDED IN PART — IDENTITY SECTION REPLACED BY ADR-W02-009`
**المالك:** Architecture Owner وDBA/Operations Owner.

## Decision

يعتمد W02 RLS تدريجياً بعد اكتمال tenant conversion لكل table family. تستخدم implementation المستقبلية tenant-bound PostgreSQL login principal غير مالك للجداول ولا يملك `BYPASSRLS`، وتقرأ policies organization من protected role-OID mapping لـ`session_user` وفق ADR-W02-009. **لا تستخدم** `set_config` أو `current_setting` أو custom GUC كمرساة tenant identity. تفعّل `FORCE ROW LEVEL SECURITY` فقط بعد نجاح negative tests. لا تفعّل RLS على schema كامل أو على tables غير migrated دفعة واحدة.

## Rollout and Recovery

الترتيب: expand tenant keys → backfill verified → repository/API cutover → broker/tenant-login lifecycle evidence → shadow/direct-query negative tests → enable RLS على family → FORCE RLS. rollback التشغيلي قبل FORCE هو تعطيل policy/family في migration forward محددة بعد إيقاف write path؛ لا تستخدم rollback يعيد كتابة migrations. إذا غاب authenticated tenant principal أو protected mapping تكون القراءة/الكتابة مرفوضة، لا global fallback.

## Security, Operational and Test Requirements

يمنع هذا owner bypass وdirect unscoped query. يتطلب app DB role مخصصاً لا يملك table ولا `BYPASSRLS`، وmigration owner منفصلاً. الاختبارات: org A/B direct query، transaction بلا setting، owner/app role distinction، join children، pagination/export، وfailure recovery. الدليل WP0 هو القرار فقط؛ لا RLS أو database role أنشئ في WP0.
