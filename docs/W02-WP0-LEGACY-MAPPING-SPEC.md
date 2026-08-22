# W02 WP0 — Legacy Data Mapping Specification

**الحالة:** `CLOSED — DESIGN SPECIFICATION`
**قاعدة أساسية:** لا يفترض أي سجل global أنه يتبع منظمة واحدة. لا backfill أو migration في WP0.

## Mapping Protocol

يبدأ التنفيذ المستقبلي بـdry-run يقرأ مصادر mapping دون كتابة. يقبل mapping فقط إذا كان المصدر explicit ومفرداً وصالحاً؛ وعند ambiguity أو orphan أو null غير مبرر يتوقف العمل قبل أي write. كل assignment يكتب `LegacyTenantAssignmentAudit` مستقبلياً مع source/reviewer/correlation. يجوز استعمال `LEGACY_ORGANIZATION_ID` فقط عقب قرار Data Owner موثق بأن dataset مستهدف أحادي المؤسسة، وليس كـdefault تقني.

| Root Aggregate | Tenant Scoped | Proposed organizationId Source | Mapping Type | Ambiguity / Orphan Behavior | Backfill Success Criterion | Composite Unique Target |
|---|---|---|---|---|---|---|
| Member | YES | membership/user assignment map | manual/explicit | STOP | every row mapped; user ownership reviewed | `(organizationId, userId)` |
| Volunteer | YES | membership/user assignment map | manual/explicit | STOP | no null/orphan | `(organizationId, userId)` |
| Beneficiary | YES | case assignment or approved legacy map | manual first | STOP | all PII rows mapped/audited | `(organizationId, nationalId)` when non-null |
| Donor | YES | donor relationship/campaign map | manual first | STOP | all rows mapped | `(organizationId, userId)` when non-null |
| DonationCampaign | YES | explicit campaign owner | manual/explicit | STOP | campaign has one org | `(organizationId, slug/code)` future |
| Donation / RecurringDonation | YES | parent donor/campaign/project only if same org | derived then validated | STOP on inconsistent parents | all parent orgs agree | org-scoped payment/idempotency keys |
| Invoice | YES | parent donation/member/order after validation | derived then validated | STOP | no conflicting parents | `(organizationId, invoiceNo)` |
| Project | YES | explicit creator/approved map | manual/explicit | STOP | all rows mapped | `(organizationId, slug/code)` future |
| News / ContentPage / Announcement | YES | editorial owner/map | manual/explicit | STOP | all public content assigned | `(organizationId, slug)` |
| PhotoAlbum / VideoCategory / Event | YES | approved content map | manual/explicit | STOP | no child without parent org | org-scoped title/slug where needed |
| Task / Survey / KPI / Evaluation | YES | assignee/owner parent only if unique org | derived then validated | STOP on multi-org users | ownership validated | org-scoped business keys |
| StoreProduct / StoreOrder | YES | store operator/order relationship map | manual/explicit | STOP | all financial/order relations agree | org-scoped SKU/payment reference |
| Budget / Expense / FinancialAccount | YES | existing financial account org or approved map | derived/manual | STOP | accounting reconciliation passes | `(organizationId, accountCode)` |
| Notification / SMS Template / SMS Log | YES | user membership or sender owner map | manual/derived | STOP on multi-org user ambiguity | all rows classified/mapped | org-scoped template name |
| MenuItem / Document / ReportShare | YES | explicit content/document owner map | manual/explicit | STOP | private resource ownership known | org-scoped paths/share ids |
| Organization / OrganizationMembership | canonical/global relation | existing data | none | invalid FK => STOP | memberships unique and active state valid | existing `(organizationId,userId)` |
| User / Permission | NO | global identity/catalog | none | n/a | not migrated as tenant data | global identity uniques retained |
| TrialRequest | NO initially | public pre-tenant lead | none | n/a | no tenant scope until conversion | global anti-abuse identifiers |

## Orphan and Validation Rules

بعد backfill المستقبلية يجب أن تكون `null_organization_count=0` لكل table family scoped، و`orphan_organization_fk_count=0`، و`cross_parent_organization_mismatch_count=0`. يتطلب الانتقال إلى `NOT NULL` وcomposite constraints تقريراً موقعاً من Data Owner. لا يحذف orphans أو يعينها تلقائياً.
