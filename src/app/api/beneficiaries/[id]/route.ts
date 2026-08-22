import { NextRequest } from "next/server";
import { beneficiarySchema } from "@/lib/validations";
import { apiError, apiInternalError, apiSuccess } from "@/lib/api-response";
import { requireTenantContext, TenantAuthorizationError } from "@/lib/tenant-context";
import { requirePermission, PolicyAuthorizationError } from "@/lib/policy";
import { beneficiaryRepository } from "@/lib/beneficiary-repository";

const denied = (error: unknown) => error instanceof TenantAuthorizationError || error instanceof PolicyAuthorizationError;
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { const context = await requireTenantContext(); await requirePermission(context, "beneficiary.read"); const record = await beneficiaryRepository.getById(context, (await params).id); return record ? apiSuccess(record) : apiError("غير موجود", 404); }
  catch (error) { return denied(error) ? apiError("غير مصرح", 403) : apiInternalError(); }
}
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { const context = await requireTenantContext(); await requirePermission(context, "beneficiary.update"); const body = beneficiarySchema.partial().parse(await request.json()); const { organizationId: _ignored, ...safe } = body as typeof body & { organizationId?: unknown }; const record = await beneficiaryRepository.update(context, (await params).id, { ...safe, dateOfBirth: safe.dateOfBirth ? new Date(safe.dateOfBirth) : undefined }); return record ? apiSuccess(record) : apiError("غير موجود", 404); }
  catch (error: any) { return denied(error) ? apiError("غير مصرح", 403) : error.name === "ZodError" ? apiError("بيانات غير صحيحة", 400) : apiInternalError(); }
}
export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { const context = await requireTenantContext(); await requirePermission(context, "beneficiary.delete"); const deleted = await beneficiaryRepository.deleteOrArchive(context, (await params).id); return deleted ? apiSuccess({ deleted: true }) : apiError("غير موجود", 404); }
  catch (error) { return denied(error) ? apiError("غير مصرح", 403) : apiInternalError(); }
}
