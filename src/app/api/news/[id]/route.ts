import { NextRequest, NextResponse } from "next/server";
import { newsSchema } from "@/lib/validations";
import { slugify } from "@/lib/utils";
import { queryTenantApi, isTenantApiError } from "@/lib/tenant-query";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const news = await queryTenantApi((db, context) =>
      db.news.findFirst({
        where: { id, organizationId: context.organizationId },
        include: { author: { select: { id: true, name: true } } },
      }),
    );
    if (isTenantApiError(news)) return news;

    if (!news) {
      return NextResponse.json({ error: "الخبر غير موجود" }, { status: 404 });
    }
    return NextResponse.json(news);
  } catch (error) {
    return NextResponse.json({ error: "خطأ في جلب الخبر" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const validated = newsSchema.partial().parse(body);

    const news = await queryTenantApi(async (db, context) => {
      const existingNews = await db.news.findFirst({
        where: { id, organizationId: context.organizationId },
      });
      if (!existingNews) return null;

      let generatedSlug: string | undefined;
      if (validated.title) {
        generatedSlug = slugify(validated.title);
        const existing = await db.news.findFirst({
          where: { slug: generatedSlug, organizationId: context.organizationId },
        });
        if (existing && existing.id !== id) generatedSlug = `${generatedSlug}-${Date.now()}`;
      }

      return db.news.update({
        where: { id },
        data: {
          ...validated,
          ...(generatedSlug ? { slug: generatedSlug } : {}),
          publishedAt: validated.status === "PUBLISHED" ? new Date() : undefined,
        },
      });
    });
    if (isTenantApiError(news)) return news;
    if (!news) {
      return NextResponse.json({ error: "الخبر غير موجود" }, { status: 404 });
    }
    return NextResponse.json(news);
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "خطأ في تحديث الخبر" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const result = await queryTenantApi((db, context) =>
      db.news.deleteMany({ where: { id, organizationId: context.organizationId } }),
    );
    if (isTenantApiError(result)) return result;
    if (result.count === 0) {
      return NextResponse.json({ error: "الخبر غير موجود" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "خطأ في حذف الخبر" }, { status: 500 });
  }
}
