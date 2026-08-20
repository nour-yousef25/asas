import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const { id } = await params;
  const donor = await prisma.donor.findUnique({
    where: { id },
    include: {
      donations: { include: { project: { select: { title: true } }, campaign: { select: { title: true } } }, orderBy: { createdAt: "desc" } },
      communications: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!donor) return NextResponse.json({ error: "المانح غير موجود" }, { status: 404 });
  return NextResponse.json(donor);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const comm = await prisma.donorCommunication.create({
    data: {
      donorId: id,
      type: body.type,
      subject: body.subject,
      notes: body.notes,
    },
  });
  return NextResponse.json(comm, { status: 201 });
}
