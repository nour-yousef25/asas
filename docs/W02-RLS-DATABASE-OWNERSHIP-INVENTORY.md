# W02 RLS — Database Ownership Inventory

## Current State

لا توجد في baseline الحالية RLS policies أو `FORCE ROW LEVEL SECURITY` أو application database role أو transaction-local tenant setter. يثبت ADR أن هذه العناصر شروط تنفيذية، لا افتراضات اختيارية. كما توجد استدعاءات Prisma مباشرة في صفحات dashboard/modules لمسارات مالية ومستفيدين ومشاريع، ولذلك سيؤدي تفعيل RLS الآن من دون cutover transaction context إلى deny أو owner bypass، وكلاهما غير مقبول.

## Tables with Direct Organization Owner

| Family | Models with `organizationId` | Ownership readiness | RLS wave status |
|---|---|---|---|
| Beneficiary | Beneficiary | WP5-2 repository/API ownership مثبت؛ dashboard direct reads ما زالت تحتاج transaction context | candidate after direct-read cutover |
| Financial donations | Donor, Donation, DonationCampaign, Project | WP5-2 ownership/repository مثبت؛ dashboard/modules legacy direct Prisma قائمة | candidate after direct-read cutover |
| Budget | Budget, BudgetItem, Expense | WP5-3 root/inheritance foundation مثبتة؛ finance modules/backfill paths تحتاج explicit runtime separation | candidate after runtime/query classification |
| Documents | Document | nullable root owner، API/storage لم يتحولا | excluded إلى Phase E |
| IAM | OrganizationMembership, OrganizationRole, PlatformSupportAccess | ownership مباشر لكن Users/Memberships API غير محول | excluded إلى Phase D |
| Communications | ConnectedChannel, CommunicationCampaign, CommunicationContentItem, PublicationPlan, WebhookEvent, MetricSnapshot, OAuthState | ownership قائم جزئياً؛ queue/cache audit مؤجل | excluded إلى Phase B |
| Other operational roots | AssemblyMeeting, BoardMember, BrandVoiceKit, Event, News, Survey, Task | routes/repositories غير محولة | excluded؛ لا RLS policy الآن |

## Parent/Child and Global Tables

| Classification | Models / principle | RLS action |
|---|---|---|
| Global identity/platform | User, Permission, Organization, installation/license primitives، public trial surfaces | لا tenant RLS؛ يعالج policy/identity boundary منفصلاً |
| Tenant child without direct owner | MembershipRole, OrganizationRolePermission, MembershipPermissionOverride، notification-like children | لا RLS حتى تثبت parent relationship and every runtime path uses tenant transaction context |
| Ownerless or nullable legacy root | Document and any unbackfilled root | BLOCKER للعائلة؛ لا inferred policy ولا `organizationId IS NULL` allow rule |

## Direct-Query Gate

المسح الحالي رصد Prisma مباشر للعائلات المرشحة في صفحات Dashboard الخاصة بالمستفيدين والمانحين والتبرعات والمشاريع، وفي `src/modules/finance/*` وbackfill tooling. لا تدخل backfill/analyze tooling ضمن application RLS role؛ يجب أن تستخدم migrator/audit role منفصلة ولا يمكن خلطها مع runtime application role.

## Phase A Scope Decision

ستبدأ RLS فقط بعد تصميم وتنفيذ application transaction context وعزل app/migrator roles، ثم تحويل كل runtime path لعائلة واحدة موجّهة. لا يوجد أساس لإطلاق schema-wide RLS الآن. أي policy يجب أن تكون fail-closed عند غياب `app.organization_id`، وتختبر مباشرة بدور app غير مالك على PostgreSQL audit database.
