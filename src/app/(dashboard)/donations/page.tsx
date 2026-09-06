import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/stat-card";
import { PageHeader } from "@/components/shared/data-table";
import { formatCurrency } from "@/lib/format";
import { financialRepository } from "@/lib/financial-repository";
import { requireTenantContext } from "@/lib/tenant-context";
import { requirePermission } from "@/lib/policy";
import { DonationsTable, type DonationRow } from "./_components/donations-table";

export const dynamic = "force-dynamic";

export default async function DonationsPage() {
  const context = await requireTenantContext();
  await requirePermission(context, "donation.read");
  const { data: donations } = (await financialRepository.listDonations(context, { skip: 0, take: 200 })) as { data: DonationRow[]; total: number };

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
        <DonationsTable data={donations} />
      </Card>
    </div>
  );
}
