import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const checks: Record<string, { status: string; latency?: number }> = {};
  let overallStatus = "healthy";

  // Database check
  try {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { status: "healthy", latency: Date.now() - start };
  } catch {
    checks.database = { status: "unhealthy" };
    overallStatus = "degraded";
  }

  // Redis check
  try {
    const start = Date.now();
    const { getRedis } = await import("@/lib/redis");
    const redis = getRedis();
    await redis.ping();
    checks.redis = { status: "healthy", latency: Date.now() - start };
  } catch {
    checks.redis = { status: "unavailable" };
  }

  // Storage check
  try {
    checks.storage = {
      status: process.env.S3_ENDPOINT ? "configured" : "not configured",
    };
  } catch {
    checks.storage = { status: "unknown" };
  }

  const response = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "0.1.0",
    uptime: process.uptime(),
    checks,
  };

  const statusCode = overallStatus === "healthy" ? 200 : 503;
  return NextResponse.json(response, { status: statusCode });
}
