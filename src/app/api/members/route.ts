import { NextRequest } from "next/server";
import { parsePaginationParams } from "@/lib/pagination";
import { logger } from "@/lib/logger";
import { apiSuccess, apiInternalError } from "@/lib/api-response";
import { requireTenantContext } from "@/lib/tenant-context";
import { requirePermission } from "@/lib/policy";
import { memberKpiRepository } from "@/lib/member-kpi-repository";

const log = logger.child("members");

export async function GET(req: NextRequest) {
  try {
    const context = await requireTenantContext();
    await requirePermission(context, "member.read");
    const params = parsePaginationParams(new URL(req.url).searchParams);
    const result = await memberKpiRepository.listMembers(context, { skip: (params.page - 1) * params.pageSize, take: params.pageSize, search: params.search });
    return apiSuccess(result);
  } catch (error) {
    log.error("Failed to fetch members", error);
    return apiInternalError();
  }
}

export async function POST(req: NextRequest) {
  try {
    const context = await requireTenantContext();
    await requirePermission(context, "member.create");
    const body = await req.json();
    const member = await memberKpiRepository.createMember(context, { userId: body.userId, membershipFee: body.membershipFee || 0, paidAmount: body.paidAmount || 0, endDate: body.endDate ? new Date(body.endDate) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) });
    log.info("Member created", { id: member.id, userId: member.userId });
    return apiSuccess(member, 201);
  } catch (error) {
    log.error("Failed to create member", error);
    return apiInternalError();
  }
}
