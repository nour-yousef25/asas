"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/data-table";
import { format } from "date-fns";

export type ContentPageRow = {
  id: string;
  title: string;
  slug: string;
  category: string;
  isPublished: boolean;
  createdAt: Date;
};

export function ContentPagesTable({ data }: { data: ContentPageRow[] }) {
  return (
    <DataTable
      data={data}
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
  );
}
