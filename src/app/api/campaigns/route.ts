import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { campaignSchema } from "@/lib/validations";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const where: any = {};
  if (status) where.status = status;
  const campaigns = await prisma.donationCampaign.findMany({
    where,
    orderBy: { displayOrder: "asc" },
  });
  // إضافة نسبة الإكمال
  const result = campaigns.map((c) => ({
    ...c,
    completionPercent: c.targetAmount > 0 ? Math.min(100, Math.round((c.collectedAmount / c.targetAmount) * 100)) : 0,
  }));
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const body = await req.json();
  const validated = campaignSchema.parse(body);
  const campaign = await prisma.donationCampaign.create({
    data: {
      ...validated,
      startDate: new Date(validated.startDate),
      endDate: validated.endDate ? new Date(validated.endDate) : null,
    },
  });
  return NextResponse.json(campaign, { status: 201 });
}
