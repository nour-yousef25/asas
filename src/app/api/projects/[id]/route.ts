import { NextRequest, NextResponse } from "next/server";
import { projectSchema } from "@/lib/validations";
import { requireTenantContext, TenantAuthorizationError } from "@/lib/tenant-context";
import { requirePermission, PolicyAuthorizationError } from "@/lib/policy";
import { financialRepository } from "@/lib/financial-repository";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireTenantContext();
    await requirePermission(context, "project.read");
    const { id } = await params;
    const project = await financialRepository.getProjectDetail(context, id);
    if (!project) return NextResponse.json({ error: "المشروع غير موجود" }, { status: 404 });
    return NextResponse.json(project);
  } catch (error) {
    if (error instanceof TenantAuthorizationError || error instanceof PolicyAuthorizationError) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    return NextResponse.json({ error: "خطأ في جلب المشروع" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireTenantContext();
    await requirePermission(context, "project.update");
    const { id } = await params;
    const body = await req.json();
    const validated = projectSchema.partial().parse(body);
    const project = await financialRepository.updateProject(context, id, validated);
    if (!project) return NextResponse.json({ error: "المشروع غير موجود" }, { status: 404 });
    return NextResponse.json(project);
  } catch (error: any) {
    if (error instanceof TenantAuthorizationError || error instanceof PolicyAuthorizationError) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    if (error.name === "ZodError") return NextResponse.json({ error: error.issues }, { status: 400 });
    return NextResponse.json({ error: "خطأ في تحديث المشروع" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireTenantContext();
    await requirePermission(context, "project.delete");
    const { id } = await params;
    const deleted = await financialRepository.deleteProject(context, id);
    if (!deleted) return NextResponse.json({ error: "المشروع غير موجود" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof TenantAuthorizationError || error instanceof PolicyAuthorizationError) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    return NextResponse.json({ error: "خطأ في حذف المشروع" }, { status: 500 });
  }
}
