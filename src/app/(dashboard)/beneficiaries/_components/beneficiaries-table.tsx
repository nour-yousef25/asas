"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/data-table";

export type BeneficiaryRow = {
  id: string;
  name: string;
  nationalId: string | null;
  phone: string;
  email: string | null;
  city: string | null;
  gender: string;
  dateOfBirth: Date | null;
  familyMembers: number | null;
  needCategory: string | null;
  status: string;
  createdAt: Date;
};

const statusMap: Record<string, { label: string; variant: any }> = {
  ACTIVE: { label: "نشط", variant: "success" },
  INACTIVE: { label: "غير نشط", variant: "secondary" },
  SUSPENDED: { label: "موقوف", variant: "warning" },
  COMPLETED: { label: "منتهي", variant: "default" },
};
const genderMap: Record<string, string> = { MALE: "ذكر", FEMALE: "أنثى" };

export function BeneficiariesTable({ data }: { data: BeneficiaryRow[] }) {
  return (
    <DataTable
      data={data}
      searchable
      searchKeys={["name", "phone", "nationalId", "city"] as any}
      columns={[
        { key: "name", header: "الاسم", render: (b) => <span className="font-medium">{b.name}</span> },
        { key: "phone", header: "الجوال", render: (b) => b.phone },
        { key: "nationalId", header: "الهوية", render: (b) => b.nationalId || "-" },
        { key: "city", header: "المدينة", render: (b) => b.city || "-" },
        { key: "gender", header: "الجنس", render: (b) => genderMap[b.gender] || b.gender },
        { key: "family", header: "أفراد الأسرة", render: (b) => b.familyMembers ?? "-" },
        { key: "category", header: "فئة الاحتياج", render: (b) => b.needCategory || "-" },
        {
          key: "status", header: "الحالة",
          render: (b) => {
            const s = statusMap[b.status] || { label: b.status, variant: "outline" };
            return <Badge variant={s.variant}>{s.label}</Badge>;
          },
        },
        {
          key: "actions", header: "إجراءات",
          render: (b) => (
            <Link href={`/beneficiaries/${b.id}`}>
              <Button variant="outline" size="sm">عرض</Button>
            </Link>
          ),
        },
      ]}
    />
  );
}
