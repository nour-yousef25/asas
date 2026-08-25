import { createHash } from "node:crypto";
import { z } from "zod";

export class DomainSchedulerError extends Error {
  constructor(public readonly code: "CATALOGUE_DENIED" | "JOB_PAUSED" | "JOB_TIMEOUT" | "EXECUTOR_DENIED" | "CONCURRENCY_DENIED") { super(`SCHEDULER_${code}`); }
}

export const schedulerJobSchema = z.object({ key: z.string().regex(/^[a-z][a-z0-9_.-]{2,100}$/), owner: z.string().trim().min(3).max(120), version: z.string().regex(/^\d+\.\d+\.\d+$/), category: z.enum(["PLATFORM", "TENANT", "SYSTEM_MAINTENANCE", "FINANCIAL", "NOTIFICATIONS", "RETENTION", "REPORTS"]), tenantMode: z.enum(["TENANT", "SYSTEM"]), intervalSeconds: z.number().int().min(60).max(86_400), timeoutSeconds: z.number().int().min(5).max(900), retryLimit: z.number().int().min(0).max(5), concurrency: z.number().int().min(1).max(16), failureBehavior: z.enum(["RETRY", "PAUSE", "DLQ", "ALERT"]), auditRequired: z.boolean(), safeAtLaunch: z.boolean(), approved: z.boolean(), paused: z.boolean().default(false) });
export type SchedulerJob = z.infer<typeof schedulerJobSchema>;
export type SchedulerCatalogue = Readonly<{ schemaVersion: 1; jobs: readonly SchedulerJob[] }>;
export type SchedulerRun = Readonly<{ jobKey: string; organizationId?: string; scheduledFor: Date; idempotencyKey: string; attempt: number }>;
export type SchedulerExecutor = Readonly<{ execute(run: SchedulerRun, timeoutMs: number): Promise<void> }>;
export type SchedulerRunStore = Readonly<{ has(idempotencyKey: string): Promise<boolean>; acquire(run: SchedulerRun, concurrency: number): Promise<boolean>; release(run: SchedulerRun): Promise<void>; record(run: SchedulerRun, outcome: "SUCCEEDED" | "FAILED" | "PAUSED"): Promise<void>; heartbeat(at: Date): Promise<void> }>;

export function parseSchedulerCatalogue(input: unknown): SchedulerCatalogue {
  const catalogue = z.object({ schemaVersion: z.literal(1), jobs: z.array(schedulerJobSchema).min(1) }).parse(input);
  const keys = new Set<string>();
  for (const job of catalogue.jobs) { if (!job.approved || keys.has(job.key)) throw new DomainSchedulerError("CATALOGUE_DENIED"); keys.add(job.key); }
  return catalogue;
}
function idempotencyKey(jobKey: string, organizationId: string | undefined, scheduledFor: Date) { return createHash("sha256").update(`${jobKey}:${organizationId ?? "system"}:${scheduledFor.toISOString()}`).digest("base64url"); }

export class DomainScheduler {
  constructor(private readonly catalogue: SchedulerCatalogue, private readonly store: SchedulerRunStore, private readonly executor?: SchedulerExecutor, private readonly now: () => Date = () => new Date()) {}
  async run(input: Readonly<{ jobKey: string; organizationId?: string; scheduledFor: Date; dryRun: boolean }>) {
    const job = this.catalogue.jobs.find((entry) => entry.key === input.jobKey);
    if (!job) throw new DomainSchedulerError("CATALOGUE_DENIED");
    if (job.tenantMode === "TENANT" && !input.organizationId) throw new DomainSchedulerError("EXECUTOR_DENIED");
    const run: SchedulerRun = { jobKey: job.key, organizationId: input.organizationId, scheduledFor: input.scheduledFor, idempotencyKey: idempotencyKey(job.key, input.organizationId, input.scheduledFor), attempt: 1 };
    if (input.dryRun) return { run, outcome: "DRY_RUN" as const };
    if (job.paused) { await this.store.record(run, "PAUSED"); return { run, outcome: "PAUSED" as const }; }
    if (await this.store.has(run.idempotencyKey)) return { run, outcome: "DUPLICATE" as const };
    if (!this.executor) throw new DomainSchedulerError("EXECUTOR_DENIED");
    if (!(await this.store.acquire(run, job.concurrency))) throw new DomainSchedulerError("CONCURRENCY_DENIED");
    try {
      for (let attempt = 1; attempt <= job.retryLimit + 1; attempt += 1) {
        const retryRun = { ...run, attempt };
        try { await this.executor.execute(retryRun, job.timeoutSeconds * 1000); await this.store.record(retryRun, "SUCCEEDED"); await this.store.heartbeat(this.now()); return { run: retryRun, outcome: "SUCCEEDED" as const }; }
        catch { if (attempt === job.retryLimit + 1) { await this.store.record(retryRun, "FAILED"); throw new DomainSchedulerError("JOB_TIMEOUT"); } }
      }
      throw new DomainSchedulerError("JOB_TIMEOUT");
    } finally { await this.store.release(run); }
  }
}

export class MemorySchedulerRunStore implements SchedulerRunStore {
  readonly records: Array<{ run: SchedulerRun; outcome: "SUCCEEDED" | "FAILED" | "PAUSED" }> = [];
  private readonly active = new Map<string, number>();
  heartbeatAt?: Date;
  async has(idempotency: string) { return this.records.some(({ run }) => run.idempotencyKey === idempotency); }
  async acquire(run: SchedulerRun, concurrency: number) { const key = `${run.jobKey}:${run.organizationId ?? "system"}`; const active = this.active.get(key) ?? 0; if (active >= concurrency) return false; this.active.set(key, active + 1); return true; }
  async release(run: SchedulerRun) { const key = `${run.jobKey}:${run.organizationId ?? "system"}`; const active = this.active.get(key) ?? 0; if (active <= 1) this.active.delete(key); else this.active.set(key, active - 1); }
  async record(run: SchedulerRun, outcome: "SUCCEEDED" | "FAILED" | "PAUSED") { this.records.push({ run, outcome }); }
  async heartbeat(at: Date) { this.heartbeatAt = at; }
}
