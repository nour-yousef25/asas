# W02 RLS — Database Tenant Isolation Design

## Contract

يعتمد التصميم الرسمي `Organization` tenant canonical و`TenantContext` server-side. لكل family مكتمل فقط، يمر runtime عبر transaction محلية تضبط `app.organization_id` و`app.membership_id` بواسطة `set_config(..., true)`. تتعامل policy مع غياب أو عدم تطابق context باعتباره deny. يستخدم التطبيق role غير مالك للجداول وغير حامل لـ`BYPASSRLS`، وتبقى migrations/backfill/rehearsals على role منفصلة.

## Intended Per-Family Rollout

| المرحلة | الشرط السابق | التغيير | دليل الإغلاق |
|---|---|---|---|
| Wave 1 | ownership + all runtime paths scoped + permissions مثبتة | app role، transaction context، policies، ثم FORCE | app role A/B direct query + no-context deny + joins/writes/rollback |
| Subsequent waves | نفس الشروط لكل family | migration forward-only منفصلة | A/B runtime + direct query + regression |
| Schema-wide RLS | كل family tenant-owned مكتمل | لا global switch؛ consolidation فقط | zero unscoped runtime inventory |

## Current Candidate Families

Beneficiary وDonor/Donation/Campaign/Project وBudget graph تملك ownership foundations جزئية، لكن لا تحقق بعد شرط **all runtime paths**: dashboard routes/modules وfinance APIs ما زالت تستخدم Prisma مباشر أو clients محلية، كما أن Budget/Expense لا يملك permission semantic runtime في catalog. لا يتم تفعيل أي policy قبل معالجة هذه الفجوات.

## Explicit Non-Design

لا يوجد allow لـ`organizationId IS NULL`، ولا default organization، ولا global role bypass، ولا session-level context قابل للتسرب في pool، ولا `FORCE RLS` قبل app-role negative proof. لا تدخل Document أو Storage أو Queue أو Users/Memberships في RLS wave حتى تكتمل ownership/contracts الخاصة بها.
