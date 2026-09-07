import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/data-table";
import { requirePageTenantContext, queryTenantWith } from "@/lib/tenant-query";
import { UsersTable, type MembershipRow } from "./_components/users-table";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const context = await requirePageTenantContext();
  const memberships = (await queryTenantWith(
    context,
    (db, ctx) =>
      db.organizationMembership.findMany({
        where: { organizationId: ctx.organizationId, isActive: true, revokedAt: null },
        include: {
          user: { select: { id: true, name: true, email: true, phone: true, isActive: true } },
          organizationRoles: { include: { organizationRole: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
    "identity.membership.read",
  )) as MembershipRow[];

  return (
    <div className="space-y-6">
      <PageHeader
        title="المستخدمون"
        description="إدارة عضويات الجمعية وأدوارها"
      />
      <Card className="p-4">
        <UsersTable data={memberships} />
      </Card>
    </div>
  );
}
