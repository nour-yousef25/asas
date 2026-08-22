import { NextRequest, NextResponse } from "next/server";
import { PolicyAuthorizationError } from "@/lib/policy";
import { requireTenantContext, TenantAuthorizationError } from "@/lib/tenant-context";
import {
  parseReportGenerationInput,
  reportGenerationService,
  ReportScopeError,
  ReportValidationError,
  type ReportName,
} from "@/modules/reports/report-service";

const REPORT_NAMES = new Set<ReportName>(["financial", "donations"]);

function isExportAttempt(searchParams: URLSearchParams) {
  return ["export", "download", "format", "share"].some((name) => searchParams.has(name));
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ reportName: string }> },
) {
  try {
    const { reportName } = await params;
    if (!REPORT_NAMES.has(reportName as ReportName)) {
      return NextResponse.json({ error: "نوع التقرير غير صحيح" }, { status: 400 });
    }
    const context = await requireTenantContext();
    const searchParams = new URL(request.url).searchParams;
    if (isExportAttempt(searchParams)) {
      return NextResponse.json({ error: "تصدير أو تنزيل التقارير غير متاح في هذا النطاق." }, { status: 501 });
    }
    const input = parseReportGenerationInput(reportName as ReportName, searchParams);
    const result = reportName === "financial"
      ? await reportGenerationService.generateFinancial(context, input)
      : await reportGenerationService.generateDonations(context, input);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof ReportValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof ReportScopeError) {
      return NextResponse.json({ error: "السجل غير موجود ضمن المنظمة النشطة." }, { status: 404 });
    }
    if (error instanceof TenantAuthorizationError || error instanceof PolicyAuthorizationError) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }
    console.error("Report generation error:", error);
    return NextResponse.json({ error: "تعذر إنشاء التقرير" }, { status: 500 });
  }
}
