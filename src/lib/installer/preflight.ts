/**
 * W01 INST-002 — فحوص Node وservices وموارد قراءة فقط، بلا كتابة في البنية.
 */
import { access, constants, statfs } from "node:fs/promises";
import { availableParallelism, freemem, totalmem } from "node:os";
import { prisma } from "@/lib/db";
import type { ComponentCheck } from "@/lib/platform/contracts";
import { getRuntimeConfig, getRuntimeConfigurationSummary } from "@/lib/platform/runtime-config";

type PreflightReport = {
  generatedAt: string;
  release: ReturnType<typeof getRuntimeConfigurationSummary>["release"];
  edition: ReturnType<typeof getRuntimeConfigurationSummary>["edition"];
  checks: ComponentCheck[];
  ready: boolean;
};

export type PreflightDependencies = {
  database?: () => Promise<void>;
  redis?: () => Promise<void>;
  disk?: () => Promise<{ available: number; total: number }>;
  memory?: () => { available: number; total: number };
  cpuCount?: () => number;
  permissions?: () => Promise<void>;
};

function nodeMajorVersion(): number {
  return Number(process.versions.node.split(".")[0]);
}

async function checkDatabase(databaseUrl: string | undefined, required: boolean, probe?: () => Promise<void>): Promise<ComponentCheck> {
  if (!databaseUrl) return { name: "database", required, status: "NOT_CONFIGURED", summary: "DATABASE_URL is not configured." };
  const startedAt = Date.now();
  try {
    await (probe ?? (async () => {
      await prisma.$queryRaw`SELECT 1`;
    }))();
    return { name: "database", required, status: "HEALTHY", summary: "Database connection verified.", latencyMs: Date.now() - startedAt };
  } catch {
    return { name: "database", required, status: "UNAVAILABLE", summary: "Database connection probe failed.", latencyMs: Date.now() - startedAt };
  }
}

async function checkRedis(redisUrl: string | undefined, probe?: () => Promise<void>): Promise<ComponentCheck> {
  if (!redisUrl) return { name: "redis", required: false, status: "NOT_CONFIGURED", summary: "REDIS_URL is not configured." };
  const startedAt = Date.now();
  try {
    await (probe ?? (async () => {
      const { getRedis } = await import("@/lib/redis");
      await getRedis().ping();
    }))();
    return { name: "redis", required: false, status: "HEALTHY", summary: "Redis connection verified.", latencyMs: Date.now() - startedAt };
  } catch {
    return { name: "redis", required: false, status: "DEGRADED", summary: "Redis connection probe failed.", latencyMs: Date.now() - startedAt };
  }
}

export async function collectPreflightReport(
  environment: Record<string, string | undefined> = process.env,
  dependencies: PreflightDependencies = {},
): Promise<PreflightReport> {
  const config = getRuntimeConfig(environment);
  const summary = getRuntimeConfigurationSummary(environment);
  const disk = dependencies.disk
    ? await dependencies.disk()
    : await statfs(process.cwd()).then((stats) => ({ available: Number(stats.bavail) * Number(stats.bsize), total: Number(stats.blocks) * Number(stats.bsize) }));
  const diskAvailable = disk.available;
  const diskTotal = disk.total;
  const memory = dependencies.memory ?? (() => ({ available: freemem(), total: totalmem() }));
  const memoryValues = memory();
  const memoryRatio = memoryValues.total === 0 ? 0 : memoryValues.available / memoryValues.total;
  const cpuCount = dependencies.cpuCount ?? availableParallelism;
  const storageConfigured = summary.dependencies.storage;
  const checks: ComponentCheck[] = [
    {
      name: "node",
      required: true,
      status: nodeMajorVersion() >= 20 ? "HEALTHY" : "UNAVAILABLE",
      summary: nodeMajorVersion() >= 20 ? `Node.js ${process.versions.node} is supported.` : "Node.js 20 or later is required.",
    },
    await checkDatabase(config.DATABASE_URL, true, dependencies.database),
    await checkRedis(config.REDIS_URL, dependencies.redis),
    {
      name: "storage",
      required: config.NODE_ENV === "production",
      status: storageConfigured ? "DEGRADED" : "NOT_CONFIGURED",
      summary: storageConfigured ? "Storage is configured; provider connectivity must be verified by provider-specific tooling." : "Storage provider is not configured.",
    },
    {
      name: "tls",
      required: config.NODE_ENV === "production",
      status: config.ASAS_PUBLIC_URL?.startsWith("https://") ? "HEALTHY" : "NOT_CONFIGURED",
      summary: config.ASAS_PUBLIC_URL?.startsWith("https://") ? "HTTPS public URL is configured." : "HTTPS public URL is not configured.",
    },
    {
      name: "disk",
      required: true,
      status: diskTotal > 0 && diskAvailable / diskTotal >= 0.1 ? "HEALTHY" : "DEGRADED",
      summary: "Disk capacity inspected read-only.",
    },
    {
      name: "memory",
      required: true,
      status: memoryRatio >= 0.1 ? "HEALTHY" : "DEGRADED",
      summary: "Memory capacity inspected read-only.",
    },
    {
      name: "cpu",
      required: true,
      status: cpuCount() >= 1 ? "HEALTHY" : "UNAVAILABLE",
      summary: `${cpuCount()} CPU execution slots available.`,
    },
    {
      name: "permissions",
      required: true,
      status: "HEALTHY",
      summary: "Application directory permissions verified.",
    },
    {
      name: "queue",
      required: false,
      status: config.REDIS_URL ? "DEGRADED" : "NOT_CONFIGURED",
      summary: config.REDIS_URL ? "Queue is configured; worker heartbeat must be verified separately." : "Durable queue is not configured.",
    },
    { name: "scheduler", required: false, status: "NOT_CONFIGURED", summary: "No scheduler adapter is configured." },
    { name: "egress", required: false, status: "NOT_CONFIGURED", summary: "No explicit egress probe is configured." },
  ];

  try {
    await (dependencies.permissions ?? (() => access(process.cwd(), constants.R_OK | constants.W_OK)))();
  } catch {
    const permissions = checks.find((check) => check.name === "permissions");
    if (permissions) {
      permissions.status = "UNAVAILABLE";
      permissions.summary = "Application directory read/write access is unavailable.";
    }
  }

  const ready = checks.every((check) => !check.required || check.status === "HEALTHY");
  return { generatedAt: new Date().toISOString(), release: summary.release, edition: summary.edition, checks, ready };
}
