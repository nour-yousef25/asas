import { NextRequest, NextResponse } from "next/server";
import { announcementSchema } from "@/lib/validations";
import { auth } from "@/lib/auth";
import { queryTenantApi, isTenantApiError } from "@/lib/tenant-query";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const validated = announcementSchema.partial().parse(body);
  const item = await queryTenantApi((db) =>
    db.announcement.update({ where: { id }, data: validated }),
  );
  if (isTenantApiError(item)) return item;
  return NextResponse.json(item);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const { id } = await params;
  const result = await queryTenantApi((db) =>
    db.announcement.delete({ where: { id } }),
  );
  if (isTenantApiError(result)) return result;
  return NextResponse.json({ success: true });
}
