/**
 * W01 HEALTH-001 — خدمة صحة موحدة وآمنة لا تكشف الأسرار أو بيانات الجمعيات.
 */
import { statfs } from "node:fs/promises";
import { availableParallelism, freemem, totalmem } from "node:os";
import { getBackupPolicy } from "@/lib/lifecycle/backup";
import {
  deriveOverallHealth,
  type ComponentCheck,
  type OverallHealthStatus,
} from "@/lib/platform/contracts";
import { getRuntimeConfig, getRuntimeConfigurationSummary, type RuntimeConfig } from "@/lib/platform/runtime-config";

export type HealthDependencies = {
  database: () => Promise<void>;
  redis: () => Promise<void>;
  storage?: () => Promise<void>;
  backup?: () => Promise<void>;
  workerHeartbeat?: () => Promise<boolean>;
  license?: () => Promise<void>;
  scheduler?: () => Promise<void>;
  now?: () => Date;
  disk?: () => Promise<{ available: number; total: number }>;
  memory?: () => { available: number; total: number };
  cpuCount?: () => number;
};

export type HealthReport = {
  status: OverallHealthStatus;
  timestamp: string;
  release: ReturnType<typeof getRuntimeConfigurationSummary>["release"];
  runtime: {
    edition: ReturnType<typeof getRuntimeConfigurationSummary>["edition"];
    instanceRole: ReturnType<typeof getRuntimeConfigurationSummary>["instanceRole"];
    cpuCount: number;
  };
  checks: ComponentCheck[];
};

async function measuredCheck(
  name: string,
  required: boolean,
  summary: string,
  check: () => Promise<void>,
): Promise<ComponentCheck> {
  const startedAt = Date.now();
  try {
    await check();
    return { name, required, status: "HEALTHY", summary, latencyMs: Date.now() - startedAt };
  } catch {
    return {
      name,
      required,
      status: required ? "UNAVAILABLE" : "DEGRADED",
      summary: "Dependency probe failed.",
      latencyMs: Date.now() - startedAt,
    };
  }
}

async function systemDisk(): Promise<{ available: number; total: number }> {
  const stats = await statfs(process.cwd());
  return { available: Number(stats.bavail) * Number(stats.bsize), total: Number(stats.blocks) * Number(stats.bsize) };
}

function resourceCheck(
  name: string,
  required: boolean,
  resource: { available: number; total: number },
): ComponentCheck {
  const availableRatio = resource.total === 0 ? 0 : resource.available / resource.total;
  return {
    name,
    required,
    status: availableRatio < 0.1 ? "DEGRADED" : "HEALTHY",
    summary: availableRatio < 0.1 ? "Available capacity is below 10%." : "Available capacity is within threshold.",
  };
}

export async function collectHealthReport(
  dependencies: HealthDependencies,
  environment: Record<string, string | undefined> = process.env,
): Promise<HealthReport> {
  const config: RuntimeConfig = getRuntimeConfig(environment);
  const summary = getRuntimeConfigurationSummary(environment);
  const now = dependencies.now ?? (() => new Date());
  const disk = dependencies.disk ?? systemDisk;
  const memory = dependencies.memory ?? (() => ({ available: freemem(), total: totalmem() }));
  const cpuCount = dependencies.cpuCount ?? availableParallelism;
  const workerEnabled = config.ASAS_INSTANCE_ROLE === "WORKER" || config.ASAS_INSTANCE_ROLE === "ALL";
  const workerHeartbeatCurrent = workerEnabled ? (await dependencies.workerHeartbeat?.()) ?? false : false;
  const checks: ComponentCheck[] = [
    { name: "application", required: true, status: "HEALTHY", summary: "Application process is responding." },
    await measuredCheck("database", true, "Database connection verified.", dependencies.database),
  ];

  if (config.REDIS_URL) {
    const redisCheck = await measuredCheck("redis", false, "Redis connection verified.", dependencies.redis);
    checks.push(redisCheck, {
      name: "queue",
      required: false,
      status: redisCheck.status === "HEALTHY" ? "HEALTHY" : "DEGRADED",
      summary: redisCheck.status === "HEALTHY" ? "Durable queue connection is available." : "Durable queue depends on Redis availability.",
    });
  } else {
    checks.push(
      { name: "redis", required: false, status: "NOT_CONFIGURED", summary: "REDIS_URL is not configured." },
      { name: "queue", required: false, status: "NOT_CONFIGURED", summary: "Durable queue is not configured." },
    );
  }

  const storageConfigured = summary.dependencies.storage;
  if (!storageConfigured) {
    checks.push({ name: "storage", required: config.NODE_ENV === "production", status: "NOT_CONFIGURED", summary: "Storage provider is not configured." });
  } else if (dependencies.storage) {
    checks.push(await measuredCheck("storage", config.NODE_ENV === "production", "Storage provider read-only probe verified.", dependencies.storage));
  } else {
    checks.push({ name: "storage", required: config.NODE_ENV === "production", status: "DEGRADED", summary: "Storage credentials are configured but no runtime provider probe is available." });
  }

  const backupPolicy = getBackupPolicy(config.ASAS_EDITION, environment);
  const lastVerified = environment.ASAS_BACKUP_LAST_VERIFIED_AT;
  if (dependencies.backup) {
    checks.push(await measuredCheck("backup", false, `Verified backup manifest is available; retention is ${backupPolicy.retentionDays} days.`, dependencies.backup));
  } else {
    checks.push({
      name: "backup",
      required: false,
      status: lastVerified ? "HEALTHY" : "DEGRADED",
      summary: lastVerified
        ? `A verified backup evidence timestamp is configured; retention is ${backupPolicy.retentionDays} days.`
        : "No verified backup evidence is configured; updates must remain blocked until verification.",
    });
  }

  const schedulerConfigured = Boolean(environment.ASAS_SCHEDULER_HEARTBEAT_PATH && environment.ASAS_SCHEDULER_MAX_LAG_SECONDS);
  checks.push(
    {
      name: "worker",
      required: false,
      status: workerEnabled ? (workerHeartbeatCurrent ? "HEALTHY" : "DEGRADED") : "NOT_CONFIGURED",
      summary:
        workerEnabled
          ? workerHeartbeatCurrent
            ? "Worker heartbeat is current."
            : "Worker role is enabled but no current heartbeat was found."
          : "Worker role is not enabled for this runtime.",
    },
    { name: "mail", required: false, status: "NOT_CONFIGURED", summary: "Mail transport contract is installed but no external transport is configured." },
    { name: "integrations", required: false, status: "NOT_CONFIGURED", summary: "Payment/IdP provider-neutral contracts are installed but no external provider is configured." },
    {
      name: "security",
      required: config.NODE_ENV === "production",
      status:
        config.NODE_ENV !== "production" || (Boolean(config.AUTH_SECRET) && Boolean(config.INTEGRATIONS_ENCRYPTION_KEY))
          ? "HEALTHY"
          : "DEGRADED",
      summary:
        config.NODE_ENV !== "production" || (Boolean(config.AUTH_SECRET) && Boolean(config.INTEGRATIONS_ENCRYPTION_KEY))
          ? "Required security configuration is present for this runtime."
          : "Production security configuration is incomplete.",
    },
  );

  if (schedulerConfigured && dependencies.scheduler) {
    checks.push(await measuredCheck("scheduler", false, "Approved scheduler heartbeat is within the configured lag limit.", dependencies.scheduler));
  } else if (schedulerConfigured) {
    checks.push({ name: "scheduler", required: false, status: "DEGRADED", summary: "Scheduler heartbeat is configured but no runtime probe is available." });
  } else {
    checks.push({ name: "scheduler", required: false, status: "NOT_CONFIGURED", summary: "No approved scheduler catalogue/heartbeat adapter is configured." });
  }

  const licenseRequired = environment.ASAS_LICENSE_REQUIRED === "true";
  if (licenseRequired && dependencies.license) {
    checks.push(await measuredCheck("license", config.NODE_ENV === "production", "Signed runtime license, instance binding, keyring and revocation set verified.", dependencies.license));
  } else if (licenseRequired) {
    checks.push({ name: "license", required: config.NODE_ENV === "production", status: "UNAVAILABLE", summary: "License is required but no runtime verifier is available." });
  } else {
    checks.push({ name: "license", required: false, status: "NOT_CONFIGURED", summary: "Runtime license enforcement is not enabled for this deployment." });
  }

  try {
    checks.push(resourceCheck("disk", true, await disk()));
  } catch {
    checks.push({ name: "disk", required: true, status: "DEGRADED", summary: "Disk capacity could not be inspected." });
  }
  checks.push(resourceCheck("memory", true, memory()));

  return {
    status: deriveOverallHealth(checks),
    timestamp: now().toISOString(),
    release: summary.release,
    runtime: { edition: summary.edition, instanceRole: summary.instanceRole, cpuCount: cpuCount() },
    checks,
  };
}
