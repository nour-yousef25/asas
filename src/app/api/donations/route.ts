import { NextRequest, NextResponse } from "next/server";
import { donationSchema } from "@/lib/validations";
import { generateInvoiceNumber, generateRandomNumber } from "@/lib/utils";
import { processPayment } from "@/lib/integrations/payment";
import { parsePaginationParams } from "@/lib/pagination";
import { requireTenantContext, TenantAuthorizationError } from "@/lib/tenant-context";
import { requirePermission, PolicyAuthorizationError } from "@/lib/policy";
import { financialRepository, FinancialScopeError } from "@/lib/financial-repository";

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
    const body = await req.json();
    const validated = donationSchema.parse(body);

    if (validated.donorId && !(await financialRepository.getDonorById(context, validated.donorId))) {
      return NextResponse.json({ error: "المانح غير موجود" }, { status: 404 });
    }
    if (validated.campaignId && !(await financialRepository.getCampaignById(context, validated.campaignId))) {
      return NextResponse.json({ error: "الحملة غير موجودة" }, { status: 404 });
    }
    if (validated.projectId && !(await financialRepository.getProjectById(context, validated.projectId))) {
      return NextResponse.json({ error: "المشروع غير موجود" }, { status: 404 });
    }

    const paymentResult = await processPayment({
      amount: validated.amount,
      method: validated.paymentMethod,
      reference: `PAY-${Date.now()}-${generateRandomNumber(6)}`,
    });

    if (!paymentResult.success) {
      return NextResponse.json({ error: "فشل عملية الدفع" }, { status: 400 });
    }

    const taxNumber = process.env.ORG_TAX_NUMBER || "300000000000003";
    const { donation, invoice } = await financialRepository.createDonation(context, {
      ...validated,
      paymentRef: paymentResult.reference,
      invoiceNo: generateInvoiceNumber(),
      taxNumber,
    });

    return NextResponse.json({ donation, invoice, success: true }, { status: 201 });
  } catch (error: any) {
    if (error instanceof TenantAuthorizationError || error instanceof PolicyAuthorizationError) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }
    if (error instanceof FinancialScopeError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error.name === "ZodError") {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error("Donation error:", error);
    return NextResponse.json({ error: "خطأ في معالجة التبرع" }, { status: 500 });
  }
}
