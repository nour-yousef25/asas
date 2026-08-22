import { NextResponse } from "next/server";
import { requireTenantContext, TenantAuthorizationError, type ResolvedTenantContext } from "@/lib/tenant-context";

export async function withTenantContext<T>(handler: (context: ResolvedTenantContext) => Promise<T>) {
  try {
    const context = await requireTenantContext();
    return NextResponse.json(await handler(context));
  } catch (error) {
    if (error instanceof TenantAuthorizationError) {
      const status = error.code === "UNAUTHENTICATED" || error.code === "STALE_SESSION" ? 401 : 403;
      return NextResponse.json({ error: "غير مصرح" }, { status });
    }
    return NextResponse.json({ error: "تعذر التحقق من سياق المنظمة" }, { status: 500 });
  }
}
