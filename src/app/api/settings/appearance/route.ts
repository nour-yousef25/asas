import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { queryTenantApi, isTenantApiError } from "@/lib/tenant-query";

/**
 * واجهة API لحفظ إعدادات المظهر.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const body = await request.json();
    const { logoUrl, primaryColor, secondaryColor } = body;

    const updatedSettings = await queryTenantApi((db, context) =>
      db.organization.update({
        where: { id: context.organizationId },
        data: {
          logo: logoUrl,
          primaryColor,
          secondaryColor,
        },
      }),
      "settings.manage",
    );
    if (isTenantApiError(updatedSettings)) return updatedSettings;

    return NextResponse.json(updatedSettings, { status: 200 });
  } catch (error: any) {
    console.error("Error updating appearance settings:", error);
    return NextResponse.json(
      { error: "Failed to save appearance settings" },
      { status: 500 }
    );
  }
}
