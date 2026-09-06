"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/data-table";
import { formatCurrency } from "@/lib/format";

export type DonorRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  donorType: string;
  totalDonations: number;
  status: string;
  _count: { donations: number };
};

const typeMap: Record<string, string> = { INDIVIDUAL: "فردي", CORPORATE: "مؤسسي", GOVERNMENT: "حكومي" };
const statusMap: Record<string, { label: string; variant: any }> = {
  ACTIVE: { label: "نشط", variant: "success" },
  POTENTIAL: { label: "محتمل", variant: "warning" },
  INACTIVE: { label: "غير نشط", variant: "secondary" },
};

export function DonorsTable({ data }: { data: DonorRow[] }) {
  return (
    <DataTable
      data={data}
      searchable
      searchKeys={["name", "phone", "email"] as any}
      columns={[
        { key: "name", header: "الاسم", render: (d) => <span className="font-medium">{d.name}</span> },
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
  );
}
