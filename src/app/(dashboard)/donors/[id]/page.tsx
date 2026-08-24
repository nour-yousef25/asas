import { notFound } from "next/navigation";
import { requireTenantContext } from "@/lib/tenant-context";
import { requirePermission } from "@/lib/policy";
import { financialRepository } from "@/lib/financial-repository";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/dashboard/stat-card";
import { formatCurrency, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const typeMap: Record<string, string> = { INDIVIDUAL: "فردي", CORPORATE: "مؤسسي", GOVERNMENT: "حكومي" };

export default async function DonorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const context = await requireTenantContext();
  await requirePermission(context, "donor.read");
  const { id } = await params;
  const donor = await financialRepository.getDonorById(context, id);
  if (!donor) return notFound();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{donor.name}</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="إجمالي التبرعات" value={formatCurrency(donor.totalDonations)} color="primary" />
        <StatCard title="عدد التبرعات" value={donor.donations.length} color="success" />
        <StatCard title="نوع المانح" value={typeMap[donor.donorType] || donor.donorType} color="secondary" />
        <StatCard title="آخر تبرع" value={donor.lastDonationAt ? formatDate(donor.lastDonationAt) : "-"} color="accent" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>بيانات الاتصال</CardTitle></CardHeader>
          <CardContent>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">الجوال</dt><dd>{donor.phone || "-"}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">البريد</dt><dd>{donor.email || "-"}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">العنوان</dt><dd>{donor.address || "-"}</dd></div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>الاتصالات والأنشطة</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {donor.communications.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">لا توجد اتصالات مسجلة</p>
              ) : (
                donor.communications.map((c) => (
                  <div key={c.id} className="rounded-lg border p-3 text-sm">
                    <div className="flex justify-between items-center mb-1">
                      <Badge variant="outline">{c.type}</Badge>
                      <span className="text-xs text-muted-foreground">{formatDate(c.contactDate)}</span>
                    </div>
                    {c.subject && <p className="font-medium">{c.subject}</p>}
                    <p className="text-muted-foreground">{c.notes}</p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>سجل التبرعات</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {donor.donations.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">لا توجد تبرعات</p>
            ) : (
              donor.donations.map((d) => (
                <div key={d.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="font-medium">{formatCurrency(d.amount)}</p>
                    <p className="text-xs text-muted-foreground">
                      {d.project?.title || d.campaign?.title || "تبرع عام"} · {d.paymentMethod} · {formatDate(d.createdAt)}
                    </p>
                  </div>
                  <Badge variant={d.status === "COMPLETED" ? "success" : "warning"}>{d.status === "COMPLETED" ? "مكتمل" : d.status}</Badge>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
