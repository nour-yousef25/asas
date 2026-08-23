# W02 — Member/KPI Runtime Evidence Contract

لا يدمج فرع `w02-member-kpi-cutover-preservation` ولا يعلن readiness قبل مدقق exact يثبت على PostgreSQL disposable: MK01 session_user/Broker/lease consumption، MK02 A/B lists/details، MK03 foreign member IDOR denial، MK04 create member requires explicit active organization membership، MK05 renewal/payment inherits scoped Member owner، MK06 KPI/KPIRecord parent-child cross-tenant denial، MK07 null-owner omission، MK08 stale/revoked/replay denial، MK09 provider outage/rotation/parallel-discard، MK10 source fallback scan/role safety/cleanup/hygiene/regression.

لا تستخدم أي حالة PASS بديلة أو evidence Dashboard/Financial لتغطية هذه المعرفات.
