import { NextRequest, NextResponse } from "next/server";
import { surveySchema } from "@/lib/validations";
import { queryTenantApi, isTenantApiError } from "@/lib/tenant-query";

export async function GET() {
  const surveys = await queryTenantApi((db, context) =>
    db.survey.findMany({
      where: { organizationId: context.organizationId },
      include: { _count: { select: { questions: true, responses: true } } },
      orderBy: { createdAt: "desc" },
    }),
  );
  if (isTenantApiError(surveys)) return surveys;
  return NextResponse.json(surveys);
}

export async function POST(req: NextRequest) {
  const parsed = surveySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "بيانات الاستبيان غير صالحة" }, { status: 400 });
  const survey = await queryTenantApi((db, context) =>
    db.survey.create({
      data: {
        ...parsed.data,
        organizationId: context.organizationId,
        status: parsed.data.startDate ? "ACTIVE" : "DRAFT",
      },
      include: { _count: { select: { questions: true, responses: true } } },
    }),
  );
  if (isTenantApiError(survey)) return survey;
  return NextResponse.json(survey, { status: 201 });
}
