import Link from "next/link";
import { queryTenant } from "@/lib/tenant-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/data-table";
import { MembersTable, type MemberRow } from "./_components/members-table";

export const dynamic = "force-dynamic";

export default async function MembersPage() {
  const members = (await queryTenant((db, context) =>
    db.member.findMany({
    where: { organizationId: context.organizationId },
    include: { user: { select: { id: true, name: true, phone: true, email: true } } },
    orderBy: { createdAt: "desc" },
  }), "member.read")) as MemberRow[];

  return (
    <div className="space-y-6">
      <PageHeader
        title="الأعضاء"
        description="قاعدة بيانات أعضاء الجمعية - التسجيل والتجديد الإلكتروني"
        actions={
          <Link href="/members/register">
            <Button>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
              تسجيل عضو
            </Button>
          </Link>
        }
      />

      <Card className="p-4">
        <MembersTable data={members} />
      </Card>
    </div>
  );
}
