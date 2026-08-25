import { NextRequest, NextResponse } from "next/server";
import { parsePaginationParams } from "@/lib/pagination";
import { requireTenantContext, TenantAuthorizationError } from "@/lib/tenant-context";
import { requirePermission, PolicyAuthorizationError } from "@/lib/policy";
import { financialRepository } from "@/lib/financial-repository";

export async function GET(req: NextRequest) {
  try {
    const context = await requireTenantContext();
    await requirePermission(context, "donation.read");
    const { searchParams } = new URL(req.url);
    const params = parsePaginationParams(searchParams);
    const result = await financialRepository.listDonations(context, { skip: (params.page - 1) * params.pageSize, take: params.pageSize, search: params.search, status: searchParams.get("status") });
    return NextResponse.json({ data: result.data, pagination: { page: params.page, pageSize: params.pageSize, total: result.total, totalPages: Math.ceil(result.total / params.pageSize) } });
  } catch (error) {
    if (error instanceof TenantAuthorizationError || error instanceof PolicyAuthorizationError) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }
    return NextResponse.json({ error: "تعذر تحميل التبرعات" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const context = await requireTenantContext();
    await requirePermission(context, "donation.create");
    return NextResponse.json({ error: "PAYMENT_CHECKOUT_UNAVAILABLE" }, { status: 503 });
  } catch (error: any) {
    if (error instanceof TenantAuthorizationError || error instanceof PolicyAuthorizationError) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }
    return NextResponse.json({ error: "خطأ في معالجة التبرع" }, { status: 500 });
  }
}
