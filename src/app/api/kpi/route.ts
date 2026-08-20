import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { kpiSchema, kpiRecordSchema } from "@/lib/validations";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const kpis = await prisma.kPI.findMany({
    include: { records: { orderBy: { period: "desc" } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(kpis);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const body = await req.json();
  const validated = kpiSchema.parse(body);
  const kpi = await prisma.kPI.create({ data: validated });
  return NextResponse.json(kpi, { status: 201 });
}

// تسجيل قياس جديد
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const body = await req.json();
  const validated = kpiRecordSchema.parse(body);
  const percent = validated.targetValue > 0
    ? Math.round((validated.actualValue / validated.targetValue) * 100)
    : 0;
  const record = await prisma.kPIRecord.create({
    data: { ...validated, percent },
  });
  // تحديث حالة KPI بناءً على آخر قياس
  await prisma.kPI.update({
    where: { id: validated.kpiId },
    data: { status: percent >= 100 ? "ACHIEVED" : percent < 50 ? "BEHIND" : "ACTIVE" },
  });
  return NextResponse.json(record, { status: 201 });
}
