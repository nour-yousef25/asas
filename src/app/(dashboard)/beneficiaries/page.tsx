import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader, DataTable } from "@/components/shared/data-table";
import { formatDate } from "@/lib/format";
import { beneficiaryRepository } from "@/lib/beneficiary-repository";
import { requireTenantContext } from "@/lib/tenant-context";
import { requirePermission } from "@/lib/policy";

export const dynamic = "force-dynamic";

const statusMap: Record<string, { label: string; variant: any }> = {
  ACTIVE: { label: "نشط", variant: "success" },
  INACTIVE: { label: "غير نشط", variant: "secondary" },
  SUSPENDED: { label: "موقوف", variant: "warning" },
  COMPLETED: { label: "منتهي", variant: "default" },
};
const genderMap: Record<string, string> = { MALE: "ذكر", FEMALE: "أنثى" };

type Beneficiary = {
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

export default async function BeneficiariesPage() {
  const context = await requireTenantContext();
  await requirePermission(context, "beneficiary.read");
  const { data: beneficiaries } = await beneficiaryRepository.list(context, { skip: 0, take: 200 });

  return (
    <div className="space-y-6">
      <PageHeader
        title="المستفيدون"
        description="قاعدة بيانات شاملة لجميع مستفيدي الجمعية"
        actions={
          <div className="flex gap-2">
            <Link href="/beneficiaries/import">
              <Button variant="outline">استيراد من Excel</Button>
            </Link>
            <Link href="/beneficiaries/new">
              <Button>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
                إضافة مستفيد
              </Button>
            </Link>
          </div>
        }
      />

      <Card className="p-4">
        <DataTable
          data={beneficiaries}
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
      </Card>
    </div>
  );
}
