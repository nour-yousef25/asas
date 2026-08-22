import { NextRequest, NextResponse } from "next/server";
import { campaignSchema } from "@/lib/validations";
import { requireTenantContext, TenantAuthorizationError } from "@/lib/tenant-context";
import { requirePermission, PolicyAuthorizationError } from "@/lib/policy";
import { financialRepository } from "@/lib/financial-repository";

export async function GET(req: NextRequest) {
  try {
    const context = await requireTenantContext();
    await requirePermission(context, "donation.read");
    const { searchParams } = new URL(req.url);
    const campaigns = await financialRepository.listCampaigns(context, searchParams.get("status"));
    const result = campaigns.map((c) => ({
      ...c,
      completionPercent: c.targetAmount > 0 ? Math.min(100, Math.round((c.collectedAmount / c.targetAmount) * 100)) : 0,
    }));
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof TenantAuthorizationError || error instanceof PolicyAuthorizationError) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }
    return NextResponse.json({ error: "تعذر تحميل الحملات" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const context = await requireTenantContext();
    await requirePermission(context, "donation.create");
    const body = await req.json();
    const validated = campaignSchema.parse(body);
    const campaign = await financialRepository.createCampaign(context, {
      ...validated,
      startDate: new Date(validated.startDate),
      endDate: validated.endDate ? new Date(validated.endDate) : null,
    });
    return NextResponse.json(campaign, { status: 201 });
  } catch (error: any) {
    if (error instanceof TenantAuthorizationError || error instanceof PolicyAuthorizationError) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }
    if (error?.name === "ZodError") {
      return NextResponse.json({ error: "بيانات غير صحيحة" }, { status: 400 });
    }
    return NextResponse.json({ error: "تعذر إنشاء الحملة" }, { status: 500 });
  }
}
