import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { projectSchema } from "@/lib/validations";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const where: any = {};
    if (status) where.status = status;

    const projects = await prisma.project.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(projects);
  } catch (error) {
    return NextResponse.json({ error: "خطأ في جلب المشاريع" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

    const body = await req.json();
    const validated = projectSchema.parse(body);

    const project = await prisma.project.create({
      data: {
        ...validated,
        creatorId: session.user.id,
      },
    });
    return NextResponse.json(project, { status: 201 });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "خطأ في إضافة المشروع" }, { status: 500 });
  }
}
