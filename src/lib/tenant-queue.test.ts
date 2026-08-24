import { readFileSync } from "node:fs";

describe("W02 tenant queue cutover guard", () => {
  it("requires a trusted tenant envelope, namespaced keys, and a fail-closed provider", () => {
    const source = readFileSync("src/lib/tenant-queue.ts", "utf8");
    expect(source).toMatch(/TenantQueueConnectionProvider/);
    expect(source).toMatch(/TENANT_QUEUE_PROVIDER_UNCONFIGURED/);
    expect(source).toMatch(/publicationQueueName/);
    expect(source).toMatch(/tenantCacheKey/);
    expect(source).toMatch(/validateEnvelope/);
    expect(source).toMatch(/evaluatePermission/);
    expect(source).toMatch(/TenantBoundPrismaExecutor/);
    expect(source).not.toMatch(/process\.env\.REDIS_URL|from "@\/lib\/redis"|from "@\/lib\/db"|current_setting|set_config|activeOrganizationId|organizationMemberships\[0\]/);
  });

  it("quarantines legacy global producers and workers", () => {
    const queue = readFileSync("src/lib/queue.ts", "utf8");
    const sms = readFileSync("src/app/api/sms/route.ts", "utf8");
    const worker = readFileSync("src/workers/communications-worker.ts", "utf8");
    expect(queue).toMatch(/QUEUE_LEGACY_SURFACE_QUARANTINED/);
    expect(queue).not.toMatch(/class InMemoryQueue|new Queue<|new Worker<|process\.env\.REDIS_URL|from "@\/lib\/db"/);
    expect(sms).toMatch(/QUEUE_LEGACY_SURFACE_QUARANTINED/);
    expect(sms).not.toMatch(/from "@\/lib\/db"|smsQueue\.add|auth\(/);
    expect(worker).toMatch(/QUEUE_LEGACY_WORKER_QUARANTINED/);
  });

  it("keeps publication producer and publisher on trusted tenant authority", () => {
    const route = readFileSync("src/app/api/communications/plans/route.ts", "utf8");
    const publisher = readFileSync("src/lib/communications/publisher.ts", "utf8");
    expect(route).toMatch(/requireTenantContext\(\)/);
    expect(route).toMatch(/requirePermission\(context, PUBLICATION_DISPATCH_PERMISSION\)/);
    expect(route).toMatch(/enqueuePublication/);
    expect(route).not.toMatch(/from "@\/lib\/db"|publicationQueue\.add|hasDurableQueue/);
    expect(publisher).toMatch(/requireTenantBoundPrismaExecutor/);
    expect(publisher).toMatch(/organizationId: input\.context\.organizationId/);
    expect(publisher).not.toMatch(/from "@\/lib\/db"|\bprisma\./);
  });
});
