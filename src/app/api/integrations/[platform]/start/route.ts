/** بدء تفويض OAuth من الخادم مع state وPKCE؛ لا تُنشأ روابط اتصال من العميل. */
import { NextResponse } from "next/server";
import { SocialPlatform } from "@prisma/client";
import { beginOAuth } from "@/lib/communications/oauth";
import { authorizeUrl, getProviderConfig, platformScopes } from "@/lib/communications/connectors";
import { canManageCommunications } from "@/lib/organization-context";

function platformFromParam(value: string) {
  const valueUpper = value.toUpperCase();
  return Object.values(SocialPlatform).includes(valueUpper as SocialPlatform) ? valueUpper as SocialPlatform : null;
}

export async function GET(request: Request, { params }: { params: Promise<{ platform: string }> }) {
  try {
    const { platform: rawPlatform } = await params;
    const platform = platformFromParam(rawPlatform);
    if (!platform) return NextResponse.json({ error: "منصة غير مدعومة." }, { status: 404 });
    getProviderConfig(platform);
    const flow = await beginOAuth(platform, platformScopes[platform]);
    if (!canManageCommunications(flow.context.role)) return NextResponse.json({ error: "ليس لديك صلاحية ربط قنوات الاتصال." }, { status: 403 });
    return NextResponse.redirect(authorizeUrl(platform, flow));
  } catch (error) {
    const message = encodeURIComponent(error instanceof Error ? error.message : "تعذر بدء ربط القناة.");
    return NextResponse.redirect(new URL(`/communications/channels?connectionError=${message}`, new URL(request.url).origin));
  }
}
