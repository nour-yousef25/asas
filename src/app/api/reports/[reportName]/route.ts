import { NextRequest, NextResponse } from "next/server";
import { generateFinancialReport, generateDonationsReport } from "@/src/modules/reports/generator";

export async function GET(
  request: NextRequest,
  { params }: { params: { reportName: string } }
) {
  try {
    const { reportName } = params;
    let response;

    // اختيار التقرير بناءً على الاسم
    if (reportName === "financial") {
      response = await generateFinancialReport();
    } else if (reportName === "donations") {
      response = await generateDonationsReport();
    } else {
      return NextResponse.json(
        { error: "نوع التقرير غير صحيح" },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, message: `تم إنشاء تقرير ${reportName}` });
  } catch (error: any) {
    console.error("Error generating report:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء إنشاء التقرير" },
      { status: 500 }
    );
  }
}