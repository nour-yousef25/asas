import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * واجهة API لحفظ إعدادات المظهر.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { logoUrl, primaryColor, secondaryColor } = body;

    // تحديث الإعدادات في قاعدة البيانات
    const updatedSettings = await prisma.organization.update({
      where: { id: 1 }, // مثال: تحديث الإعدادات لجمعية معينة (معرّف ثابت)
      data: {
        logoUrl,
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