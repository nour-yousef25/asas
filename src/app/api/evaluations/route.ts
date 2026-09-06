import { NextRequest, NextResponse } from "next/server";
import { evaluationSchema } from "@/lib/validations";
import { queryTenantApi, isTenantApiError } from "@/lib/tenant-query";

export async function GET() {
  const evaluations = await queryTenantApi((db) =>
    db.evaluation.findMany({
      include: {
        employee: { select: { id: true, name: true } },
        evaluator: { select: { id: true, name: true } },
        goals: true,
        competencies: true,
      },
      orderBy: { createdAt: "desc" },
    }),
  );
  if (isTenantApiError(evaluations)) return evaluations;
  return NextResponse.json(evaluations);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const validated = evaluationSchema.parse(body);
  const evaluation = await queryTenantApi((db, context) =>
    db.evaluation.create({
      data: {
        employeeId: validated.employeeId,
        evaluatorId: context.userId,
        period: validated.period,
        startDate: new Date(validated.startDate),
        endDate: validated.endDate ? new Date(validated.endDate) : null,
        status: "IN_PROGRESS",
      },
    }),
  );
  if (isTenantApiError(evaluation)) return evaluation;
  return NextResponse.json(evaluation, { status: 201 });
}
