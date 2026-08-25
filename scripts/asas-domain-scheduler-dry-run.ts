import { readFile, stat } from "node:fs/promises";
import process from "node:process";
import { DomainScheduler, MemorySchedulerRunStore, parseSchedulerCatalogue } from "@/lib/domain-scheduler";

async function readRootOwnedManifest(path: string) {
  const details = await stat(path);
  if (!details.isFile() || details.uid !== 0 || (details.mode & 0o077) !== 0) throw new Error("SCHEDULER_MANIFEST_PERMISSION_DENIED");
  return JSON.parse(await readFile(path, "utf8")) as unknown;
}

async function main() {
  const path = process.env.ASAS_DOMAIN_SCHEDULER_CATALOGUE_PATH;
  if (!path) throw new Error("ASAS_DOMAIN_SCHEDULER_CATALOGUE_PATH_REQUIRED");
  const catalogue = parseSchedulerCatalogue(await readRootOwnedManifest(path));
  const organizationId = process.env.ASAS_SCHEDULER_DRY_RUN_ORGANIZATION_ID;
  const scheduler = new DomainScheduler(catalogue, new MemorySchedulerRunStore());
  const scheduledFor = new Date();
  const outcomes = await Promise.all(catalogue.jobs.map(async (job) => {
    if (job.tenantMode === "TENANT" && !organizationId) return { jobKey: job.key, outcome: "TENANT_CONTEXT_REQUIRED" };
    return scheduler.run({ jobKey: job.key, organizationId: job.tenantMode === "TENANT" ? organizationId : undefined, scheduledFor, dryRun: true });
  }));
  console.log(JSON.stringify({ status: "SCHEDULER_DRY_RUN_COMPLETE", catalogueVersion: catalogue.jobs.map((job) => job.version).join(","), outcomes }));
}

main().catch((error: unknown) => {
  console.error(JSON.stringify({ status: "SCHEDULER_DRY_RUN_BLOCKED", reason: error instanceof Error ? error.message : "UNKNOWN" }));
  process.exitCode = 2;
});
