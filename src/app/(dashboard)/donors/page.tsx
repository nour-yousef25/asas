import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader, DataTable } from "@/components/shared/data-table";
import { formatCurrency } from "@/lib/format";
import { financialRepository } from "@/lib/financial-repository";
import { requireTenantContext } from "@/lib/tenant-context";
import { requirePermission } from "@/lib/policy";

export const dynamic = "force-dynamic";

const typeMap: Record<string, string> = { INDIVIDUAL: "فردي", CORPORATE: "مؤسسي", GOVERNMENT: "حكومي" };
const statusMap: Record<string, { label: string; variant: any }> = {
  ACTIVE: { label: "نشط", variant: "success" },
  POTENTIAL: { label: "محتمل", variant: "warning" },
  INACTIVE: { label: "غير نشط", variant: "secondary" },
};

type Donor = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  donorType: string;
  totalDonations: number;
  status: string;
  _count: { donations: number };
};

export default async function DonorsPage() {
  const context = await requireTenantContext();
  await requirePermission(context, "donor.read");
  const donors = (await financialRepository.listDonors(context)).map((donor) => ({ ...donor, _count: { donations: donor.donations.length } })) as Donor[];

  return (
    <div className="space-y-6">
      <PageHeader title="المانحون" description="قاعدة بيانات المانحين واتصالاتهم وأنشطتهم" />
      <Card className="p-4">
        <DataTable
          data={donors}
          searchable
          searchKeys={["name", "phone", "email"] as any}
          columns={[
            { key: "name", header: "الاسم", render: (d) => { return <span className="font-medium">{d.name}</span>; } },
            { key: "phone", header: "الجوال", render: (d) => d.phone || "-" },
            { key: "type", header: "النوع", render: (d) => <Badge variant="outline">{typeMap[d.donorType] || d.donorType}</Badge> },
            { key: "total", header: "إجمالي التبرعات", render: (d) => <span className="font-medium text-primary">{formatCurrency(d.totalDonations)}</span> },
            {
              key: "status",
              header: "الحالة",
              render: (d) => {
                const s = statusMap[d.status] || { label: d.status, variant: "outline" };
                return <Badge variant={s.variant}>{s.label}</Badge>;
              },
            },
            { key: "donations", header: "عدد التبرعات", render: (d) => d._count.donations },
            {
              key: "actions",
              header: "إجراءات",
              render: (d) => (
                <Link href={`/donors/${d.id}`}>
                  <Button variant="outline" size="sm">عرض الملف</Button>
                </Link>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
