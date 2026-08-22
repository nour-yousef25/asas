import { NextRequest } from "next/server";
import { beneficiarySchema } from "@/lib/validations";
import { logger } from "@/lib/logger";
import { apiSuccess, apiError, apiInternalError } from "@/lib/api-response";
import { parsePaginationParams } from "@/lib/pagination";
import { requireTenantContext, TenantAuthorizationError } from "@/lib/tenant-context";
import { requirePermission, PolicyAuthorizationError } from "@/lib/policy";
import { beneficiaryRepository } from "@/lib/beneficiary-repository";

const log = logger.child("beneficiaries");

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const params = parsePaginationParams(searchParams);
    const status = searchParams.get("status");
    const context = await requireTenantContext();
    await requirePermission(context, "beneficiary.read");
    const result = await beneficiaryRepository.list(context, { skip: (params.page - 1) * params.pageSize, take: params.pageSize, search: params.search, status: status ?? undefined });
    return apiSuccess({ data: result.data, pagination: { page: params.page, pageSize: params.pageSize, total: result.total, totalPages: Math.ceil(result.total / params.pageSize) } }, 200);
  } catch (error) {
    if (error instanceof TenantAuthorizationError || error instanceof PolicyAuthorizationError) return apiError("غير مصرح", 403);
    log.error("Failed to fetch beneficiaries", error);
    return apiInternalError();
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = beneficiarySchema.parse(body);
    const context = await requireTenantContext();
    await requirePermission(context, "beneficiary.create");
    const { organizationId: _ignoredOrganizationId, ...safe } = body as { organizationId?: unknown };
    const beneficiary = await beneficiaryRepository.create(context, { ...safe, ...validated, dateOfBirth: validated.dateOfBirth ? new Date(validated.dateOfBirth) : null });

    log.info("Beneficiary created", { id: beneficiary.id, name: beneficiary.name });
    return apiSuccess(beneficiary, 201);
  } catch (error: any) {
    if (error instanceof TenantAuthorizationError || error instanceof PolicyAuthorizationError) return apiError("غير مصرح", 403);
    if (error.name === "ZodError") {
      return apiError("بيانات غير صحيحة", 400);
    }
    log.error("Failed to create beneficiary", error);
    return apiInternalError();
  }
}
