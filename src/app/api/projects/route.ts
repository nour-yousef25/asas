import { NextRequest, NextResponse } from "next/server";
import { projectSchema } from "@/lib/validations";
import { requireTenantContext, TenantAuthorizationError } from "@/lib/tenant-context";
import { requirePermission, PolicyAuthorizationError } from "@/lib/policy";
import { financialRepository } from "@/lib/financial-repository";

export async function GET(req: NextRequest) {
  try {
    const context = await requireTenantContext();
    await requirePermission(context, "project.read");
    const status = new URL(req.url).searchParams.get("status");
    const projects = await financialRepository.listProjects(context, status);
    return NextResponse.json(projects);
  } catch (error) {
    if (error instanceof TenantAuthorizationError || error instanceof PolicyAuthorizationError) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    return NextResponse.json({ error: "خطأ في جلب المشاريع" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const context = await requireTenantContext();
    await requirePermission(context, "project.create");
    const body = await req.json();
    const validated = projectSchema.parse(body);
    const project = await financialRepository.createProject(context, validated);
    return NextResponse.json(project, { status: 201 });
  } catch (error: any) {
    if (error instanceof TenantAuthorizationError || error instanceof PolicyAuthorizationError) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    if (error.name === "ZodError") {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "خطأ في إضافة المشروع" }, { status: 500 });
  }
}
