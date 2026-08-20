import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { evaluationSchema } from "@/lib/validations";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const evaluations = await prisma.evaluation.findMany({
    include: {
      employee: { select: { id: true, name: true } },
      evaluator: { select: { id: true, name: true } },
      goals: true,
      competencies: true,
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(evaluations);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const body = await req.json();
  const validated = evaluationSchema.parse(body);
  const evaluation = await prisma.evaluation.create({
    data: {
      employeeId: validated.employeeId,
      evaluatorId: session.user.id,
      period: validated.period,
      startDate: new Date(validated.startDate),
      endDate: validated.endDate ? new Date(validated.endDate) : null,
      status: "IN_PROGRESS",
    },
  });
  return NextResponse.json(evaluation, { status: 201 });
}
