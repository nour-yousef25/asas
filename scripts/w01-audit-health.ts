import { readFile } from "node:fs/promises";
import { prisma } from "@/lib/db";
import { collectHealthReport } from "@/lib/health/health-service";
import { verifyBackupManifest } from "@/lib/lifecycle/backup";
import { closeRedis, getRedis } from "@/lib/redis";

async function main() {
  const standardLog = console.log;
  console.log = (...values: unknown[]) => console.error(...values);
  try {
    const report = await collectHealthReport({
      database: async () => prisma.$queryRaw`SELECT 1`.then(() => undefined),
      redis: async () => getRedis().ping().then(() => undefined),
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
      workerHeartbeat: async () => Boolean(await getRedis().get("asas:health:worker:communications")),
    });
    standardLog(JSON.stringify(report, null, 2));
  } finally {
    console.log = standardLog;
    await closeRedis();
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
