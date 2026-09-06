import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { isCanonicalAuthRequestHost, SCHOOL_SCREEN_CANONICAL_HOST } from "@/lib/auth-origin";

const publicPaths = ["/login", "/api/auth", "/api/health", "/donate", "/store"];

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

function applyRateLimit(request: NextRequest, pathname: string): NextResponse | null {
  const ip = getClientIp(request);

  if (pathname.startsWith("/api/installer")) {
    const result = rateLimit(`installer:${ip}`, { maxRequests: 10, windowMs: 15 * 60 * 1000 });
    if (!result.success) {
      return NextResponse.json(
        { error: "تم تجاوز الحد المسموح لمسار المثبت. حاول مرة أخرى لاحقاً" },
        { status: 429 },
      );
    }
  }

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

  // The OpenLiteSpeed proxy duplicates request headers such as `Origin` and
  // `X-Forwarded-*` on browser POSTs; Node joins them with ", " and Next's
  // Server-Action origin check then crashes on `new URL(origin)` → 500.
  // Normalize multi-value headers to their first entry before any handling.
  const requestHeaders = new Headers(request.headers);
  for (const name of ["origin", "referer", "x-forwarded-host", "x-forwarded-proto"]) {
    const value = requestHeaders.get(name);
    if (value?.includes(",")) requestHeaders.set(name, value.split(",")[0]?.trim() ?? "");
  }
  const next = () => NextResponse.next({ request: { headers: requestHeaders } });

  // Only the canonical apex host is trusted; www (served by the same vhost)
  // would otherwise reach the app but fail every /api/auth call.
  const requestHost = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "";
  if (requestHost.toLowerCase() === `www.${SCHOOL_SCREEN_CANONICAL_HOST}`) {
    return NextResponse.redirect(
      new URL(`https://${SCHOOL_SCREEN_CANONICAL_HOST}${pathname}${request.nextUrl.search}`),
      308,
    );
  }

  if (pathname.startsWith("/api/auth") && !isCanonicalAuthRequestHost(requestHeaders)) {
    return NextResponse.json({ error: "المضيف غير موثوق" }, { status: 400 });
  }

  if (pathname.startsWith("/api/installer")) {
    const rateLimitResponse = applyRateLimit(request, pathname);
    if (rateLimitResponse) return rateLimitResponse;
    return next();
  }

  if (publicPaths.some((p) => pathname.startsWith(p))) {
    return next();
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

    return next();
  }

  if (!sessionToken) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
