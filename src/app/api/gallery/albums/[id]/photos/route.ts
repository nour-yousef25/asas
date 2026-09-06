import { NextRequest, NextResponse } from "next/server";
import { queryTenantApi, isTenantApiError } from "@/lib/tenant-query";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const photos = await queryTenantApi((db) =>
    db.photo.createMany({
      data: (body.photos as any[]).map((p) => ({ ...p, albumId: id })),
    }),
  );
  if (isTenantApiError(photos)) return photos;
  return NextResponse.json(photos, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const photoId = searchParams.get("photoId");
  if (photoId) {
    const result = await queryTenantApi((db) =>
      db.photo.delete({ where: { id: photoId } }),
    );
    if (isTenantApiError(result)) return result;
  }
  return NextResponse.json({ success: true });
}
