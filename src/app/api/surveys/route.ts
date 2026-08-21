import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { surveySchema } from "@/lib/validations";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const surveys = await prisma.survey.findMany({
    include: { _count: { select: { questions: true, responses: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(surveys);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const parsed = surveySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "بيانات الاستبيان غير صالحة" }, { status: 400 });
  const survey = await prisma.survey.create({
    data: {
      ...parsed.data,
      status: parsed.data.startDate ? "ACTIVE" : "DRAFT",
    },
    include: { _count: { select: { questions: true, responses: true } } },
  });
  return NextResponse.json(survey, { status: 201 });
}
