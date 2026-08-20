import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { newsSchema } from "@/lib/validations";
import { slugify } from "@/lib/utils";
import { auth } from "@/lib/auth";

// الحصول على قائمة الأخبار
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const category = searchParams.get("category");
    const limit = parseInt(searchParams.get("limit") || "50");
    const page = parseInt(searchParams.get("page") || "1");

    const where: any = {};
    if (status) where.status = status;
    if (category) where.category = category;

    const [news, total] = await Promise.all([
      prisma.news.findMany({
        where,
        include: { author: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: (page - 1) * limit,
      }),
      prisma.news.count({ where }),
    ]);

    return NextResponse.json({ data: news, total, page, limit });
  } catch (error) {
    console.error("GET /api/news error:", error);
    return NextResponse.json({ error: "خطأ في جلب الأخبار" }, { status: 500 });
  }
}

// إضافة خبر جديد
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const body = await req.json();
    const validated = newsSchema.parse(body);

    let slug = slugify(validated.title);
    const existing = await prisma.news.findUnique({ where: { slug } });
    if (existing) slug = `${slug}-${Date.now()}`;

    const news = await prisma.news.create({
      data: {
        ...validated,
        slug,
        publishedAt: validated.status === "PUBLISHED" ? new Date() : null,
        authorId: session.user.id,
      },
    });

    return NextResponse.json(news, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/news error:", error);
    if (error.name === "ZodError") {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "خطأ في إضافة الخبر" }, { status: 500 });
  }
}
