import { getAllPages } from "@/modules/content/pages";
import { PageHeader, DataTable } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { format } from "date-fns";

export default async function ContentPage() {
  const pages = await getAllPages();

  return (
    <div className="space-y-6">
      <PageHeader
        title="الأنظمة والتعليمات"
        description="إدارة صفحات المحتوى والأنظمة والتعليمات"
        actions={
          <Link href="/content/new">
            <Button>+ إضافة صفحة جديدة</Button>
          </Link>
        }
      />
      <DataTable
        data={pages}
        searchable
        searchKeys={["title", "category"]}
        emptyMessage="لا توجد صفحات بعد"
        columns={[
          { key: "title", header: "العنوان", render: (row) => <span className="font-medium">{row.title}</span> },
          { key: "slug", header: "الرابط", render: (row) => <code className="text-xs bg-muted px-1 py-0.5 rounded">{row.slug}</code> },
          { key: "category", header: "الفئة", render: (row) => <Badge variant="outline">{row.category}</Badge> },
          {
            key: "isPublished", header: "الحالة",
            render: (row) => row.isPublished
              ? <Badge variant="success">منشور</Badge>
              : <Badge variant="secondary">مسودة</Badge>
          },
          {
            key: "createdAt", header: "تاريخ الإنشاء",
            render: (row) => format(new Date(row.createdAt), "yyyy/MM/dd")
          },
          {
            key: "actions", header: "إجراءات",
            render: (row) => (
              <div className="flex gap-2">
                <Link href={`/content/${row.id}/edit`}>
                  <Button variant="outline" size="sm">تعديل</Button>
                </Link>
              </div>
            )
          },
        ]}
      />
    </div>
  );
}
