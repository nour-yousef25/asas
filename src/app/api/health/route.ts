import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";
import { collectHealthReport } from "@/lib/health/health-service";
import { verifyBackupManifest } from "@/lib/lifecycle/backup";
import { healthHttpStatus } from "@/lib/platform/contracts";
import { withCorrelationId } from "@/lib/observability/correlation";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

function hasHealthAuthorization(request: NextRequest) {
  const expected = process.env.ASAS_HEALTH_TOKEN;
  const actual = request.headers.get("x-asas-health-token");
  if (!expected || !actual) return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(actual);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function GET(request: NextRequest) {
  if (!hasHealthAuthorization(request)) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401, headers: { "cache-control": "no-store" } });
  }
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
        storage: async () => {
          const probeUrl = process.env.ASAS_PREFLIGHT_STORAGE_PROBE_URL;
          if (!probeUrl) throw new Error("Storage probe URL is not configured.");
          const response = await fetch(probeUrl, { method: "GET", signal: AbortSignal.timeout(5_000) });
          if (!response.ok) throw new Error(`Storage probe failed with ${response.status}.`);
        },
        backup: async () => {
          const manifestPath = process.env.ASAS_BACKUP_MANIFEST_PATH;
          if (!manifestPath) throw new Error("Backup manifest path is not configured.");
          verifyBackupManifest(JSON.parse(await readFile(manifestPath, "utf8")));
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
