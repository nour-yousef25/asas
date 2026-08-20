import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader, DataTable } from "@/components/shared/data-table";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

type News = {
  id: string;
  title: string;
  slug: string;
  status: string;
  category: string | null;
  createdAt: Date;
  author: { name: string } | null;
};

const statusMap: Record<string, { label: string; variant: any }> = {
  PUBLISHED: { label: "منشور", variant: "success" },
  DRAFT: { label: "مسودة", variant: "warning" },
  ARCHIVED: { label: "مؤرشف", variant: "secondary" },
};

export default async function NewsPage() {
  const news = await prisma.news.findMany({
    include: { author: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  }) as News[];

  return (
    <div className="space-y-6">
      <PageHeader
        title="الأخبار"
        description="إدارة أخبار الجمعية ومحتواها"
        actions={
          <Link href="/news/new">
            <Button>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14" />
              </svg>
              إضافة خبر
            </Button>
          </Link>
        }
      />

      <Card className="p-4">
        <DataTable
          data={news}
          searchable
          searchKeys={["title", "category"] as any}
          columns={[
            {
              key: "title",
              header: "العنوان",
              render: (n) => (
                <div>
                  <p className="font-medium">{n.title}</p>
                  <p className="text-xs text-muted-foreground">/{n.slug}</p>
                </div>
              ),
            },
            {
              key: "category",
              header: "التصنيف",
              render: (n) => n.category || "-",
            },
            {
              key: "status",
              header: "الحالة",
              render: (n) => {
                const s = statusMap[n.status] || { label: n.status, variant: "outline" };
                return <Badge variant={s.variant}>{s.label}</Badge>;
              },
            },
            {
              key: "author",
              header: "بواسطة",
              render: (n) => n.author?.name || "-",
            },
            {
              key: "createdAt",
              header: "تاريخ الإنشاء",
              render: (n) => formatDateTime(n.createdAt),
            },
            {
              key: "actions",
              header: "إجراءات",
              render: (n) => (
                <div className="flex items-center gap-2">
                  <Link href={`/news/${n.id}`}>
                    <Button variant="ghost" size="sm">عرض</Button>
                  </Link>
                  <Link href={`/news/${n.id}/edit`}>
                    <Button variant="outline" size="sm">تعديل</Button>
                  </Link>
                </div>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
