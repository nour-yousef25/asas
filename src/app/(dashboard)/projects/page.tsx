import Link from "next/link";
import { requireTenantContext } from "@/lib/tenant-context";
import { requirePermission } from "@/lib/policy";
import { financialRepository } from "@/lib/financial-repository";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress-bar";
import { PageHeader } from "@/components/shared/data-table";
import { formatCurrency } from "@/lib/format";

export const dynamic = "force-dynamic";

const statusMap: Record<string, { label: string; variant: any }> = {
  PLANNING: { label: "قيد التخطيط", variant: "secondary" },
  ACTIVE: { label: "نشط", variant: "success" },
  COMPLETED: { label: "مكتمل", variant: "default" },
  SUSPENDED: { label: "متوقف", variant: "warning" },
  CANCELLED: { label: "ملغى", variant: "danger" },
};

export default async function ProjectsPage() {
  const context = await requireTenantContext();
  await requirePermission(context, "project.read");
  const projects = await financialRepository.listProjects(context);

  return (
    <div className="space-y-6">
      <PageHeader
        title="المشاريع"
        description="إدارة مشاريع التبرع ومتابعة نسب الإكمال"
        actions={
          <Link href="/projects/new">
            <Button>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
              إضافة مشروع
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {projects.map((p) => {
          const s = statusMap[p.status] || { label: p.status, variant: "outline" };
          return (
            <Card key={p.id} className="overflow-hidden">
              {p.imageUrl && (
                <img src={p.imageUrl} alt={p.title} className="h-40 w-full object-cover" />
              )}
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{p.title}</CardTitle>
                  <Badge variant={s.variant}>{s.label}</Badge>
                </div>
                {p.category && <CardDescription>{p.category}</CardDescription>}
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{p.description}</p>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">المبلغ المطلوب:</span>
                    <span className="font-medium">{formatCurrency(p.targetAmount)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">المحصّل:</span>
                    <span className="font-medium text-primary">{formatCurrency(p.collectedAmount)}</span>
                  </div>
                  <ProgressBar value={p.completionPercent} showLabel={false} />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>نسبة الإكمال</span>
                    <span>%{p.completionPercent}</span>
                  </div>
                </div>
                <Link href={`/projects/${p.id}`} className="block mt-4">
                  <Button variant="outline" className="w-full">عرض التفاصيل</Button>
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
