import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { evaluationGoalSchema, evaluationCompetencySchema } from "@/lib/validations";
import { auth } from "@/lib/auth";

// الحصول على تقييم محدد مع الأهداف والجدارات
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const { id } = await params;
  const evaluation = await prisma.evaluation.findUnique({
    where: { id },
    include: {
      employee: { select: { id: true, name: true, email: true } },
      evaluator: { select: { id: true, name: true } },
      goals: true,
      competencies: true,
    },
  });
  if (!evaluation) return NextResponse.json({ error: "التقييم غير موجود" }, { status: 404 });
  return NextResponse.json(evaluation);
}

// إضافة هدف أو جدارة للتقييم
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const type = body.type; // "goal" أو "competency"

  if (type === "goal") {
    const validated = evaluationGoalSchema.parse(body);
    const weightedScore = validated.score && validated.weight ? (validated.score * validated.weight / 100) : null;
    const goal = await prisma.evaluationGoal.create({
      data: { ...validated, evaluationId: id, weightedScore },
    });
    await recalculateFinalScore(id);
    return NextResponse.json(goal, { status: 201 });
  } else if (type === "competency") {
    const validated = evaluationCompetencySchema.parse(body);
    const weightedScore = validated.score && validated.weight ? (validated.score * validated.weight / 100) : null;
    const competency = await prisma.evaluationCompetency.create({
      data: { ...validated, evaluationId: id, weightedScore },
    });
    await recalculateFinalScore(id);
    return NextResponse.json(competency, { status: 201 });
  }
  return NextResponse.json({ error: "نوع غير صحيح" }, { status: 400 });
}

// إكمال التقييم
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  if (body.action === "complete") {
    await recalculateFinalScore(id);
    const evaluation = await prisma.evaluation.update({
      where: { id },
      data: { status: "COMPLETED", endDate: new Date() },
    });
    return NextResponse.json(evaluation);
  }
  if (body.action === "approve") {
    const evaluation = await prisma.evaluation.update({
      where: { id },
      data: { status: "APPROVED" },
    });
    return NextResponse.json(evaluation);
  }
  return NextResponse.json({ error: "إجراء غير صحيح" }, { status: 400 });
}

// حساب الدرجة النهائية بناءً على الأهداف والجدارات
async function recalculateFinalScore(evaluationId: string) {
  const evaluation = await prisma.evaluation.findUnique({
    where: { id: evaluationId },
    include: { goals: true, competencies: true },
  });
  if (!evaluation) return;

  let totalWeight = 0;
  let totalWeightedScore = 0;
  let allScored = true;

  for (const g of evaluation.goals) {
    totalWeight += g.weight;
    if (g.score == null) { allScored = false; }
    else if (g.weightedScore != null) { totalWeightedScore += g.weightedScore; }
  }
  for (const c of evaluation.competencies) {
    totalWeight += c.weight;
    if (c.score == null) { allScored = false; }
    else if (c.weightedScore != null) { totalWeightedScore += c.weightedScore; }
  }

  const finalScore = allScored && totalWeight > 0 ? Math.round(totalWeightedScore) : null;
  await prisma.evaluation.update({ where: { id: evaluationId }, data: { finalScore } });
}
