import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/data-table";
import { financialRepository } from "@/lib/financial-repository";
import { requirePageTenantContext } from "@/lib/tenant-query";
import { requirePermission } from "@/lib/policy";
import { DonorsTable, type DonorRow } from "./_components/donors-table";

export const dynamic = "force-dynamic";

export default async function DonorsPage() {
  const context = await requirePageTenantContext();
  await requirePermission(context, "donor.read");
  const donors = (await financialRepository.listDonors(context)).map((donor) => ({ ...donor, _count: { donations: donor.donations.length } })) as DonorRow[];

  return (
    <div className="space-y-6">
      <PageHeader title="المانحون" description="قاعدة بيانات المانحين واتصالاتهم وأنشطتهم" />
      <Card className="p-4">
        <DonorsTable data={donors} />
      </Card>
    </div>
  );
}
