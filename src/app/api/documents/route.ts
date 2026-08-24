import { NextRequest } from "next/server";
import { apiError, apiInternalError, apiSuccess } from "@/lib/api-response";
import { privateArtifactRepository } from "@/lib/private-artifact";
import { requireTenantContext } from "@/lib/tenant-context";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

export async function GET() {
  try { return apiSuccess(await privateArtifactRepository.list(await requireTenantContext())); } catch { return apiInternalError(); }
}

export async function POST(request: NextRequest) {
  try {
    const context = await requireTenantContext();
    const form = await request.formData();
    const file = form.get("file");
    const beneficiaryId = form.get("beneficiaryId");
    const category = form.get("category");
    if (!(file instanceof File)) return apiError("ملف مطلوب", 400);
    if (!ALLOWED_TYPES.has(file.type)) return apiError("نوع الملف غير مدعوم", 400);
    if (typeof beneficiaryId !== "string" && beneficiaryId !== null) return apiError("معرف المستفيد غير صالح", 400);
    if (typeof category !== "string" && category !== null) return apiError("تصنيف المستند غير صالح", 400);
    const data = new Uint8Array(await file.arrayBuffer());
    return apiSuccess(await privateArtifactRepository.create(context, { name: file.name, contentType: file.type, size: file.size, data, beneficiaryId: beneficiaryId ?? undefined, category: category ?? undefined }), 201);
  } catch { return apiInternalError(); }
}
