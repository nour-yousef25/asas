/** مركز الاتصال: قنوات الجمعية الحالية فقط، دون إعادة أي رمز وصول أو بيانات سرية. */
import { NextResponse } from "next/server";
import { canManageCommunications, getOrganizationContext } from "@/lib/organization-context";
import { queryTenantApi, isTenantApiError } from "@/lib/tenant-query";

export async function GET() {
  try {
    const context = await getOrganizationContext();
    if (!canManageCommunications(context.role)) return NextResponse.json({ error: "ليس لديك صلاحية إدارة قنوات الاتصال." }, { status: 403 });
    const channels = await queryTenantApi((db, ctx) => db.connectedChannel.findMany({
      where: { organizationId: ctx.organizationId },
      select: { id: true, platform: true, externalId: true, displayName: true, accountType: true, status: true, scopes: true, capabilities: true, lastSyncedAt: true, reauthReason: true, metadata: true, createdAt: true },
      orderBy: [{ platform: "asc" }, { displayName: "asc" }],
    }));
    if (isTenantApiError(channels)) return channels;
    return NextResponse.json({ channels });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "تعذر تحميل القنوات." }, { status: 401 });
  }
}
