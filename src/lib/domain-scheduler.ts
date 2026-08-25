import { createHash } from "node:crypto";
import { z } from "zod";

export class DomainSchedulerError extends Error {
  constructor(public readonly code: "CATALOGUE_DENIED" | "JOB_PAUSED" | "JOB_TIMEOUT" | "EXECUTOR_DENIED" | "CONCURRENCY_DENIED") { super(`SCHEDULER_${code}`); }
}

function isIanaTimezone(value: string) {
  try { Intl.DateTimeFormat("en-US", { timeZone: value }); return true; } catch { return false; }
}

export const schedulerJobSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_.-]{2,100}$/),
  purpose: z.string().trim().min(8).max(240),
  owner: z.string().trim().min(3).max(120),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  category: z.enum(["PLATFORM", "TENANT", "SYSTEM_MAINTENANCE", "FINANCIAL", "NOTIFICATIONS", "RETENTION", "REPORTS"]),
  tenantMode: z.enum(["TENANT", "SYSTEM"]),
  intervalSeconds: z.number().int().min(60).max(86_400),
  timezone: z.string().min(1).max(120).refine(isIanaTimezone),
  inputContract: z.string().trim().min(3).max(240),
  outputContract: z.string().trim().min(3).max(240),
  sideEffectClass: z.enum(["NONE", "INTERNAL_TENANT", "EXTERNAL"]),
  externalDependencies: z.array(z.string().trim().min(3).max(160)).max(16).default([]),
  timeoutSeconds: z.number().int().min(5).max(900),
  retryLimit: z.number().int().min(0).max(5),
  concurrency: z.number().int().min(1).max(16),
  failureBehavior: z.enum(["RETRY", "PAUSE", "DLQ", "ALERT"]),
  auditRequired: z.literal(true),
  safeAtLaunch: z.boolean(),
  approved: z.literal(true),
  enabled: z.boolean().default(false),
  paused: z.boolean().default(false),
});
export type SchedulerJob = z.infer<typeof schedulerJobSchema>;
export type SchedulerCatalogue = Readonly<{ schemaVersion: 1; jobs: readonly SchedulerJob[] }>;
export type SchedulerRun = Readonly<{ jobKey: string; organizationId?: string; scheduledFor: Date; idempotencyKey: string; attempt: number }>;
export type SchedulerExecutor = Readonly<{ execute(run: SchedulerRun, timeoutMs: number): Promise<void> }>;
export type SchedulerRunStore = Readonly<{ has(idempotencyKey: string): Promise<boolean>; acquire(run: SchedulerRun, concurrency: number): Promise<boolean>; release(run: SchedulerRun): Promise<void>; isPaused(jobKey: string): Promise<boolean>; pause(jobKey: string): Promise<void>; record(run: SchedulerRun, outcome: "SUCCEEDED" | "FAILED" | "PAUSED"): Promise<void>; heartbeat(at: Date): Promise<void> }>;

export function parseSchedulerCatalogue(input: unknown): SchedulerCatalogue {
  const catalogue = z.object({ schemaVersion: z.literal(1), jobs: z.array(schedulerJobSchema).min(1) }).parse(input);
  const keys = new Set<string>();
  for (const job of catalogue.jobs) { if (!job.approved || keys.has(job.key)) throw new DomainSchedulerError("CATALOGUE_DENIED"); keys.add(job.key); }
  return catalogue;
}
function idempotencyKey(jobKey: string, organizationId: string | undefined, scheduledFor: Date) { return createHash("sha256").update(`${jobKey}:${organizationId ?? "system"}:${scheduledFor.toISOString()}`).digest("base64url"); }
function assertScheduledSlot(job: SchedulerJob, scheduledFor: Date) {
  if (!Number.isFinite(scheduledFor.getTime()) || scheduledFor.getMilliseconds() !== 0 || Math.floor(scheduledFor.getTime() / 1_000) % job.intervalSeconds !== 0) throw new DomainSchedulerError("CATALOGUE_DENIED");
}
function schedulerTimeout(timeoutMs: number) {
  let timer: NodeJS.Timeout | undefined;
  const promise = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new DomainSchedulerError("JOB_TIMEOUT")), timeoutMs); });
  return { promise, clear: () => { if (timer) clearTimeout(timer); } };
}

export class DomainScheduler {
  constructor(private readonly catalogue: SchedulerCatalogue, private readonly store: SchedulerRunStore, private readonly executor?: SchedulerExecutor, private readonly now: () => Date = () => new Date()) {}
  async run(input: Readonly<{ jobKey: string; organizationId?: string; scheduledFor: Date; dryRun: boolean }>) {
    const job = this.catalogue.jobs.find((entry) => entry.key === input.jobKey);
    if (!job) throw new DomainSchedulerError("CATALOGUE_DENIED");
    if (job.tenantMode === "TENANT" && !input.organizationId) throw new DomainSchedulerError("EXECUTOR_DENIED");
    if (input.organizationId && !/^[A-Za-z0-9_-]{12,160}$/.test(input.organizationId)) throw new DomainSchedulerError("EXECUTOR_DENIED");
    assertScheduledSlot(job, input.scheduledFor);
    const run: SchedulerRun = { jobKey: job.key, organizationId: input.organizationId, scheduledFor: input.scheduledFor, idempotencyKey: idempotencyKey(job.key, input.organizationId, input.scheduledFor), attempt: 1 };
    if (input.dryRun) return { run, outcome: "DRY_RUN" as const };
    if (!job.enabled || job.paused || await this.store.isPaused(job.key)) { await this.store.record(run, "PAUSED"); return { run, outcome: "PAUSED" as const }; }
    if (await this.store.has(run.idempotencyKey)) return { run, outcome: "DUPLICATE" as const };
    if (!this.executor) throw new DomainSchedulerError("EXECUTOR_DENIED");
    if (!(await this.store.acquire(run, job.concurrency))) throw new DomainSchedulerError("CONCURRENCY_DENIED");
    try {
      for (let attempt = 1; attempt <= job.retryLimit + 1; attempt += 1) {
        const retryRun = { ...run, attempt };
        const timeout = schedulerTimeout(job.timeoutSeconds * 1_000);
        try { await Promise.race([this.executor.execute(retryRun, job.timeoutSeconds * 1_000), timeout.promise]); await this.store.record(retryRun, "SUCCEEDED"); await this.store.heartbeat(this.now()); return { run: retryRun, outcome: "SUCCEEDED" as const }; }
        catch {
          if (attempt === job.retryLimit + 1) {
            if (job.failureBehavior === "PAUSE") { await this.store.pause(job.key); await this.store.record(retryRun, "PAUSED"); return { run: retryRun, outcome: "PAUSED" as const }; }
            await this.store.record(retryRun, "FAILED");
            throw new DomainSchedulerError("JOB_TIMEOUT");
          }
        } finally { timeout.clear(); }
      }
      throw new DomainSchedulerError("JOB_TIMEOUT");
    } finally { await this.store.release(run); }
  }
}

export class MemorySchedulerRunStore implements SchedulerRunStore {
  readonly records: Array<{ run: SchedulerRun; outcome: "SUCCEEDED" | "FAILED" | "PAUSED" }> = [];
  private readonly active = new Map<string, number>();
  private readonly paused = new Set<string>();
  heartbeatAt?: Date;
  async has(idempotency: string) { return this.records.some(({ run }) => run.idempotencyKey === idempotency); }
  async acquire(run: SchedulerRun, concurrency: number) { const key = `${run.jobKey}:${run.organizationId ?? "system"}`; const active = this.active.get(key) ?? 0; if (active >= concurrency) return false; this.active.set(key, active + 1); return true; }
  async release(run: SchedulerRun) { const key = `${run.jobKey}:${run.organizationId ?? "system"}`; const active = this.active.get(key) ?? 0; if (active <= 1) this.active.delete(key); else this.active.set(key, active - 1); }
  async isPaused(jobKey: string) { return this.paused.has(jobKey); }
  async pause(jobKey: string) { this.paused.add(jobKey); }
  async record(run: SchedulerRun, outcome: "SUCCEEDED" | "FAILED" | "PAUSED") { this.records.push({ run, outcome }); }
  async heartbeat(at: Date) { this.heartbeatAt = at; }
}
