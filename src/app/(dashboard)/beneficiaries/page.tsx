import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/data-table";
import { beneficiaryRepository } from "@/lib/beneficiary-repository";
import { requirePageTenantContext } from "@/lib/tenant-query";
import { requirePermission } from "@/lib/policy";
import { BeneficiariesTable, type BeneficiaryRow } from "./_components/beneficiaries-table";

export const dynamic = "force-dynamic";

export default async function BeneficiariesPage() {
  const context = await requirePageTenantContext();
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
        <BeneficiariesTable data={beneficiaries as BeneficiaryRow[]} />
      </Card>
    </div>
  );
}
