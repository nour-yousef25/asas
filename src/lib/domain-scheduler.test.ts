import { DomainScheduler, DomainSchedulerError, MemorySchedulerRunStore, parseSchedulerCatalogue } from "@/lib/domain-scheduler";

const job = { key: "audit.tenant", purpose: "Perform a bounded tenant-local scheduler audit.", owner: "Platform Operations", version: "1.0.0", category: "TENANT" as const, tenantMode: "TENANT" as const, intervalSeconds: 300, timezone: "Asia/Riyadh", inputContract: "Tenant context and scheduled timestamp.", outputContract: "Redacted audit outcome only.", sideEffectClass: "NONE" as const, externalDependencies: [], timeoutSeconds: 5, retryLimit: 1, concurrency: 1, failureBehavior: "RETRY" as const, auditRequired: true as const, safeAtLaunch: true, approved: true as const, enabled: true, paused: false };
const scheduledFor = new Date("2026-08-25T12:00:00.000Z");
const input = { jobKey: job.key, organizationId: "org_123456789012", scheduledFor };

describe("Domain Scheduler bounded contract", () => {
  it("requires catalogue purpose, IANA timezone, audit, approval and explicit enablement", () => {
    expect(parseSchedulerCatalogue({ schemaVersion: 1, jobs: [job] }).jobs[0].timezone).toBe("Asia/Riyadh");
    expect(() => parseSchedulerCatalogue({ schemaVersion: 1, jobs: [{ ...job, timezone: "Mars/Phobos" }] })).toThrow();
    expect(() => parseSchedulerCatalogue({ schemaVersion: 1, jobs: [{ ...job, auditRequired: false }] })).toThrow();
    expect(() => parseSchedulerCatalogue({ schemaVersion: 1, jobs: [{ ...job, approved: false }] })).toThrow();
  });

  it("keeps dry-run side-effect free and derives an organization-scoped idempotency key", async () => {
    const execute = jest.fn();
    const scheduler = new DomainScheduler(parseSchedulerCatalogue({ schemaVersion: 1, jobs: [job] }), new MemorySchedulerRunStore(), { execute });
    const result = await scheduler.run({ ...input, dryRun: true });
    expect(result.outcome).toBe("DRY_RUN");
    expect(result.run.idempotencyKey).toHaveLength(43);
    expect(execute).not.toHaveBeenCalled();
  });

  it("bounds retries, pauses after a PAUSE failure policy, and releases concurrency", async () => {
    const store = new MemorySchedulerRunStore();
    const execute = jest.fn().mockRejectedValue(new Error("contained failure"));
    const scheduler = new DomainScheduler(parseSchedulerCatalogue({ schemaVersion: 1, jobs: [{ ...job, retryLimit: 1, failureBehavior: "PAUSE" }] }), store, { execute });
    await expect(scheduler.run({ ...input, dryRun: false })).resolves.toMatchObject({ outcome: "PAUSED" });
    expect(execute).toHaveBeenCalledTimes(2);
    await expect(scheduler.run({ ...input, scheduledFor: new Date("2026-08-25T12:05:00.000Z"), dryRun: false })).resolves.toMatchObject({ outcome: "PAUSED" });
  });

  it("rejects concurrent runs for the same tenant/job and malformed tenant scope", async () => {
    let resolveExecution: (() => void) | undefined;
    const execute = jest.fn(() => new Promise<void>((resolve) => { resolveExecution = resolve; }));
    const scheduler = new DomainScheduler(parseSchedulerCatalogue({ schemaVersion: 1, jobs: [job] }), new MemorySchedulerRunStore(), { execute });
    const first = scheduler.run({ ...input, dryRun: false });
    await Promise.resolve();
    await expect(scheduler.run({ ...input, scheduledFor: new Date("2026-08-25T12:05:00.000Z"), dryRun: false })).rejects.toMatchObject({ code: "CONCURRENCY_DENIED" });
    resolveExecution?.();
    await expect(first).resolves.toMatchObject({ outcome: "SUCCEEDED" });
    await expect(scheduler.run({ ...input, organizationId: "bad", dryRun: true })).rejects.toMatchObject({ code: "EXECUTOR_DENIED" });
  });
});
