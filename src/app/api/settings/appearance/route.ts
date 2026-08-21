import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { auth } from "@/lib/auth";

const prisma = new PrismaClient();

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

    const organization = await prisma.organization.findFirst({
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });
    if (!organization) {
      return NextResponse.json({ error: "لم يتم إعداد بيانات الجمعية بعد" }, { status: 404 });
    }

    // تحديث الإعدادات في قاعدة البيانات
    const updatedSettings = await prisma.organization.update({
      where: { id: organization.id },
      data: {
        logo: logoUrl,
        primaryColor,
        secondaryColor,
      },
    });

    return NextResponse.json(updatedSettings, { status: 200 });
  } catch (error: any) {
    console.error("Error updating appearance settings:", error);
    return NextResponse.json(
      { error: "Failed to save appearance settings" },
      { status: 500 }
    );
  }
}
