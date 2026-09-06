import { NextRequest, NextResponse } from "next/server";
import { queryTenantApi, isTenantApiError } from "@/lib/tenant-query";

export async function GET() {
  const albums = await queryTenantApi((db) =>
    db.photoAlbum.findMany({
      include: { photos: true },
      orderBy: { sortOrder: "asc" },
    }),
  );
  if (isTenantApiError(albums)) return albums;
  return NextResponse.json(albums);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const album = await queryTenantApi((db) =>
    db.photoAlbum.create({
      data: { title: body.title, description: body.description, coverUrl: body.coverUrl },
    }),
  );
  if (isTenantApiError(album)) return album;
  return NextResponse.json(album, { status: 201 });
}
