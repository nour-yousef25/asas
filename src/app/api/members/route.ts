import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { parsePaginationParams, buildSearchCondition, paginatedQuery } from "@/lib/pagination";
import { memberInclude } from "@/lib/prisma-selects";
import { logger } from "@/lib/logger";
import { apiSuccess, apiUnauthorized, apiInternalError } from "@/lib/api-response";

const log = logger.child("members");

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return apiUnauthorized();

    const { searchParams } = new URL(req.url);
    const params = parsePaginationParams(searchParams);

    const searchFields = ["user.name", "user.phone", "user.email"];
    const searchCondition = buildSearchCondition(params.search, searchFields);

    const result = await paginatedQuery(
      (args) =>
        prisma.member.findMany({
          ...args,
          include: memberInclude,
        }),
      (args) => prisma.member.count(args),
      searchCondition,
      params,
      "createdAt"
    );

    return apiSuccess(result);
  } catch (error) {
    log.error("Failed to fetch members", error);
    return apiInternalError();
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return apiUnauthorized();

    const body = await req.json();
    const member = await prisma.member.create({
      data: {
        userId: body.userId,
        membershipType: body.membershipType || "REGULAR",
        membershipFee: body.membershipFee || 0,
        paidAmount: body.paidAmount || 0,
        endDate: body.endDate
          ? new Date(body.endDate)
          : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        status: body.status || "ACTIVE",
        paymentStatus: body.paymentStatus || "PENDING",
      },
      include: memberInclude,
    });

    log.info("Member created", { id: member.id, userId: member.userId });
    return apiSuccess(member, 201);
  } catch (error) {
    log.error("Failed to create member", error);
    return apiInternalError();
  }
}
