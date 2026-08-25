import { NextRequest, NextResponse } from "next/server";
import { requireTenantContext } from "@/lib/tenant-context";
import { LocalTenantArtifactError, requireLocalTenantArtifactProvider } from "@/lib/local-tenant-artifact-provider";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token");
    if (!token) return NextResponse.json({ error: "DOCUMENT_DELIVERY_DENIED" }, { status: 403, headers: { "cache-control": "no-store" } });
    const context = await requireTenantContext();
    const resolved = await requireLocalTenantArtifactProvider().resolveDelivery(token, context.organizationId);
    return new NextResponse(resolved.data, { headers: { "content-type": "application/octet-stream", "cache-control": "private, no-store", "content-disposition": `attachment; filename="${resolved.artifactId}"` } });
  } catch (error) {
    const status = error instanceof LocalTenantArtifactError ? 403 : 500;
    return NextResponse.json({ error: "DOCUMENT_DELIVERY_DENIED" }, { status, headers: { "cache-control": "no-store" } });
  }
}
