import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { z } from "zod";

const volunteerSchema = z.object({
  userId: z.string().min(1, "المستخدم مطلوب"),
  skills: z.array(z.string()).default([]),
  availability: z.string().default("flexible"),
  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]).default("ACTIVE"),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const volunteers = await prisma.volunteer.findMany({
    include: { user: { select: { id: true, name: true, phone: true, email: true } }, activities: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(volunteers);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const body = await req.json();
  const validated = volunteerSchema.parse(body);
  const volunteer = await prisma.volunteer.create({ data: validated });
  return NextResponse.json(volunteer, { status: 201 });
}
