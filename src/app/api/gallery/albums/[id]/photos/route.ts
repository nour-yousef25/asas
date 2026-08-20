import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const photos = await prisma.photo.createMany({
    data: (body.photos as any[]).map((p) => ({ ...p, albumId: id })),
  });
  return NextResponse.json(photos, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const photoId = searchParams.get("photoId");
  if (photoId) {
    await prisma.photo.delete({ where: { id: photoId } });
  }
  return NextResponse.json({ success: true });
}
