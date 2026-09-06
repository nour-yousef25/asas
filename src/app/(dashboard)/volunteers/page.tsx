import { queryTenant } from "@/lib/tenant-query";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/data-table";

export const dynamic = "force-dynamic";

const statusMap: Record<string, { label: string; variant: any }> = {
  ACTIVE: { label: "نشط", variant: "success" },
  INACTIVE: { label: "غير نشط", variant: "secondary" },
  SUSPENDED: { label: "موقوف", variant: "danger" },
};

type Volunteer = {
  id: string;
  skills: string[];
  availability: string;
  totalHours: number;
  status: string;
  user: { id: string; name: string; phone: string | null; email: string | null };
  activities: any[];
};

export default async function VolunteersPage() {
  const volunteers = (await queryTenant((db) =>
    db.volunteer.findMany({
      include: {
        user: { select: { id: true, name: true, phone: true, email: true } },
        activities: true,
      },
      orderBy: { createdAt: "desc" },
    }),
  )) as Volunteer[];

  return (
    <div className="space-y-6">
      <PageHeader title="المتطوعون" description="إدارة المتطوعين وتتبع أنشطتهم وساعات تطوعهم" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {volunteers.map((v) => {
          const s = statusMap[v.status] || { label: v.status, variant: "outline" };
          return (
            <Card key={v.id}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary text-lg font-bold">
                    {v.user.name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-base">{v.user.name}</CardTitle>
                    <CardDescription>{v.user.phone || v.user.email}</CardDescription>
                  </div>
                  <Badge variant={s.variant}>{s.label}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {v.skills.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">المهارات</p>
                      <div className="flex flex-wrap gap-1">
                        {v.skills.map((sk, i) => <Badge key={i} variant="outline">{sk}</Badge>)}
                      </div>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">ساعات التطوع:</span>
                    <span className="font-medium">{v.totalHours} ساعة</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">عدد الأنشطة:</span>
                    <span className="font-medium">{v.activities.length}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">التفرغ:</span>
                    <span className="font-medium">{v.availability === "flexible" ? "مرن" : v.availability}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      {volunteers.length === 0 && (
        <Card className="p-8 text-center text-muted-foreground">لا يوجد متطوعون مسجلون بعد</Card>
      )}
    </div>
  );
}
