import { NextRequest, NextResponse } from "next/server";
import { newsSchema } from "@/lib/validations";
import { slugify } from "@/lib/utils";
import { queryTenantApi, isTenantApiError } from "@/lib/tenant-query";

// الحصول على قائمة الأخبار
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const category = searchParams.get("category");
    const limit = parseInt(searchParams.get("limit") || "50");
    const page = parseInt(searchParams.get("page") || "1");

    const result = await queryTenantApi(async (db, context) => {
      const where: any = { organizationId: context.organizationId };
      if (status) where.status = status;
      if (category) where.category = category;

      const [news, total] = await Promise.all([
        db.news.findMany({
          where,
          include: { author: { select: { id: true, name: true } } },
          orderBy: { createdAt: "desc" },
          take: limit,
          skip: (page - 1) * limit,
        }),
        db.news.count({ where }),
      ]);
      return { data: news, total };
    });
    if (isTenantApiError(result)) return result;

    return NextResponse.json({ data: result.data, total: result.total, page, limit });
  } catch (error) {
    console.error("GET /api/news error:", error);
    return NextResponse.json({ error: "خطأ في جلب الأخبار" }, { status: 500 });
  }
}

// إضافة خبر جديد
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = newsSchema.parse(body);

    const news = await queryTenantApi(async (db, context) => {
      let slug = slugify(validated.title);
      const existing = await db.news.findFirst({
        where: { slug, organizationId: context.organizationId },
      });
      if (existing) slug = `${slug}-${Date.now()}`;

      return db.news.create({
        data: {
          ...validated,
          slug,
          organizationId: context.organizationId,
          publishedAt: validated.status === "PUBLISHED" ? new Date() : null,
          authorId: context.userId,
        },
      });
    });
    if (isTenantApiError(news)) return news;

    return NextResponse.json(news, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/news error:", error);
    if (error.name === "ZodError") {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "خطأ في إضافة الخبر" }, { status: 500 });
  }
}
