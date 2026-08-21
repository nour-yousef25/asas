/** مركز الاتصال: قنوات الجمعية الحالية فقط، دون إعادة أي رمز وصول أو بيانات سرية. */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { canManageCommunications, getOrganizationContext } from "@/lib/organization-context";

export async function GET() {
  try {
    const context = await getOrganizationContext();
    if (!canManageCommunications(context.role)) return NextResponse.json({ error: "ليس لديك صلاحية إدارة قنوات الاتصال." }, { status: 403 });
    const channels = await prisma.connectedChannel.findMany({
      where: { organizationId: context.organizationId },
      select: { id: true, platform: true, externalId: true, displayName: true, accountType: true, status: true, scopes: true, capabilities: true, lastSyncedAt: true, reauthReason: true, metadata: true, createdAt: true },
      orderBy: [{ platform: "asc" }, { displayName: "asc" }],
    });
    return NextResponse.json({ channels });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "تعذر تحميل القنوات." }, { status: 401 });
  }
}
