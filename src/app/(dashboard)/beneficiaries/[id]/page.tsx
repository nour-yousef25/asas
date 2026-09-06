import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/data-table";
import { formatDate } from "@/lib/format";
import { beneficiaryRepository } from "@/lib/beneficiary-repository";
import { requireTenantContext } from "@/lib/tenant-context";
import { requirePermission } from "@/lib/policy";

const statusMap: Record<string, { label: string; variant: any }> = {
  ACTIVE: { label: "نشط", variant: "success" },
  INACTIVE: { label: "غير نشط", variant: "secondary" },
  SUSPENDED: { label: "موقوف", variant: "warning" },
  COMPLETED: { label: "منتهي", variant: "default" },
};
const genderMap: Record<string, string> = { MALE: "ذكر", FEMALE: "أنثى" };

export default async function BeneficiaryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await requireTenantContext();
  await requirePermission(context, "beneficiary.read");
  const b = await beneficiaryRepository.getById(context, id);
  if (!b) return notFound();
  const s = statusMap[b.status] || { label: b.status, variant: "outline" };

  return (
    <div className="space-y-6">
      <PageHeader
        title={`ملف المستفيد: ${b.name}`}
        actions={<Button variant="outline">تعديل</Button>}
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>البيانات الشخصية</CardTitle></CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-sm">
              <div><dt className="text-muted-foreground">الاسم</dt><dd className="font-medium">{b.name}</dd></div>
              <div><dt className="text-muted-foreground">الجوال</dt><dd className="font-medium">{b.phone}</dd></div>
              <div><dt className="text-muted-foreground">الهوية</dt><dd>{b.nationalId || "-"}</dd></div>
              <div><dt className="text-muted-foreground">الجنس</dt><dd>{genderMap[b.gender] || b.gender}</dd></div>
              <div><dt className="text-muted-foreground">المدينة</dt><dd>{b.city || "-"}</dd></div>
              <div><dt className="text-muted-foreground">العنوان</dt><dd>{b.address || "-"}</dd></div>
              <div><dt className="text-muted-foreground">تاريخ الميلاد</dt><dd>{b.dateOfBirth ? formatDate(b.dateOfBirth) : "-"}</dd></div>
              <div><dt className="text-muted-foreground">أفراد الأسرة</dt><dd>{b.familyMembers ?? "-"}</dd></div>
              <div><dt className="text-muted-foreground">مستوى الدخل</dt><dd>{b.incomeLevel || "-"}</dd></div>
              <div><dt className="text-muted-foreground">فئة الاحتياج</dt><dd>{b.needCategory || "-"}</dd></div>
              <div><dt className="text-muted-foreground">الحالة</dt><dd><Badge variant={s.variant}>{s.label}</Badge></dd></div>
              <div><dt className="text-muted-foreground">تاريخ التسجيل</dt><dd>{formatDate(b.createdAt)}</dd></div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>الأوراق الثبوتية</CardTitle>
            <p className="text-sm text-muted-foreground">المستندات المرفوعة بواسطة المستفيد</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {b.documents.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">لا توجد مستندات مرفوعة</p>
              ) : (
                b.documents.map((d) => (
                  <div key={d.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="font-medium text-sm">{d.name}</p>
                      <p className="text-xs text-muted-foreground">{d.fileType} · رفع بتاريخ {formatDate(d.uploadedAt)}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">يتطلب التحميل رابطاً خاصاً مقيداً بالمنظمة</span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      {b.notes && (
        <Card>
          <CardHeader><CardTitle>ملاحظات</CardTitle></CardHeader>
          <CardContent><p className="text-sm whitespace-pre-wrap">{b.notes}</p></CardContent>
        </Card>
      )}
    </div>
  );
}
