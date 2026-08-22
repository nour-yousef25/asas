import { z } from "zod";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireTenantContext, switchActiveOrganization, TenantAuthorizationError } from "@/lib/tenant-context";

const switchSchema = z.object({ organizationId: z.string().cuid() });

export async function POST(request: Request) {
  try {
    const current = await requireTenantContext();
    const session = await auth();
    const body = switchSchema.parse(await request.json());
    const next = await switchActiveOrganization({
      userId: current.userId,
      authVersion: session?.user.authVersion ?? 0,
      organizationId: body.organizationId,
      correlationId: current.correlationId,
    });
    return NextResponse.json({ organizationId: next.organizationId, membershipId: next.membershipId });
  } catch (error) {
    if (error instanceof TenantAuthorizationError) {
      return NextResponse.json({ error: "غير مصرح" }, { status: error.code === "UNAUTHENTICATED" ? 401 : 403 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "بيانات تبديل المنظمة غير صالحة" }, { status: 400 });
    }
    return NextResponse.json({ error: "تعذر تبديل المنظمة" }, { status: 500 });
  }
}
