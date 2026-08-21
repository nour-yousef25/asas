import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { beneficiarySchema } from "@/lib/validations";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { apiSuccess, apiUnauthorized, apiError, apiInternalError } from "@/lib/api-response";
import { parsePaginationParams, buildSearchCondition, paginatedQuery } from "@/lib/pagination";

const log = logger.child("beneficiaries");

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return apiUnauthorized();

    const { searchParams } = new URL(req.url);
    const params = parsePaginationParams(searchParams);
    const status = searchParams.get("status");

    const searchFields = ["name", "phone", "email", "nationalId"];
    const searchCondition = buildSearchCondition(params.search, searchFields);

    const where: any = { ...searchCondition };
    if (status) where.status = status;

    const result = await paginatedQuery(
      (args) =>
        prisma.beneficiary.findMany({
          ...args,
          include: { documents: true },
        }),
      (args) => prisma.beneficiary.count(args),
      where,
      params,
      "createdAt"
    );

    return apiSuccess(result.data, 200);
  } catch (error) {
    log.error("Failed to fetch beneficiaries", error);
    return apiInternalError();
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return apiUnauthorized();

    const body = await req.json();
    const validated = beneficiarySchema.parse(body);
    const beneficiary = await prisma.beneficiary.create({
      data: {
        ...validated,
        dateOfBirth: validated.dateOfBirth ? new Date(validated.dateOfBirth) : null,
      },
    });

    log.info("Beneficiary created", { id: beneficiary.id, name: beneficiary.name });
    return apiSuccess(beneficiary, 201);
  } catch (error: any) {
    if (error.name === "ZodError") {
      return apiError("بيانات غير صحيحة", 400);
    }
    log.error("Failed to create beneficiary", error);
    return apiInternalError();
  }
}
