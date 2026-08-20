import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { z } from "zod";

const donorSchema = z.object({
  name: z.string().min(2, "الاسم مطلوب"),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
  donorType: z.enum(["INDIVIDUAL", "CORPORATE", "GOVERNMENT"]).default("INDIVIDUAL"),
  status: z.enum(["ACTIVE", "INACTIVE", "POTENTIAL"]).default("ACTIVE"),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const donors = await prisma.donor.findMany({
    include: {
      donations: { where: { status: "COMPLETED" }, select: { amount: true, createdAt: true } },
      communications: { orderBy: { createdAt: "desc" }, take: 5 },
    },
    orderBy: { totalDonations: "desc" },
  });
  return NextResponse.json(donors);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const body = await req.json();
  const validated = donorSchema.parse(body);
  const donor = await prisma.donor.create({ data: validated });
  return NextResponse.json(donor, { status: 201 });
}
