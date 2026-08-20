import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET() {
  const albums = await prisma.photoAlbum.findMany({
    include: { photos: true },
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json(albums);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const body = await req.json();
  const album = await prisma.photoAlbum.create({
    data: { title: body.title, description: body.description, coverUrl: body.coverUrl },
  });
  return NextResponse.json(album, { status: 201 });
}
