import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/dashboard/stat-card";
import { PageHeader } from "@/components/shared/data-table";
import { formatDate, formatCurrency } from "@/lib/format";

export const dynamic = "force-dynamic";

const typeMap: Record<string, string> = { FOUNDER: "مؤسس", REGULAR: "عضو فعّال", HONORARY: "عضو فخري", ASSOCIATE: "عضو منتسب" };
const statusMap: Record<string, { label: string; variant: any }> = {
  ACTIVE: { label: "نشط", variant: "success" },
  EXPIRED: { label: "منتهي", variant: "danger" },
  PENDING_RENEWAL: { label: "بانتظار التجديد", variant: "warning" },
  SUSPENDED: { label: "موقوف", variant: "secondary" },
};

export default async function MemberDetailPage({ params }: { params: { id: string } }) {
  const member = await prisma.member.findUnique({
    where: { id: params.id },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true } },
      payments: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!member) return notFound();
  const s = statusMap[member.status] || { label: member.status, variant: "outline" };

  return (
    <div className="space-y-6">
      <PageHeader
        title={`ملف العضو: ${member.user.name}`}
        actions={
          <Link href={`/members/${member.id}/renew`}>
            <Button disabled={member.status === "ACTIVE"}>تجديد العضوية</Button>
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="نوع العضوية" value={typeMap[member.membershipType] || member.membershipType} color="primary" />
        <StatCard title="الحالة" value={s.label} color="primary" />
        <StatCard title="رسوم العضوية" value={formatCurrency(member.membershipFee)} color="secondary" />
        <StatCard title="المبلغ المدفوع" value={formatCurrency(member.paidAmount)} color="success" />
      </div>

      <Card>
        <CardHeader><CardTitle>بيانات العضو</CardTitle></CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div><dt className="text-sm text-muted-foreground">الاسم</dt><dd className="font-medium">{member.user.name}</dd></div>
            <div><dt className="text-sm text-muted-foreground">الجوال</dt><dd className="font-medium">{member.user.phone || "-"}</dd></div>
            <div><dt className="text-sm text-muted-foreground">البريد</dt><dd className="font-medium">{member.user.email || "-"}</dd></div>
            <div><dt className="text-sm text-muted-foreground">تاريخ التسجيل</dt><dd className="font-medium">{formatDate(member.startDate)}</dd></div>
            <div><dt className="text-sm text-muted-foreground">تاريخ الانتهاء</dt><dd className="font-medium">{member.endDate ? formatDate(member.endDate) : "-"}</dd></div>
            <div><dt className="text-sm text-muted-foreground">الحالة</dt><dd><Badge variant={s.variant}>{s.label}</Badge></dd></div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>سجل المدفوعات</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {member.payments.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">لا توجد مدفوعات</p>
            ) : (
              member.payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="font-medium">{formatCurrency(p.amount)}</p>
                    <p className="text-xs text-muted-foreground">رقم الإيصال: {p.receiptNo || "-"}</p>
                  </div>
                  <div className="text-left">
                    <Badge variant={p.status === "PAID" ? "success" : "warning"}>
                      {p.status === "PAID" ? "مدفوع" : "معلق"}
                    </Badge>
                    <p className="mt-1 text-xs text-muted-foreground">{p.paidAt ? formatDate(p.paidAt) : "-"}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
