import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

const publicPaths = ["/login", "/api/auth", "/donate", "/store"];

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

function applyRateLimit(request: NextRequest, pathname: string): NextResponse | null {
  const ip = getClientIp(request);

  if (pathname.startsWith("/api/auth")) {
    const result = rateLimit(`auth:${ip}`, RATE_LIMITS.auth);
    if (!result.success) {
      return NextResponse.json(
        { error: "تم تجاوز الحد المسموح. حاول مرة أخرى لاحقاً" },
        { status: 429 }
      );
    }
  }

  if (pathname.startsWith("/api/sms")) {
    const result = rateLimit(`sms:${ip}`, RATE_LIMITS.sms);
    if (!result.success) {
      return NextResponse.json(
        { error: "تم تجاوز الحد المسموح للرسائل" },
        { status: 429 }
      );
    }
  }

  if (pathname.startsWith("/api/donations")) {
    const result = rateLimit(`donation:${ip}`, RATE_LIMITS.donation);
    if (!result.success) {
      return NextResponse.json(
        { error: "تم تجاوز الحد المسموح للتبرعات" },
        { status: 429 }
      );
    }
  }

  if (pathname.startsWith("/api/")) {
    const result = rateLimit(`api:${ip}`, RATE_LIMITS.api);
    if (!result.success) {
      return NextResponse.json(
        { error: "تم تجاوز الحد المسموح. حاول مرة أخرى لاحقاً" },
        { status: 429 }
      );
    }
  }

  return null;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (publicPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const sessionToken =
    request.cookies.get("__Secure-authjs.session-token")?.value ??
    request.cookies.get("authjs.session-token")?.value;

  if (pathname.startsWith("/api/")) {
    if (!sessionToken) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const rateLimitResponse = applyRateLimit(request, pathname);
    if (rateLimitResponse) return rateLimitResponse;

    return NextResponse.next();
  }

  if (!sessionToken) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
