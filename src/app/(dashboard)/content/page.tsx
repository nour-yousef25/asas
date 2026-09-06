import { getAllPages } from "@/modules/content/pages";
import { queryTenant } from "@/lib/tenant-query";
import { PageHeader } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ContentPagesTable } from "./_components/content-pages-table";

export default async function ContentPage() {
  const pages = await queryTenant((db) => getAllPages(db));

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
      <ContentPagesTable data={pages} />
    </div>
  );
}
