# W02 RLS — Database Tenant Isolation Design

## Contract

يعتمد التصميم الرسمي `Organization` tenant canonical و`TenantContext` server-side. لكل family مكتمل فقط، يمر runtime لاحقاً من Broker إلى tenant-bound PostgreSQL login principal. تستمد policy organization من `session_user` عبر protected role-OID mapping وفق ADR-W02-009. لا تضبط ولا تقرأ policy `app.organization_id` أو `app.membership_id` عبر `set_config/current_setting`. تتعامل policy مع غياب principal/mapping أو عدم تطابقهما باعتباره deny. يستخدم runtime principal غير مالك للجداول وغير حامل لـ`BYPASSRLS`، وتبقى migrations/backfill/rehearsals على roles منفصلة.

## Intended Per-Family Rollout

| المرحلة | الشرط السابق | التغيير | دليل الإغلاق |
|---|---|---|---|
| Wave 1 | ownership + all runtime paths scoped + permissions + Broker/tenant-login lifecycle مثبتة | tenant-bound principal، protected mapping، policies، ثم FORCE | A/B direct query + no-principal/mapping deny + same-transaction switch + joins/writes/rollback |
| Subsequent waves | نفس الشروط لكل family | migration forward-only منفصلة | A/B runtime + direct query + regression |
| Schema-wide RLS | كل family tenant-owned مكتمل | لا global switch؛ consolidation فقط | zero unscoped runtime inventory |

## Current Candidate Families

Beneficiary وDonor/Donation/Campaign/Project وBudget graph تملك ownership foundations جزئية، لكن لا تحقق بعد شرط **all runtime paths**: dashboard routes/modules وfinance APIs ما زالت تستخدم Prisma مباشر أو clients محلية، كما أن Budget/Expense لا يملك permission semantic runtime في catalog. لا يتم تفعيل أي policy قبل معالجة هذه الفجوات.

## Explicit Non-Design

لا يوجد allow لـ`organizationId IS NULL`، ولا default organization، ولا global role bypass، ولا session-level context قابل للتسرب في pool، ولا `FORCE RLS` قبل app-role negative proof. لا تدخل Document أو Storage أو Queue أو Users/Memberships في RLS wave حتى تكتمل ownership/contracts الخاصة بها.
