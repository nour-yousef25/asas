import { NextRequest, NextResponse } from "next/server";
import { requireTenantContext, TenantAuthorizationError } from "@/lib/tenant-context";
import { requirePermission, PolicyAuthorizationError } from "@/lib/policy";
import { financialRepository } from "@/lib/financial-repository";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireTenantContext();
    await requirePermission(context, "donor.read");
    const { id } = await params;
    const donor = await financialRepository.getDonorById(context, id);
    if (!donor) return NextResponse.json({ error: "المانح غير موجود" }, { status: 404 });
    return NextResponse.json(donor);
  } catch (error) {
    if (error instanceof TenantAuthorizationError || error instanceof PolicyAuthorizationError) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }
    return NextResponse.json({ error: "تعذر تحميل بيانات المانح" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireTenantContext();
    await requirePermission(context, "donor.update");
    const { id } = await params;
    const body = (await req.json()) as { type?: string; subject?: string; notes?: string };
    const comm = await financialRepository.addDonorCommunication(context, id, body);
    if (!comm) return NextResponse.json({ error: "المانح غير موجود" }, { status: 404 });
    return NextResponse.json(comm, { status: 201 });
  } catch (error) {
    if (error instanceof TenantAuthorizationError || error instanceof PolicyAuthorizationError) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }
    return NextResponse.json({ error: "تعذر تسجيل التواصل" }, { status: 500 });
  }
}
