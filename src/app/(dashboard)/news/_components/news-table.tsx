"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/data-table";
import { formatDateTime } from "@/lib/format";

export type NewsRow = {
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

export function NewsTable({ data }: { data: NewsRow[] }) {
  return (
    <DataTable
      data={data}
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
        { key: "category", header: "التصنيف", render: (n) => n.category || "-" },
        {
          key: "status",
          header: "الحالة",
          render: (n) => {
            const s = statusMap[n.status] || { label: n.status, variant: "outline" };
            return <Badge variant={s.variant}>{s.label}</Badge>;
          },
        },
        { key: "author", header: "بواسطة", render: (n) => n.author?.name || "-" },
        { key: "createdAt", header: "تاريخ الإنشاء", render: (n) => formatDateTime(n.createdAt) },
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
  );
}
