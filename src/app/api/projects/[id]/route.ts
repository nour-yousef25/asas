import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { projectSchema } from "@/lib/validations";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    const { id } = await params;
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        donations: { where: { status: "COMPLETED" }, select: { id: true, amount: true, createdAt: true, donorId: true }, take: 50 },
        creator: { select: { name: true } },
      },
    });
    if (!project) return NextResponse.json({ error: "المشروع غير موجود" }, { status: 404 });
    return NextResponse.json(project);
  } catch {
    return NextResponse.json({ error: "خطأ في جلب المشروع" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

    const { id } = await params;
    const body = await req.json();
    const validated = projectSchema.partial().parse(body);

    // تحديث نسبة الإكمال تلقائياً
    if ("collectedAmount" in validated || "targetAmount" in validated) {
      const project = await prisma.project.findUnique({ where: { id } });
      if (project) {
        const collected = validated.collectedAmount ?? project.collectedAmount;
        const target = validated.targetAmount ?? project.targetAmount;
        validated.completionPercent = target > 0 ? Math.round((collected / target) * 100) : 0;
      }
    }

    const project = await prisma.project.update({ where: { id }, data: validated });
    return NextResponse.json(project);
  } catch (error: any) {
    if (error.name === "ZodError") return NextResponse.json({ error: error.errors }, { status: 400 });
    return NextResponse.json({ error: "خطأ في تحديث المشروع" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    const { id } = await params;
    await prisma.project.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "خطأ في حذف المشروع" }, { status: 500 });
  }
}
