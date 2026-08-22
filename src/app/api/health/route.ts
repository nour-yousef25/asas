import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { collectHealthReport } from "@/lib/health/health-service";
import { healthHttpStatus } from "@/lib/platform/contracts";
import { withCorrelationId } from "@/lib/observability/correlation";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const correlationId = request.headers.get("x-correlation-id") ?? crypto.randomUUID();
  try {
    const report = await withCorrelationId(correlationId, () =>
      collectHealthReport({
        database: async () => {
          await prisma.$queryRaw`SELECT 1`;
        },
        redis: async () => {
          const { getRedis } = await import("@/lib/redis");
          await getRedis().ping();
        },
        workerHeartbeat: async () => {
          if (!process.env.REDIS_URL) return false;
          const { getRedis } = await import("@/lib/redis");
          return Boolean(await getRedis().get("asas:health:worker:communications"));
        },
      }),
    );

    logger.info("Health report collected", { status: report.status });
    return NextResponse.json(report, {
      status: healthHttpStatus(report.status),
      headers: { "x-correlation-id": correlationId, "cache-control": "no-store" },
    });
  } catch {
    logger.error("Health report collection failed");
    return NextResponse.json(
      { status: "UNAVAILABLE", timestamp: new Date().toISOString(), checks: [] },
      { status: 503, headers: { "x-correlation-id": correlationId, "cache-control": "no-store" } },
    );
  }
}
