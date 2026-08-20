import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader, DataTable } from "@/components/shared/data-table";
import { formatDate, formatCurrency } from "@/lib/format";

export const dynamic = "force-dynamic";

const typeMap: Record<string, string> = {
  FOUNDER: "مؤسس",
  REGULAR: "عضو فعّال",
  HONORARY: "عضو فخري",
  ASSOCIATE: "عضو منتسب",
};
const statusMap: Record<string, { label: string; variant: any }> = {
  ACTIVE: { label: "نشط", variant: "success" },
  EXPIRED: { label: "منتهي", variant: "danger" },
  PENDING_RENEWAL: { label: "بانتظار التجديد", variant: "warning" },
  SUSPENDED: { label: "موقوف", variant: "secondary" },
  INACTIVE: { label: "غير نشط", variant: "outline" },
};
const payStatusMap: Record<string, { label: string; variant: any }> = {
  PAID: { label: "مدفوع", variant: "success" },
  PENDING: { label: "معلق", variant: "warning" },
  PARTIAL: { label: "جزئي", variant: "warning" },
  OVERDUE: { label: "متأخر", variant: "danger" },
};

type Member = {
  id: string;
  membershipType: string;
  status: string;
  paymentStatus: string;
  startDate: Date;
  endDate: Date | null;
  membershipFee: number;
  paidAmount: number;
  user: { id: string; name: string; phone: string | null; email: string | null };
};

export default async function MembersPage() {
  const members = (await prisma.member.findMany({
    include: { user: { select: { id: true, name: true, phone: true, email: true } } },
    orderBy: { createdAt: "desc" },
  })) as Member[];

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
        <DataTable
          data={members}
          searchable
          searchKeys={["user.name", "user.phone", "user.email"] as any}
          columns={[
            {
              key: "name",
              header: "العضو",
              render: (m) => (
                <div>
                  <p className="font-medium">{m.user.name}</p>
                  <p className="text-xs text-muted-foreground">{m.user.phone || m.user.email}</p>
                </div>
              ),
            },
            { key: "type", header: "النوع", render: (m) => typeMap[m.membershipType] || m.membershipType },
            {
              key: "fee",
              header: "رسوم العضوية",
              render: (m) => (
                <div>
                  <p>{formatCurrency(m.membershipFee)}</p>
                  <p className="text-xs text-muted-foreground">مدفوع: {formatCurrency(m.paidAmount)}</p>
                </div>
              ),
            },
            {
              key: "endDate",
              header: "تاريخ الانتهاء",
              render: (m) => (m.endDate ? formatDate(m.endDate) : "-"),
            },
            {
              key: "status",
              header: "الحالة",
              render: (m) => {
                const s = statusMap[m.status] || { label: m.status, variant: "outline" };
                return <Badge variant={s.variant}>{s.label}</Badge>;
              },
            },
            {
              key: "payStatus",
              header: "حالة السداد",
              render: (m) => {
                const s = payStatusMap[m.paymentStatus] || { label: m.paymentStatus, variant: "outline" };
                return <Badge variant={s.variant}>{s.label}</Badge>;
              },
            },
            {
              key: "actions",
              header: "إجراءات",
              render: (m) => (
                <div className="flex gap-2">
                  <Link href={`/members/${m.id}`}>
                    <Button variant="outline" size="sm">عرض</Button>
                  </Link>
                  <Link href={`/members/${m.id}/renew`}>
                    <Button size="sm" disabled={m.status === "ACTIVE"}>تجديد</Button>
                  </Link>
                </div>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
