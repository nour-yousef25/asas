import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { newsSchema } from "@/lib/validations";
import { slugify } from "@/lib/utils";
import { auth } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const news = await prisma.news.findUnique({
      where: { id },
      include: { author: { select: { id: true, name: true } } },
    });

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
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const validated = newsSchema.partial().parse(body);

    if (validated.title) {
      let slug = slugify(validated.title);
      const existing = await prisma.news.findUnique({ where: { slug } });
      if (existing && existing.id !== id) slug = `${slug}-${Date.now()}`;
      validated.slug = slug;
    }

    const news = await prisma.news.update({
      where: { id },
      data: {
        ...validated,
        publishedAt: validated.status === "PUBLISHED" ? new Date() : undefined,
      },
    });
    return NextResponse.json(news);
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "خطأ في تحديث الخبر" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const { id } = await params;
    await prisma.news.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "خطأ في حذف الخبر" }, { status: 500 });
  }
}
