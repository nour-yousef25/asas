import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { announcementSchema } from "@/lib/validations";
import { auth } from "@/lib/auth";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const validated = announcementSchema.partial().parse(body);
  const item = await prisma.announcement.update({ where: { id }, data: validated });
  return NextResponse.json(item);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const { id } = await params;
  await prisma.announcement.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
