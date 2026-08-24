import { NextRequest } from "next/server";
import { apiError, apiInternalError, apiSuccess } from "@/lib/api-response";
import { privateArtifactRepository } from "@/lib/private-artifact";
import { requireTenantContext } from "@/lib/tenant-context";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { const { id } = await params; return apiSuccess(await privateArtifactRepository.issueDownload(await requireTenantContext(), id)); } catch { return apiInternalError(); }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params; const form = await request.formData(); const file = form.get("file");
    if (!(file instanceof File)) return apiError("ملف مطلوب", 400);
    const data = new Uint8Array(await file.arrayBuffer());
    return apiSuccess(await privateArtifactRepository.replace(await requireTenantContext(), id, { contentType: file.type, size: file.size, data }));
  } catch { return apiInternalError(); }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { const { id } = await params; return apiSuccess(await privateArtifactRepository.delete(await requireTenantContext(), id)); } catch { return apiInternalError(); }
}
