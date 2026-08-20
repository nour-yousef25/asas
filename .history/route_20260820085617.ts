import { NextResponse } from 'next/server';
import {
  generateFinancialReport,
  generateDonationsReport,
} from '@/modules/reports/generator';

type RouteParams = {
  params: {
    reportName: string;
  };
};

export async function GET(request: Request, { params }: RouteParams) {
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const { reportName } = params;

  if (!startDate || !endDate) {
    return NextResponse.json(
      { message: 'startDate and endDate query parameters are required.' },
      { status: 400 }
    );
  }

  try {
    const start = new Date(startDate);
    const end = new Date(endDate);

    let reportData;

    switch (reportName) {
      case 'financial':
        reportData = await generateFinancialReport(start, end);
        break;
      case 'donations':
        reportData = await generateDonationsReport(start, end);
        break;
      default:
        return NextResponse.json({ message: `Report type '${reportName}' not found.` }, { status: 404 });
    }

    return NextResponse.json(reportData);
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}