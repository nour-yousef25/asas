import { prisma } from "@/lib/db";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/stat-card";
import { ProgressBar } from "@/components/ui/progress-bar";
import {
  AreaChartComponent,
  BarChartComponent,
  PieChartComponent,
  RadialGaugeComponent,
} from "@/components/charts";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

export default async function DashboardPage() {
  const [
    totalDonations,
    activeMembers,
    totalMembers,
    activeBeneficiaries,
    activeProjects,
    completedProjects,
    recentDonations,
    projects,
    kpis,
  ] = await Promise.all([
    prisma.donation.aggregate({ where: { status: "COMPLETED" }, _sum: { amount: true } }),
    prisma.member.count({ where: { status: "ACTIVE" } }),
    prisma.member.count(),
    prisma.beneficiary.count({ where: { status: "ACTIVE" } }),
    prisma.project.count({ where: { status: "ACTIVE" } }),
    prisma.project.count({ where: { status: "COMPLETED" } }),
    prisma.donation.findMany({
      where: { status: "COMPLETED" },
      include: { donor: { select: { name: true } }, project: { select: { title: true } }, campaign: { select: { title: true } } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.project.findMany({
      where: { status: { in: ["ACTIVE", "PLANNING"] } },
      orderBy: { completionPercent: "desc" },
      take: 4,
    }),
    prisma.kPI.findMany({
      where: { status: "ACTIVE" },
      include: { records: { orderBy: { period: "desc" }, take: 1 } },
      take: 6,
    }),
  ]);

  const avgKpiPercent = kpis.length > 0
    ? Math.round(kpis.reduce((sum, k) => sum + (k.records[0]?.percent ?? 0), 0) / kpis.length)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">لوحة التحكم</h1>
        <p className="text-muted-foreground">نظرة عامة على أداء الجمعية وعرض الإحصائيات الشاملة</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="إجمالي التبرعات"
          value={`${(totalDonations._sum.amount ?? 0).toLocaleString("ar-SA")} ر.س`}
          color="primary"
          subtitle="التبرعات المكتملة"
          icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 15h2a4 4 0 0 0 0-8M5 11h6M2 21v-2l3-3.5M9 13l1-1a2 2 0 0 1 3 3l-3 3-3-3a2 2 0 0 1 0-3 2 2 0 0 1 3 0z"/></svg>}
        />
        <StatCard
          title="الأعضاء النشطون"
          value={activeMembers.toLocaleString("ar-SA")}
          color="secondary"
          subtitle={`من أصل ${totalMembers.toLocaleString("ar-SA")}`}
          icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"/></svg>}
        />
        <StatCard
          title="المستفيدون"
          value={activeBeneficiaries.toLocaleString("ar-SA")}
          color="accent"
          subtitle="مستفيد نشط"
          icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 21a8 8 0 0 0-16 0M2 21v-1a8 8 0 0 1 8-8"/></svg>}
        />
        <StatCard
          title="المشاريع النشطة"
          value={activeProjects.toLocaleString("ar-SA")}
          color="success"
          subtitle={`${completedProjects} مشاريع مكتملة`}
          icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 10h8M8 14h6M4 4v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8.343a2 2 0 0 0-.586-1.414l-3.343-3.343A2 2 0 0 0 13.343 3H6a2 2 0 0 0-2 2z"/></svg>}
        />
      </div>

      {projects.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>المشاريع النشطة</CardTitle>
            <CardDescription>حالة المشاريع مع نسبة الإكمال</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {projects.map((p) => (
                <div key={p.id} className="rounded-lg border p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold">{p.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {p.collectedAmount.toLocaleString("ar-SA")} من {p.targetAmount.toLocaleString("ar-SA")} ر.س
                      </p>
                    </div>
                    <Badge variant={p.completionPercent >= 80 ? "success" : p.completionPercent >= 50 ? "default" : "warning"}>
                      %{p.completionPercent}
                    </Badge>
                  </div>
                  <ProgressBar value={p.completionPercent} className="mt-3" showLabel={false} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>مؤشر الأداء العام</CardTitle>
            <CardDescription>متوسط تحقيق مؤشرات KPI النشطة</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <RadialGaugeComponent value={avgKpiPercent} label="الأداء" height={180} />
            <p className="mt-2 text-2xl font-bold text-primary">{avgKpiPercent}٪</p>
            <p className="text-sm text-muted-foreground">تحقيق الأهداف</p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>آخر التبرعات</CardTitle>
            <CardDescription>آخر التبرعات الواردة على الجمعية</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentDonations.map((d) => (
                <div key={d.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">
                      {(d.donor?.name ?? d.guestName ?? "؟").charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium">{d.donor?.name ?? d.guestName ?? "متبرع مجهول"}</p>
                      <p className="text-xs text-muted-foreground">
                        {d.project?.title ?? d.campaign?.title ?? "تبرع عام"} ·{" "}
                        {formatDistanceToNow(d.createdAt, { addSuffix: true, locale: ar })}
                      </p>
                    </div>
                  </div>
                  <Badge variant="success">{d.amount.toLocaleString("ar-SA")} ر.س</Badge>
                </div>
              ))}
              {recentDonations.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-4">لا توجد تبرعات بعد</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
