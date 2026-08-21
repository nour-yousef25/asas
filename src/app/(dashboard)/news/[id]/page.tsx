import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

const statusMap: Record<string, { label: string; variant: any }> = {
  PUBLISHED: { label: "منشور", variant: "success" },
  DRAFT: { label: "مسودة", variant: "warning" },
  ARCHIVED: { label: "مؤرشف", variant: "secondary" },
};

export default async function NewsDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const news = await prisma.news.findUnique({
    where: { id },
    include: { author: { select: { name: true } } },
  });

  if (!news) return notFound();
  const s = statusMap[news.status] || { label: news.status, variant: "outline" };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/news">
          <Button variant="outline" size="sm">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            رجوع
          </Button>
        </Link>
        <Link href={`/news/${news.id}/edit`}>
          <Button size="sm">تعديل</Button>
        </Link>
      </div>

      <Card className="p-6">
        <div className="flex flex-col gap-2 border-b pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={s.variant}>{s.label}</Badge>
            {news.category && <Badge variant="outline">{news.category}</Badge>}
          </div>
          <h1 className="text-2xl font-bold">{news.title}</h1>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>بواسطة: {news.author?.name || "غير معروف"}</span>
            <span>·</span>
            <span>{formatDateTime(news.createdAt)}</span>
          </div>
        </div>
        {news.imageUrl && (
          <img
            src={news.imageUrl}
            alt={news.title}
            className="mt-4 max-h-96 w-full rounded-lg object-cover"
          />
        )}
        <div className="mt-6 prose prose-sm max-w-none whitespace-pre-wrap text-foreground">{news.content}</div>
      </Card>
    </div>
  );
}
