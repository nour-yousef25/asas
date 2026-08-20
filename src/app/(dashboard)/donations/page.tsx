import { prisma } from "@/lib/db";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/dashboard/stat-card";
import { PageHeader, DataTable } from "@/components/shared/data-table";
import { formatCurrency, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const statusMap: Record<string, { label: string; variant: any }> = {
  COMPLETED: { label: "مكتمل", variant: "success" },
  PENDING: { label: "معلق", variant: "warning" },
  FAILED: { label: "فشل", variant: "danger" },
  REFUNDED: { label: "مسترد", variant: "secondary" },
};

type Donation = {
  id: string;
  amount: number;
  paymentMethod: string | null;
  paymentRef: string | null;
  status: string;
  isGuest: boolean;
  isAnonymous: boolean;
  guestName: string | null;
  guestPhone: string | null;
  createdAt: Date;
  donor: { name: string } | null;
  campaign: { title: string } | null;
  project: { title: string } | null;
  invoice: { invoiceNo: string } | null;
};

export default async function DonationsPage() {
  const donations = (await prisma.donation.findMany({
    include: {
      donor: { select: { name: true } },
      campaign: { select: { title: true } },
      project: { select: { title: true } },
      invoice: { select: { invoiceNo: true } },
    },
    orderBy: { createdAt: "desc" },
  })) as Donation[];

  const total = donations.filter((d) => d.status === "COMPLETED").reduce((sum, d) => sum + d.amount, 0);
  const guestDonations = donations.filter((d) => d.isGuest).length;
  const todayDonations = donations.filter((d) => {
    const today = new Date();
    return d.createdAt.toDateString() === today.toDateString();
  }).length;

  return (
    <div className="space-y-6">
      <PageHeader title="التبرعات" description="إدارة جميع التبرعات (الأعضاء والزوار) والفواتير الإلكترونية" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="إجمالي التبرعات" value={formatCurrency(total)} color="primary" />
        <StatCard title="عدد التبرعات" value={donations.length} color="secondary" />
        <StatCard title="تبرعات اليوم" value={todayDonations} color="accent" />
        <StatCard title="تبرعات الزوار" value={guestDonations} color="success" />
      </div>
      <Card className="p-4">
        <DataTable
          data={donations}
          searchable
          searchKeys={["amount", "paymentRef", "guestName", "guestPhone"] as any}
          columns={[
            { key: "createdAt", header: "التاريخ", render: (d) => formatDate(d.createdAt) },
            { key: "donor", header: "المتبرع",
              render: (d) => {
                if (d.isAnonymous) return "متبرع مجهول";
                if (d.isGuest) return d.guestName || "زائر";
                return d.donor?.name || "-";
              },
            },
            { key: "phone", header: "الجوال", render: (d) => d.guestPhone || "-" },
            { key: "amount", header: "المبلغ", render: (d) => <span className="font-medium text-primary">{formatCurrency(d.amount)}</span> },
            { key: "method", header: "طريقة الدفع", render: (d) => d.paymentMethod || "-" },
            { key: "target", header: "الجهة",
              render: (d) => d.project?.title || d.campaign?.title || "تبرع عام" },
            { key: "invoice", header: "الفاتورة", render: (d) =>
              d.invoice?.invoiceNo ?
                (<a href={`/donations/invoices/${d.id}`} className="text-primary hover:underline text-xs">{d.invoice.invoiceNo}</a>)
                : "-",
            },
            { key: "status", header: "الحالة",
              render: (d) => {
                const s = statusMap[d.status] || { label: d.status, variant: "outline" };
                return <Badge variant={s.variant}>{s.label}</Badge>;
              },
            },
          ]}
        />
      </Card>
    </div>
  );
}
