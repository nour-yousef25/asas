import Link from "next/link";
import { queryTenant } from "@/lib/tenant-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/data-table";
import { NewsTable, type NewsRow } from "./_components/news-table";

export const dynamic = "force-dynamic";

export default async function NewsPage() {
  const news = await queryTenant((db, context) =>
    db.news.findMany({
      where: { organizationId: context.organizationId },
      include: { author: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ) as NewsRow[];

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
        <NewsTable data={news} />
      </Card>
    </div>
  );
}
