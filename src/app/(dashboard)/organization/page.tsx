import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/data-table";
import { formatDate } from "@/lib/format";
import { requirePageTenantContext, queryTenantWith } from "@/lib/tenant-query";

export const dynamic = "force-dynamic";

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium">{value || "—"}</p>
    </div>
  );
}

export default async function OrganizationPage() {
  const context = await requirePageTenantContext();
  const org = await queryTenantWith(
    context,
    (db, ctx) => db.organization.findUnique({ where: { id: ctx.organizationId } }),
    "settings.read",
  );

  if (!org) {
    return (
      <div className="space-y-6">
        <PageHeader title="الجمعية" description="بيانات الجمعية" />
        <Card className="p-8 text-center text-muted-foreground">لم يتم العثور على بيانات الجمعية.</Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="الجمعية"
        description="الملف التعريفي والبيانات الرسمية للجمعية"
        actions={
          <Link href="/settings/appearance">
            <Button variant="outline">تعديل الهوية والمظهر</Button>
          </Link>
        }
      />

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            {org.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={org.logo} alt={org.name} className="h-16 w-16 rounded-lg object-cover" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-primary/10 text-2xl font-bold text-primary">
                {org.name.charAt(0)}
              </div>
            )}
            <div>
              <CardTitle className="text-xl">{org.name}</CardTitle>
              {org.nameEn && <p className="text-sm text-muted-foreground">{org.nameEn}</p>}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {org.description && <p className="text-sm leading-relaxed text-muted-foreground">{org.description}</p>}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="رقم التسجيل" value={org.registrationNo} />
            <Field label="المرجع في المركز الوطني" value={org.ncnpRef} />
            <Field label="الرقم الضريبي" value={org.taxNumber} />
            <Field label="تاريخ التأسيس" value={org.foundedDate ? formatDate(org.foundedDate) : null} />
            <Field label="المدينة" value={org.city} />
            <Field label="العنوان" value={org.address} />
            <Field label="الرمز البريدي" value={org.postalCode} />
            <Field label="الهاتف" value={org.phone} />
            <Field label="البريد الإلكتروني" value={org.email} />
            <Field label="الموقع الإلكتروني" value={org.website} />
          </div>

          <div className="flex items-center gap-4 border-t pt-4">
            <p className="text-xs text-muted-foreground">ألوان الهوية:</p>
            <div className="flex items-center gap-2">
              <span className="h-6 w-6 rounded" style={{ backgroundColor: org.primaryColor }} />
              <Badge variant="outline">{org.primaryColor}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-6 w-6 rounded" style={{ backgroundColor: org.secondaryColor }} />
              <Badge variant="outline">{org.secondaryColor}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-6 w-6 rounded" style={{ backgroundColor: org.accentColor }} />
              <Badge variant="outline">{org.accentColor}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
