import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress-bar";
import { StatCard } from "@/components/dashboard/stat-card";
import { formatCurrency, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const statusMap: Record<string, { label: string; variant: any }> = {
  PLANNING: { label: "قيد التخطيط", variant: "secondary" },
  ACTIVE: { label: "نشط", variant: "success" },
  COMPLETED: { label: "مكتمل", variant: "default" },
  SUSPENDED: { label: "متوقف", variant: "warning" },
  CANCELLED: { label: "ملغى", variant: "danger" },
};

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    include: { donations: true, creator: { select: { name: true } } },
  });
  if (!project) return notFound();

  const s = statusMap[project.status] || { label: project.status, variant: "outline" };
  const completedDonations = project.donations.filter((d) => d.status === "COMPLETED");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/projects"><Button variant="outline" size="sm">رجوع</Button></Link>
        <Link href={`/projects/${project.id}/edit`}><Button size="sm">تعديل</Button></Link>
      </div>

      <Card>
        {project.imageUrl && (
          <img src={project.imageUrl} alt={project.title} className="h-64 w-full object-cover rounded-t-lg" />
        )}
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={s.variant}>{s.label}</Badge>
            {project.category && <Badge variant="outline">{project.category}</Badge>}
          </div>
          <CardTitle className="text-2xl">{project.title}</CardTitle>
          <p className="text-sm text-muted-foreground">
            بواسطة: {project.creator?.name || "غير معروف"} · {formatDate(project.createdAt)}
          </p>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap">{project.description}</p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="المبلغ المطلوب" value={formatCurrency(project.targetAmount)} color="primary" />
        <StatCard title="المبلغ المحصّل" value={formatCurrency(project.collectedAmount)} color="success" />
        <StatCard title="المتبقي" value={formatCurrency(Math.max(0, project.targetAmount - project.collectedAmount))} color="warning" />
        <StatCard title="عدد التبرعات" value={completedDonations.length} color="accent" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>نسبة الإكمال</CardTitle>
        </CardHeader>
        <CardContent>
          <ProgressBar value={project.completionPercent} size="lg" />
          <p className="mt-2 text-center text-2xl font-bold text-primary">٪{project.completionPercent}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>التبرعات على هذا المشروع</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {completedDonations.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">لا توجد تبرعات بعد</p>
            ) : (
              completedDonations.map((d) => (
                <div key={d.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="font-medium">{d.isGuest ? d.guestName || "متبرع زائر" : "متبرع"}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(d.createdAt)} · {d.paymentMethod}</p>
                  </div>
                  <Badge variant="success">{formatCurrency(d.amount)}</Badge>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
