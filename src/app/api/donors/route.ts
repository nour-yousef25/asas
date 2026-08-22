import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireTenantContext, TenantAuthorizationError } from "@/lib/tenant-context";
import { requirePermission, PolicyAuthorizationError } from "@/lib/policy";
import { financialRepository } from "@/lib/financial-repository";

const donorSchema = z.object({
  name: z.string().min(2, "الاسم مطلوب"),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
  donorType: z.enum(["INDIVIDUAL", "CORPORATE", "GOVERNMENT"]).default("INDIVIDUAL"),
  status: z.enum(["ACTIVE", "INACTIVE", "POTENTIAL"]).default("ACTIVE"),
});

export async function GET() {
  try {
    const context = await requireTenantContext();
    await requirePermission(context, "donor.read");
    const donors = await financialRepository.listDonors(context);
    return NextResponse.json(donors);
  } catch (error) {
    if (error instanceof TenantAuthorizationError || error instanceof PolicyAuthorizationError) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }
    return NextResponse.json({ error: "تعذر تحميل المانحين" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const context = await requireTenantContext();
    await requirePermission(context, "donor.create");
    const body = await req.json();
    const validated = donorSchema.parse(body);
    const donor = await financialRepository.createDonor(context, validated);
    return NextResponse.json(donor, { status: 201 });
  } catch (error: any) {
    if (error instanceof TenantAuthorizationError || error instanceof PolicyAuthorizationError) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }
    if (error?.name === "ZodError") {
      return NextResponse.json({ error: "بيانات غير صحيحة" }, { status: 400 });
    }
    return NextResponse.json({ error: "تعذر إنشاء المانح" }, { status: 500 });
  }
}
