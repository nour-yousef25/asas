import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { apiError, apiInternalError, apiSuccess } from "@/lib/api-response";
import { parsePaginationParams } from "@/lib/pagination";
import { requireTenantContext } from "@/lib/tenant-context";
import { requirePermission } from "@/lib/policy";
import { membershipRepository } from "@/lib/membership-repository";

export async function GET(request: NextRequest) {
  try {
    const context = await requireTenantContext();
    await requirePermission(context, "identity.membership.read");
    const params = parsePaginationParams(new URL(request.url).searchParams);
    return apiSuccess(await membershipRepository.list(context, { skip: (params.page - 1) * params.pageSize, take: params.pageSize, search: params.search }));
  } catch {
    return apiInternalError();
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await requireTenantContext();
    await requirePermission(context, "identity.membership.manage");
    const body = await request.json() as { userId?: unknown; role?: unknown };
    if (typeof body.userId !== "string" || (body.role !== undefined && (!Object.values(Role).includes(body.role as Role)))) return apiError("بيانات العضوية غير صالحة", 400);
    return apiSuccess(await membershipRepository.create(context, { userId: body.userId, role: body.role as Role | undefined }), 201);
  } catch {
    return apiInternalError();
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const context = await requireTenantContext();
    await requirePermission(context, "identity.membership.manage");
    const membershipId = new URL(request.url).searchParams.get("id");
    if (!membershipId) return apiError("معرف العضوية مطلوب", 400);
    return apiSuccess(await membershipRepository.revoke(context, membershipId));
  } catch {
    return apiInternalError();
  }
}
